const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validateUploadRequest } = require('../middleware/validation');
const { uploadFromUrl, uploadFromBase64 } = require('../services/cloudinary');
const logger = require('../utils/logger');
const { getPresupuestoPdfBase64 } = require('../services/lqm');

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

    res.status(500).json({
      error: 'Upload Failed',
      message: 'Failed to upload file to Cloudinary',
      code: 'UPLOAD_ERROR',
      details: [error.message],
      requestId: req.id
    });
  }
});

// // --- NUEVO endpoint: LQM → Cloudinary ---
// router.post('/lqm/presupuesto', authenticate, async (req, res) => {
//   const { id, articulo, sucursal, public_id, metadata } = req.body || {};

//   if ( !articulo || !sucursal || !public_id) {
//     return res.status(422).json({
//       error: 'Validation Error',
//       message: 'Campos requeridos: id, articulo, sucursal, public_id',
//       code: 'INVALID_REQUEST',
//       requestId: req.id,
//     });
//   }

//   try {
//     logger.info('Starting LQM presupuesto → Cloudinary flow', {
//       requestId: req.id,
//       id,  // puede venir undefined, usamos default adentro del servicio
//       articulo,
//       sucursal,
//       public_id,
//     });

//     const pdfBase64 = await getPresupuestoPdfBase64({
//       id,
//       articulo,
//       sucursal,
//       requestId: req.id,
//     });

//     const dataUri = pdfBase64.startsWith('data:')
//       ? pdfBase64
//       : `data:application/pdf;base64,${pdfBase64}`;

//     const result = await uploadFromBase64(dataUri, public_id, metadata, req.id);

//     const response = {
//       ok: true,
//       secure_url: result.secure_url,
//       public_id: result.public_id,
//       bytes: result.bytes,
//       etag: result.etag,
//       version: result.version,
//       original_filename: result.original_filename || 'presupuesto.pdf',
//       resource_type: result.resource_type,
//       created_at: result.created_at,
//       lqm: {
//         status: 'ok',
//       },
//     };

//     logger.info('LQM presupuesto → Cloudinary completed', {
//       requestId: req.id,
//       publicId: result.public_id,
//       secureUrl: result.secure_url.substring(0, 100) + '...',
//     });

//     res.status(200).json(response);
//   } catch (error) {
//     logger.error('LQM presupuesto → Cloudinary flow failed', {
//       requestId: req.id,
//       error: error.message,
//       stack: error.stack,
//     });

//     if (error.isLqmTokenError) {
//       return res.status(502).json({
//         error: 'LQM Token Error',
//         message: 'Error al obtener access_token desde LQM',
//         code: 'LQM_TOKEN_ERROR',
//         details: [error.message],
//         requestId: req.id,
//       });
//     }

//     if (error.isLqmPresupuestoError) {
//       return res.status(502).json({
//         error: 'LQM Presupuesto Error',
//         message: 'Error al consultar LQM /presupuesto',
//         code: 'LQM_PRESUPUESTO_ERROR',
//         details: [error.message],
//         requestId: req.id,
//       });
//     }

//     if (error.http_code === 400) {
//       return res.status(422).json({
//         error: 'Upload Failed',
//         message: 'Invalid file or upload parameters',
//         code: 'CLOUDINARY_VALIDATION_ERROR',
//         details: [error.message],
//         requestId: req.id,
//       });
//     }

//     return res.status(500).json({
//       error: 'Upload Failed',
//       message: 'Failed to generate and upload presupuesto PDF',
//       code: 'UPLOAD_ERROR',
//       details: [error.message],
//       requestId: req.id,
//     });
//   }
// });

// --- NUEVO endpoint: LQM → Cloudinary ---
// router.post('/lqm/presupuesto', authenticate, async (req, res) => {
//   const {
//     articulo,
//     cantidad,
//     sucursal,
//     promocion,
//     servicios_recomendados,
//     cliente,
//     telefono,
//     mail,
//     public_id,
//     metadata,
//   } = req.body || {};

//   const missingFields = [];
//   if (!articulo) missingFields.push('articulo');
//   if (cantidad === undefined || cantidad === null) missingFields.push('cantidad');
//   if (!promocion) missingFields.push('promocion');
//   if (!cliente) missingFields.push('cliente');
//   if (!telefono) missingFields.push('telefono');
//   if (!mail) missingFields.push('mail');
//   if (!public_id) missingFields.push('public_id');

//   if (missingFields.length > 0) {
//     return res.status(422).json({
//       error: 'Validation Error',
//       message: `Campos requeridos faltantes: ${missingFields.join(', ')}`,
//       code: 'INVALID_REQUEST',
//       requestId: req.id,
//     });
//   }

//   try {
//     logger.info('Starting LQM presupuesto → Cloudinary flow', {
//       requestId: req.id,
//       articulo,
//       cantidad,
//       sucursal,
//       promocion,
//       servicios_recomendados,
//       cliente,
//       telefono,
//       mail,
//       public_id,
//     });

//     const pdfBase64 = await getPresupuestoPdfBase64({
//       articulo,
//       cantidad,
//       sucursal,
//       promocion,
//       servicios_recomendados,
//       cliente,
//       telefono,
//       mail,
//       requestId: req.id,
//     });

//     const dataUri = pdfBase64.startsWith('data:')
//       ? pdfBase64
//       : `data:application/pdf;base64,${pdfBase64}`;

//     const result = await uploadFromBase64(dataUri, public_id, metadata, req.id);

//     const response = {
//       ok: true,
//       secure_url: result.secure_url,
//       public_id: result.public_id,
//       bytes: result.bytes,
//       etag: result.etag,
//       version: result.version,
//       original_filename: result.original_filename || 'presupuesto.pdf',
//       resource_type: result.resource_type,
//       created_at: result.created_at,
//       lqm: {
//         status: 'ok',
//       },
//     };

//     logger.info('LQM presupuesto → Cloudinary completed', {
//       requestId: req.id,
//       publicId: result.public_id,
//       secureUrl: result.secure_url.substring(0, 100) + '...',
//     });

//     res.status(200).json(response);
//   } catch (error) {
//     logger.error('LQM presupuesto → Cloudinary flow failed', {
//       requestId: req.id,
//       error: error.message,
//       stack: error.stack,
//     });

//     if (error.isLqmTokenError) {
//       return res.status(502).json({
//         error: 'LQM Token Error',
//         message: 'Error al obtener access_token desde LQM',
//         code: 'LQM_TOKEN_ERROR',
//         details: [error.message],
//         requestId: req.id,
//       });
//     }

//     if (error.isLqmPresupuestoError) {
//       return res.status(502).json({
//         error: 'LQM Presupuesto Error',
//         message: 'Error al consultar LQM /presupuesto',
//         code: 'LQM_PRESUPUESTO_ERROR',
//         details: [error.message],
//         requestId: req.id,
//       });
//     }

//     if (error.http_code === 400) {
//       return res.status(422).json({
//         error: 'Upload Failed',
//         message: 'Invalid file or upload parameters',
//         code: 'CLOUDINARY_VALIDATION_ERROR',
//         details: [error.message],
//         requestId: req.id,
//       });
//     }

//     return res.status(500).json({
//       error: 'Upload Failed',
//       message: 'Failed to generate and upload presupuesto PDF',
//       code: 'UPLOAD_ERROR',
//       details: [error.message],
//       requestId: req.id,
//     });
//   }
// });

// --- NUEVO endpoint: LQM → Cloudinary ---
router.post('/lqm/presupuesto', authenticate, async (req, res) => {
  const {
    // LQM
    articulo,
    cantidad,
    sucursal,
    promocion,
    promocion_2,
    promocion_3,
    servicios_recomendados,
    cliente,
    telefono,
    mail,
    descuento,
    // Cloudinary
    public_id,
    metadata,
  } = req.body || {};

  const missing = [];
  if (!articulo) missing.push('articulo');
  if (cantidad === undefined || cantidad === null) missing.push('cantidad');
  if (!cliente) missing.push('cliente');
  if (!telefono) missing.push('telefono');
  if (!mail) missing.push('mail');
  if (!public_id) missing.push('public_id');

  if (missing.length > 0) {
    return res.status(422).json({
      error: 'Validation Error',
      message: `Campos requeridos: ${missing.join(', ')}`,
      code: 'INVALID_REQUEST',
      requestId: req.id,
    });
  }

  try {
    logger.info('Starting LQM presupuesto → Cloudinary flow', {
      requestId: req.id,
      articulo,
      cantidad,
      sucursal,
      promocion,
      promocion_2,
      promocion_3,
      servicios_recomendados,
      cliente,
      telefono,
      mail,
      public_id,
    });

    const pdfBase64 = await getPresupuestoPdfBase64({
      articulo,
      cantidad,
      sucursal,
      promocion,
      promocion_2,
      promocion_3,
      servicios_recomendados,
      cliente,
      telefono,
      mail,
      descuento,
      requestId: req.id,
    });

    const dataUri = pdfBase64.startsWith('data:')
      ? pdfBase64
      : `data:application/pdf;base64,${pdfBase64}`;

    const result = await uploadFromBase64(dataUri, public_id, metadata, req.id);

    const response = {
      ok: true,
      secure_url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes,
      etag: result.etag,
      version: result.version,
      original_filename: result.original_filename || 'presupuesto.pdf',
      resource_type: result.resource_type,
      created_at: result.created_at,
      lqm: {
        status: 'ok',
      },
    };

    logger.info('LQM presupuesto → Cloudinary completed', {
      requestId: req.id,
      publicId: result.public_id,
      secureUrl: result.secure_url.substring(0, 100) + '...',
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('LQM presupuesto → Cloudinary flow failed', {
      requestId: req.id,
      error: error.message,
      stack: error.stack,
    });

    if (error.isLqmTokenError) {
      return res.status(502).json({
        error: 'LQM Token Error',
        message: 'Error al obtener access_token desde LQM',
        code: 'LQM_TOKEN_ERROR',
        details: [error.message],
        requestId: req.id,
      });
    }

    if (error.isLqmPresupuestoError) {
      return res.status(502).json({
        error: 'LQM Presupuesto Error',
        message: 'Error al consultar LQM /presupuesto',
        code: 'LQM_PRESUPUESTO_ERROR',
        details: [error.message],
        requestId: req.id,
      });
    }

    if (error.http_code === 400) {
      return res.status(422).json({
        error: 'Upload Failed',
        message: 'Invalid file or upload parameters',
        code: 'CLOUDINARY_VALIDATION_ERROR',
        details: [error.message],
        requestId: req.id,
      });
    }

    return res.status(500).json({
      error: 'Upload Failed',
      message: 'Failed to generate and upload presupuesto PDF',
      code: 'UPLOAD_ERROR',
      details: [error.message],
      requestId: req.id,
    });
  }
});



module.exports = router;
