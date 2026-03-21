const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/projects (Owned + Public)
router.get('/', (req, res) => {
  const userId = req.user ? req.user.id : null;
  db.all(`SELECT * FROM projects WHERE owner_id = ? OR is_public = 1`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/projects/:id (IDOR VULNERABILITY: No ownership check)
router.get('/:id', (req, res) => {
  const projectId = req.params.id;
  // Missing check: if (project.owner_id !== req.user.id && !project.is_public)
  db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Project not found' });
    res.json(row);
  });
});

// GET /api/projects/search?name= (SQL INJECTION VULNERABILITY)
router.get('/search/name', (req, res) => {
  const name = req.query.name || '';
  // VULNERABILITY: Raw string concatenation
  const query = `SELECT * FROM projects WHERE name LIKE '%${name}%'`;
  console.log(`Executing vulnerable query: ${query}`);
  
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/projects (STORED XSS VULNERABILITY: description allows raw HTML)
router.post('/', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { name, description, is_public } = req.body;
  
  db.run(`INSERT INTO projects (name, description, owner_id, is_public) VALUES (?, ?, ?, ?)`,
    [name, description, req.user.id, is_public ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, description });
    }
  );
});

// DELETE /api/projects/:id (IDOR VULNERABILITY)
router.delete('/:id', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  // Missing ownership check
  db.run(`DELETE FROM projects WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Project deleted' });
  });
});

// ==========================================
// VULNERABILITY #10: CSV INJECTION
// GET /api/projects/export
// Exports project data as CSV without sanitizing
// formulas like =CMD(), allowing spreadsheet injection
// ==========================================
router.get('/export/csv', (req, res) => {
  db.all(`SELECT * FROM projects`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // VULNERABILITY: No sanitization of values containing = + - @ 
    let csv = 'id,name,description,owner_id,is_public\n';
    rows.forEach(row => {
      csv += `${row.id},"${row.name}","${row.description}",${row.owner_id},${row.is_public}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
    res.send(csv);
  });
});

// ==========================================
// VULNERABILITY: MASS UPDATE (no ownership check)
// PUT /api/projects/:id
// Any authenticated user can update any project
// ==========================================
router.put('/:id', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { name, description, is_public } = req.body;

  // VULNERABILITY: No ownership check + raw description (Stored XSS)
  db.run(`UPDATE projects SET name = ?, description = ?, is_public = ? WHERE id = ?`,
    [name, description, is_public ? 1 : 0, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Project updated', id: req.params.id });
    }
  );
});

module.exports = router;
