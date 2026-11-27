'use server';

import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/dal';
import { hashPassword } from '@/lib/auth';
import * as argon2 from 'argon2';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { ADMIN_SECTIONS, ADMIN_SECTION_ACTIONS, isMainAdminRole } from '@/lib/admin-permissions';

async function resolveSectionPermissions(actions: string[]) {
  if (!Array.isArray(actions) || actions.some((action) => !ADMIN_SECTION_ACTIONS.includes(action as typeof ADMIN_SECTION_ACTIONS[number]))) {
    throw new Error('صلاحيات الأقسام المحددة غير صالحة');
  }
  await Promise.all(ADMIN_SECTIONS.map((section) => prisma.permission.upsert({
    where: { action: section.action },
    update: { description: section.description },
    create: { action: section.action, description: section.description },
  })));
  const permissions = await prisma.permission.findMany({
    where: { action: { in: [...ADMIN_SECTION_ACTIONS] } },
    select: { id: true, action: true },
  });
  if (permissions.length !== ADMIN_SECTIONS.length) throw new Error('تعذر التحقق من صلاحيات الأقسام');
  return permissions;
}

export async function createEmployee(data: {
  name: string;
  email: string;
  password?: string;
  roleId: string;
  isActive: boolean;
  selectedPermissionActions: string[];
  bootstrapAdminId: string; // The performing employee (Admin)
}) {
  try {
    const session = await requireSuperAdmin();
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role || (!isMainAdminRole(role.name) && role.name !== 'أدمن تشغيلي')) {
      return { success: false, error: 'الدور الوظيفي المحدد غير صالح' };
    }
    const sectionPermissions = await resolveSectionPermissions(data.selectedPermissionActions);
    const selectedActions = new Set(data.selectedPermissionActions);
    const employeePermissionRows = isMainAdminRole(role.name) ? [] : sectionPermissions.map((permission) => ({
      permissionId: permission.id,
      effect: selectedActions.has(permission.action) ? 'ALLOW' : 'DENY',
    }));

    const existing = await prisma.employee.findUnique({
      where: { email: data.email.trim().toLowerCase() }
    });
    if (existing) {
      return { success: false, error: 'البريد الإلكتروني مسجل بالفعل لموظف آخر' };
    }

    // Default password if not provided
    const hasCustomPassword = Boolean(data.password && data.password.trim().length >= 6);
    const password = hasCustomPassword ? data.password!.trim() : 'Rawaq@Staff!' + crypto.randomBytes(3).toString('hex');
    const passwordHash = await hashPassword(password);

    const employee = await prisma.employee.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        passwordHash,
        roleId: data.roleId,
        isActive: data.isActive,
        mustChangePassword: !hasCustomPassword,
        bootstrapCredential: !hasCustomPassword
      }
    });

    // Save custom checkbox permissions
    if (employeePermissionRows.length > 0) {
      await prisma.employeePermission.createMany({
        data: employeePermissionRows.map((permission) => ({
          employeeId: employee.id,
          permissionId: permission.permissionId,
          grantedByEmployeeId: session.employeeId,
          effect: permission.effect,
          reason: 'Direct Admin Assignment'
        }))
      });
    }

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    // Write audit log
    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: employee.id,
        ipAddress,
        details: JSON.stringify({ name: data.name, email: data.email, roleId: data.roleId, selectedPermissionActions: data.selectedPermissionActions })
      }
    });

    revalidatePath('/admin/employees');
    return { success: true, employeeId: employee.id, generatedPassword: password };
  } catch (error: any) {
    return { success: false, error: 'حدث خطأ أثناء حفظ البيانات' };
  }
}

export async function updateEmployee(data: {
  id: string;
  name: string;
  email: string;
  roleId: string;
  isActive: boolean;
  password?: string;
  selectedPermissionActions: string[];
  adminId: string;
}) {
  try {
    const session = await requireSuperAdmin();

    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role || (!isMainAdminRole(role.name) && role.name !== 'أدمن تشغيلي')) {
      return { success: false, error: 'الدور الوظيفي المحدد غير صالح' };
    }
    const sectionPermissions = await resolveSectionPermissions(data.selectedPermissionActions);
    const selectedActions = new Set(data.selectedPermissionActions);
    const employeePermissionRows = isMainAdminRole(role.name) ? [] : sectionPermissions.map((permission) => ({
      permissionId: permission.id,
      effect: selectedActions.has(permission.action) ? 'ALLOW' : 'DENY',
    }));

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: data.id },
      include: { role: true }
    });

    // Protect against disabling/removing last active Admin
    if (targetEmployee && isMainAdminRole(targetEmployee.role.name) && targetEmployee.isActive) {
      const activeAdmins = await prisma.employee.findMany({ where: { isActive: true, id: { not: data.id }, role: { name: { in: ['ADMIN', 'Admin', 'Super Admin', 'أدمن رئيسي', 'ادمن رئيسي'] } } }, include: { role: true } });
      const activeAdminsCount = activeAdmins.filter((employee) => isMainAdminRole(employee.role.name)).length;
      if (activeAdminsCount === 0 && (!data.isActive || !isMainAdminRole(role.name))) {
        return { success: false, error: 'لا يمكن تعطيل آخر مدير نشط في النظام لحماية الإدارة' };
      }
    }

    const dataToUpdate: any = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      roleId: data.roleId,
      isActive: data.isActive
    };

    if (data.password && data.password.trim().length >= 6) {
      dataToUpdate.passwordHash = await hashPassword(data.password.trim());
      dataToUpdate.mustChangePassword = false;
      dataToUpdate.bootstrapCredential = false;
    }

    // Update Employee
    await prisma.employee.update({
      where: { id: data.id },
      data: dataToUpdate
    });

    // Re-sync custom permissions
    await prisma.employeePermission.deleteMany({
      where: { employeeId: data.id }
    });

    if (employeePermissionRows.length > 0) {
      await prisma.employeePermission.createMany({
        data: employeePermissionRows.map((permission) => ({
          employeeId: data.id,
          permissionId: permission.permissionId,
          grantedByEmployeeId: session.employeeId,
          effect: permission.effect,
          reason: 'Direct Admin Assignment'
        }))
      });
    }

    // Revoke employee sessions if disabled or permissions changed
    await prisma.session.deleteMany({
      where: { employeeId: data.id }
    });

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    // Write audit log
    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: data.id,
        ipAddress,
        details: JSON.stringify({ name: data.name, email: data.email, roleId: data.roleId, selectedPermissionActions: data.selectedPermissionActions })
      }
    });

    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'حدث خطأ أثناء تحديث البيانات' };
  }
}

export async function addEmployeePermissionOverride(data: {
  employeeId: string;
  permissionId: string;
  effect: 'ALLOW' | 'DENY';
  reason: string;
  expiresInMinutes?: number;
  adminId: string;
}) {
  try {
    const session = await requireSuperAdmin();
    const permission = await prisma.permission.findUnique({ where: { id: data.permissionId } });
    if (!permission || !ADMIN_SECTION_ACTIONS.includes(permission.action as typeof ADMIN_SECTION_ACTIONS[number])) {
      return { success: false, error: 'صلاحية القسم المحددة غير صالحة' };
    }
    if (data.effect !== 'ALLOW' && data.effect !== 'DENY') {
      return { success: false, error: 'نوع تعديل الصلاحية غير صالح' };
    }

    const expiresAt = data.expiresInMinutes
      ? new Date(Date.now() + data.expiresInMinutes * 60 * 1000)
      : null;

    const override = await prisma.employeePermission.upsert({
      where: {
        employeeId_permissionId: {
          employeeId: data.employeeId,
          permissionId: data.permissionId
        }
      },
      update: {
        effect: data.effect,
        reason: data.reason,
        expiresAt,
        grantedByEmployeeId: session.employeeId
      },
      create: {
        employeeId: data.employeeId,
        permissionId: data.permissionId,
        effect: data.effect,
        reason: data.reason,
        expiresAt,
        grantedByEmployeeId: session.employeeId
      }
    });

    // Force session revocation
    await prisma.session.deleteMany({
      where: { employeeId: data.employeeId }
    });

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'PERMISSION_OVERRIDE_ADDED',
        entityType: 'EmployeePermission',
        entityId: `${data.employeeId}:${data.permissionId}`,
        ipAddress,
        details: JSON.stringify({ employeeId: data.employeeId, permissionId: data.permissionId, effect: data.effect, reason: data.reason, expiresAt })
      }
    });

    return { success: true, override };
  } catch (error: any) {
    return { success: false, error: 'فشل إضافة صلاحية الاستثناء' };
  }
}

export async function toggleEmployeeStatus(employeeId: string, adminId: string) {
  try {
    const session = await requireSuperAdmin();

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { role: true }
    });
    if (!employee) return { success: false, error: 'الموظف غير موجود' };

    const newActiveState = !employee.isActive;

    // Protect against disabling last active Admin
    if (isMainAdminRole(employee.role.name) && employee.isActive && !newActiveState) {
      const activeAdmins = await prisma.employee.findMany({ where: { isActive: true, id: { not: employeeId }, role: { name: { in: ['ADMIN', 'Admin', 'Super Admin', 'أدمن رئيسي', 'ادمن رئيسي'] } } }, include: { role: true } });
      const activeAdminsCount = activeAdmins.filter((item) => isMainAdminRole(item.role.name)).length;
      if (activeAdminsCount === 0) {
        return { success: false, error: 'لا يمكن تعطيل آخر مدير نشط في النظام لحماية الإدارة' };
      }
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: newActiveState }
    });

    // Revoke sessions
    await prisma.session.deleteMany({
      where: { employeeId }
    });

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'EMPLOYEE_STATUS_TOGGLED',
        entityType: 'Employee',
        entityId: employeeId,
        ipAddress,
        details: JSON.stringify({ email: employee.email, isActive: newActiveState })
      }
    });

    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'فشل تعديل حالة الموظف' };
  }
}

export async function forcePasswordChange(employeeId: string, adminId: string) {
  try {
    const session = await requireSuperAdmin();
    await prisma.employee.update({
      where: { id: employeeId },
      data: { mustChangePassword: true }
    });

    // Revoke sessions
    await prisma.session.deleteMany({
      where: { employeeId }
    });

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'FORCE_PASSWORD_CHANGE',
        entityType: 'Employee',
        entityId: employeeId,
        ipAddress,
        details: null
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'فشل إلزام تغيير كلمة المرور' };
  }
}

export async function getEmployeeSessions(employeeId: string) {
  try {
    await requireSuperAdmin();
    return await prisma.session.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' }
    });
  } catch {
    return [];
  }
}

export async function revokeEmployeeSession(sessionId: string, adminId: string) {
  try {
    const session = await requireSuperAdmin();
    const targetSession = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!targetSession) return { success: false, error: 'الجلسة غير موجودة' };

    await prisma.session.delete({
      where: { id: sessionId }
    });

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'SESSION_REVOKED',
        entityType: 'Session',
        entityId: sessionId,
        ipAddress,
        details: JSON.stringify({ employeeId: targetSession.employeeId })
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'فشل إلغاء الجلسة' };
  }
}

export async function revokeAllEmployeeSessions(employeeId: string, adminId: string) {
  try {
    const session = await requireSuperAdmin();
    await prisma.session.deleteMany({
      where: { employeeId }
    });

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'ALL_SESSIONS_REVOKED',
        entityType: 'Employee',
        entityId: employeeId,
        ipAddress,
        details: null
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'فشل إلغاء كافة الجلسات' };
  }
}

export async function getActiveSessionPermissions() {
  const { getCurrentSession } = await import('@/lib/auth');
  const { getEmployeePermissions } = await import('@/lib/dal');
  const session = await getCurrentSession();
  if (!session) return [];
  return getEmployeePermissions(session.employeeId);
}

export async function deleteEmployee(employeeId: string, adminId: string) {
  try {
    const session = await requireSuperAdmin();

    // Prevent self-deletion
    if (employeeId === session.employeeId) {
      return { success: false, error: 'لا يمكنك حذف حسابك الشخصي المسجل به الدخول حالياً.' };
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { role: true }
    });
    if (!employee) return { success: false, error: 'الموظف غير موجود' };

    const roleName = employee.role.name.trim().toUpperCase().replace(/[_-]+/g, ' ');
    const isAdmin = ['ADMIN', 'SUPER ADMIN', 'أدمن رئيسي', 'ادمن رئيسي'].includes(roleName);

    if (isAdmin) {
      const activeAdminsCount = await prisma.employee.count({
        where: {
          role: { name: { in: ['ADMIN', 'Admin', 'Super Admin', 'أدمن رئيسي', 'ادمن رئيسي'] } },
          isActive: true,
          id: { not: employeeId }
        }
      });
      if (activeAdminsCount === 0) {
        return { success: false, error: 'لا يمكن حذف أو تعطيل آخر مدير رئيسي نشط في النظام' };
      }
    }

    const headersList = await (await import('next/headers')).headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';

    // تنفيذ عملية الحذف النهائي الكامل من قاعدة البيانات مع فك وحل كافة الارتباطات
    await prisma.$transaction(async (tx) => {
      // 1. إعادة توجيه القيود المحاسبية وسجلات المبيعات إلى المدير النشط لمنع فقدان البيانات المالية
      await tx.sale.updateMany({
        where: { employeeId },
        data: { employeeId: session.employeeId }
      });
      await tx.sale.updateMany({
        where: { soldByEmployeeId: employeeId },
        data: { soldByEmployeeId: session.employeeId }
      });
      await tx.return.updateMany({
        where: { employeeId },
        data: { employeeId: session.employeeId }
      });
      await tx.inventoryMovement.updateMany({
        where: { employeeId },
        data: { employeeId: session.employeeId }
      });

      // 2. تحديث جلسات الجرد والمخزون
      await tx.inventoryCountSession.updateMany({
        where: { assignedEmployeeId: employeeId },
        data: { assignedEmployeeId: session.employeeId }
      });
      await tx.inventoryCountSession.updateMany({
        where: { assignedByEmployeeId: employeeId },
        data: { assignedByEmployeeId: session.employeeId }
      });
      await tx.inventoryCountSession.updateMany({
        where: { reviewedByEmployeeId: employeeId },
        data: { reviewedByEmployeeId: session.employeeId }
      });
      await tx.inventoryCountSession.updateMany({
        where: { approvedByEmployeeId: employeeId },
        data: { approvedByEmployeeId: session.employeeId }
      });

      await tx.productLiquidStock.updateMany({
        where: { lastVerifiedByEmployeeId: employeeId },
        data: { lastVerifiedByEmployeeId: null }
      });
      await tx.productLiquidMovement.updateMany({
        where: { employeeId },
        data: { employeeId: session.employeeId }
      });

      await tx.importJob.updateMany({
        where: { employeeId },
        data: { employeeId: session.employeeId }
      });

      // 3. حذف اتفاقيات وفترات الرواتب المرتبطة بالموظف
      await tx.payrollPeriod.deleteMany({ where: { employeeId } });
      await tx.employeePayAgreement.deleteMany({ where: { employeeId } });

      // 4. حذف الجلسات والمحاولات والصلاحيات والورديات المؤقتة
      await tx.session.deleteMany({ where: { employeeId } });
      await tx.loginAttempt.deleteMany({ where: { employeeId } });
      await tx.pendingMfaChallenge.deleteMany({ where: { employeeId } });
      await tx.shift.deleteMany({ where: { employeeId } });
      await tx.heldSale.deleteMany({ where: { employeeId } });
      await tx.employeePermission.deleteMany({ where: { employeeId } });

      // 5. فك ارتباط سجلات التدقيق التاريخية بحيث لا تمنع الحذف
      await tx.auditLog.updateMany({
        where: { employeeId },
        data: { employeeId: null }
      });

      // 6. الحذف النهائي الفيزيائي للحساب من جدول الموظفين
      await tx.employee.delete({
        where: { id: employeeId }
      });
    });

    // تسجيل العملية في سجل التدقيق
    await prisma.auditLog.create({
      data: {
        employeeId: session.employeeId,
        action: 'EMPLOYEE_PERMANENTLY_DELETED',
        entityType: 'Employee',
        entityId: employeeId,
        ipAddress,
        details: JSON.stringify({ email: employee.email, name: employee.name })
      }
    });

    revalidatePath('/admin/employees');
    return {
      success: true,
      message: `تم حذف حساب "${employee.name}" (${employee.email}) نهائياً من قاعدة البيانات بنجاح.`
    };
  } catch (error: any) {
    console.error('Error in deleteEmployee:', error);
    return { success: false, error: error?.message || 'فشل حذف الموظف من قاعدة البيانات' };
  }
}

