const logger = require('../utils/logger');

function getExpectedToken() {
  const raw = process.env.BACKEND_BEARER_TOKEN || '';
  const cleaned = raw.trim(); // 🔹 quitamos espacios/saltos de línea

  if (!raw) {
    console.warn('[AUTH] BACKEND_BEARER_TOKEN no está definido en process.env');
  } else {
    console.info('[AUTH] BACKEND_BEARER_TOKEN cargado', {
      rawLength: raw.length,
      cleanedLength: cleaned.length,
      rawPreview: raw.slice(0, 4) + '***',
      cleanedPreview: cleaned.slice(0, 4) + '***',
    });
  }

  return cleaned;
}

const authenticate = (req, res, next) => {
  const expectedToken = getExpectedToken();
  const rawHeader = req.headers.authorization || '';

  logger.info('[AUTH] Incoming request auth header', {
    requestId: req.id,
    rawHeader,
    hasHeader: !!rawHeader,
    hasBearerPrefix: rawHeader.toLowerCase().startsWith('bearer '),
  });

  if (!rawHeader || !rawHeader.toLowerCase().startsWith('bearer ')) {
    logger.warn('Authentication failed - missing or invalid header', {
      requestId: req.id,
      hasHeader: !!rawHeader,
      rawHeader,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token required',
      code: 'MISSING_TOKEN',
    });
  }

  const token = rawHeader.replace(/^Bearer\s+/i, '').trim(); // 🔹 limpiamos token recibido

  if (!expectedToken) {
    logger.error('Server misconfiguration - BACKEND_BEARER_TOKEN not set', {
      requestId: req.id,
    });

    return res.status(500).json({
      error: 'Server Misconfigured',
      message: 'Authentication not properly configured',
      code: 'SERVER_CONFIG_ERROR',
    });
  }

  if (token !== expectedToken) {
    // 🔍 debug fino: buscamos el primer índice donde difieren
    let diffIndex = -1;
    const len = Math.max(token.length, expectedToken.length);
    for (let i = 0; i < len; i++) {
      if (token[i] !== expectedToken[i]) {
        diffIndex = i;
        break;
      }
    }

    logger.warn('Authentication failed - invalid token', {
      requestId: req.id,
      receivedTokenLength: token.length,
      expectedTokenLength: expectedToken.length,
      receivedPreview: token.slice(0, 8) + '***',
      expectedPreview: expectedToken.slice(0, 8) + '***',
      diffIndex,
      receivedCharCode: diffIndex >= 0 ? token.charCodeAt(diffIndex) : null,
      expectedCharCode: diffIndex >= 0 ? expectedToken.charCodeAt(diffIndex) : null,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid bearer token',
      code: 'INVALID_TOKEN',
    });
  }

  logger.info('[AUTH] Authentication success', {
    requestId: req.id,
  });

  next();
};

module.exports = { authenticate };
