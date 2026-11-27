'use client';

import { useTransition } from 'react';

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
  onDelete,
}: {
  employeeId: string;
  employeeName: string;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  const handleAction = async (formData: FormData) => {
    const confirmed = window.confirm(
      `هل أنت متأكد تماماً من حذف حساب "${employeeName}" نهائياً من قاعدة البيانات؟\nلن يمكن التراجع عن هذه العملية.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      await onDelete(formData);
    });
  };

  return (
    <form action={handleAction} className="inline-block">
      <input type="hidden" name="targetId" value={employeeId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs px-3 py-1.5 rounded font-bold transition-colors text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50"
      >
        {isPending ? 'جاري الحذف...' : 'حذف نهائي'}
      </button>
    </form>
  );
}
