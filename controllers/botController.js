/**
 * Controlador para conexión y manejo del bot WhatsApp.
 */

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const {
  buscarEstudiante,
  calcularDeuda
} = require('../services/studentService');
const {
  validarPIN
} = require('../services/pinService');
const {
  registrarEncargado,
  obtenerAlumnosEncargado,
  eliminarRelacion
} = require('../services/encargadoService');
const {
  establecerEstado,
  obtenerEstado,
  establecerUltimoSaludo,
  obtenerUltimoSaludo
} = require('../services/stateService');
const { infoEscuela, dataDir } = require('../config/config');

/**
 * Envía el menú principal al usuario.
 * @param {Object} bot - Instancia del bot.
 * @param {string} remitente - Número del usuario.
 */
async function enviarMenuPrincipal(bot, remitente) {
  const alumnos = obtenerAlumnosEncargado(remitente);
  let mensaje = `🏫 *BIENVENIDO AL SISTEMA ESCOLAR*\n\n`;

  if (alumnos.length > 0) {
    mensaje += `👨‍👩‍👧‍👦 Tiene ${alumnos.length} alumno(s) registrado(s)\n\n`;
  }

  mensaje += `Seleccione una opción:\n\n`;
  mensaje += `1️⃣ *Registrar* nuevo alumno\n`;
  mensaje += `2️⃣ *Consultar* estado de pagos\n`;
  mensaje += `3️⃣ *Información* de la escuela\n`;
  mensaje += `4️⃣ *Contactar* administración\n`;

  if (alumnos.length > 0) {
    mensaje += `5️⃣ *Eliminar* alumno de mi cuenta\n`;
  }

  mensaje += `\nResponda con el número de la opción deseada.`;

  establecerEstado(remitente, 'MENU_PRINCIPAL');
  await bot.sendMessage(remitente, { text: mensaje });
}

/**
 * Envía el estado de pagos detallado al usuario.
 * @param {Object} bot - Instancia del bot.
 * @param {string} remitente - Número del usuario.
 * @param {Object} estudiante - Información del estudiante.
 */
async function enviarEstadoPagos(bot, remitente, estudiante) {
  if (!estudiante || !estudiante.nombre) {
    await bot.sendMessage(remitente, {
      text: '❌ No se encontró información del alumno. Por favor contacte a administración.'
    });
    return;
  }

  const deuda = calcularDeuda(estudiante);
  // Define ordered months array in lowercase
  const mesesOrdenados = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const mesActualIndex = new Date().getMonth(); // 0-based index

  // Determine starting month index based on planDePago
  const inicioMesIndex = estudiante.planDePago === 10 ? 1 : 0; // febrero index 1, enero index 0

  const mesesHastaActualLower = mesesOrdenados.slice(inicioMesIndex, mesActualIndex + 1);

  const mesesKeys = Object.keys(estudiante.meses);

  let respuesta = `📊 *ESTADO DE PAGOS - ${estudiante.nombre.toUpperCase()}*\n`;
  respuesta += `🏫 Grado: ${estudiante.grado}\n\n`;

  mesesKeys
    .filter(mes => mesesHastaActualLower.includes(mes.toLowerCase()))
    .forEach(mes => {
      const valorMes = estudiante.meses[mes];
      const estado = valorMes ? `L.${parseFloat(valorMes).toFixed(2)} ✅ Pagado` : '❌ Pendiente';
      respuesta += `▫️ ${mes.charAt(0).toUpperCase() + mes.slice(1)}: ${estado}\n`;
    });

  respuesta += `\n💵 Cuota mensual: L.${deuda.cuotaMensual}`;
  respuesta += `\n📅 Meses pendientes: ${deuda.mesesPendientes.length}`;
  respuesta += deuda.alDia
    ? '\n\n✅ *AL DÍA EN PAGOS*'
    : `\n\n❌ *DEUDA MENSUALIDAD: L.${deuda.deudaMensualidad}*\n❌ *DEUDA MORA: L.${deuda.deudaMora}*\n❌ *DEUDA TOTAL: L.${deuda.totalDeuda}*`;

  if (estudiante.totalPagar < 10) {
    respuesta += `\n\n[DEBUG] Valor original: ${JSON.stringify(estudiante.valorCeldaOriginal)}`;
  }

  await bot.sendMessage(remitente, { text: respuesta });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enviarMensajeConDelay(bot, remitente, mensaje) {
  const delayMs = Math.floor(Math.random() * 10000) + 1000; // 1 to 10 seconds
  await delay(delayMs);
  await bot.sendMessage(remitente, mensaje);
}

/**
 * Procesa los mensajes recibidos y maneja la lógica de conversación.
 * @param {Object} bot - Instancia del bot.
 * @param {string} remitente - Número del usuario.
 * @param {string} mensaje - Texto del mensaje recibido.
 */
async function procesarMensaje(bot, remitente, mensaje) {
  const estado = obtenerEstado(remitente);
  const alumnos = obtenerAlumnosEncargado(remitente);
  const textoMinuscula = mensaje.toLowerCase();

  // Check if greeting was sent today
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimoSaludo = obtenerUltimoSaludo(remitente);
  let esPrimerMensajeDelDia = false;

  if (ultimoSaludo !== hoy) {
    esPrimerMensajeDelDia = true;
    establecerUltimoSaludo(remitente, hoy);
    const saludo = `🐺 ¡Hola! Soy Chilo el lobo asistente virtual del Instituto José Cecilio del Valle.\nEstoy aquí para ayudarte. ¿En qué puedo asistirte hoy? 📚✨.`;
    await enviarMensajeConDelay(bot, remitente, { text: saludo });
    // Set state to MENU_PRINCIPAL after greeting
    establecerEstado(remitente, 'MENU_PRINCIPAL');
    await enviarMenuPrincipal(bot, remitente);
    return;
  }

  if (textoMinuscula === 'menu' || textoMinuscula === 'menú') {
    await enviarMenuPrincipal(bot, remitente);
    return;
  }

  switch (estado.estado) {
    case 'MENU_PRINCIPAL':
      switch (mensaje) {
        case '1':
          establecerEstado(remitente, 'REGISTRO_ID');
          await enviarMensajeConDelay(bot, remitente, {
            text: '📝 *REGISTRO DE ALUMNO*\n\nPor favor, ingrese el número de identidad del alumno (13 dígitos):'
          });
          break;

        case '2':
          if (alumnos.length === 0) {
            await enviarMensajeConDelay(bot, remitente, {
              text: '❌ No tiene alumnos registrados. Seleccione la opción 1️⃣ para registrar un alumno.'
            });
            await enviarMenuPrincipal(bot, remitente);
          } else if (alumnos.length === 1) {
            const estudiante = await buscarEstudiante(alumnos[0]);
            if (estudiante) {
              await enviarEstadoPagos(bot, remitente, estudiante);
              setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
            } else {
              await enviarMensajeConDelay(bot, remitente, {
                text: '❌ No se encontró información del alumno registrado. Por favor contacte a administración.'
              });
              await enviarMenuPrincipal(bot, remitente);
            }
          } else {
            let mensajeLista = '👨‍👩‍👧‍👦 *SELECCIONE ALUMNO*\n\n';
            let contador = 1;

            for (const idAlumno of alumnos) {
              const estudiante = await buscarEstudiante(idAlumno);
              if (estudiante) {
                mensajeLista += `${contador}. ${estudiante.nombre} - ${estudiante.grado}\n`;
                contador++;
              }
            }

            mensajeLista += '\nResponda con el número del alumno para ver su estado de pagos.';
            establecerEstado(remitente, 'SELECCION_ALUMNO', { alumnos });
            await enviarMensajeConDelay(bot, remitente, { text: mensajeLista });
          }
          break;

        case '3':
          let infoMensaje = `📚 *INFORMACIÓN DE LA ESCUELA*\n\n`;
          infoMensaje += `*${infoEscuela.nombre}*\n\n`;
          infoMensaje += `📍 *Dirección:* ${infoEscuela.direccion}\n`;
          infoMensaje += `📞 *Teléfono:* ${infoEscuela.telefono}\n`;
          infoMensaje += `📧 *Email:* ${infoEscuela.email}\n`;
          infoMensaje += `⏰ *Horario:* ${infoEscuela.horario}\n`;
          infoMensaje += `🌐 *Sitio Web:* ${infoEscuela.sitioWeb}\n\n`;
          infoMensaje += `Escriba *menú* para volver al menú principal.`;

          await enviarMensajeConDelay(bot, remitente, { text: infoMensaje });
          break;

        case '4':
          let contactoMensaje = `📞 *CONTACTAR ADMINISTRACIÓN*\n\n`;
          contactoMensaje += `Para consultas administrativas puede comunicarse al:\n`;
          contactoMensaje += `📱 *WhatsApp:* ${infoEscuela.telefono}\n`;
          contactoMensaje += `📧 *Email:* ${infoEscuela.email}\n\n`;
          contactoMensaje += `⏰ *Horario de atención:*\n`;
          contactoMensaje += `${infoEscuela.horario}\n\n`;
          contactoMensaje += `Escriba *menú* para volver al menú principal.`;

          await enviarMensajeConDelay(bot, remitente, { text: contactoMensaje });
          break;

        case '5':
          if (alumnos.length === 0) {
            await enviarMensajeConDelay(bot, remitente, {
              text: '❌ No tiene alumnos registrados para eliminar.'
            });
            await enviarMenuPrincipal(bot, remitente);
          } else {
            let mensajeEliminar = '🗑️ *ELIMINAR ALUMNO*\n\n';
            let contador = 1;

            for (const idAlumno of alumnos) {
              const estudiante = await buscarEstudiante(idAlumno);
              if (estudiante) {
                mensajeEliminar += `${contador}. ${estudiante.nombre} - ${estudiante.grado}\n`;
                contador++;
              }
            }

            mensajeEliminar += '\nResponda con el número del alumno que desea eliminar de su cuenta.';
            establecerEstado(remitente, 'ELIMINAR_ALUMNO', { alumnos });
            await enviarMensajeConDelay(bot, remitente, { text: mensajeEliminar });
          }
          break;

        default:
          // Suppress invalid option message on first message of the day
          if (!esPrimerMensajeDelDia) {
            await enviarMensajeConDelay(bot, remitente, {
              text: '❓ Opción no válida. Por favor seleccione una opción del menú.'
            });
          }
          await enviarMenuPrincipal(bot, remitente);
          break;
      }
      break;

    case 'REGISTRO_ID':
      if (/^\d{13}$/.test(mensaje)) {
        const estudiante = await buscarEstudiante(mensaje);
        if (estudiante) {
          establecerEstado(remitente, 'REGISTRO_PIN', { idEstudiante: mensaje });
          await enviarMensajeConDelay(bot, remitente, {
            text: `✅ *Alumno encontrado:* ${estudiante.nombre}\n\nAhora ingrese el PIN de autorización:`
          });
        } else {
          await enviarMensajeConDelay(bot, remitente, {
            text: '❌ El número de identidad no está registrado en el sistema. Verifique e intente nuevamente.'
          });
        }
      } else {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Formato incorrecto. El número de identidad debe tener 13 dígitos numéricos.\n\nIntente nuevamente o escriba *menú* para volver al menú principal.'
        });
      }
      break;

    case 'REGISTRO_PIN':
      const pinValido = await validarPIN(estado.datos.idEstudiante, mensaje);

      if (pinValido) {
        await registrarEncargado(remitente, estado.datos.idEstudiante);
        const estudiante = await buscarEstudiante(estado.datos.idEstudiante);

        await enviarMensajeConDelay(bot, remitente, {
          text: `✅ *REGISTRO EXITOSO*\n\nEl alumno *${estudiante.nombre}* ha sido vinculado a su número.\n\nYa puede consultar su estado de pagos desde el menú principal.`
        });

        setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
      } else {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ PIN incorrecto. Verifique e intente nuevamente o escriba *menú* para volver al menú principal.'
        });
      }
      break;

    case 'SELECCION_ALUMNO':
      const indice = parseInt(mensaje, 10) - 1;

      if (isNaN(indice) || indice < 0 || indice >= estado.datos.alumnos.length) {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Opción no válida. Por favor seleccione un número de la lista.'
        });
      } else {
        const idAlumno = estado.datos.alumnos[indice];
        const estudiante = await buscarEstudiante(idAlumno);

        if (estudiante) {
          await enviarEstadoPagos(bot, remitente, estudiante);
          setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
        } else {
          await enviarMensajeConDelay(bot, remitente, {
            text: '❌ No se encontró información del alumno seleccionado. Por favor contacte a administración.'
          });
          await enviarMenuPrincipal(bot, remitente);
        }
      }
      break;

    case 'ELIMINAR_ALUMNO':
      const indiceEliminar = parseInt(mensaje, 10) - 1;

      if (isNaN(indiceEliminar) || indiceEliminar < 0 || indiceEliminar >= estado.datos.alumnos.length) {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Opción no válida. Por favor seleccione un número de la lista.'
        });
      } else {
        const idAlumno = estado.datos.alumnos[indiceEliminar];
        const estudiante = await buscarEstudiante(idAlumno);

        if (eliminarRelacion(remitente, idAlumno)) {
          await enviarMensajeConDelay(bot, remitente, {
            text: `✅ El alumno *${estudiante.nombre}* ha sido eliminado de su cuenta correctamente.`
          });
        } else {
          await enviarMensajeConDelay(bot, remitente, {
            text: '❌ Error al eliminar el alumno. Por favor contacte a administración.'
          });
        }

        setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
      }
      break;

    default:
      await enviarMenuPrincipal(bot, remitente);
      break;
  }
}

/**
 * Inicia la conexión del bot WhatsApp.
 */
async function iniciarBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(dataDir, 'session'));

    const bot = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ["Sistema Escolar", "Chrome", "122.0.6261.94"],
      mobile: false
    });

bot.ev.on('connection.update', (update) => {
  console.log('Connection update event:', JSON.stringify(update, null, 2));
  if (update.qr) {
    console.log('QR code event received');
    console.log('QR code received, scan please:');
    qrcodeTerminal.generate(update.qr, { small: true });

    // Generate QR code string and save to file for Railway environment
    qrcodeTerminal.generate(update.qr, { small: true }, (qrString) => {
      const qrFilePath = path.join(dataDir, 'qr_code.txt');
      fs.writeFile(qrFilePath, qrString, (err) => {
        if (err) {
          console.error('Error saving QR code to file:', err);
        } else {
          console.log(`QR code saved to file: ${qrFilePath}`);
        }
      });
    });

    // Generate QR code PNG file and log data URL
    const qrPngPath = path.join(dataDir, 'qr_code.png');
    qrcode.toFile(qrPngPath, update.qr, { type: 'png' }, (err) => {
      if (err) {
        console.error('Error generating QR code PNG:', err);
      } else {
        console.log(`QR code PNG saved to file: ${qrPngPath}`);
      }
    });

    qrcode.toDataURL(update.qr, (err, url) => {
      if (err) {
        console.error('Error generating QR code data URL:', err);
      } else {
        console.log('QR code data URL:', url);
      }
    });
  }
  if (update.connection) {
    console.log('Connection update:', update.connection);
  }
  if (update.lastDisconnect) {
    console.log('Last disconnect info:', JSON.stringify(update.lastDisconnect, null, 2));
    const statusCode = update.lastDisconnect.error?.output?.statusCode || update.lastDisconnect.statusCode;
    console.log('Last disconnect status code:', statusCode);
if (statusCode === 401) {
  console.log('Unauthorized, deleting session and restarting...');
  // Delete session files to force re-authentication
  const sessionPath = path.join(dataDir, 'session');
  fs.rm(sessionPath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('Error deleting session files:', err);
    } else {
      console.log('Session files deleted successfully.');
    }
    setTimeout(iniciarBot, 3000);
  });
  return; // Prevent further restart until deletion completes
}
  }
  if (update.connection === 'close') {
    console.log('Connection closed, restarting bot in 3 seconds...');
    setTimeout(iniciarBot, 3000);
  }
});

    bot.ev.on('creds.update', saveCreds);

    bot.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.key.fromMe && msg.message) {
        const remitente = msg.key.remoteJid;
        let texto = '';

        if (msg.message.conversation) {
          texto = msg.message.conversation.trim();
        } else if (msg.message.extendedTextMessage) {
          texto = msg.message.extendedTextMessage.text.trim();
        }

        if (texto) {
          await procesarMensaje(bot, remitente, texto);
        }
      }
    });

    console.log('🔔 BOT INICIADO - ESCANEE EL CÓDIGO QR');
  } catch (error) {
    console.error('Error al iniciar el bot:', error);
  }
}

module.exports = {
  iniciarBot,
  procesarMensaje,
  enviarMenuPrincipal,
  enviarEstadoPagos
};
