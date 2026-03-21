const jwt = require('jsonwebtoken');

// INSECURE: Weak/Hardcoded secret
const JWT_SECRET = 'secret123';

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Proceed as anonymous
  }

  // ==========================================
  // VULNERABILITY: JWT NONE ALGORITHM BYPASS
  // Accepts tokens with alg: "none" (unsigned)
  // Attacker can forge any identity without the secret
  // ==========================================
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      if (header.alg === 'none' || header.alg === 'None') {
        // VULNERABILITY: Trusting unsigned token
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log(`[VULN] Accepted unsigned JWT for user: ${payload.email}`);
        req.user = payload;
        return next();
      }
    }
  } catch (e) {
    // Fall through to normal verification
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticate, JWT_SECRET };
