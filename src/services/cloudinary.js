const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const MAX_RETRIES = 3;
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
const UPLOAD_TIMEOUT = 300000; // 5 minutos

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const uploadWithRetry = async (uploadFunction, options, retries = MAX_RETRIES) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await uploadFunction(options);
      return result;
    } catch (error) {
      logger.warn('Cloudinary upload attempt failed', {
        attempt,
        maxRetries: MAX_RETRIES,
        error: error.message,
        publicId: options.public_id
      });

      if (attempt === retries) {
        throw error;
      }

      // Backoff exponencial
      const backoffTime = Math.pow(2, attempt) * 1000;
      await sleep(backoffTime);
    }
  }
};

const uploadFromUrl = async (fileUrl, publicId, metadata, requestId) => {
  const uploadOptions = {
    resource_type: 'raw',
    type: 'upload',
    public_id: publicId,
    folder: 'intercom/pdfs',
    use_filename: true,
    unique_filename: !publicId,
    overwrite: true,
    timeout: UPLOAD_TIMEOUT,
    context: metadata ? Object.entries(metadata).map(([key, value]) => `${key}=${value}`).join('|') : undefined
  };

  logger.info('Starting URL upload to Cloudinary', {
    requestId,
    fileUrl: fileUrl.substring(0, 100) + '...', // Log parcial por seguridad
    publicId: uploadOptions.public_id,
    folder: uploadOptions.folder
  });

  const result = await uploadWithRetry(
    (opts) => cloudinary.uploader.upload(fileUrl, opts),
    uploadOptions,
    MAX_RETRIES
  );

  return result;
};

const uploadFromBase64 = async (dataUri, publicId, metadata, requestId) => {
  try {
    // Limpiar el base64 si viene con prefijo data URL
    const base64Data = dataUri.startsWith('data:application/pdf') 
      ? dataUri.split(',')[1] 
      : dataUri.replace(/^data:application\/pdf;base64,/, '');
    
    logger.info('Starting base64 upload to Cloudinary', {
      requestId,
      dataLength: base64Data.length,
      publicId,
      originalDataUriLength: dataUri.length
    });

    // Convertir base64 a Buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    const uploadOptions = {
      resource_type: 'raw',
      public_id: publicId,
      folder: 'intercom/pdfs',
      use_filename: true,
      unique_filename: !publicId,
      overwrite: true,
      timeout: UPLOAD_TIMEOUT,
      context: metadata ? Object.entries(metadata).map(([key, value]) => `${key}=${value}`).join('|') : undefined
    };

    // Usar upload_stream para subir el Buffer directamente
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload stream error', {
              requestId,
              error: error.message
            });
            reject(error);
          } else {
            logger.info('Cloudinary upload stream success', {
              requestId,
              publicId: result.public_id,
              bytes: result.bytes
            });
            resolve(result);
          }
        }
      );
      
      // Crear stream desde el Buffer y enviar a Cloudinary
      const { Readable } = require('stream');
      const stream = Readable.from(pdfBuffer);
      stream.pipe(uploadStream);
    });

    return result;

  } catch (error) {
    logger.error('Base64 upload processing failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

  // const uploadFromBase64 = async (dataUri, publicId, metadata, requestId) => {
  //   const base64Data = dataUri.replace(/^data:application\/pdf;base64,/, '');
    
  //   logger.info('Starting base64 upload to Cloudinary', {
  //     requestId,
  //     dataLength: base64Data.length,
  //     publicId,
  //     chunkSize: `${CHUNK_SIZE / 1024 / 1024}MB`
  //   });

  //   const uploadOptions = {
  //     resource_type: 'raw',
  //     public_id: publicId,
  //     folder: 'intercom/pdfs',
  //     use_filename: true,
  //     unique_filename: !publicId,
  //     overwrite: true,
  //     chunk_size: CHUNK_SIZE,
  //     timeout: UPLOAD_TIMEOUT,
  //     context: metadata ? Object.entries(metadata).map(([key, value]) => `${key}=${value}`).join('|') : undefined
  //   };

  //   const result = await uploadWithRetry(
  //     (opts) => cloudinary.uploader.upload_large(dataUri, opts),
  //     uploadOptions,
  //     MAX_RETRIES
  //   );

  //   return result;
  // };

module.exports = {
  uploadFromUrl,
  uploadFromBase64
};