const fs = require('fs');
const path = require('path');
const adminsFilePath = path.join(__dirname, '..', 'config', 'admins.json');

let admins = [];

try {
  const data = fs.readFileSync(adminsFilePath, 'utf8');
  admins = JSON.parse(data);
} catch (error) {
  console.error('Error reading admins.json:', error);
}

/**
 * Checks if a phone number is an admin.
 * @param {string} phoneNumber - The phone number with WhatsApp suffix (e.g., 1234567890@s.whatsapp.net).
 * @returns {boolean} True if admin, false otherwise.
 */
function isAdmin(phoneNumber) {
  return admins.includes(phoneNumber);
}

module.exports = {
  isAdmin
};
