export const ADMIN_SECTIONS = [
  { action: 'section:dashboard', label: 'لوحة الأعمال', description: 'ملخص الطلبات والمبيعات والأداء' },
  { action: 'section:orders', label: 'الطلبات', description: 'عرض الطلبات وتعديلها ومتابعتها' },
  { action: 'section:products', label: 'المنتجات', description: 'المنتجات والتصنيفات' },
  { action: 'section:financials', label: 'المالية والتقارير', description: 'المبيعات والأرباح والتسويات والتقارير والحركات' },
  { action: 'section:delivery', label: 'التوصيل', description: 'طلبات شركة التوصيل وإدارة التوصيلات' },
  { action: 'section:suppliers', label: 'الموردون والمحلات', description: 'بيانات الموردين والمحلات والتعاملات المرتبطة' },
  { action: 'section:settings', label: 'إعدادات النظام', description: 'إعدادات المتجر ومناطق الشحن والمكافآت' },
  { action: 'section:content', label: 'المحتوى والرسائل', description: 'المحتوى والوسائط وقوالب الرسائل' },
] as const;

export const ADMIN_SECTION_ACTIONS = ADMIN_SECTIONS.map((section) => section.action);

const ROLE_ACTIONS_BY_SECTION: Record<string, string[]> = {
  'section:dashboard': ['dashboard.view'],
  'section:orders': ['manage:orders', 'manage_orders', 'orders.view', 'orders.confirm', 'orders.edit'],
  'section:products': ['manage:products', 'products.view'],
  'section:financials': ['manage:financials', 'financials.view', 'manage:settings'],
  'section:delivery': ['manage:delivery', 'delivery.view', 'manage:orders', 'manage_orders'],
  'section:suppliers': ['manage:suppliers', 'suppliers.view', 'manage:settings'],
  'section:settings': ['manage:settings', 'settings.view'],
  'section:content': ['manage:content', 'content.view'],
};

export function sectionsIncludedByRoleActions(roleActions: string[]) {
  const actions = new Set(roleActions);
  return ADMIN_SECTIONS
    .filter((section) => actions.has(section.action) || (ROLE_ACTIONS_BY_SECTION[section.action] || []).some((action) => actions.has(action)))
    .map((section) => section.action);
}

export function defaultSectionsForRole(roleName: string, roleActions: string[] = []) {
  if (isMainAdminRole(roleName)) return [...ADMIN_SECTION_ACTIONS];
  const inherited = sectionsIncludedByRoleActions(roleActions);
  if (inherited.length) return inherited;
  const normalized = normalizeRoleName(roleName);
  if (normalized === 'أدمن تشغيلي' || normalized === 'ادمن تشغيلي') {
    return ['section:dashboard', 'section:orders'];
  }
  return [];
}

export function normalizeRoleName(roleName: string) {
  return roleName.trim().toUpperCase().replace(/[_-]+/g, ' ');
}

export function isMainAdminRole(roleName: string) {
  return ['ADMIN', 'SUPER ADMIN', 'أدمن رئيسي', 'ادمن رئيسي'].includes(normalizeRoleName(roleName));
}

const ACTION_SECTION_ACCESS: Record<string, string[]> = {
  'manage:orders': ['section:orders', 'section:delivery'],
  manage_orders: ['section:orders', 'section:delivery'],
  'orders.view': ['section:orders', 'section:delivery'],
  'orders.confirm': ['section:orders', 'section:delivery'],
  'orders.edit': ['section:orders'],
  'manage:products': ['section:products'],
  'manage:inventory': ['section:inventory'],
  'manage:financials': ['section:financials'],
  'manage:settings': ['section:settings'],
  'manage:suppliers': ['section:suppliers'],
  'manage:delivery': ['section:delivery'],
  'manage:content': ['section:content'],
};

export function permissionAllowsAction(granted: string[], action: string) {
  if (action.startsWith('section:')) return granted.includes(action);
  const sectionAccess = ACTION_SECTION_ACCESS[action];
  if (sectionAccess) return sectionAccess.some((section) => granted.includes(section));

  const aliases: Record<string, string[]> = {
    manage_orders: ['manage:orders'],
    'orders.confirm': ['manage:orders'],
  };
  if ((aliases[action] || []).some((alias) => ACTION_SECTION_ACCESS[alias]?.some((section) => granted.includes(section)))) return true;
  return granted.includes(action);
}
