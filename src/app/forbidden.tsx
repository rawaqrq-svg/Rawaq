import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6" dir="rtl">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#3F4832]">لا تملك صلاحية الوصول</h1>
        <p className="mt-3 text-sm leading-7 text-stone-600">هذا القسم غير متاح لحسابك. إذا كنت بحاجة إليه، تواصل مع الأدمن الرئيسي لتحديث صلاحياتك.</p>
        <Link href="/admin/dashboard" className="mt-6 inline-flex rounded-lg bg-[#3F4832] px-4 py-2 text-sm font-bold text-white">العودة للوحة الإدارة</Link>
      </section>
    </main>
  );
}
