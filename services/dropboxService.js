const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Dropbox } = require('dropbox');
const axios = require('axios');

// 1. Configuración de credenciales
const DROPBOX_CONFIG = {
  clientId: process.env.DROPBOX_CLIENT_ID,
  clientSecret: process.env.DROPBOX_CLIENT_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN
};

// 2. Verificación de credenciales
if (!DROPBOX_CONFIG.clientId || !DROPBOX_CONFIG.clientSecret || !DROPBOX_CONFIG.refreshToken) {
  console.error('ERROR: Configuración incompleta de Dropbox');
  console.error('Se requieren las siguientes variables de entorno:');
  console.error('- DROPBOX_CLIENT_ID');
  console.error('- DROPBOX_CLIENT_SECRET');
  console.error('- DROPBOX_REFRESH_TOKEN');
  process.exit(1);
}

// 3. Estado de la conexión
let dropboxInstance = null;
let accessToken = null;
let lastTokenRefresh = null;

// 4. Función para refrescar el token con manejo robusto de errores
async function refreshDropboxToken() {
  try {
    console.log('Refrescando token de acceso a Dropbox...');
    
    const response = await axios.post('https://api.dropbox.com/oauth2/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: DROPBOX_CONFIG.refreshToken,
        client_id: DROPBOX_CONFIG.clientId,
        client_secret: DROPBOX_CONFIG.clientSecret
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000 // 10 segundos de timeout
    });

    accessToken = response.data.access_token;
    lastTokenRefresh = new Date();
    
    console.log('Token refrescado exitosamente');
    return accessToken;
  } catch (error) {
    console.error('ERROR CRÍTICO al refrescar token:', {
      status: error.response?.status,
      code: error.code,
      message: error.message,
      responseData: error.response?.data
    });
    
    throw new Error('No se pudo renovar el token de acceso a Dropbox');
  }
}

// 5. Función para obtener instancia de Dropbox con token fresco
async function getDropboxClient() {
  // Si no hay token o el token tiene más de 1 hora, refrescar
  if (!accessToken || (lastTokenRefresh && (new Date() - lastTokenRefresh) > 3600000)) {
    await refreshDropboxToken();
  }

  if (!dropboxInstance) {
    dropboxInstance = new Dropbox({ 
      accessToken,
      fetch: require('node-fetch').default
    });
  }

  return dropboxInstance;
}

// 6. Sistema de caché mejorado
const CACHE_SETTINGS = {
  dir: path.join(os.tmpdir(), 'dropbox_cache_v2'),
  ttl: 3600000 // 1 hora
};

if (!fs.existsSync(CACHE_SETTINGS.dir)) {
  fs.mkdirSync(CACHE_SETTINGS.dir, { recursive: true });
}

function getCacheKey(filePath) {
  return crypto.createHash('sha256').update(filePath).digest('hex');
}

function getCachedFilePath(dropboxPath) {
  return path.join(CACHE_SETTINGS.dir, getCacheKey(dropboxPath));
}

// 7. Función principal para descargar archivos con reintentos
async function downloadWithRetry(dropboxPath, options = {}) {
  const {
    maxRetries = 3,
    useCache = true,
    forceRefresh = false
  } = options;

  const cachedPath = getCachedFilePath(dropboxPath);
  const metaPath = `${cachedPath}.meta`;

  // Verificar caché si está habilitado y no se fuerza refresco
  if (useCache && !forceRefresh && fs.existsSync(cachedPath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const dbx = await getDropboxClient();
      const currentMeta = await dbx.filesGetMetadata({ path: dropboxPath });
      
      if (currentMeta.result.rev === meta.rev) {
        console.log(`[CACHÉ] Usando versión almacenada de: ${dropboxPath}`);
        return cachedPath;
      }
    } catch (error) {
      console.warn(`[CACHÉ] Error al verificar metadatos: ${error.message}`);
    }
  }

  let lastError = null;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const dbx = await getDropboxClient();
      const response = await dbx.filesDownload({ path: dropboxPath });

      // Guardar archivo y metadatos
      fs.writeFileSync(cachedPath, response.result.fileBinary, 'binary');
      fs.writeFileSync(metaPath, JSON.stringify({
        rev: response.result.rev,
        server_modified: response.result.server_modified,
        cached_at: new Date().toISOString()
      }));

      console.log(`[DESCARGA] Archivo obtenido: ${dropboxPath}`);
      return cachedPath;
    } catch (error) {
      lastError = error;
      
      // Manejo específico para token expirado
      if (error.status === 401 || error?.error?.error?.['.tag'] === 'expired_access_token') {
        console.log(`[TOKEN] Detectado token expirado (intento ${attempt}/${maxRetries})`);
        dropboxInstance = null;
        accessToken = null;
        await refreshDropboxToken();
        continue;
      }

      // Para otros errores, romper el ciclo
      break;
    }
  }

  console.error(`[ERROR] Fallo después de ${attempt} intentos con: ${dropboxPath}`);
  throw lastError || new Error(`Error al descargar ${dropboxPath}`);
}

// 8. Función para verificar conexión
async function verifyDropboxConnection() {
  try {
    const dbx = await getDropboxClient();
    const account = await dbx.usersGetCurrentAccount();
    
    if (!account?.result?.name?.display_name) {
      throw new Error('Respuesta inesperada de la API');
    }
    
    console.log(`[CONEXIÓN] Conectado a Dropbox como: ${account.result.name.display_name}`);
    return true;
  } catch (error) {
    console.error('[CONEXIÓN] Error de conexión:', {
      message: error.message,
      stack: error.stack
    });
    return false;
  }
}

// 9. Inicialización automática al cargar el módulo
(async () => {
  try {
    await verifyDropboxConnection();
  } catch (error) {
    console.error('[INICIO] Error al verificar conexión inicial:', error);
  }
})();

module.exports = {
  downloadFile: downloadWithRetry,
  verifyConnection: verifyDropboxConnection,
  getClient: getDropboxClient,
  refreshToken: refreshDropboxToken
};
