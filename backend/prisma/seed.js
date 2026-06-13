const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.FOUNDER_EMAIL;
  const password = process.env.FOUNDER_PASSWORD || 'changeme123';

  if (!email) { console.log('Set FOUNDER_EMAIL in .env'); return; }

  const existing = await prisma.founder.findUnique({ where: { email } });
  if (existing) { console.log('Founder already exists:', email); return; }

  const hash = await bcrypt.hash(password, 10);
  await prisma.founder.create({ data: { email, password: hash } });
  console.log('Founder created:', email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
