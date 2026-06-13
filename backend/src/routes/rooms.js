const router = require('express').Router();
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { createUploader } = require('../lib/upload');
const path = require('path');
const fs = require('fs');

const upload = createUploader('rooms');

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fileUrl(req, filePath) {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const relative = filePath.replace(path.resolve(process.env.STORAGE_PATH || './uploads'), '');
  return `${base}/uploads${relative.replace(/\\/g, '/')}`;
}

router.get('/', auth, async (req, res) => {
  const rooms = await prisma.room.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      _count: { select: { visits: true, docOpens: true } },
    },
  });
  res.json(rooms);
});

router.post('/', auth, upload.fields([{ name: 'logo' }, { name: 'banner' }]), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  let slug = slugify(name);
  const existing = await prisma.room.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const logo_url = req.files?.logo?.[0] ? fileUrl(req, req.files.logo[0].path) : null;
  const banner_url = req.files?.banner?.[0] ? fileUrl(req, req.files.banner[0].path) : null;

  const room = await prisma.room.create({ data: { name, slug, logo_url, banner_url } });
  res.json(room);
});

router.get('/:id', auth, async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: {
      documents: { orderBy: { order: 'asc' } },
      visits: { orderBy: { visited_at: 'desc' }, take: 50 },
      _count: { select: { visits: true, docOpens: true } },
    },
  });
  if (!room) return res.status(404).json({ error: 'Not found' });
  res.json(room);
});

router.put('/:id', auth, upload.fields([{ name: 'logo' }, { name: 'banner' }]), async (req, res) => {
  const { name, is_active } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (is_active !== undefined) data.is_active = is_active === 'true' || is_active === true;
  if (req.files?.logo?.[0]) data.logo_url = fileUrl(req, req.files.logo[0].path);
  if (req.files?.banner?.[0]) data.banner_url = fileUrl(req, req.files.banner[0].path);

  const room = await prisma.room.update({ where: { id: req.params.id }, data });
  res.json(room);
});

// Upload document to room
const docUpload = createUploader('documents');
router.post('/:id/documents', auth, docUpload.single('file'), async (req, res) => {
  const { display_name } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'File required' });

  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const count = await prisma.document.count({ where: { room_id: req.params.id } });
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  const url = fileUrl(req, file.path);

  const doc = await prisma.document.create({
    data: {
      room_id: req.params.id,
      display_name: display_name || file.originalname,
      file_url: url,
      file_type: ext,
      order: count,
    },
  });
  res.json(doc);
});

module.exports = router;
