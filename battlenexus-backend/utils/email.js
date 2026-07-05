const nodemailer = require('nodemailer');

// ─── Create transporter using environment variables ───
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Send Password Reset Email ───
const sendPasswordResetEmail = async (to, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: 'BattleNexus – Password Reset',
    html: `
      <h2>Reset Your Password</h2>
      <p>You requested a password reset. Click the link below to set a new password.</p>
      <p><a href="${resetLink}" style="color:#ff7b00;">${resetLink}</a></p>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
};

// ─── Send Email Verification Email ───
const sendVerificationEmail = async (to, token) => {
  const verifyLink = `${process.env.FRONTEND_URL}/verify-email.html?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: 'BattleNexus – Verify Your Email',
    html: `
      <h1>Welcome to BattleNexus!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyLink}" style="color:#ff7b00;">${verifyLink}</a></p>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p>If you didn't sign up, ignore this email.</p>
    `,
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
};