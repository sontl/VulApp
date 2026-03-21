const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// VULNERABILITY: No file type/extension validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // VULNERABILITY: Keep original name (allowing .js, .html, etc.)
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// POST /api/files/upload (Insecure Upload)
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { project_id } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  db.run(`INSERT INTO files (filename, filepath, project_id, owner_id) VALUES (?, ?, ?, ?)`,
    [file.originalname, file.path, project_id, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, filename: file.originalname, url: `/uploads/${file.originalname}` });
    }
  );
});

// GET /api/files/project/:id
router.get('/project/:id', (req, res) => {
  const projectId = req.params.id;
  db.all(`SELECT * FROM files WHERE project_id = ?`, [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==========================================
// VULNERABILITY #6: PATH TRAVERSAL
// GET /api/files/download?name=
// No sanitization of filename — allows ../../etc/passwd
// ==========================================
router.get('/download', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Filename is required' });

  // VULNERABILITY: Direct path concatenation without sanitization
  const filePath = path.join(__dirname, '../uploads', name);
  console.log(`[VULN] Path traversal download: ${filePath}`);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found', path: filePath });
  }
});

module.exports = router;
