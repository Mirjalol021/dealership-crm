import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// One-off utility: (re)set passwords for demo/seed users.
// Usage: npx tsx prisma/set-passwords.ts
const prisma = new PrismaClient();

const USERS: { email: string; password: string }[] = [
  { email: 'admin@crm.local', password: 'admin12345' },
  { email: 'head@crm.local', password: 'head12345' },
  { email: 'manager@crm.local', password: 'manager123' },
  { email: 'manager2@crm.local', password: 'manager2123' },
  { email: 'callcenter@crm.local', password: 'call12345' },
  { email: 'service@crm.local', password: 'service12345' },
  { email: 'finance@crm.local', password: 'finance12345' },
];

async function main() {
  for (const u of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      console.log(`skip (not found): ${u.email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.update({ where: { email: u.email }, data: { passwordHash, active: true } });
    console.log(`updated: ${u.email} -> ${u.password}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
