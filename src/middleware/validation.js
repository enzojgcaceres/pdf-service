const logger = require('../utils/logger');

const validateUploadRequest = (req, res, next) => {
  const { source, file_url, file_data_uri, public_id } = req.body;
  
  // Validar source requerido
  if (!source) {
    return res.status(422).json({
      error: 'Validation Error',
      message: 'Field "source" is required',
      code: 'MISSING_SOURCE',
      details: ['source must be "url" or "base64"']
    });
  }

  // Validar que source sea válido
  if (!['url', 'base64'].includes(source)) {
    return res.status(422).json({
      error: 'Validation Error',
      message: 'Invalid source type',
      code: 'INVALID_SOURCE',
      details: ['source must be "url" or "base64"']
    });
  }

  // Validaciones para modo URL
  if (source === 'url') {
    if (!file_url) {
      return res.status(422).json({
        error: 'Validation Error',
        message: 'Field "file_url" is required for URL source',
        code: 'MISSING_FILE_URL'
      });
    }

    try {
      const url = new URL(file_url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      return res.status(422).json({
        error: 'Validation Error',
        message: 'Invalid URL format',
        code: 'INVALID_URL',
        details: ['URL must be a valid HTTP/HTTPS URL']
      });
    }
  }

  // Validaciones para modo Base64
  if (source === 'base64') {
    if (!file_data_uri) {
      return res.status(422).json({
        error: 'Validation Error',
        message: 'Field "file_data_uri" is required for base64 source',
        code: 'MISSING_DATA_URI'
      });
    }

    if (!file_data_uri.startsWith('data:application/pdf;base64,')) {
      return res.status(422).json({
        error: 'Validation Error',
        message: 'Invalid data URI format',
        code: 'INVALID_DATA_URI',
        details: ['Data URI must start with "data:application/pdf;base64,"']
      });
    }

    // Validar tamaño máximo para base64 (20MB en base64 ≈ 15MB binario)
    const base64Data = file_data_uri.replace(/^data:application\/pdf;base64,/, '');
    const base64Length = base64Data.length;
    const maxBase64Size = 20 * 1024 * 1024; // 20MB

    if (base64Length > maxBase64Size) {
      return res.status(413).json({
        error: 'File Too Large',
        message: 'Base64 file exceeds maximum size limit',
        code: 'FILE_TOO_LARGE',
        details: [`Maximum size for base64 upload is 20MB, got ${Math.round(base64Length / 1024 / 1024)}MB`]
      });
    }
  }

  // Validar public_id si se proporciona
  if (public_id && typeof public_id !== 'string') {
    return res.status(422).json({
      error: 'Validation Error',
      message: 'Field "public_id" must be a string',
      code: 'INVALID_PUBLIC_ID'
    });
  }

  // Sanitizar public_id
  if (public_id) {
    const sanitizedPublicId = public_id.replace(/[^a-zA-Z0-9_\-/.]/g, '_');
    if (sanitizedPublicId !== public_id) {
      req.body.public_id = sanitizedPublicId;
      logger.info('Public ID sanitized', {
        requestId: req.id,
        original: public_id,
        sanitized: sanitizedPublicId
      });
    }
  }

  next();
};

module.exports = { validateUploadRequest };