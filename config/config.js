const path = require('path');

/**
 * Configuración general y rutas de archivos.
 */

module.exports = {
  excelFilePath: '/datos_estudiantes.xlsx',
  relacionesFilePath: '/relaciones.xlsx',
  encargadosFilePath: path.join(__dirname, '..', 'encargados.json'),
  dataDir: path.join(__dirname, '..', 'data'),
  infoEscuela: {
    nombre: "Instituto Jose Cecilio Del Valle",
    direccion: "Colonia Altos De Loarque ,al final de la calle",
    telefono: "+504 2275-8510",
    email: "info@centroejemplo.edu.hn",
    horario: "Lunes a Viernes: 7:00 AM - 4:00 PM",
    sitioWeb: "www.JoseCecilio.edu.hn"
  },
  columnas: {
    NOMBRE: 'A',
    GRADO: 'B',
    ID: 'F',
    MESES: {
      ENERO: 'W', FEBRERO: 'X', MARZO: 'Y', ABRIL: 'Z',
      MAYO: 'AA', JUNIO: 'AB', JULIO: 'AC', AGOSTO: 'AD',
      SEPTIEMBRE: 'AE', OCTUBRE: 'AF', NOVIEMBRE: 'AG', DICIEMBRE: 'AH'
    },
    TOTAL_PAGAR: 'N'
  }
};
