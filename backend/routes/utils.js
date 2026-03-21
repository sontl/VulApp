const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

// ==========================================
// VULNERABILITY #1: COMMAND INJECTION
// GET /api/utils/ping?host=
// Uses exec() with unsanitized user input
// Payload: ; cat /etc/passwd
// ==========================================
router.get('/ping', (req, res) => {
  const { host } = req.query;
  if (!host) return res.status(400).json({ error: 'Host parameter is required' });

  // VULNERABILITY: Direct shell command injection
  const cmd = `ping -c 2 ${host}`;
  console.log(`[VULN] Executing command: ${cmd}`);

  exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
    res.json({
      command: cmd,
      stdout: stdout || '',
      stderr: stderr || '',
      error: err ? err.message : null
    });
  });
});

// ==========================================
// VULNERABILITY #2: PROTOTYPE POLLUTION
// POST /api/utils/merge
// Recursively merges user-controlled JSON into an object
// Payload: {"__proto__": {"isAdmin": true}}
// ==========================================
function unsafeMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      unsafeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

router.post('/merge', (req, res) => {
  const baseConfig = { theme: 'dark', lang: 'en' };

  // VULNERABILITY: Merging user input directly — allows __proto__ pollution
  const merged = unsafeMerge(baseConfig, req.body);

  // Check if prototype was polluted
  const testObj = {};
  res.json({
    merged,
    pollutionCheck: {
      isAdmin: testObj.isAdmin || false,
      message: testObj.isAdmin ? 'PROTOTYPE POLLUTED!' : 'No pollution detected'
    }
  });
});

// ==========================================
// VULNERABILITY #3: OPEN REDIRECT
// GET /api/utils/redirect?url=
// Redirects to any URL without validation
// Payload: https://evil.com
// ==========================================
router.get('/redirect', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL parameter is required' });

  // VULNERABILITY: No validation of redirect target
  console.log(`[VULN] Open redirect to: ${url}`);
  res.redirect(url);
});

// ==========================================
// VULNERABILITY #4: HTTP HEADER INJECTION
// GET /api/utils/lang?lang=
// Reflects user input into response header
// Payload: en%0d%0aX-Injected: true
// ==========================================
router.get('/lang', (req, res) => {
  const { lang } = req.query;
  if (!lang) return res.status(400).json({ error: 'lang parameter is required' });

  // VULNERABILITY: Reflecting user input in header without sanitization
  res.setHeader('X-Language', lang);
  res.json({ message: `Language set to: ${lang}` });
});

// ==========================================
// VULNERABILITY #5: ReDoS (Regular Expression Denial of Service)
// POST /api/utils/validate-email
// Uses a catastrophic-backtracking regex
// Payload: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
// ==========================================
router.post('/validate-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // VULNERABILITY: Catastrophic backtracking regex
  const evilRegex = /^([a-zA-Z0-9]+)+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/;
  const start = Date.now();
  const isValid = evilRegex.test(email);
  const duration = Date.now() - start;

  res.json({ email, isValid, processingTimeMs: duration });
});

module.exports = router;
