'use client';

import React, { useState } from 'react';
import {
  BackupOverviewData,
  triggerManualBackup,
  testRestoreAction,
  testEmailAction,
} from '@/actions/backups';
import { useRouter } from 'next/navigation';

export function BackupsClient({ initialData }: { initialData: BackupOverviewData }) {
  const router = useRouter();
  const [data, setData] = useState<BackupOverviewData>(initialData);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isTestingRestore, setIsTestingRestore] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let amt = bytes;
    let idx = -1;
    do {
      amt /= 1024;
      idx++;
    } while (amt >= 1024 && idx < units.length - 1);
    return `${amt.toFixed(2)} ${units[idx]}`;
  };

  const handleManualBackup = async () => {
    if (!confirm('هل ترغب في بدء عملية نسخ احتياطي شاملة لبيانات ومستندات رَواق الآن؟')) return;
    setIsBackingUp(true);
    setFeedback({ type: 'info', message: 'جاري إنشاء النسخة الاحتياطية وفحصها في Neon وتشفيرها... قد يستغرق ذلك نصف دقيقة.' });

    try {
      const res = await triggerManualBackup();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `تم إنشاء النسخة الاحتياطية (${res.backupId}) بنجاح والتحقق من سلامتها وتطبيق سياسة النسختين!`,
        });
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: `فشلت العملية: ${res.error}` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ غير متوقع' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleTestRestore = async () => {
    setIsTestingRestore(true);
    setFeedback({ type: 'info', message: 'جاري اختبار استعادة المخطط المعزول في Neon والتحقق من تطابق الجداول...' });
    try {
      const res = await testRestoreAction();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `${res.message} (الجداول: ${res.details?.totalTables}، المنتجات: ${res.details?.productsCount}، الطلبات: ${res.details?.ordersCount})`,
        });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsTestingRestore(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setFeedback({ type: 'info', message: 'جاري إرسال بريد تجريبي عبر بوابة Resend...' });
    try {
      const res = await testEmailAction();
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
      } else {
        setFeedback({ type: 'error', message: `${res.message}: ${res.error}` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl font-heading">
            حماية البيانات والنسخ الاحتياطية
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            نظام آلي متكامل كل 48 ساعة — قاعدة Supabase للإنتاج، Neon للنسخ الاحتياطية، وأرشيف ZIP مشفر، مع إشعارات Resend.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualBackup}
            disabled={isBackingUp}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3F4832] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#323927] focus:outline-none focus:ring-2 focus:ring-[#B7935F] disabled:opacity-50"
          >
            {isBackingUp ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>جاري النسخ...</span>
              </>
            ) : (
              <>
                <span>💾 نسخ احتياطي الآن</span>
              </>
            )}
          </button>

          <button
            onClick={handleTestRestore}
            disabled={isTestingRestore}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {isTestingRestore ? 'جاري الفحص...' : '🧪 اختبار الاستعادة'}
          </button>

          <button
            onClick={handleTestEmail}
            disabled={isTestingEmail}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {isTestingEmail ? 'جاري الإرسال...' : '✉ اختبار الإيميل'}
          </button>

          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-zinc-300 bg-white p-2.5 text-zinc-600 hover:bg-zinc-50"
            title="تحديث البيانات"
          >
            🔄
          </button>
        </div>
      </div>

      {/* User Alerts / Feedback */}
      {feedback && (
        <div
          className={`rounded-lg p-4 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : feedback.type === 'error'
              ? 'border border-rose-200 bg-rose-50 text-rose-800'
              : 'border border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 1. Top Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">آخر نسخة ناجحة</span>
          <p className="mt-2 text-xl font-bold text-zinc-900 truncate" title={data.stats.lastBackupId}>
            {data.stats.lastBackupId}
          </p>
          <span className="mt-1 block text-xs text-zinc-500">{data.stats.lastBackupDate}</span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">النسخة القادمة</span>
          <p className="mt-2 text-xl font-bold text-zinc-900">كل 48 ساعة</p>
          <span className="mt-1 block text-xs text-zinc-500">{data.stats.nextBackupDate}</span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">النسخ المحفوظة المعتمدة</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#3F4832]">{data.stats.retainedCount}</span>
            <span className="text-sm font-semibold text-zinc-500">/ {data.stats.maxRetention} نسختان كحد أقصى</span>
          </div>
          <span className="mt-1 block text-xs text-emerald-700">✓ سياسة الحذف التلقائي للأقدم نشطة</span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">إجمالي مساحة الأرشيف</span>
          <p className="mt-2 text-2xl font-bold text-zinc-900">{formatBytes(data.stats.totalSizeBytes)}</p>
          <span className="mt-1 block text-xs text-zinc-500">مشفرة بتشفير AES-256</span>
        </div>
      </div>

      {/* 2. Service Health Grid */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
        <h2 className="text-base font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <span>📡</span>
          <span>حالة الخدمات المتصلة بنظام الحماية</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Supabase DB */}
          <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-zinc-800">Supabase Database</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${data.services.supabaseDb.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {data.services.supabaseDb.ok ? 'يعمل' : 'معطل'}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">قاعدة الإنتاج الرئيسية</p>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-200/60 pt-2">
              <span>{data.services.supabaseDb.details}</span>
              {data.services.supabaseDb.ok && <span>{data.services.supabaseDb.latencyMs}ms</span>}
            </div>
          </div>

          {/* Supabase Storage */}
          <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-zinc-800">Supabase Storage</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${data.services.supabaseStorage.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {data.services.supabaseStorage.ok ? 'يعمل' : 'معطل'}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">الصور والملفات والمستندات</p>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-200/60 pt-2">
              <span>{data.services.supabaseStorage.details}</span>
            </div>
          </div>

          {/* Neon DB */}
          <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-zinc-800">Neon Database</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${data.services.neonDb.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {data.services.neonDb.ok ? 'يعمل' : 'معطل'}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">النسخ الاحتياطية فقط (معزولة)</p>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-200/60 pt-2">
              <span>{data.services.neonDb.details}</span>
              {data.services.neonDb.ok && <span>{data.services.neonDb.latencyMs}ms</span>}
            </div>
          </div>

          {/* Archive Storage */}
          <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-zinc-800">تخزين أرشيف ZIP</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                يعمل
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">حفظ الأرشيف المشفر خارج Supabase</p>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-200/60 pt-2 truncate" title={data.services.backupStorage.details}>
              <span className="truncate">{data.services.backupStorage.details}</span>
            </div>
          </div>

          {/* Resend */}
          <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-zinc-800">Resend Email</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${data.services.resend.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {data.services.resend.ok ? 'يعمل' : 'معطل'}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">إشعارات الطلبات والنسخ والأمان</p>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-200/60 pt-2">
              <span>{data.services.resend.details}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. The 2 Retained Backups */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <span>🛡</span>
            <span>النسختان المحفوظتان حالياً (الحد الأقصى المعتمد)</span>
          </h2>
          <span className="text-xs text-zinc-500 font-medium">
            يتم الاحتفاظ بآخر نسختين ناجحتين فقط؛ عند نجاح النسخة الثالثة يتم التحقق منها ثم حذف أقدم نسخة تلقائياً.
          </span>
        </div>

        {data.retainedBackups.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            لا توجد نسخ مسجلة حالياً. يمكنك الضغط على "نسخ احتياطي الآن" لإنشاء النسخة الأولى.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.retainedBackups.map((backup) => (
              <div
                key={backup.backupId}
                className={`rounded-xl border p-5 transition-all ${
                  backup.isLatest
                    ? 'border-[#B7935F] bg-[#FAF8F5]/80 shadow-xs ring-1 ring-[#B7935F]/30'
                    : 'border-zinc-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      backup.isLatest
                        ? 'bg-[#3F4832] text-[#F7F3EA]'
                        : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {backup.isLatest ? '★ أحدث نسخة معتمدة' : 'النسخة السابقة'}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">
                    {formatBytes(backup.sizeBytes)}
                  </span>
                </div>

                <p className="mt-3 font-mono font-bold text-lg text-zinc-900">{backup.backupId}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{backup.createdAt}</p>

                <div className="mt-4 pt-3 border-t border-zinc-200/80 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block">قاعدة Neon:</span>
                    <span className="font-semibold text-emerald-700">✓ مستعادة ومطابقة</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">أرشيف ZIP:</span>
                    <span className="font-semibold text-emerald-700">✓ مشفر ومحفوظ</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {backup.downloadUrl && (
                    <a
                      href={backup.downloadUrl}
                      download
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-xs"
                    >
                      <span>📥 تنزيل الأرشيف المشفر</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Recent Operations & Audit Trail */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
        <h2 className="text-base font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <span>📋</span>
          <span>سجل عمليات النسخ والاستعادة الأخير (/admin/logs)</span>
        </h2>

        {data.recentLogs.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">لا توجد سجلات نسخ احتياطي مسجلة بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">التاريخ والوقت</th>
                  <th className="py-2.5 px-3 font-semibold">الحدث</th>
                  <th className="py-2.5 px-3 font-semibold">الحالة</th>
                  <th className="py-2.5 px-3 font-semibold">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 px-3 font-mono text-zinc-600">{log.createdAt}</td>
                    <td className="py-2.5 px-3 font-bold text-zinc-800">{log.action}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          log.outcome === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.outcome === 'SUCCESS' ? 'ناجح' : 'فشل'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 max-w-md truncate font-mono" title={log.details || ''}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
