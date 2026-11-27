import React from 'react';
import { requireSuperAdmin } from '@/lib/dal';
import { ADMIN_SECTIONS, defaultSectionsForRole, isMainAdminRole } from '@/lib/admin-permissions';
import { prisma } from '@/lib/db';
import { AdminSidebar } from '@/components/AdminSidebar';
import { createEmployee, updateEmployee, toggleEmployeeStatus, deleteEmployee } from '@/actions/employees';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { EmployeePermissionsFields } from './EmployeePermissionsFields';
import { DeleteEmployeeButton } from './DeleteEmployeeButton';

export default async function AdminEmployeesPage({
  searchParams
}: {
  searchParams: Promise<{ action?: string; id?: string; error?: string; message?: string }>;
}) {
  const session = await requireSuperAdmin();

  // Resolve searchParams promise
  const resolvedParams = await searchParams;
  const action = resolvedParams.action;
  const editId = resolvedParams.id;
  const errorMsg = resolvedParams.error;
  const successMsg = resolvedParams.message;

  const allRoles = await prisma.role.findMany();
  const allowedRoles = ['أدمن رئيسي', 'أدمن تشغيلي'];
  
  // Ensure roles exist
  for (const roleName of allowedRoles) {
    if (!allRoles.find(r => r.name === roleName)) {
      await prisma.role.create({ data: { name: roleName } });
    }
  }

  // Only fetch Main Admin and Operational Admin roles
  const roles = await prisma.role.findMany({
    where: { name: { in: allowedRoles } },
    include: { permissions: { include: { permission: { select: { action: true } } } } },
  });
  const roleOptions = roles.map((role) => ({
    id: role.id,
    name: role.name,
    defaultSections: defaultSectionsForRole(role.name, role.permissions.map((entry) => entry.permission.action)),
    isMainAdmin: isMainAdminRole(role.name),
  }));
  await Promise.all(ADMIN_SECTIONS.map((section) => prisma.permission.upsert({
    where: { action: section.action },
    update: { description: section.description },
    create: { action: section.action, description: section.description },
  })));

  // Load employee list
  const employees = await prisma.employee.findMany({
    include: {
      role: true,
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  // Handle Edit employee load
  let editEmployee = null;
  let editEmployeePermActions: string[] = [];
  if (action === 'edit' && editId) {
    editEmployee = await prisma.employee.findUnique({
      where: { id: editId },
      include: {
        role: true,
        permissions: { include: { permission: true } }
      }
    });
    if (editEmployee) {
      const storedSectionActions = editEmployee.permissions
        .map((permission) => permission.permission.action)
        .filter((action): action is typeof ADMIN_SECTIONS[number]['action'] => ADMIN_SECTIONS.some((section) => section.action === action));
      const storedSectionOverrides = editEmployee.permissions.filter((permission) =>
        ADMIN_SECTIONS.some((section) => section.action === permission.permission.action)
      );
      const explicitlyAllowedSections = new Set(storedSectionOverrides
        .filter((permission) => permission.effect === 'ALLOW')
        .map((permission) => permission.permission.action));
      editEmployeePermActions = storedSectionOverrides.length
        ? storedSectionActions.filter((action) => explicitlyAllowedSections.has(action))
        : defaultSectionsForRole(editEmployee.role.name, roleOptions.find((role) => role.id === editEmployee!.roleId)?.defaultSections || []);
    }
  }

  // Server Action wrappers
  async function handleSave(formData: FormData) {
    'use server';

    const empId = formData.get('id') as string;
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const roleId = formData.get('roleId') as string;
    const isActive = formData.get('isActive') === 'true';
    
    // Roles dictate permissions completely now.
    const selectedPermissionActions = formData.getAll('permissions').filter((value): value is string => typeof value === 'string');

    if (empId) {
      // Update
      const res = await updateEmployee({
        id: empId,
        name,
        email,
        password: password || undefined,
        roleId,
        isActive,
        selectedPermissionActions,
        adminId: session.employeeId
      });
      if (!res.success) {
        redirect(`/admin/employees?action=edit&id=${empId}&error=${encodeURIComponent(res.error || 'فشل تحديث بيانات الموظف')}`);
      }
      redirect('/admin/employees?message=' + encodeURIComponent('تم تحديث بيانات الموظف بنجاح في قاعدة البيانات'));
    } else {
      // Create
      const res = await createEmployee({
        name,
        email,
        password: password || undefined,
        roleId,
        isActive,
        selectedPermissionActions,
        bootstrapAdminId: session.employeeId
      });
      if (!res.success) {
        redirect(`/admin/employees?action=new&error=${encodeURIComponent(res.error || 'فشل إنشاء الموظف')}`);
      }
      let successMsg = 'تم حفظ وإنشاء حساب الموظف بنجاح داخل قاعدة البيانات';
      if (res.generatedPassword) {
        successMsg += ` (كلمة المرور المولدة: ${res.generatedPassword})`;
      }
      redirect('/admin/employees?message=' + encodeURIComponent(successMsg));
    }
  }

  async function handleRevoke(formData: FormData) {
    'use server';
    const { requireSuperAdmin } = await import('@/lib/dal');
    const actor = await requireSuperAdmin();
    const targetId = formData.get('targetId') as string;
    try {
      await prisma.session.deleteMany({
        where: { employeeId: targetId }
      });
      
      await prisma.auditLog.create({
        data: {
          employeeId: actor.employeeId,
          action: 'SESSIONS_REVOKED',
          entityType: 'Employee',
          entityId: targetId,
          details: JSON.stringify({ reason: 'Manual session revocation by Admin' })
        }
      });

      redirect('/admin/employees?message=' + encodeURIComponent('تم إنهاء وإلغاء كافة جلسات الموظف بنجاح'));
    } catch {
      redirect('/admin/employees?error=' + encodeURIComponent('فشل إلغاء جلسات الموظف'));
    }
  }

  async function handleToggleStatus(formData: FormData) {
    'use server';
    const targetId = formData.get('targetId') as string;
    const res = await toggleEmployeeStatus(targetId, session.employeeId);
    if (!res.success) {
      redirect(`/admin/employees?error=${encodeURIComponent(res.error || 'فشل تعديل حالة الموظف')}`);
    }
    redirect('/admin/employees?message=' + encodeURIComponent('تم تعديل حالة الموظف بنجاح'));
  }

  async function handleDelete(formData: FormData) {
    'use server';
    const targetId = formData.get('targetId') as string;
    const res = await deleteEmployee(targetId, session.employeeId);
    if (!res.success) {
      redirect(`/admin/employees?error=${encodeURIComponent(res.error || 'فشل حذف الموظف')}`);
    }
    const msg = res.message || 'تم حذف الموظف بنجاح';
    redirect(`/admin/employees?message=${encodeURIComponent(msg)}`);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--color-ivory-100)]" dir="rtl">
      <AdminSidebar employeeName={session.employee.name} roleName={session?.employee?.role?.name || "ADMIN"} />

      <main className="min-w-0 max-w-full flex-1 p-4 md:p-8 font-sans w-full max-w-4xl mx-auto">
        {/* Feedback Alerts */}
        {errorMsg && (
          <div role="alert" className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <Link href="/admin/employees" className="text-xs text-red-700 hover:text-red-900 underline font-bold">
              إغلاق
            </Link>
          </div>
        )}

        {successMsg && (
          <div role="status" aria-live="polite" className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span>{successMsg}</span>
            </div>
            <Link href="/admin/employees" className="text-xs text-emerald-700 hover:text-emerald-900 underline font-bold">
              إغلاق
            </Link>
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-[var(--color-ivory-200)] pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-heading text-[#3F4832]">
              {action === 'new' ? 'إضافة موظف جديد' : action === 'edit' ? 'تعديل بيانات الموظف' : 'إدارة الموظفين والصلاحيات'}
            </h1>
            <p className="text-zinc-650 text-xs md:text-sm mt-1">التحكم بحسابات الموظفين وصلاحياتهم المباشرة</p>
          </div>
          {!action && (
            <Link
              href="/admin/employees?action=new"
              className="bg-[#2d3623] text-white text-xs md:text-sm px-4 py-2 rounded font-bold hover:bg-[#3F4832] transition-colors"
            >
              + إضافة موظف
            </Link>
          )}
        </div>

        {/* Create / Edit Form */}
        {action && (action === 'new' || (action === 'edit' && editEmployee)) ? (
          <form action={handleSave} className="bg-white p-6 rounded-lg border border-[var(--color-ivory-200)] shadow-sm space-y-4">
            {editEmployee && <input type="hidden" name="id" value={editEmployee.id} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editEmployee?.name || ''}
                  className="w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none focus:border-[#2d3623]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={editEmployee?.email || ''}
                  className="w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none focus:border-[#2d3623]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">
                  {action === 'new' ? 'كلمة المرور' : 'إعادة تعيين كلمة المرور (اختياري)'}
                </label>
                <input
                  type="text"
                  name="password"
                  placeholder={action === 'new' ? 'أدخل كلمة مرور قوية (أو اتركها فارغة لتوليدها تلقائياً)' : 'اتركه فارغاً لعدم التغيير'}
                  className="w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none focus:border-[#2d3623]"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {action === 'new' ? 'يمكنك تحديد كلمة مرور مخصصة أو تركها لتوليد كلمة مرور عشوائية آمنة.' : 'أدخل 6 خانات على الأقل لتغيير كلمة المرور.'}
                </p>
              </div>

                <EmployeePermissionsFields
                  roles={roleOptions}
                  sections={ADMIN_SECTIONS.map(({ action, label, description }) => ({ action, label, description }))}
                  initialRoleId={editEmployee?.roleId || ''}
                  initialPermissions={editEmployeePermActions}
                />

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1">حالة الحساب</label>
                <select
                  name="isActive"
                  required
                  defaultValue={editEmployee ? String(editEmployee.isActive) : 'true'}
                  className="w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none bg-white focus:border-[#2d3623]"
                >
                  <option value="true">نشط</option>
                  <option value="false">معطل / موقف</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-zinc-100 mt-6">
              <Link
                href="/admin/employees"
                className="bg-zinc-100 text-zinc-700 text-xs md:text-sm px-4 py-2 rounded font-bold hover:bg-zinc-200 transition-colors"
              >
                إلغاء
              </Link>
              <button
                type="submit"
                className="bg-[#2d3623] text-white text-xs md:text-sm px-5 py-2 rounded font-bold hover:bg-[#3F4832] transition-colors"
              >
                حفظ التغييرات
              </button>
            </div>
          </form>
        ) : (
          /* Mobile Card List Layout (Integrated with user request) */
          <div className="space-y-4">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white p-4 rounded-lg border border-[var(--color-ivory-200)] shadow-sm space-y-3 relative"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-zinc-950 text-base">{emp.name}</h3>
                    <p className="text-zinc-500 text-xs font-mono mt-0.5">{emp.email}</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${emp.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {emp.isActive ? 'نشط' : 'معطل'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs pt-1">
                  <span className="bg-[var(--color-ivory-200)] px-2 py-0.5 rounded font-bold text-[#3F4832]">
                    الدور: {emp.role.name === 'Admin' ? 'أدمن رئيسي' : emp.role.name === 'Cashier' ? 'كاشير' : emp.role.name}
                  </span>
                  
                  {emp.permissions.filter((ep) => ep.effect === 'ALLOW').map((ep) => (
                    <span key={ep.permissionId} className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded font-bold">
                      {ADMIN_SECTIONS.find((section) => section.action === ep.permission.action)?.label || ep.permission.action}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-100 justify-end items-center">
                  {emp.id === session.employeeId ? (
                    <span className="text-xs px-3 py-1.5 rounded font-bold text-zinc-500 bg-zinc-100 border border-zinc-200">
                      حسابك المسجل حالياً
                    </span>
                  ) : (
                    <>
                      <form action={handleToggleStatus} className="inline-block">
                        <input type="hidden" name="targetId" value={emp.id} />
                        <button
                          type="submit"
                          className={`text-xs px-3 py-1.5 rounded font-bold transition-colors ${
                            emp.isActive 
                              ? 'text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200' 
                              : 'text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200'
                          }`}
                        >
                          {emp.isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                      </form>
                      <DeleteEmployeeButton
                        employeeId={emp.id}
                        employeeName={emp.name}
                        onDelete={handleDelete}
                      />
                      <form action={handleRevoke} className="inline-block">
                        <input type="hidden" name="targetId" value={emp.id} />
                        <button
                          type="submit"
                          className="text-xs text-zinc-600 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded font-bold transition-colors"
                        >
                          إلغاء الجلسات
                        </button>
                      </form>
                    </>
                  )}
                  <Link
                    href={`/admin/employees?action=edit&id=${emp.id}`}
                    className="text-xs text-[#2d3623] bg-[var(--color-ivory-200)] hover:bg-[var(--color-champagne-200)] px-4 py-1.5 rounded font-bold transition-colors border border-[var(--color-ivory-300,#e5e0d3)]"
                  >
                    تعديل
                  </Link>
                </div>
              </div>
            ))}

            {employees.length === 0 && (
              <div className="bg-white p-8 text-center rounded-lg border border-[var(--color-ivory-200)] text-zinc-500">
                لا يوجد موظفون مسجلون.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
