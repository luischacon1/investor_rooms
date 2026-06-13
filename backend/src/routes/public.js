const router = require('express').Router();
const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const { sendRoomEntryNotification, sendDocumentOpenNotification } = require('../services/email');

function visitorToken(email, roomId) {
  return jwt.sign({ email, roomId }, process.env.JWT_SECRET, { expiresIn: '90d' });
}

function verifyVisitorToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Get room info (no file URLs)
router.get('/room/:slug', async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { slug: req.params.slug },
    include: {
      documents: {
        orderBy: { order: 'asc' },
        select: { id: true, display_name: true, file_type: true, order: true },
      },
    },
  });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.is_active) return res.status(403).json({ error: 'Room is not active' });
  res.json(room);
});

// Enter room with email
router.post('/room/:slug/enter', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const room = await prisma.room.findUnique({ where: { slug: req.params.slug } });
  if (!room || !room.is_active) return res.status(404).json({ error: 'Room not found' });

  await prisma.roomVisit.create({ data: { room_id: room.id, visitor_email: email } });

  sendRoomEntryNotification({ visitorEmail: email, roomName: room.name, roomId: room.id }).catch(
    (err) => console.error('Email error:', err)
  );

  const token = visitorToken(email, room.id);
  res.json({ token, email });
});

// Open document — returns file URL + logs the open
router.get('/document/:id/open', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: 'Token required' });

  let visitor;
  try {
    visitor = verifyVisitorToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { room: true },
  });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  await prisma.documentOpen.create({
    data: {
      room_id: doc.room_id,
      document_id: doc.id,
      visitor_email: visitor.email,
    },
  });

  sendDocumentOpenNotification({
    visitorEmail: visitor.email,
    documentName: doc.display_name,
    roomName: doc.room.name,
  }).catch((err) => console.error('Email error:', err));

  res.json({ file_url: doc.file_url });
});

module.exports = router;
