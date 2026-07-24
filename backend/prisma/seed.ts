import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'admin@agencyos.local';
const SUPER_ADMIN_PASSWORD = 'Admin@12345';

async function main() {
  let role = await prisma.role.findFirst({ where: { companyId: null, name: 'SUPER_ADMIN' } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        companyId: null,
        name: 'SUPER_ADMIN',
        displayName: 'Super Admin',
        description: 'Platform-level administrator with full access.',
        isSystem: true,
      },
    });
  }

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      companyId: null,
      roleId: role.id,
      firstName: 'Super',
      lastName: 'Admin',
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      status: 'ACTIVE',
    },
  });

  console.log(`Seeded SUPER_ADMIN user: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
