const tls = require('tls');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

if (!SMTP_USER && !SMTP_PASS) {
  console.warn('[email] SMTP_USER y SMTP_PASS no configurados en .env — el envio de correos no funcionara');
} else if (!SMTP_USER || !SMTP_PASS) {
  console.warn('[email] Falta SMTP_USER o SMTP_PASS en .env');
}

function smtpSend(from, to, subject, html) {
  return new Promise((resolve, reject) => {
    if (!SMTP_USER || !SMTP_PASS) {
      resolve({ sent: false, reason: 'SMTP_USER o SMTP_PASS no configurados en .env' });
      return;
    }

    const CRLF = '\r\n';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var now = new Date();
    var dateStr = days[now.getUTCDay()] + ', ' + now.getUTCDate() + ' ' + months[now.getUTCMonth()] + ' ' +
                  now.getUTCFullYear() + ' ' + now.getUTCHours().toString().padStart(2, '0') + ':' +
                  now.getUTCMinutes().toString().padStart(2, '0') + ':' +
                  now.getUTCSeconds().toString().padStart(2, '0') + ' +0000';
    var msg = '';
    msg += 'Date: ' + dateStr + CRLF;
    msg += 'From: ' + from + CRLF;
    msg += 'To: ' + to + CRLF;
    msg += 'Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=' + CRLF;
    msg += 'MIME-Version: 1.0' + CRLF;
    msg += 'Content-Type: text/html; charset="UTF-8"' + CRLF;
    msg += 'Content-Transfer-Encoding: base64' + CRLF;
    msg += CRLF;
    msg += Buffer.from(html).toString('base64');
    msg += CRLF + '.' + CRLF;

    var socket;
    var buf = '';
    var step = 0;
    var authed = false;
    var base64User = Buffer.from(SMTP_USER).toString('base64');
    var base64Pass = Buffer.from(SMTP_PASS).toString('base64');

    function send(line) {
      socket.write(line + CRLF);
    }

    function onData(data) {
      buf += data.toString();
      var lines = buf.split(CRLF);
      buf = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var code = parseInt(line.substring(0, 3), 10);
        var isFinal = line[3] === ' ';

        if (step === 0 && code === 220) {
          step = 1;
          send('EHLO localhost');
        } else if (step === 1 && code === 250 && isFinal) {
          step = 2;
          send('AUTH LOGIN');
        } else if (step === 2 && code === 334) {
          step = 3;
          send(base64User);
        } else if (step === 3 && code === 334) {
          step = 4;
          send(base64Pass);
        } else if (step === 4 && code === 235) {
          authed = true;
          step = 5;
          send('MAIL FROM:<' + from + '>');
        } else if (step === 5 && code === 250 && isFinal) {
          step = 6;
          send('RCPT TO:<' + to + '>');
        } else if (step === 6 && code === 250 && isFinal) {
          step = 7;
          send('DATA');
        } else if (step === 7 && code === 354) {
          step = 8;
          socket.write(msg);
        } else if (step === 8 && code === 250 && isFinal) {
          step = 9;
          send('QUIT');
          socket.end();
          resolve({ sent: true });
        } else if (code >= 500) {
          socket.end();
          console.error('[SMTP] Error response:', line.substring(0, 200));
          resolve({ sent: false, reason: 'SMTP error: ' + line.substring(0, 100) });
        }
      }
    }

    function onError(err) {
      if (socket) socket.destroy();
      console.error('[SMTP] Connection error:', err.message);
      resolve({ sent: false, reason: err.message });
    }

    socket = tls.connect(SMTP_PORT, SMTP_HOST, {
      rejectUnauthorized: false
    }, function () {
      socket.on('data', onData);
    });
    socket.on('error', onError);
  });
}

function buildEmailHtml(title, userName, bodyText, ctaLink, ctaText, footerNote) {
  return '<!DOCTYPE html>' +
  '<html><head><meta charset="utf-8"></head>' +
  '<body style="margin:0;padding:0;background-color:#0F1115;font-family:Geist,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F1115;padding:40px 20px">' +
      '<tr><td align="center">' +
        '<table width="480" cellpadding="0" cellspacing="0" style="background-color:#171A21;border-radius:12px;border:1px solid #2B313C;padding:32px">' +
          '<tr><td style="padding-bottom:24px;text-align:center">' +
            '<h1 style="color:#5B7CFA;font-size:24px;font-weight:700;margin:0">DevInterview</h1>' +
          '</td></tr>' +
          '<tr><td style="padding-bottom:16px">' +
            '<h2 style="color:#E6E8EE;font-size:18px;font-weight:600;margin:0">' + title + '</h2>' +
          '</td></tr>' +
          '<tr><td style="padding-bottom:16px">' +
            '<p style="color:#A7ADB8;font-size:14px;line-height:1.6;margin:0">Hola <strong style="color:#E6E8EE">' + escapeHtml(userName) + '</strong>,</p>' +
            '<p style="color:#A7ADB8;font-size:14px;line-height:1.6;margin:8px 0 0">' + bodyText + '</p>' +
          '</td></tr>' +
          '<tr><td style="padding:16px 0;text-align:center">' +
            '<a href="' + ctaLink + '" style="display:inline-block;background:#5B7CFA;color:#E6E8EE;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600">' + ctaText + '</a>' +
          '</td></tr>' +
          '<tr><td style="padding:16px 0">' +
            '<p style="color:#7D8593;font-size:13px;line-height:1.5;margin:0">O copia este enlace en tu navegador:</p>' +
            '<p style="color:#5B7CFA;font-size:12px;margin:4px 0 0;word-break:break-all">' + ctaLink + '</p>' +
          '</td></tr>' +
          '<tr><td style="padding-top:16px;border-top:1px solid #2B313C">' +
            '<p style="color:#7D8593;font-size:12px;line-height:1.4;margin:0">' + footerNote + '</p>' +
            '<p style="color:#7D8593;font-size:12px;margin:8px 0 0">&copy; 2026 DevInterview</p>' +
          '</td></tr>' +
        '</table>' +
      '</td></tr>' +
    '</table>' +
  '</body></html>';
}

async function sendPasswordResetEmail(toEmail, userName, resetToken) {
  var resetLink = APP_URL + '/reset-password?token=' + resetToken;
  var html = buildEmailHtml(
    'Recupera tu contrase\u00f1a',
    userName,
    'Recibimos una solicitud para restablecer tu contrase\u00f1a. Haz clic en el bot\u00f3n de abajo para continuar:',
    resetLink,
    'Restablecer contrase\u00f1a',
    'Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.'
  );
  return smtpSend(FROM_EMAIL, toEmail, 'Recuperacion de contrasena \u2014 DevInterview', html);
}

async function sendVerificationEmail(toEmail, userName, verificationToken) {
  var verifyLink = APP_URL + '/verify-email?token=' + verificationToken;
  var html = buildEmailHtml(
    'Verifica tu correo electr\u00f3nico',
    userName,
    'Gracias por registrarte en DevInterview. Para activar tu cuenta, confirma tu direcci\u00f3n de correo haciendo clic en el bot\u00f3n de abajo:',
    verifyLink,
    'Verificar correo',
    'Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.'
  );
  return smtpSend(FROM_EMAIL, toEmail, 'Verifica tu correo \u2014 DevInterview', html);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
