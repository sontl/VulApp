const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// POST /register (No rate limiting, VULNERABILITY)
router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  db.run(`INSERT INTO users (email, password, plan_type) VALUES (?, ?, 'free')`, [email, password], function(err) {
    if (err) {
      // VULNERABILITY #7: USER ENUMERATION
      // Different error messages for existing vs new users
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json({ message: 'User registered successfully', id: this.lastID });
  });
});

// POST /login (No rate limiting, VULNERABILITY)
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, plan: user.plan_type }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, plan: user.plan_type } });
  });
});

// GET /profile
router.get('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user: req.user });
});

// ==========================================
// VULNERABILITY #8: MASS ASSIGNMENT
// PUT /api/auth/profile
// Merges request body directly into DB update
// Allows overwriting plan_type, etc.
// Payload: {"email": "a@b.com", "plan_type": "enterprise"}
// ==========================================
router.put('/profile', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // VULNERABILITY: Accepting ALL fields from request body
  const updates = req.body;
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);

  if (!fields) return res.status(400).json({ error: 'No fields to update' });

  const query = `UPDATE users SET ${fields} WHERE id = ?`;
  console.log(`[VULN] Mass assignment query: ${query}`);

  db.run(query, [...values, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Profile updated', updatedFields: Object.keys(updates) });
  });
});

// ==========================================
// VULNERABILITY #9: INSECURE PASSWORD RESET
// POST /api/auth/forgot-password
// Uses predictable reset token (timestamp-based)
// ==========================================
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // VULNERABILITY: Predictable token based on timestamp
  const resetToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
  console.log(`[VULN] Password reset token for ${email}: ${resetToken}`);

  res.json({
    message: 'Password reset link sent (not really)',
    // VULNERABILITY: Token leaked in response
    debug_token: resetToken
  });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new_password required' });

  try {
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [email] = decoded.split(':');

    // VULNERABILITY: No token expiration or one-time use check
    db.run(`UPDATE users SET password = ? WHERE email = ?`, [new_password, email], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Password reset successfully', email });
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
});

module.exports = router;
