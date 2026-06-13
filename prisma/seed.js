const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Hapus data lama jika perlu (Opsional, hati-hati di production!)
  // await prisma.accessLog.deleteMany();
  // await prisma.card.deleteMany();
  // await prisma.user.deleteMany();

  // Buat User Dummy
  const user1 = await prisma.user.create({
    data: {
      name: 'Ahmad Fauzi',
      role: 'Staff',
      cards: {
        create: [
          {
            uid: 'D3FA82C1',
            status: 'ACTIVE',
          },
        ],
      },
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: 'Budi Santoso',
      role: 'Guest',
      cards: {
        create: [
          {
            uid: 'A1B2C3D4',
            status: 'INACTIVE', // Kartu ini sengaja dibuat non-aktif
          },
        ],
      },
    },
  });

  console.log('✅ Database berhasil di-seed!');
  console.log('--- Data Uji ---');
  console.log(`1. Kartu Aktif     | UID: D3FA82C1 | Milik: ${user1.name}`);
  console.log(`2. Kartu Non-Aktif | UID: A1B2C3D4 | Milik: ${user2.name}`);
  console.log(`3. Kartu Asing     | UID: 99B1A2C3 | (Tidak terdaftar)`);
}

main()
  .catch((e) => {
    console.error('Error saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
