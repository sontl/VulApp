const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/subscribe (BUSINESS LOGIC VULNERABILITY: bypass payment)
router.post('/', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { plan_type } = req.body;
  
  // VULNERABILITY: Directly setting plan_type from request body without payment validation
  db.run(`UPDATE users SET plan_type = ? WHERE id = ?`, [plan_type, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Successfully subscribed to ${plan_type}`, plan_type });
  });
});

module.exports = router;
