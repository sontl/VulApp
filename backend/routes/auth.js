const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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
      return res.status(500).json({ error: 'User already exists or DB error', details: err.message });
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

module.exports = router;
