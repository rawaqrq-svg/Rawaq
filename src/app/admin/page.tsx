import { forbidden, redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { getEmployeePermissions } from '@/lib/dal';
const AdminIndexPage = async () => {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/admin/login');
  }

  const permissions = await getEmployeePermissions(session.employeeId);
  const normalizedRole = session.employee.role.name.trim().toUpperCase().replace(/[_-]+/g, ' ');
  const isMainAdmin = ['ADMIN', 'SUPER ADMIN', 'أدمن رئيسي', 'ادمن رئيسي'].includes(normalizedRole);
  const landingRoutes = [
    ['section:dashboard', '/admin/dashboard'],
    ['section:orders', '/admin/orders'],
    ['section:products', '/admin/products'],
    ['section:financials', '/admin/financials'],
    ['section:delivery', '/admin/settings'],
    ['section:suppliers', '/admin/suppliers'],
    ['section:settings', '/admin/shipping-zones'],
    ['section:content', '/admin/content'],
  ] as const;
  const firstAllowedRoute = landingRoutes.find(([permission]) => permissions.includes(permission));

  if (isMainAdmin) redirect('/admin/dashboard');
  if (firstAllowedRoute) redirect(firstAllowedRoute[1]);
  forbidden();
};

export default AdminIndexPage;
