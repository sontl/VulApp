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
app.use(authenticate);
app.use(logger);

// Routes (will be implemented next)
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const fileRoutes = require('./routes/files');
const paymentRoutes = require('./routes/payment');
const debugRoutes = require('./routes/debug');

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/subscribe', paymentRoutes);
app.use('/api', debugRoutes);

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
});
