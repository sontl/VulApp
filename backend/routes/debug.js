const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const { JWT_SECRET } = require('../middleware/auth');

// GET /api/debug (SENSITIVE DATA EXPOSURE VULNERABILITY)
router.get('/debug', (req, res) => {
  res.json({
    message: 'Debug information',
    config: {
      db_type: 'sqlite',
      db_path: path.resolve(__dirname, '../database.sqlite'),
      jwt_secret: JWT_SECRET // VULNERABILITY: leak JWT secret
    },
    system: process.env
  });
});

// GET /api/fetch-url?url= (SSRF VULNERABILITY)
router.get('/fetch-url', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    console.log(`Fetching URL (SSRF): ${url}`);
    const response = await axios.get(url);
    res.send(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch URL', message: err.message });
  }
});

// GET /api/admin (ADMIN PANEL BYPASS)
router.get('/admin', (req, res) => {
  const { admin } = req.query;
  // VULNERABILITY: Weak protection (query param)
  if (admin === 'true') {
    res.json({ message: 'Welcome to the Admin Panel!', info: 'All users are listed here (not really, just a mock)' });
  } else {
    res.status(403).json({ error: 'Access denied. Use ?admin=true to access admin panel' });
  }
});

module.exports = router;
