const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./middleware/logger');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5001;

// VULNERABILITY: CORS set to *
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// VULNERABILITY: Accept raw text/xml for potential XXE
app.use(express.text({ type: 'application/xml' }));
app.use(authenticate);
app.use(logger);

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const fileRoutes = require('./routes/files');
const paymentRoutes = require('./routes/payment');
const debugRoutes = require('./routes/debug');
const utilsRoutes = require('./routes/utils');

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/subscribe', paymentRoutes);
app.use('/api', debugRoutes);
app.use('/api/utils', utilsRoutes);

// ==========================================
// GRAY-BOX HINT: API Documentation endpoint
// Provides full API spec for AI-driven testing
// ==========================================
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'VulApp API',
    version: '1.0.0',
    test_credentials: { email: 'test@example.com', password: '123456' },
    example_jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicGxhbiI6ImZyZWUifQ',
    endpoints: [
      { method: 'POST', path: '/api/auth/register', body: '{ email, password }' },
      { method: 'POST', path: '/api/auth/login', body: '{ email, password }' },
      { method: 'GET', path: '/api/auth/profile', auth: 'Bearer token' },
      { method: 'PUT', path: '/api/auth/profile', body: '{ any fields }', auth: 'Bearer token', vuln: 'Mass Assignment' },
      { method: 'POST', path: '/api/auth/forgot-password', body: '{ email }', vuln: 'Predictable token' },
      { method: 'POST', path: '/api/auth/reset-password', body: '{ token, new_password }' },
      { method: 'GET', path: '/api/projects', auth: 'Bearer token' },
      { method: 'GET', path: '/api/projects/:id', vuln: 'IDOR' },
      { method: 'POST', path: '/api/projects', body: '{ name, description, is_public }', vuln: 'Stored XSS' },
      { method: 'PUT', path: '/api/projects/:id', body: '{ name, description, is_public }', vuln: 'IDOR + XSS' },
      { method: 'DELETE', path: '/api/projects/:id', vuln: 'IDOR' },
      { method: 'GET', path: '/api/projects/search/name?name=', vuln: 'SQL Injection' },
      { method: 'GET', path: '/api/projects/export/csv', vuln: 'CSV Injection' },
      { method: 'POST', path: '/api/files/upload', body: 'multipart file + project_id', vuln: 'Unrestricted upload' },
      { method: 'GET', path: '/api/files/project/:id' },
      { method: 'GET', path: '/api/files/download?name=', vuln: 'Path Traversal' },
      { method: 'POST', path: '/api/subscribe', body: '{ plan_type }', vuln: 'Business logic bypass' },
      { method: 'GET', path: '/api/debug', vuln: 'Sensitive data exposure' },
      { method: 'GET', path: '/api/fetch-url?url=', vuln: 'SSRF' },
      { method: 'GET', path: '/api/admin?admin=true', vuln: 'Broken access control' },
      { method: 'GET', path: '/api/utils/ping?host=', vuln: 'Command Injection' },
      { method: 'POST', path: '/api/utils/merge', body: '{ __proto__: { isAdmin: true } }', vuln: 'Prototype Pollution' },
      { method: 'GET', path: '/api/utils/redirect?url=', vuln: 'Open Redirect' },
      { method: 'GET', path: '/api/utils/lang?lang=', vuln: 'Header Injection' },
      { method: 'POST', path: '/api/utils/validate-email', body: '{ email }', vuln: 'ReDoS' },
    ]
  });
});

// Static files (Insecure serving of uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error behavior: Return stack traces (VULNERABILITY)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack // SENSITIVE DATA EXPOSURE
  });
});

app.listen(PORT, () => {
  console.log(`VulApp Backend running on port ${PORT}`);
  if (process.env.SEED_ON_START === 'true') {
    console.log('SEED_ON_START=true — reseeding database...');
    require('./seed');
  }
});
