/**
 * Servicio para manejo de estados de conversación de usuarios.
 */

const estadosUsuarios = {};
const ultimosSaludo = {}; // Track last greeting date per user

/**
 * Establece el estado de un usuario.
 * @param {string} numero - Número del usuario.
 * @param {string} estado - Estado a establecer.
 * @param {Object} datos - Datos adicionales.
 */
function establecerEstado(numero, estado, datos = {}) {
  estadosUsuarios[numero] = { estado, datos, timestamp: Date.now() };
}

/**
 * Obtiene el estado actual de un usuario.
 * Elimina estados con más de 10 minutos de antigüedad.
 * @param {string} numero - Número del usuario.
 * @returns {Object} Estado y datos.
 */
function obtenerEstado(numero) {
  if (estadosUsuarios[numero] && Date.now() - estadosUsuarios[numero].timestamp > 10 * 60 * 1000) {
    delete estadosUsuarios[numero];
  }
  return estadosUsuarios[numero] || { estado: 'MENU_PRINCIPAL', datos: {} };
}

/**
 * Establece la fecha del último saludo enviado a un usuario.
 * @param {string} numero - Número del usuario.
 * @param {string} fecha - Fecha en formato YYYY-MM-DD.
 */
function establecerUltimoSaludo(numero, fecha) {
  ultimosSaludo[numero] = fecha;
}

/**
 * Obtiene la fecha del último saludo enviado a un usuario.
 * @param {string} numero - Número del usuario.
 * @returns {string|null} Fecha en formato YYYY-MM-DD o null si no existe.
 */
function obtenerUltimoSaludo(numero) {
  return ultimosSaludo[numero] || null;
}

module.exports = {
  establecerEstado,
  obtenerEstado,
  establecerUltimoSaludo,
  obtenerUltimoSaludo
};
