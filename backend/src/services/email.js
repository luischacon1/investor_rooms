const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const MADRID_TZ = 'Europe/Madrid';

function formatTime(date) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: MADRID_TZ,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

async function sendRoomEntryNotification({ visitorEmail, roomName, roomId }) {
  const time = formatTime(new Date());
  await resend.emails.send({
    from: 'InvestorRoom <onboarding@resend.dev>',
    to: FOUNDER_EMAIL,
    subject: `👁 ${visitorEmail} just entered "${roomName}"`,
    html: `
      <p><strong>Visitor:</strong> ${visitorEmail}</p>
      <p><strong>Room:</strong> ${roomName}</p>
      <p><strong>Time:</strong> ${time}</p>
      <p><a href="${BASE_URL}/dashboard/rooms/${roomId}">View in dashboard →</a></p>
    `,
  });
}

async function sendDocumentOpenNotification({ visitorEmail, documentName, roomName }) {
  const time = formatTime(new Date());
  await resend.emails.send({
    from: 'InvestorRoom <onboarding@resend.dev>',
    to: FOUNDER_EMAIL,
    subject: `📄 ${visitorEmail} opened "${documentName}" in "${roomName}"`,
    html: `
      <p><strong>Visitor:</strong> ${visitorEmail}</p>
      <p><strong>Document:</strong> ${documentName}</p>
      <p><strong>Room:</strong> ${roomName}</p>
      <p><strong>Time:</strong> ${time}</p>
    `,
  });
}

module.exports = { sendRoomEntryNotification, sendDocumentOpenNotification };
