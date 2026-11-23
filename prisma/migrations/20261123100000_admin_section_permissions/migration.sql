INSERT INTO "Permission" ("id", "action", "description") VALUES
  (md5('admin-section:dashboard'), 'section:dashboard', 'ملخص الطلبات والمبيعات والأداء'),
  (md5('admin-section:orders'), 'section:orders', 'عرض الطلبات وتعديلها ومتابعتها'),
  (md5('admin-section:products'), 'section:products', 'المنتجات والتصنيفات والعلامات والقوالب والدرجات'),
  (md5('admin-section:inventory'), 'section:inventory', 'المستودعات والجرد وأوامر الشراء'),
  (md5('admin-section:financials'), 'section:financials', 'المبيعات والأرباح والتسويات والتقارير والحركات'),
  (md5('admin-section:delivery'), 'section:delivery', 'طلبات شركة التوصيل وإدارة التوصيلات'),
  (md5('admin-section:suppliers'), 'section:suppliers', 'بيانات الموردين والمحلات والتعاملات المرتبطة'),
  (md5('admin-section:settings'), 'section:settings', 'إعدادات المتجر ومناطق الشحن والمكافآت'),
  (md5('admin-section:content'), 'section:content', 'المحتوى والوسائط وقوالب الرسائل')
ON CONFLICT ("action") DO UPDATE SET "description" = EXCLUDED."description";

-- Convert the old operational-admin dashboard and order access to explicit, revocable grants.
INSERT INTO "EmployeePermission" (
  "employeeId", "permissionId", "createdAt", "effect", "grantedByEmployeeId", "reason", "updatedAt"
)
SELECT employee."id", permission."id", CURRENT_TIMESTAMP, 'ALLOW', employee."id",
       'Migrated previous operational-admin access to explicit section permission', CURRENT_TIMESTAMP
FROM "Employee" employee
JOIN "Role" role ON role."id" = employee."roleId"
JOIN "Permission" permission ON permission."action" IN ('section:orders', 'section:dashboard')
WHERE lower(trim(role."name")) IN ('أدمن تشغيلي', 'ادمن تشغيلي')
ON CONFLICT ("employeeId", "permissionId") DO NOTHING;
