require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check if card already exists
  const existingCard = await prisma.card.findUnique({
    where: { uid: '816A5C5D' }
  });

  if (existingCard) {
    console.log('Kartu dengan UID 816A5C5D sudah ada di database!');
    return;
  }

  // Create User and Card
  const user = await prisma.user.create({
    data: {
      name: 'Ketua AAL',
      role: 'USER',
      cards: {
        create: {
          uid: '816A5C5D'
        }
      }
    }
  });
  console.log('Berhasil mendaftarkan kartu! Data:', user);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
