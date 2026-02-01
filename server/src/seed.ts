import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Create test user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@fluxos.local',
      password: hashedPassword,
    },
  });

  console.log('Created test user:', { username: user.username, email: user.email });
  console.log('Password: admin123');
  
  // Create test group
  const group = await prisma.group.upsert({
    where: { name: 'Administrators' },
    update: {},
    create: {
      name: 'Administrators',
      description: 'System administrators with full access',
    },
  });

  console.log('Created test group:', group.name);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
