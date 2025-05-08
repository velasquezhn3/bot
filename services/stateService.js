/**
 * Servicio para manejo de estados de conversación de usuarios.
 */

const estadosUsuarios = {};

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

module.exports = {
  establecerEstado,
  obtenerEstado
};
