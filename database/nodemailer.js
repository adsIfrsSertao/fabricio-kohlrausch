const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com", // Servidor SMTP para Hotmail/Outlook
  port: 587, // Porta para conexão
  secure: false, // Usar TLS
  auth: {
    user: "fabricio.k70@gmail.com", // Seu e-mail do Hotmail
    pass: "fbr.0897" // Sua senha do Hotmail (ou App Password se você estiver usando 2FA)
  }
});

module.exports = transporter;
