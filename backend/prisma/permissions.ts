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
  'campaigns',
  'posts',
  'social_accounts',
] as const;

export const PERMISSION_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
] as const;

/**
 * Codes outside the CRUD grid. Kept as an explicit list rather than widening the
 * cartesian, which would mint meaningless pairs like `roles:publish`.
 * Add non-CRUD actions (approve, publish, export) here as their modules land.
 */
export const EXTRA_PERMISSIONS = [
  // The audit trail is read-only by design: nothing may create or edit an entry.
  { module: 'activity', action: 'read' },
  // Publishing is a distinct privilege: producing content is not the same as
  // putting it in front of a client's audience.
  { module: 'posts', action: 'publish' },
] as const;

function crudPermissions() {
  return PERMISSION_MODULES.flatMap((module) =>
    PERMISSION_ACTIONS.map((action) => ({ module, action })),
  );
}

export const ALL_PERMISSIONS: { module: string; action: string }[] = [
  ...crudPermissions(),
  ...EXTRA_PERMISSIONS,
];

export const ALL_PERMISSION_CODES = ALL_PERMISSIONS.map(
  ({ module, action }) => `${module}:${action}`,
);

export async function seedPermissions(prisma: PrismaClient) {
  for (const { module, action } of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { module_action: { module, action } },
      update: {},
      create: { code: `${module}:${action}`, module, action },
    });
  }
}
