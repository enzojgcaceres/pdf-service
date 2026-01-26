// // services/lqm.js
// const axios = require('axios');
// const logger = require('../utils/logger');

// const LQM_BASE_URL = process.env.LQM_BASE_URL || 'https://www.lqm.com.ar/api/index.php';
// const LQM_BEARER_TOKEN = process.env.LQM_BEARER_TOKEN;
// const LQM_COMPANY_ID = process.env.LQM_COMPANY_ID || 'corral';


// // fallback: 4 horas si LQM no manda duración
// const DEFAULT_TOKEN_DURATION_SECONDS = Number(
//   process.env.LQM_TOKEN_EXPIRES_FALLBACK_SECONDS || 4 * 60 * 60
// );

// if (!LQM_BEARER_TOKEN) {
//   logger.warn('LQM_BEARER_TOKEN no está configurado. Las llamadas a LQM fallarán.');
// }

// // Cache por empresa (id): { accessToken, expiresAt }
// const tokenCache = new Map();

// /**
//  * Headers comunes para todas las llamadas a LQM
//  */
// function getCommonHeaders() {
//   return {
//     accept: 'application/json',
//     'Content-Type': 'application/json',
//     Authorization: `Bearer ${LQM_BEARER_TOKEN}`,
//   };
// }

// /**
//  * Pide un nuevo access_token a /token para la empresa indicada (id).
//  * Respuesta esperada:
//  * {
//  *   "status": "ok",
//  *   "access_token": "string",
//  *   "duration": "14400"
//  * }
//  */
// async function fetchNewAccessToken(requestId) {
//   const url = `${LQM_BASE_URL}/token`;

//   logger.info('LQM: fetching new access_token', {
//     requestId,
//     url,
//     companyId: LQM_COMPANY_ID,
//   });

//   try {
//     const { data } = await axios.post(
//       url,
//       { id: LQM_COMPANY_ID }, // <-- SIEMPRE "corral"
//       {
//         headers: getCommonHeaders(),
//         timeout: 10_000,
//       }
//     );

//     logger.info('LQM /token response', {
//       requestId,
//       companyId: LQM_COMPANY_ID,
//       status: data.status,
//     });

//     if (data.status !== 'ok') {
//       const err = new Error(`LQM /token devolvió status="${data.status}"`);
//       err.isLqmTokenError = true;
//       throw err;
//     }

//     const accessToken = data.access_token;
//     const durationSeconds = Number(
//       data.duration || DEFAULT_TOKEN_DURATION_SECONDS
//     );

//     if (!accessToken) {
//       const err = new Error('LQM /token no devolvió access_token');
//       err.isLqmTokenError = true;
//       throw err;
//     }

//     const expiresAt = Date.now() + (durationSeconds - 60) * 1000;

//     tokenCache.set(LQM_COMPANY_ID, { accessToken, expiresAt });

//     logger.info('LQM access_token cached', {
//       requestId,
//       companyId: LQM_COMPANY_ID,
//       durationSeconds,
//     });

//     return accessToken;
//   } catch (error) {
//     logger.error('Error fetching LQM access_token', {
//       requestId,
//       companyId: LQM_COMPANY_ID,
//       message: error.message,
//       status: error.response?.status,
//       data: error.response?.data,
//     });

//     if (!error.isLqmTokenError) {
//       error.isLqmTokenError = true;
//     }

//     throw error;
//   }
// }


// /**
//  * Devuelve un access_token válido para la empresa (id).
//  * Usa cache y renueva cuando está por expirar.
//  */
// async function getAccessToken(companyId, requestId) {
//   const cached = tokenCache.get(companyId);
//   const now = Date.now();

//   if (cached && cached.accessToken && now < cached.expiresAt) {
//     return cached.accessToken;
//   }

//   return fetchNewAccessToken(companyId, requestId);
// }

// /**
//  * Llama a /presupuesto y devuelve el PDF en base64 (campo "presupuesto").
//  * Request esperado:
//  * {
//  *   "access_token": "<TOKEN>",
//  *   "id": "corral",
//  *   "articulo": "ALV-2055516",
//  *   "sucursal": "Sucursal 1"
//  * }
//  *
//  * Respuesta:
//  * {
//  *   "status": "ok",
//  *   "presupuesto": "<BASE64_PDF>"
//  * }
//  */
// async function getPresupuestoPdfBase64({ id, articulo, sucursal, requestId }) {
//   // si no te interesa que Intercom mande id, simplemente ignoralo:
//   const companyId = LQM_COMPANY_ID; // siempre "corral"
//   const effectiveId = id || LQM_COMPANY_ID; // por si quieres usarlo igual en el body

//   const accessToken = await getAccessToken(companyId, requestId);

//   const url = `${LQM_BASE_URL}/presupuesto`;
//   const body = {
//     access_token: accessToken,
//     id: effectiveId,
//     articulo,
//     sucursal,
//   };

//   logger.info('LQM: calling /presupuesto', {
//     requestId,
//     url,
//     body,
//   });

//   try {
//     const { data } = await axios.post(url, body, {
//       headers: getCommonHeaders(),
//       timeout: 20_000,
//     });

//     logger.info('LQM /presupuesto response', {
//       requestId,
//       status: data.status,
//       hasPresupuesto: !!data.presupuesto,
//       message: data.message,
//     });

//     if (data.status !== 'ok') {
//       const err = new Error(
//         `LQM /presupuesto devolvió status="${data.status}"` +
//           (data.message ? `: ${data.message}` : '')
//       );
//       err.isLqmPresupuestoError = true;
//       err.lqmResponse = data;
//       throw err;
//     }

//     if (!data.presupuesto) {
//       const err = new Error('LQM /presupuesto no devolvió campo presupuesto');
//       err.isLqmPresupuestoError = true;
//       err.lqmResponse = data;
//       throw err;
//     }

//     return data.presupuesto;
//   } catch (error) {
//     logger.error('Error calling LQM /presupuesto', {
//       requestId,
//       message: error.message,
//       status: error.response?.status,
//       data: error.response?.data,
//       lqmResponse: error.lqmResponse,
//     });

//     if (!error.isLqmPresupuestoError) {
//       error.isLqmPresupuestoError = true;
//     }

//     throw error;
//   }
// }


// module.exports = {
//   getAccessToken,
//   getPresupuestoPdfBase64,
// };

// services/lqm.js

const axios = require('axios');
const logger = require('../utils/logger');

const LQM_BASE_URL = process.env.LQM_BASE_URL || 'https://www.lqm.com.ar/api/index.php';
const LQM_BEARER_TOKEN = process.env.LQM_BEARER_TOKEN;
const LQM_COMPANY_ID = process.env.LQM_COMPANY_ID || 'corral';

// sucursal fija según aclaración tuya
const LQM_DEFAULT_SUCURSAL = process.env.LQM_SUCURSAL || '9999 Capacitacion';

// fallback: 4 horas si LQM no manda duración
const DEFAULT_TOKEN_DURATION_SECONDS = Number(
  process.env.LQM_TOKEN_EXPIRES_FALLBACK_SECONDS || 4 * 60 * 60
);

if (!LQM_BEARER_TOKEN) {
  logger.warn('LQM_BEARER_TOKEN no está configurado. Las llamadas a LQM fallarán.');
}

// Cache por empresa (id): { accessToken, expiresAt }
const tokenCache = new Map();

/**
 * Headers comunes para todas las llamadas a LQM
 */
function getCommonHeaders() {
  return {
    accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LQM_BEARER_TOKEN}`,
  };
}

/**
 * Pide un nuevo access_token a /token para la empresa indicada (id).
 */
async function fetchNewAccessToken(companyId, requestId) {
  const url = `${LQM_BASE_URL}/token`;

  logger.info('LQM: fetching new access_token', {
    requestId,
    url,
    companyId,
  });

  try {
    const { data } = await axios.post(
      url,
      { id: companyId }, // siempre "corral"
      {
        headers: getCommonHeaders(),
        timeout: 10_000,
      }
    );

    logger.info('LQM /token response', {
      requestId,
      companyId,
      status: data.status,
    });

    if (data.status !== 'ok') {
      const err = new Error(`LQM /token devolvió status="${data.status}"`);
      err.isLqmTokenError = true;
      throw err;
    }

    const accessToken = data.access_token;
    const durationSeconds = Number(data.duration || DEFAULT_TOKEN_DURATION_SECONDS);

    if (!accessToken) {
      const err = new Error('LQM /token no devolvió access_token');
      err.isLqmTokenError = true;
      throw err;
    }

    const expiresAt = Date.now() + (durationSeconds - 60) * 1000;

    tokenCache.set(companyId, { accessToken, expiresAt });

    logger.info('LQM access_token cached', {
      requestId,
      companyId,
      durationSeconds,
    });

    return accessToken;
  } catch (error) {
    logger.error('Error fetching LQM access_token', {
      requestId,
      companyId,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (!error.isLqmTokenError) {
      error.isLqmTokenError = true;
    }

    throw error;
  }
}

/**
 * Devuelve un access_token válido para la empresa (id).
 */
async function getAccessToken(companyId = LQM_COMPANY_ID, requestId) {
  const cached = tokenCache.get(companyId);
  const now = Date.now();

  if (cached && cached.accessToken && now < cached.expiresAt) {
    return cached.accessToken;
  }

  return fetchNewAccessToken(companyId, requestId);
}

// function normalizeOptionalPromo(value) {
//   if (value === undefined || value === null) return undefined;
//   if (typeof value === 'string' && value.trim() === '') return undefined;
//   return value;
// }

function normalizeOptionalPromo(value) {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  // Si es vacío o es el guion que manda Intercom, devolvemos string vacío
  if (trimmed === '' || trimmed === '-') return "";
  return trimmed;
}

async function getPresupuestoPdfBase64({
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
  requestId,
  descuento, //
}) {


  // --- LOG 1: Ver qué recibe la función desde el controller ---
  console.log(`[LQM DEBUG - ${requestId}] Parámetros recibidos en service:`, { 
    articulo, sucursal, promocion, descuento 
  });


  const companyId = LQM_COMPANY_ID; // siempre "corral"
  const accessToken = await getAccessToken(companyId, requestId);

  const promo1 = normalizeOptionalPromo(promocion);
  const promo2 = normalizeOptionalPromo(promocion_2);
  const promo3 = normalizeOptionalPromo(promocion_3);
  
  const descuentoNormalizado = normalizeOptionalPromo(descuento);

  // --- LOG 2: Ver el resultado de la normalización ---
  console.log(`[LQM DEBUG - ${requestId}] Valores normalizados:`, { 
    promo1, promo2, promo3, descuentoNormalizado 
  });


  const url = `${LQM_BASE_URL}/presupuesto`;

  const body = {
    access_token: accessToken,
    id: companyId,
    articulo,
    cantidad,
    sucursal: sucursal || LQM_DEFAULT_SUCURSAL,
    servicios_recomendados:
      typeof servicios_recomendados === 'boolean' ? servicios_recomendados : true,
    cliente,
    telefono,
    mail, 
  };

  // Solo agregamos las promos que vengan con valor real
  if (promo1) body.promocion = promo1;
  if (promo2) body.promocion_2 = promo2;
  if (promo3) body.promocion_3 = promo3;
  if (descuentoNormalizado) body.descuento = descuentoNormalizado;

   // --- LOG 3: El objeto final que sale hacia LQM ---
  console.log(`[LQM DEBUG - ${requestId}] JSON final enviado a LQM:`, JSON.stringify(body));

  logger.info('LQM: calling /presupuesto', {
    requestId,
    url,
    body,
  });

  try {
    const { data } = await axios.post(url, body, {
      headers: getCommonHeaders(),
      timeout: 20_000,
    });

    logger.info('LQM /presupuesto response', {
      requestId,
      status: data.status,
      hasPresupuesto: !!data.presupuesto,
      message: data.message,
    });

    if (data.status !== 'ok') {
      const err = new Error(
        `LQM /presupuesto devolvió status="${data.status}"` +
          (data.message ? `: ${data.message}` : '')
      );
      err.isLqmPresupuestoError = true;
      err.lqmResponse = data;
      throw err;
    }

    if (!data.presupuesto) {
      const err = new Error('LQM /presupuesto no devolvió campo presupuesto');
      err.isLqmPresupuestoError = true;
      err.lqmResponse = data;
      throw err;
    }

    return data.presupuesto;
  } catch (error) {
    logger.error('Error calling LQM /presupuesto', {
      requestId,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      lqmResponse: error.lqmResponse,
    });

    if (!error.isLqmPresupuestoError) {
      error.isLqmPresupuestoError = true;
    }

    throw error;
  }
}

// async function getPresupuestoPdfBase64({
//   articulo,
//   cantidad,
//   sucursal,
//   promocion,
//   servicios_recomendados,
//   cliente,
//   telefono,
//   mail,
//   requestId,
// }) {
//   const companyId = LQM_COMPANY_ID; // siempre "corral"
//   const accessToken = await getAccessToken(companyId, requestId);

//   const url = `${LQM_BASE_URL}/presupuesto`;

//   const body = {
//     access_token: accessToken,
//     id: companyId, // fijo "corral"
//     articulo,
//     cantidad,
//     sucursal: sucursal || LQM_DEFAULT_SUCURSAL, // default "9999 Capacitacion"
//     promocion,
//     servicios_recomendados:
//       typeof servicios_recomendados === 'boolean' ? servicios_recomendados : true,
//     cliente,
//     telefono,
//     mail,
//   };

//   logger.info('LQM: calling /presupuesto', {
//     requestId,
//     url,
//     body, // si después querés, se puede anonimizar teléfono/mail
//   });

//   try {
//     const { data } = await axios.post(url, body, {
//       headers: getCommonHeaders(),
//       timeout: 20_000,
//     });

//     logger.info('LQM /presupuesto response', {
//       requestId,
//       status: data.status,
//       hasPresupuesto: !!data.presupuesto,
//       message: data.message,
//     });

//     if (data.status !== 'ok') {
//       const err = new Error(
//         `LQM /presupuesto devolvió status="${data.status}"` +
//           (data.message ? `: ${data.message}` : '')
//       );
//       err.isLqmPresupuestoError = true;
//       err.lqmResponse = data;
//       throw err;
//     }

//     if (!data.presupuesto) {
//       const err = new Error('LQM /presupuesto no devolvió campo presupuesto');
//       err.isLqmPresupuestoError = true;
//       err.lqmResponse = data;
//       throw err;
//     }

//     return data.presupuesto;
//   } catch (error) {
//     logger.error('Error calling LQM /presupuesto', {
//       requestId,
//       message: error.message,
//       status: error.response?.status,
//       data: error.response?.data,
//       lqmResponse: error.lqmResponse,
//     });

//     if (!error.isLqmPresupuestoError) {
//       error.isLqmPresupuestoError = true;
//     }

//     throw error;
//   }
// }

module.exports = {
  getAccessToken,
  getPresupuestoPdfBase64,
};
