const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/secrets');

const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }

  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(503).json({
        success: false,
        message: 'JWT_SECRET is not configured on the server. Authentication is unavailable.',
      });
    }
    const decoded = jwt.verify(token, jwtSecret);
    
    // In fallback mode if DB is disconnected, supply decoded payload
    try {
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
        return next();
      }
    } catch (dbErr) {
      // Fallback
    }

    req.user = {
      _id: decoded.id,
      name: decoded.name || 'Demo User',
      email: decoded.email || 'user@securepay.crypto',
      role: decoded.role || 'user',
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token validation failed',
      error: error.message,
    });
  }
};

module.exports = { protect };
