const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Dropbox } = require('dropbox');

const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Error: DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET, and DROPBOX_REFRESH_TOKEN environment variables must be set.');
  process.exit(1);
}

let dbx = null;

async function getDropboxInstance() {
  if (dbx) {
    return dbx;
  }
  const fetchModule = await import('node-fetch');
  const fetch = fetchModule.default;

  // Get new access token using refresh token
  const tokenResponse = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to refresh access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  dbx = new Dropbox({ accessToken, fetch });

  // Test connection
  try {
    const currentAccount = await dbx.usersGetCurrentAccount();
    console.log('Dropbox connection response:', JSON.stringify(currentAccount, null, 2));
    if (currentAccount && currentAccount.name && currentAccount.name.display_name) {
      console.log('Dropbox connection successful:', currentAccount.name.display_name);
    } else {
      console.warn('Dropbox connection response missing name.display_name property');
    }
  } catch (error) {
    console.error('Error testing Dropbox connection:', error);
    throw error;
  }

  return dbx;
}

const cacheDir = path.join(os.tmpdir(), 'ijcvwabot_dropbox_cache');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

/**
 * Generate a hash for a given string (used for cache file naming).
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Get local cache file path for a Dropbox file path.
 * @param {string} dropboxPath
 * @returns {string}
 */
function getCacheFilePath(dropboxPath) {
  const hashedName = hashString(dropboxPath);
  return path.join(cacheDir, hashedName);
}

/**
 * Download a file from Dropbox and cache it locally.
 * If the file is already cached and unchanged, returns the cached path.
 * @param {string} dropboxPath - The path of the file in Dropbox (e.g. '/datos_estudiantes.xlsx')
 * @returns {Promise<string>} - Local cached file path
 */
async function downloadFile(dropboxPath) {
  const localPath = getCacheFilePath(dropboxPath);
  const metaPath = localPath + '.meta.json';

  // Check if cached file exists and metadata exists
  if (fs.existsSync(localPath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      // Get current metadata from Dropbox to check if file changed
      const dbx = await getDropboxInstance();
      const currentMeta = await dbx.filesGetMetadata({ path: dropboxPath });
      if (currentMeta.result.rev === meta.rev) {
        // File unchanged, return cached path
        return localPath;
      }
    } catch (err) {
      // If any error occurs, proceed to download fresh
      console.warn('Warning checking Dropbox file metadata:', err);
    }
  }

  // Download file from Dropbox
  try {
    const dbx = await getDropboxInstance();
    const response = await dbx.filesDownload({ path: dropboxPath });
    const fileBinary = response.result.fileBinary || response.result.fileBlob || response.result.fileBinary;

    // Write file to local cache
    fs.writeFileSync(localPath, fileBinary, 'binary');

    // Save metadata
    const meta = {
      rev: response.result.rev,
      server_modified: response.result.server_modified
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf8');

    return localPath;
  } catch (error) {
    console.error('Error downloading file from Dropbox:', error);
    throw error;
  }
}

module.exports = {
  downloadFile
};
