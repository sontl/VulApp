const logger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - status: ${res.statusCode} - user_id: ${req.user ? req.user.id : 'anonymous'} - duration: ${duration}ms`);
  });
  next();
};

module.exports = logger;
