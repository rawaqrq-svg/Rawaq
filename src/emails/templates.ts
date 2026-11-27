export const BRAND = {
  olive: '#3F4832',
  cream: '#F7F3EA',
  gold: '#B7935F',
  dark: '#262923',
  lightGray: '#F4F4F1',
  border: '#E2DEC9',
  white: '#FFFFFF',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#F87171',
  success: '#16A34A',
  successBg: '#F0FDF4',
  successBorder: '#86EFAC',
};

export function wrapBaseEmail(title: string, subtitle: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${BRAND.cream};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: ${BRAND.dark};
      direction: rtl;
      text-align: right;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    .container {
      max-width: 620px;
      margin: 20px auto;
      background-color: ${BRAND.white};
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(63, 72, 50, 0.08);
      border: 1px solid ${BRAND.border};
    }
    .header {
      background-color: ${BRAND.olive};
      color: ${BRAND.white};
      padding: 32px 24px;
      text-align: center;
    }
    .header-logo {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 4px;
      color: ${BRAND.gold};
      margin: 0;
    }
    .header-tagline {
      font-size: 13px;
      color: #D6DDC8;
      margin-top: 6px;
      letter-spacing: 1px;
    }
    .title-banner {
      background-color: #ECE7DA;
      padding: 16px 24px;
      border-bottom: 2px solid ${BRAND.gold};
    }
    .title-text {
      font-size: 18px;
      font-weight: 700;
      color: ${BRAND.olive};
      margin: 0;
    }
    .subtitle-text {
      font-size: 13px;
      color: #6B725C;
      margin-top: 4px;
      margin-bottom: 0;
    }
    .body {
      padding: 24px;
    }
    .info-table {
      margin: 16px 0;
      border-radius: 8px;
      background-color: ${BRAND.lightGray};
      border: 1px solid ${BRAND.border};
    }
    .info-table td {
      padding: 10px 16px;
      border-bottom: 1px solid #EBE7D8;
      font-size: 14px;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .label-col {
      width: 35%;
      color: #6B725C;
      font-weight: 600;
    }
    .value-col {
      font-weight: 700;
      color: ${BRAND.dark};
    }
    .button-container {
      text-align: center;
      margin: 28px 0 16px;
    }
    .btn {
      display: inline-block;
      background-color: ${BRAND.olive};
      color: ${BRAND.white} !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      border: 1px solid ${BRAND.gold};
    }
    .footer {
      background-color: ${BRAND.cream};
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #8C9280;
      border-top: 1px solid ${BRAND.border};
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">رَواق | RAWAQ</div>
      <div class="header-tagline">أناقة من روح الأصالة</div>
    </div>
    <div class="title-banner">
      <h1 class="title-text">${title}</h1>
      <p class="subtitle-text">${subtitle}</p>
    </div>
    <div class="body">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>تم إرسال هذا الإشعار تلقائياً من نظام رَواق الإداري الموحد.</p>
      <p>رَواق · حماية البيانات والإشعارات الإلكترونية © ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
  `;
}

// 1. New Order Email
export interface NewOrderEmailData {
  reference: string;
  customerName: string;
  customerPhone: string;
  city: string;
  addressDetails?: string;
  paymentMethod: string;
  status: string;
  items: Array<{ name: string; quantity: number; priceFils: number }>;
  subtotalFils: number;
  deliveryFils: number;
  discountFils?: number;
  totalFils: number;
  adminOrderUrl?: string;
}

export function formatFils(fils: number): string {
  const jod = fils / 1000;
  return `${jod.toFixed(3)} د.أ`;
}

export function renderNewOrderEmail(data: NewOrderEmailData): { subject: string; html: string; text: string } {
  const subject = `طلب جديد | #${data.reference} | رَواق`;

  const itemsRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #EBE7D8; font-size: 14px;">
          <strong>${item.name}</strong>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #EBE7D8; text-align: center; font-size: 14px;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #EBE7D8; text-align: left; font-size: 14px; font-weight: bold;">
          ${formatFils(item.priceFils * item.quantity)}
        </td>
      </tr>
    `,
    )
    .join('');

  const content = `
    <p style="font-size: 15px; margin-top: 0; line-height: 1.6;">
      وصلك طلب جديد تم تسجيله في متجر رَواق وبانتظار مراجعتك وتجهيزه للتسليم.
    </p>

    <table class="info-table">
      <tr>
        <td class="label-col">رقم الطلب</td>
        <td class="value-col" style="color: ${BRAND.olive}; font-size: 16px;">#${data.reference}</td>
      </tr>
      <tr>
        <td class="label-col">اسم العميلة</td>
        <td class="value-col">${data.customerName}</td>
      </tr>
      <tr>
        <td class="label-col">رقم الهاتف</td>
        <td class="value-col" dir="ltr" style="text-align: right;">${data.customerPhone}</td>
      </tr>
      <tr>
        <td class="label-col">المدينة</td>
        <td class="value-col">${data.city}</td>
      </tr>
      ${
        data.addressDetails
          ? `<tr><td class="label-col">العنوان التفصيلي</td><td class="value-col">${data.addressDetails}</td></tr>`
          : ''
      }
      <tr>
        <td class="label-col">طريقة الدفع</td>
        <td class="value-col">${data.paymentMethod}</td>
      </tr>
      <tr>
        <td class="label-col">الحالة</td>
        <td class="value-col"><span style="background-color: #FEF3C7; color: #92400E; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${data.status}</span></td>
      </tr>
    </table>

    <h3 style="color: ${BRAND.olive}; margin: 24px 0 12px; font-size: 16px; border-bottom: 1px solid ${BRAND.border}; padding-bottom: 8px;">
      محتويات الطلب
    </h3>

    <table style="width: 100%; border: 1px solid ${BRAND.border}; border-radius: 8px; margin-bottom: 16px;">
      <thead>
        <tr style="background-color: ${BRAND.lightGray};">
          <th style="padding: 10px; text-align: right; font-size: 13px; color: #6B725C;">الصنف</th>
          <th style="padding: 10px; text-align: center; font-size: 13px; color: #6B725C;">الكمية</th>
          <th style="padding: 10px; text-align: left; font-size: 13px; color: #6B725C;">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <table class="info-table" style="margin-top: 12px;">
      <tr>
        <td class="label-col">إجمالي المنتجات</td>
        <td class="value-col" style="text-align: left;">${formatFils(data.subtotalFils)}</td>
      </tr>
      <tr>
        <td class="label-col">التوصيل</td>
        <td class="value-col" style="text-align: left;">${formatFils(data.deliveryFils)}</td>
      </tr>
      ${
        data.discountFils && data.discountFils > 0
          ? `<tr><td class="label-col">الخصم</td><td class="value-col" style="text-align: left; color: ${BRAND.danger};">-${formatFils(data.discountFils)}</td></tr>`
          : ''
      }
      <tr style="background-color: #ECE7DA;">
        <td class="label-col" style="font-size: 16px; color: ${BRAND.olive}; font-weight: bold;">إجمالي الطلب</td>
        <td class="value-col" style="font-size: 18px; color: ${BRAND.olive}; text-align: left; font-weight: bold;">${formatFils(data.totalFils)}</td>
      </tr>
    </table>

    ${
      data.adminOrderUrl
        ? `
    <div class="button-container">
      <a href="${data.adminOrderUrl}" class="btn">عرض الطلب في لوحة الإدارة</a>
    </div>`
        : ''
    }
  `;

  const html = wrapBaseEmail('وصلك طلب جديد!', 'تم تسجيل طلب جديد في متجر رَواق وبانتظار مراجعتك.', content);

  const text = `
طلب جديد في متجر رَواق!
رقم الطلب: #${data.reference}
العميلة: ${data.customerName} (${data.customerPhone})
المدينة: ${data.city}
الإجمالي: ${formatFils(data.totalFils)}
طريقة الدفع: ${data.paymentMethod}
  `.trim();

  return { subject, html, text };
}

// 2. Backup Success Email
export interface BackupSuccessEmailData {
  backupId: string;
  date: string;
  startTime: string;
  durationSeconds: number;
  totalSizeBytes: number;
  tableCount: number;
  totalRows: number;
  storageFilesCount: number;
  retainedBackups: string[];
  prunedBackupId?: string;
  nextScheduledBackup: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let amt = bytes;
  let idx = -1;
  do {
    amt /= 1024;
    idx++;
  } while (amt >= 1024 && idx < units.length - 1);
  return `${amt.toFixed(2)} ${units[idx]}`;
}

export function renderBackupSuccessEmail(data: BackupSuccessEmailData): { subject: string; html: string; text: string } {
  const subject = `نجاح النسخ الاحتياطي | RAWAQ | ${data.backupId}`;
  const durationText = `${Math.floor(data.durationSeconds / 60)} دقيقة و ${Math.floor(data.durationSeconds % 60)} ثانية`;

  const content = `
    <div style="background-color: ${BRAND.successBg}; border: 1px solid ${BRAND.successBorder}; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <strong style="color: ${BRAND.success}; font-size: 15px;">✓ تم النسخ الاحتياطي بنجاح</strong>
      <p style="margin: 4px 0 0; font-size: 13px; color: #166534;">تم حفظ بيانات رَواق والتحقق من سلامة واستعادة النسخة الجديدة بالكامل.</p>
    </div>

    <table class="info-table">
      <tr>
        <td class="label-col">رقم النسخة</td>
        <td class="value-col" style="color: ${BRAND.olive}; font-size: 16px;">${data.backupId}</td>
      </tr>
      <tr>
        <td class="label-col">التاريخ والوقت</td>
        <td class="value-col">${data.date} — ${data.startTime}</td>
      </tr>
      <tr>
        <td class="label-col">مدة التنفيذ</td>
        <td class="value-col">${durationText}</td>
      </tr>
      <tr>
        <td class="label-col">حجم النسخة المشفرة</td>
        <td class="value-col">${formatBytes(data.totalSizeBytes)}</td>
      </tr>
      <tr>
        <td class="label-col">سجلات قاعدة البيانات</td>
        <td class="value-col">${data.totalRows.toLocaleString('ar-JO')} سجل (${data.tableCount} جدولاً)</td>
      </tr>
      <tr>
        <td class="label-col">ملفات التخزين (Storage)</td>
        <td class="value-col">${data.storageFilesCount} ملف</td>
      </tr>
    </table>

    <h3 style="color: ${BRAND.olive}; margin: 24px 0 12px; font-size: 15px;">
      نتائج النسخ والتحقق
    </h3>
    <table class="info-table">
      <tr>
        <td class="label-col">Supabase Database</td>
        <td class="value-col" style="color: ${BRAND.success};">✓ مكتمل ومطابق بنسبة 100%</td>
      </tr>
      <tr>
        <td class="label-col">Supabase Storage</td>
        <td class="value-col" style="color: ${BRAND.success};">✓ مكتمل (${data.storageFilesCount} ملف)</td>
      </tr>
      <tr>
        <td class="label-col">إنشاء ZIP المشفر</td>
        <td class="value-col" style="color: ${BRAND.success};">✓ تشفير AES-256 مكتمل</td>
      </tr>
      <tr>
        <td class="label-col">استعادة البيانات إلى Neon</td>
        <td class="value-col" style="color: ${BRAND.success};">✓ استعادة واختبار سلامة الجداول مكتمل</td>
      </tr>
      <tr>
        <td class="label-col">تنظيف وتدوير النسخ</td>
        <td class="value-col" style="color: ${BRAND.success};">✓ تم تطبيق سياسة آخر نسختين فقط</td>
      </tr>
    </table>

    <h3 style="color: ${BRAND.olive}; margin: 24px 0 12px; font-size: 15px;">
      النسخ الاحتياطية المحفوظة حالياً
    </h3>
    <table class="info-table">
      ${data.retainedBackups
        .map(
          (b, idx) => `
        <tr>
          <td class="label-col">${idx === 0 ? 'أحدث نسخة' : 'النسخة السابقة'}</td>
          <td class="value-col">${b}</td>
        </tr>
      `,
        )
        .join('')}
      ${
        data.prunedBackupId
          ? `
        <tr style="background-color: #FFF7ED;">
          <td class="label-col" style="color: #9A3412;">النسخة المحذوفة</td>
          <td class="value-col" style="color: #9A3412;">تم حذف النسخة الأقدم (${data.prunedBackupId}) بعد التحقق بنجاح من النسخة الجديدة.</td>
        </tr>`
          : ''
      }
    </table>

    <p style="margin-top: 20px; font-size: 13px; color: #6B725C;">
      <strong>موعد النسخ القادم:</strong> ${data.nextScheduledBackup}
    </p>
  `;

  const html = wrapBaseEmail('نجاح النسخ الاحتياطي', 'تم حفظ وتشفير واختبار بيانات رَواق بنجاح.', content);

  const text = `
نجاح النسخ الاحتياطي | RAWAQ
رقم النسخة: ${data.backupId}
الحجم: ${formatBytes(data.totalSizeBytes)}
المدة: ${durationText}
النسخ المعتمدة: ${data.retainedBackups.join(' , ')}
  `.trim();

  return { subject, html, text };
}

// 3. Backup Failure Email
export interface BackupFailureEmailData {
  backupId: string;
  stage: string;
  errorMessage: string;
  nextRetry: string;
  retainedBackups: string[];
}

export function renderBackupFailureEmail(data: BackupFailureEmailData): { subject: string; html: string; text: string } {
  const subject = `تنبيه مهم | فشل النسخ الاحتياطي | RAWAQ`;

  const content = `
    <div style="background-color: ${BRAND.dangerBg}; border: 1px solid ${BRAND.dangerBorder}; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <strong style="color: ${BRAND.danger}; font-size: 15px;">⚠ لم تكتمل النسخة الاحتياطية</strong>
      <p style="margin: 4px 0 0; font-size: 13px; color: #991B1B;">حدث خطأ أثناء تنفيذ عملية النسخ الاحتياطي المجدولة لبيانات رَواق.</p>
    </div>

    <table class="info-table">
      <tr>
        <td class="label-col">رقم العملية</td>
        <td class="value-col" style="color: ${BRAND.danger};">${data.backupId}</td>
      </tr>
      <tr>
        <td class="label-col">مرحلة الفشل</td>
        <td class="value-col">${data.stage}</td>
      </tr>
      <tr>
        <td class="label-col">سبب الخطأ</td>
        <td class="value-col" style="color: ${BRAND.danger}; font-family: monospace;">${data.errorMessage}</td>
      </tr>
      <tr>
        <td class="label-col">الإجراء القادم</td>
        <td class="value-col">${data.nextRetry}</td>
      </tr>
    </table>

    <div style="background-color: #FEFCE8; border: 1px solid #FEF08A; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
      <strong style="color: #854D0E; font-size: 14px;">النسختان السابقتان محفوظتان ومحميتان</strong>
      <p style="margin: 4px 0 0; font-size: 13px; color: #713F12;">
        بناءً على سياسة رَواق الصارمة، لم يتم حذف أي نسخة سليمة سابقة نتيجة فشل العملية الجديدة. النسخ المتاحة للاستعادة هي:
      </p>
      <ul style="margin: 8px 0 0; padding-right: 20px; font-size: 13px; color: #713F12;">
        ${data.retainedBackups.map((b) => `<li><strong>${b}</strong></li>`).join('')}
      </ul>
    </div>
  `;

  const html = wrapBaseEmail('تنبيه أمان | فشل النسخ الاحتياطي', 'حدث خطأ في عملية النسخ الاحتياطي المجدولة.', content);

  const text = `
تنبيه: فشل النسخ الاحتياطي في رَواق
رقم العملية: ${data.backupId}
المرحلة: ${data.stage}
السبب: ${data.errorMessage}
النسخ السابقة لا تزال سليمة ومحفوظة.
  `.trim();

  return { subject, html, text };
}
