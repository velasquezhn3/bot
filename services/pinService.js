/**
 * Servicio para validación de PIN.
 */

const ExcelJS = require('exceljs');
const { relacionesFilePath } = require('../config/config');
const { downloadFile } = require('./dropboxService');

/**
 * Valida el PIN para un estudiante dado.
 * @param {string} idEstudiante - ID del estudiante.
 * @param {string} pin - PIN a validar.
 * @returns {Promise<boolean>} True si el PIN es válido.
 */
async function validarPIN(idEstudiante, pin) {
  try {
    // Download and cache the Excel file from Dropbox
    const localExcelPath = await downloadFile(relacionesFilePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(localExcelPath);
    const hoja = workbook.getWorksheet(1);

    let pinValido = false;

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const idRow = row.getCell(1).value?.toString();
      const pinRow = row.getCell(2).value?.toString();

      if (idRow === idEstudiante && pinRow === pin) {
        pinValido = true;
      }
    });

    return pinValido;
  } catch (error) {
    console.error('Error al validar PIN:', error);
    return false;
  }
}

module.exports = {
  validarPIN
};
