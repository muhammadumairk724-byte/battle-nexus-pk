const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/email');
const crypto = require('crypto');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ error: 'All fields except phone are required' });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const userId = await User.create({ username, email, password, fullName, phone });

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const pool = getPool();
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at, type) VALUES (?, ?, ?, "verify")',
      [userId, verifyToken, expiresAt]
    );

    sendVerificationEmail(email, verifyToken).catch(err => {
      console.error('Verification email failed:', err.message);
    });

    await Notification.create(userId, 'Registration Pending', 'You have registered successfully. Please verify your email to log in.');
    const adminRows = await pool.query('SELECT id FROM users WHERE role = "admin"');
    const adminIds = adminRows[0].map(row => row.id);
    for (const adminId of adminIds) {
      await Notification.create(adminId, 'New User Registration', `User ${username} has registered and is pending email verification.`);
    }

    const newUser = await User.findById(userId);
    delete newUser.password_hash;

    res.status(201).json({
      message: 'Registration successful. A verification email has been sent to your address. Please verify before logging in.',
      user: newUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status === 'blocked') return res.status(403).json({ error: 'Your account has been blocked' });

    // ─── SKIP EMAIL VERIFICATION FOR ADMIN ───
    if (!user.email_verified && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Please verify your email address before logging in. Check your inbox (and spam folder) for the verification link.'
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    await getPool().query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const { accessToken, refreshToken } = generateTokens(user.id);
    delete user.password_hash;

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        avatar: user.avatar_url,
        prefs: user.prefs,
        email_verified: user.email_verified,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' });
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const pool = getPool();
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at, type) VALUES (?, ?, ?, "reset")',
      [user.id, token, expiresAt]
    );

    sendPasswordResetEmail(email, token).catch(err => {
      console.error('Failed to send password reset email:', err.message);
    });

    res.json({ message: 'If an account exists with this email and is verified, a reset link has been sent.' });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long, contain 1 uppercase, 1 lowercase, and 1 number.'
      });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT user_id FROM password_reset_tokens WHERE token = ? AND type = "reset" AND expires_at > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const userId = rows[0].user_id;

    await User.changePassword(userId, newPassword);
    await pool.query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);

    await Notification.create(userId, 'Password Reset', 'Your password has been successfully reset.');

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT user_id FROM password_reset_tokens WHERE token = ? AND type = "verify" AND expires_at > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const userId = rows[0].user_id;

    await User.verifyEmail(userId);
    await pool.query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);

    await Notification.create(userId, 'Email Verified', 'Your email has been successfully verified! You can now log in.');

    res.json({ message: 'Email verified successfully. You can now log in.' });

  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};