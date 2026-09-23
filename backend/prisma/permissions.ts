import { PrismaClient } from '@prisma/client';

export const PERMISSION_MODULES = [
  'roles',
  'users',
  'clients',
  'projects',
  'workspaces',
  'tasks',
  'quotations',
  'invoices',
] as const;

export const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete'] as const;

export async function seedPermissions(prisma: PrismaClient) {
  for (const module of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { code: `${module}:${action}`, module, action },
      });
    }
  }
}
