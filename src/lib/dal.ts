import { getCurrentSession } from './auth';
import { forbidden, redirect } from 'next/navigation';
import { prisma } from './db';
import { ADMIN_SECTION_ACTIONS, defaultSectionsForRole, isMainAdminRole, permissionAllowsAction } from './admin-permissions';
import 'server-only';

export async function requireAuth() {
  const session = await getCurrentSession();
  
  if (!session) {
    redirect('/admin/login');
  }

  // Note: Absolute POS Cashier Isolation (P2-002) is enforced by Next.js middleware
  // which blocks Cashier roles from accessing /admin/* routes entirely.
  
  return session;
}

export async function requirePermission(action: string) {
  const session = await requireAuth();
  const roleName = session.employee.role.name;
  if (isMainAdminRole(roleName)) {
    return session;
  }

  if (roleName.trim().toUpperCase() === 'CASHIER' && action.startsWith('pos:')) {
    return session;
  }

  const granted = await getEmployeePermissions(session.employeeId);
  if (permissionAllowsAction(granted, action)) return session;

  forbidden();
}

export async function requireAnyPermission(actions: string[]) {
  const session = await requireAuth();
  if (isMainAdminRole(session.employee.role.name)) return session;

  const roleName = session.employee.role.name.trim().toUpperCase();
  if (roleName === 'CASHIER' && actions.some((action) => action.startsWith('pos:'))) return session;

  const granted = await getEmployeePermissions(session.employeeId);
  if (actions.some((action) => permissionAllowsAction(granted, action))) return session;

  forbidden();
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  
  if (!isMainAdminRole(session.employee.role.name)) forbidden();
  
  return session;
}

export async function getEmployeePermissions(employeeId: string): Promise<string[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { role: { select: { name: true, permissions: { include: { permission: { select: { action: true } } } } } } }
  });

  if (!employee) return [];
  if (isMainAdminRole(employee.role.name)) {
    return [...ADMIN_SECTION_ACTIONS];
  }

  const roleActions = employee.role.permissions.map((entry) => entry.permission.action);
  const allowed = new Set<string>(defaultSectionsForRole(employee.role.name, roleActions));

  const overrides = await prisma.employeePermission.findMany({
    where: { employeeId },
    include: { permission: true }
  });

  const now = new Date();
  const retiredInventoryActions = new Set(['section:inventory', 'manage:inventory', 'inventory.view']);

  // Apply explicit DENY overrides
  for (const o of overrides) {
    if (o.effect === 'DENY' && (!o.expiresAt || o.expiresAt > now)) {
      const deniedAction = o.permission.action;
      allowed.delete(deniedAction);
      // A direct section setting replaces any legacy role permission for that section.
      if (ADMIN_SECTION_ACTIONS.includes(deniedAction as typeof ADMIN_SECTION_ACTIONS[number])) {
        allowed.delete(deniedAction);
      }
    }
  }

  // Apply explicit ALLOW overrides (if not expired)
  for (const o of overrides) {
    if (o.effect === 'ALLOW' && !retiredInventoryActions.has(o.permission.action) && (!o.expiresAt || o.expiresAt > now)) {
      allowed.add(o.permission.action);
    }
  }

  return Array.from(allowed);
}
