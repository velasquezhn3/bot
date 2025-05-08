/**
 * Servicio para gestión de encargados y sus alumnos.
 */

const fs = require('fs');
const { encargadosFilePath } = require('../config/config');

let encargadosDB = { encargados: {} };

try {
  if (fs.existsSync(encargadosFilePath)) {
    encargadosDB = JSON.parse(fs.readFileSync(encargadosFilePath, 'utf8'));
  }
} catch (error) {
  console.error('Error al leer encargados.json:', error);
}

/**
 * Guarda la base de datos de encargados en archivo JSON.
 */
function guardarEncargados() {
  try {
    fs.writeFileSync(encargadosFilePath, JSON.stringify(encargadosDB, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar encargados.json:', error);
  }
}

/**
 * Registra la relación encargado-alumno.
 * @param {string} numeroEncargado - Número del encargado.
 * @param {string} idEstudiante - ID del estudiante.
 */
function registrarEncargado(numeroEncargado, idEstudiante) {
  if (!encargadosDB.encargados[numeroEncargado]) {
    encargadosDB.encargados[numeroEncargado] = { alumnos: [] };
  }

  if (!encargadosDB.encargados[numeroEncargado].alumnos.includes(idEstudiante)) {
    encargadosDB.encargados[numeroEncargado].alumnos.push(idEstudiante);
    guardarEncargados();
  }
}

/**
 * Obtiene los alumnos registrados de un encargado.
 * @param {string} numeroEncargado - Número del encargado.
 * @returns {string[]} Lista de IDs de alumnos.
 */
function obtenerAlumnosEncargado(numeroEncargado) {
  return encargadosDB.encargados[numeroEncargado]?.alumnos || [];
}

/**
 * Elimina la relación encargado-alumno.
 * @param {string} numeroEncargado - Número del encargado.
 * @param {string} idEstudiante - ID del estudiante.
 * @returns {boolean} True si se eliminó correctamente.
 */
function eliminarRelacion(numeroEncargado, idEstudiante) {
  if (encargadosDB.encargados[numeroEncargado]) {
    encargadosDB.encargados[numeroEncargado].alumnos =
      encargadosDB.encargados[numeroEncargado].alumnos.filter(id => id !== idEstudiante);
    guardarEncargados();
    return true;
  }
  return false;
}

module.exports = {
  registrarEncargado,
  obtenerAlumnosEncargado,
  eliminarRelacion
};
