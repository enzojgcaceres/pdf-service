const logger = require('../utils/logger');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Authentication failed - missing or invalid header', {
      requestId: req.id,
      hasHeader: !!authHeader
    });
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token required',
      code: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.substring(7);
  const expectedToken = process.env.BACKEND_BEARER_TOKEN;

  if (!expectedToken) {
    logger.error('Server misconfiguration - BACKEND_BEARER_TOKEN not set', {
      requestId: req.id
    });
    
    return res.status(500).json({
      error: 'Server Misconfigured',
      message: 'Authentication not properly configured',
      code: 'SERVER_CONFIG_ERROR'
    });
  }

  if (token !== expectedToken) {
    logger.warn('Authentication failed - invalid token', {
      requestId: req.id,
      tokenLength: token.length
    });
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid bearer token',
      code: 'INVALID_TOKEN'
    });
  }

  next();
};

module.exports = { authenticate };