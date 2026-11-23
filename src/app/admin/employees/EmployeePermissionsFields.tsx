'use client';

import { useState } from 'react';

type RoleOption = {
  id: string;
  name: string;
  defaultSections: string[];
  isMainAdmin: boolean;
};

type PermissionOption = {
  action: string;
  label: string;
  description: string;
};

export function EmployeePermissionsFields({
  roles,
  sections,
  initialRoleId,
  initialPermissions,
}: {
  roles: RoleOption[];
  sections: PermissionOption[];
  initialRoleId: string;
  initialPermissions: string[];
}) {
  const [roleId, setRoleId] = useState(initialRoleId);
  const [selected, setSelected] = useState(() => new Set(initialPermissions));
  const selectedRole = roles.find((role) => role.id === roleId);

  function changeRole(nextRoleId: string) {
    setRoleId(nextRoleId);
    const nextRole = roles.find((role) => role.id === nextRoleId);
    setSelected(new Set(nextRole?.defaultSections ?? []));
  }

  function togglePermission(action: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(action);
      else next.delete(action);
      return next;
    });
  }

  return (
    <>
      <div>
        <label htmlFor="employee-role" className="mb-1 block text-sm font-bold text-zinc-700">الدور الوظيفي الرئيسي</label>
        <select
          id="employee-role"
          name="roleId"
          required
          value={roleId}
          onChange={(event) => changeRole(event.target.value)}
          className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d3623]"
        >
          <option value="">اختر الدور الوظيفي...</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name === 'أدمن رئيسي' ? 'أدمن رئيسي (Super Admin)' : role.name === 'أدمن تشغيلي' ? 'أدمن تشغيلي (Operational Admin)' : role.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-xl border border-zinc-200 p-4">
        <legend className="px-2 text-sm font-bold text-zinc-800">الأقسام المسموح بها</legend>
        <p className="mb-3 text-xs leading-relaxed text-zinc-500">
          تم تحديد الأقسام الافتراضية للدور. يمكنك إضافة أو إزالة أي قسم قبل الحفظ.
        </p>
        {selectedRole?.isMainAdmin && (
          <p className="mb-3 text-sm text-amber-800">الأدمن الرئيسي يحتفظ بصلاحية كاملة على النظام؛ الخيارات هنا توضح صلاحيات الدور فقط.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <label key={section.action} className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50">
              <input
                type="checkbox"
                name="permissions"
                value={section.action}
                checked={selected.has(section.action)}
                onChange={(event) => togglePermission(section.action, event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#3F4832]"
              />
              <span>
                <span className="block text-sm font-bold text-zinc-800">{section.label}</span>
                <span className="block text-xs leading-relaxed text-zinc-500">{section.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
