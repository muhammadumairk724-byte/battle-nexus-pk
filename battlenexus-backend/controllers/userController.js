const User = require('../models/User');
const { getPool } = require('../config/db');
const bcrypt = require('bcryptjs');
const Notification = require('../models/Notification');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password_hash;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, username } = req.body;
    // Validate
    if (fullName && !/^[a-zA-Z\s]{2,50}$/.test(fullName)) {
      return res.status(400).json({ error: 'Full name must be 2-50 letters and spaces' });
    }
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 chars, letters, numbers, underscore' });
    }
    if (phone && !/^(03\d{9}|\+923\d{9})$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Check uniqueness of username if changed
    if (username) {
      const pool = getPool();
      const [existing] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user.id]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    const updateData = {};
    if (fullName) updateData.full_name = fullName;
    if (phone) updateData.phone = phone;
    if (username) updateData.username = username;

    await User.updateProfile(req.user.id, updateData);

    // Send notification
    await Notification.create(req.user.id, 'Profile Updated', 'Your profile details have been updated successfully.');

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      return res.status(400).json({ error: 'New password must be at least 8 chars with uppercase, lowercase and number' });
    }

    const user = await User.findById(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await User.changePassword(req.user.id, newPassword);
    await Notification.create(req.user.id, 'Password Changed', 'Your password has been changed successfully.');

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { prefs } = req.body;
    const pool = getPool();
    await pool.query('UPDATE users SET prefs = ? WHERE id = ?', [JSON.stringify(prefs), req.user.id]);
    await Notification.create(req.user.id, 'Preferences Updated', 'Your preferences have been saved.');
    res.json({ message: 'Preferences updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};