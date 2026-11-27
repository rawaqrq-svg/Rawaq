import React from 'react';
import { requireSuperAdmin } from '@/lib/dal';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getBackupOverview } from '@/actions/backups';
import { BackupsClient } from './BackupsClient';

export const dynamic = 'force-dynamic';

export default async function AdminBackupsPage() {
  const session = await requireSuperAdmin();
  const overviewResult = await getBackupOverview();

  if (!overviewResult.success || !overviewResult.data) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-ivory-100,#F7F3EA)] md:flex-row" dir="rtl">
        <AdminSidebar employeeName={session.employee.name} roleName={session.employee.role.name} />
        <main className="min-w-0 w-full flex-1 p-6 md:p-8">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800">
            <h2 className="text-lg font-bold">تعذر تحميل بيانات النسخ الاحتياطية</h2>
            <p className="mt-2 text-sm">{overviewResult.error || 'حدث خطأ غير معروف أثناء الاتصال بالخوادم.'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F3EA]/30 md:flex-row" dir="rtl">
      <AdminSidebar employeeName={session.employee.name} roleName={session.employee.role.name} />
      <main className="min-w-0 w-full flex-1 p-4 md:p-8">
        <BackupsClient initialData={overviewResult.data} />
      </main>
    </div>
  );
}
