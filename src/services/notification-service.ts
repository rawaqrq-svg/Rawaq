import { resendService } from './resend-service';
import {
  renderNewOrderEmail,
  renderBackupSuccessEmail,
  renderBackupFailureEmail,
  NewOrderEmailData,
  BackupSuccessEmailData,
  BackupFailureEmailData,
  wrapBaseEmail,
} from '../emails/templates';
import { getBackupConfig } from '../../scripts/backup/config';
import { prisma } from '../lib/db';

export class NotificationService {
  private config = getBackupConfig();

  public async notifyNewOrder(data: NewOrderEmailData) {
    const { subject, html, text } = renderNewOrderEmail(data);
    const recipient = this.config.adminNotificationEmail;

    const result = await resendService.sendEmail({
      to: recipient,
      subject,
      html,
      text,
      type: 'orders',
      idempotencyKey: `order-email-${data.reference}`,
    });

    // Log to AuditLog if database connection is available
    try {
      await prisma.auditLog.create({
        data: {
          action: 'ORDER_EMAIL_NOTIFICATION',
          entityType: 'Order',
          entityId: data.reference,
          category: 'ORDERS',
          actorType: 'SYSTEM',
          actorNameSnapshot: 'نظام إشعارات رَواق',
          outcome: result.success ? 'SUCCESS' : 'FAILED',
          severity: result.success ? 'NORMAL' : 'HIGH',
          details: JSON.stringify({
            recipient,
            subject,
            messageId: result.messageId,
            sender: result.senderUsed,
            error: result.error,
          }),
        },
      });
    } catch (logErr) {
      console.warn('[NotificationService] Could not write audit log for order email:', logErr);
    }

    return result;
  }

  public async notifyBackupSuccess(data: BackupSuccessEmailData) {
    const { subject, html, text } = renderBackupSuccessEmail(data);
    const recipient = this.config.adminNotificationEmail;

    const result = await resendService.sendEmail({
      to: recipient,
      subject,
      html,
      text,
      type: 'backup',
      idempotencyKey: `backup-success-${data.backupId}`,
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'BACKUP_EMAIL_NOTIFICATION',
          entityType: 'Backup',
          entityId: data.backupId,
          category: 'SECURITY',
          actorType: 'SYSTEM',
          actorNameSnapshot: 'نظام حماية بيانات رَواق',
          outcome: result.success ? 'SUCCESS' : 'FAILED',
          severity: 'NORMAL',
          details: JSON.stringify({
            backupId: data.backupId,
            recipient,
            messageId: result.messageId,
            error: result.error,
          }),
        },
      });
    } catch {
      // Ignore if DB offline
    }

    return result;
  }

  public async notifyBackupFailure(data: BackupFailureEmailData) {
    const { subject, html, text } = renderBackupFailureEmail(data);
    const recipient = this.config.adminNotificationEmail;

    const result = await resendService.sendEmail({
      to: recipient,
      subject,
      html,
      text,
      type: 'security',
      idempotencyKey: `backup-failure-${data.backupId}-${Date.now()}`,
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'BACKUP_ALERT_NOTIFICATION',
          entityType: 'Backup',
          entityId: data.backupId,
          category: 'SECURITY',
          actorType: 'SYSTEM',
          actorNameSnapshot: 'نظام حماية بيانات رَواق',
          outcome: result.success ? 'SUCCESS' : 'FAILED',
          severity: 'CRITICAL',
          details: JSON.stringify({
            backupId: data.backupId,
            stage: data.stage,
            errorMessage: data.errorMessage,
            recipient,
            messageId: result.messageId,
          }),
        },
      });
    } catch {
      // Ignore if DB offline
    }

    return result;
  }

  public async sendTestEmail(recipientEmail?: string) {
    const recipient = recipientEmail || this.config.adminNotificationEmail;
    const testContent = `
      <div style="background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <strong style="color: #16A34A; font-size: 16px;">✓ تم التحقق من اتصال Resend بنجاح!</strong>
        <p style="margin: 6px 0 0; font-size: 14px; color: #166534;">
          هذه رسالة تجريبية لتأكيد ضبط مفاتيح Resend وتكامل الإشعارات الإلكترونية في متجر رَواق.
        </p>
      </div>
      <table class="info-table">
        <tr>
          <td class="label-col">الخدمة</td>
          <td class="value-col">Resend Email Gateway</td>
        </tr>
        <tr>
          <td class="label-col">المستلم</td>
          <td class="value-col">${recipient}</td>
        </tr>
        <tr>
          <td class="label-col">وقت الإرسال</td>
          <td class="value-col">${new Date().toLocaleString('ar-JO', { timeZone: 'Asia/Amman' })}</td>
        </tr>
      </table>
    `;

    const html = wrapBaseEmail('اختبار نظام الإشعارات الإلكترونية', 'فحص اتصال خدمة Resend', testContent);

    return await resendService.sendEmail({
      to: recipient,
      subject: 'اختبار الإشعارات | رَواق | RAWAQ Test Email',
      html,
      text: 'اختبار إشعارات متجر رَواق بنجاح.',
      type: 'security',
    });
  }
}

export const notificationService = new NotificationService();
