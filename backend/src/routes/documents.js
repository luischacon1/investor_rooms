const router = require('express').Router();
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

router.put('/:id', auth, async (req, res) => {
  const { display_name, order } = req.body;
  const data = {};
  if (display_name !== undefined) data.display_name = display_name;
  if (order !== undefined) data.order = parseInt(order);

  const doc = await prisma.document.update({ where: { id: req.params.id }, data });
  res.json(doc);
});

router.delete('/:id', auth, async (req, res) => {
  await prisma.document.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Reorder documents in bulk
router.post('/reorder', auth, async (req, res) => {
  const { items } = req.body; // [{ id, order }]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be array' });

  await Promise.all(
    items.map(({ id, order }) =>
      prisma.document.update({ where: { id }, data: { order: parseInt(order) } })
    )
  );
  res.json({ ok: true });
});

module.exports = router;
