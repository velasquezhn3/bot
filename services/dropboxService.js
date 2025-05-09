const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Dropbox } = require('dropbox');
const axios = require('axios');

// 1. Configuración de variables de entorno
const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;

// Verificar que todas las variables estén configuradas
if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('ERROR: Las siguientes variables de entorno deben estar configuradas:');
  console.error('- DROPBOX_CLIENT_ID');
  console.error('- DROPBOX_CLIENT_SECRET');
  console.error('- DROPBOX_REFRESH_TOKEN');
  process.exit(1);
}

// 2. Variables globales para manejar la conexión
let dbxInstance = null;
let currentAccessToken = null;

// 3. Función para refrescar el token de acceso
async function refreshAccessToken() {
  try {
    const response = await axios.post('https://api.dropbox.com/oauth2/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    currentAccessToken = response.data.access_token;
    console.log('Token de acceso refrescado exitosamente');
    return currentAccessToken;
  } catch (error) {
    console.error('ERROR AL REFRESCAR TOKEN:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error('No se pudo refrescar el token de acceso a Dropbox');
  }
}

// 4. Función para obtener la instancia de Dropbox
async function getDropboxInstance() {
  if (!dbxInstance || !currentAccessToken) {
    await refreshAccessToken();
    dbxInstance = new Dropbox({ 
      accessToken: currentAccessToken,
      fetch: require('node-fetch').default
    });
  }
  return dbxInstance;
}

// 5. Configuración del sistema de caché
const cacheDir = path.join(os.tmpdir(), 'dropbox_cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// 6. Función para generar hash de rutas (para nombres de archivos en caché)
function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// 7. Función para obtener la ruta local del archivo en caché
function getCacheFilePath(dropboxPath) {
  const hashedName = hashString(dropboxPath);
  return path.join(cacheDir, hashedName);
}

// 8. Función principal para descargar archivos con manejo de errores
async function downloadFile(dropboxPath, maxRetries = 3) {
  const localPath = getCacheFilePath(dropboxPath);
  const metaPath = localPath + '.meta.json';

  // Verificar si el archivo ya está en caché y es actual
  if (fs.existsSync(localPath) && fs.existsSync(metaPath)) {
    try {
      const cachedMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const dbx = await getDropboxInstance();
      const currentMeta = await dbx.filesGetMetadata({ path: dropboxPath });
      
      if (currentMeta.result.rev === cachedMeta.rev) {
        console.log(`Usando versión en caché de: ${dropboxPath}`);
        return localPath;
      }
    } catch (error) {
      console.warn('Advertencia al verificar caché:', error.message);
    }
  }

  // Intentar descargar el archivo
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const dbx = await getDropboxInstance();
      const response = await dbx.filesDownload({ path: dropboxPath });
      
      // Guardar archivo y metadatos
      fs.writeFileSync(localPath, response.result.fileBinary, 'binary');
      fs.writeFileSync(metaPath, JSON.stringify({
        rev: response.result.rev,
        server_modified: response.result.server_modified,
        last_updated: new Date().toISOString()
      }));

      console.log(`Archivo descargado exitosamente: ${dropboxPath}`);
      return localPath;
    } catch (error) {
      lastError = error;
      
      if (error.status === 401 && attempt < maxRetries) {
        console.log(`Token expirado (intento ${attempt}/${maxRetries}), refrescando...`);
        dbxInstance = null;
        currentAccessToken = null;
        continue;
      }
      
      break;
    }
  }

  console.error(`ERROR después de ${maxRetries} intentos al descargar: ${dropboxPath}`);
  throw lastError || new Error('Error desconocido al descargar archivo');
}

// 9. Función para verificar la conexión
async function testConnection() {
  try {
    const dbx = await getDropboxInstance();
    const account = await dbx.usersGetCurrentAccount();
    
    if (account?.result?.name?.display_name) {
      console.log(`Conectado a Dropbox como: ${account.result.name.display_name}`);
      return true;
    }
    throw new Error('Respuesta inesperada de la API');
  } catch (error) {
    console.error('ERROR DE CONEXIÓN A DROPBOX:', error);
    return false;
  }
}

// 10. Exportar funciones
module.exports = {
  downloadFile,
  testConnection,
  getDropboxInstance
};
