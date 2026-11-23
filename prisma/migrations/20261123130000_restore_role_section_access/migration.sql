-- Preserve existing role-level access when authorization moves to explicit section grants.
-- Existing employee-specific grants remain authoritative because conflicts are not replaced.
WITH mapped_role_sections AS (
  SELECT DISTINCT rp."roleId", target_permission."id" AS "permissionId"
  FROM "RolePermission" rp
  JOIN "Permission" source_permission ON source_permission."id" = rp."permissionId"
  JOIN "Permission" target_permission ON target_permission."action" = CASE
    WHEN source_permission."action" IN ('manage:products', 'products.view') THEN 'section:products'
    WHEN source_permission."action" IN ('manage:orders', 'manage_orders', 'orders.view', 'orders.confirm', 'orders.edit') THEN 'section:orders'
    WHEN source_permission."action" IN ('manage:delivery', 'delivery.view') THEN 'section:delivery'
    WHEN source_permission."action" IN ('manage:financials', 'financials.view') THEN 'section:financials'
    WHEN source_permission."action" IN ('manage:settings', 'settings.view') THEN 'section:settings'
    WHEN source_permission."action" IN ('manage:suppliers', 'suppliers.view') THEN 'section:suppliers'
    WHEN source_permission."action" IN ('manage:content', 'content.view') THEN 'section:content'
    WHEN source_permission."action" IN ('manage:inventory', 'inventory.view') THEN 'section:inventory'
    ELSE NULL
  END
)
INSERT INTO "EmployeePermission" (
  "employeeId", "permissionId", "createdAt", "effect", "grantedByEmployeeId", "reason", "updatedAt"
)
SELECT employee."id", mapped."permissionId", CURRENT_TIMESTAMP, 'ALLOW', employee."id",
       'Migrated existing role permission to section access', CURRENT_TIMESTAMP
FROM "Employee" employee
JOIN mapped_role_sections mapped ON mapped."roleId" = employee."roleId"
ON CONFLICT ("employeeId", "permissionId") DO NOTHING;
