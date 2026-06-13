const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Register (one-time setup or via env seed)
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const existing = await prisma.founder.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Already registered' });
  const hash = await bcrypt.hash(password, 10);
  const founder = await prisma.founder.create({ data: { email, password: hash } });
  res.json({ id: founder.id, email: founder.email });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const founder = await prisma.founder.findUnique({ where: { email } });
  if (!founder) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, founder.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ founderId: founder.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, email: founder.email });
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  const founder = await prisma.founder.findUnique({ where: { id: req.founderId } });
  if (!founder) return res.status(404).json({ error: 'Not found' });
  res.json({ id: founder.id, email: founder.email });
});

module.exports = router;
