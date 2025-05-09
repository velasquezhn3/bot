/**
 * Servicio para manejo de datos de estudiantes.
 */

const ExcelJS = require('exceljs');
const { excelFilePath, columnas } = require('../config/config');
const { downloadFile } = require('./dropboxService');

/**
 * Busca un estudiante por su ID en el archivo Excel.
 * @param {string} id - ID del estudiante.
 * @returns {Promise<Object|null>} Información del estudiante o null si no encontrado.
 */
async function buscarEstudiante(id) {
  try {
    // Download and cache the Excel file from Dropbox
    const localExcelPath = await downloadFile(excelFilePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(localExcelPath);
    const hoja = workbook.getWorksheet('Hoja1');

    let estudiante = null;

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber < 3) return;
      if (row.getCell(columnas.ID).value?.toString() === id) {
        const valorCelda = row.getCell(columnas.TOTAL_PAGAR).value;
        let totalPagar = 0;

        if (typeof valorCelda === 'number') {
          totalPagar = valorCelda;
        } else if (typeof valorCelda === 'string') {
          const numeroLimpio = valorCelda.replace(/[^0-9.]/g, '');
          totalPagar = parseFloat(numeroLimpio) || 0;
        } else if (valorCelda && typeof valorCelda === 'object') {
          if (valorCelda.text) {
            const numeroLimpio = valorCelda.text.replace(/[^0-9.]/g, '');
            totalPagar = parseFloat(numeroLimpio) || 0;
          } else if (valorCelda.result) {
            totalPagar = valorCelda.result;
          }
        }

        if (valorCelda && typeof valorCelda === 'string' && valorCelda.includes(',')) {
          const numeroLimpio = valorCelda
            .replace('L.', '')
            .replace('L', '')
            .replace(/\s/g, '')
            .replace(',', '');
          totalPagar = parseFloat(numeroLimpio) || 0;
        }

        estudiante = {
          nombre: row.getCell(columnas.NOMBRE).value,
          grado: row.getCell(columnas.GRADO).value,
          id,
          planDePago: row.getCell('H').value,  // Added planDePago from column H
          meses: Object.entries(columnas.MESES).reduce((acc, [mes, col]) => {
            acc[mes.toLowerCase()] = row.getCell(col).value;
            return acc;
          }, {}),
          totalPagar,
          valorCeldaOriginal: valorCelda
        };
      }
    });

    return estudiante;
  } catch (error) {
    console.error('Error en buscarEstudiante:', error);
    throw error;
  }
}

/**
 * Calcula la deuda actual de un estudiante.
 * @param {Object} estudiante - Objeto estudiante con información de pagos.
 * @returns {Object} Detalles de deuda y estado de pagos.
 */
function calcularDeuda(estudiante) {
  const ahora = new Date();
  const mesActual = ahora.getMonth() + 1;
  const meses = Object.keys(columnas.MESES).map((mes, index) => ({
    nombre: mes.toLowerCase(),
    num: index + 1
  }));

  // Determine starting month based on planDePago
  const inicioMes = estudiante.planDePago === 10 ? 2 : 1;

  const mesesPendientes = meses
    .filter(m => m.num >= inicioMes && m.num <= mesActual)
    .filter(m => {
      const valor = estudiante.meses[m.nombre];
      return !valor || valor.toString().trim() === '';
    });

  const totalDeuda = (estudiante.totalPagar * mesesPendientes.length).toFixed(2);

  return {
    totalDeuda,
    mesesPendientes: mesesPendientes.map(m => m.nombre.toUpperCase()),
    cuotaMensual: estudiante.totalPagar.toFixed(2),
    alDia: mesesPendientes.length === 0
  };
}

module.exports = {
  buscarEstudiante,
  calcularDeuda
};
