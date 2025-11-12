const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validateUploadRequest } = require('../middleware/validation');
const { uploadFromUrl, uploadFromBase64 } = require('../services/cloudinary');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/upload', authenticate, validateUploadRequest, async (req, res) => {
  const { source, file_url, file_data_uri, public_id, metadata } = req.body;
  
  try {
    let result;

    if (source === 'url') {
      logger.info('Processing URL upload', {
        requestId: req.id,
        url: file_url.substring(0, 100) + '...' // Log parcial
      });
      
      result = await uploadFromUrl(file_url, public_id, metadata, req.id);
    } else {
      logger.info('Processing base64 upload', {
        requestId: req.id,
        dataUriLength: file_data_uri.length
      });
      
      result = await uploadFromBase64(file_data_uri, public_id, metadata, req.id);
    }

    // Formatear respuesta exitosa
    const response = {
      ok: true,
      secure_url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes,
      etag: result.etag,
      version: result.version,
      original_filename: result.original_filename || 'document.pdf',
      resource_type: result.resource_type,
      created_at: result.created_at
    };

    logger.info('Upload completed successfully', {
      requestId: req.id,
      publicId: result.public_id,
      bytes: result.bytes,
      secureUrl: result.secure_url.substring(0, 100) + '...' // Log parcial
    });

    res.status(200).json(response);

  } catch (error) {
    logger.error('Upload failed', {
      requestId: req.id,
      error: error.message,
      stack: error.stack,
      source,
      publicId: public_id
    });

    // Manejar errores específicos de Cloudinary
    if (error.http_code === 400) {
      return res.status(422).json({
        error: 'Upload Failed',
        message: 'Invalid file or upload parameters',
        code: 'CLOUDINARY_VALIDATION_ERROR',
        details: [error.message],
        requestId: req.id
      });
    }

    if (error.http_code === 413) {
      return res.status(413).json({
        error: 'File Too Large',
        message: 'File exceeds Cloudinary size limits',
        code: 'CLOUDINARY_SIZE_LIMIT',
        details: ['Cloudinary maximum file size is 100MB for URL uploads'],
        requestId: req.id
      });
    }

    if (error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Upload Timeout',
        message: 'Upload operation timed out',
        code: 'UPLOAD_TIMEOUT',
        requestId: req.id
      });
    }

    // Error genérico del servidor
    res.status(500).json({
      error: 'Upload Failed',
      message: 'Failed to upload file to Cloudinary',
      code: 'UPLOAD_ERROR',
      details: [error.message],
      requestId: req.id
    });
  }
});

module.exports = router;