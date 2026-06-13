const router = require('express').Router();
const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
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

// View document — streams file inline, logs the open, never exposes file URL
router.get('/document/:id/view', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).send('Unauthorized');

  let visitor;
  try {
    visitor = verifyVisitorToken(token);
  } catch {
    return res.status(401).send('Invalid token');
  }

  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { room: true },
  });
  if (!doc) return res.status(404).send('Not found');

  // Resolve file path from stored URL
  const storagePath = path.resolve(process.env.STORAGE_PATH || './uploads');
  const urlPath = new URL(doc.file_url, 'http://localhost').pathname.replace(/^\/uploads/, '');
  const filePath = path.join(storagePath, urlPath);

  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  // Log the open (idempotent within same session — still log every view)
  prisma.documentOpen.create({
    data: { room_id: doc.room_id, document_id: doc.id, visitor_email: visitor.email },
  }).catch(() => {});

  sendDocumentOpenNotification({
    visitorEmail: visitor.email,
    documentName: doc.display_name,
    roomName: doc.room.name,
  }).catch((err) => console.error('Email error:', err));

  const MIME_MAP = {
    pdf: 'application/pdf',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  };
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';

  const stat = fs.statSync(filePath);
  const isVideo = ['mp4', 'webm', 'mov'].includes(ext);

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Video needs range request support so the player can seek
  if (isVideo) {
    const range = req.headers.range;
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', stat.size);
      res.writeHead(200);
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  }
});

module.exports = router;
