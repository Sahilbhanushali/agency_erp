import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'admin@agencyos.local';
const SUPER_ADMIN_PASSWORD = 'Admin@12345';

const PERMISSION_MODULES = [
  'roles',
  'users',
  'clients',
  'projects',
  'workspaces',
  'quotations',
  'invoices',
] as const;
const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete'] as const;

async function seedPermissions() {
  for (const module of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: {
          code: `${module}:${action}`,
          module,
          action,
        },
      });
    }
  }
}

async function main() {
  await seedPermissions();

  let role = await prisma.role.findFirst({
    where: { companyId: null, name: 'SUPER_ADMIN' },
  });
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

  console.log(
    `Seeded SUPER_ADMIN user: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
