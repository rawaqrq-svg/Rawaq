import { Resend } from 'resend';
import { getBackupConfig } from '../../scripts/backup/config';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  type?: 'orders' | 'backup' | 'security';
  idempotencyKey?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  senderUsed?: string;
}

export class ResendService {
  private static instance: ResendService;
  private resend: Resend;
  private config = getBackupConfig();

  private constructor() {
    this.resend = new Resend(this.config.resendApiKey);
  }

  public static getInstance(): ResendService {
    if (!ResendService.instance) {
      ResendService.instance = new ResendService();
    }
    return ResendService.instance;
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    let primaryFrom = this.config.resendFallbackFrom;

    if (options.type === 'orders') {
      primaryFrom = this.config.resendOrdersFrom;
    } else if (options.type === 'backup') {
      primaryFrom = this.config.resendBackupFrom;
    } else if (options.type === 'security') {
      primaryFrom = this.config.resendSecurityFrom;
    }

    // Format sender display name
    const formattedFrom = `رَواق | RAWAQ <${primaryFrom}>`;
    const fallbackFrom = `رَواق | RAWAQ <${this.config.resendFallbackFrom}>`;

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    try {
      // First attempt with primary domain
      const result = await this.resend.emails.send({
        from: formattedFrom,
        replyTo: this.config.adminNotificationEmail,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: options.idempotencyKey
          ? {
              'Idempotency-Key': options.idempotencyKey,
            }
          : undefined,
      });

      if (result.error) {
        // If error is domain verification related, retry with verified onboarding fallback sender
        if (
          result.error.message.includes('domain') ||
          result.error.message.includes('not verified') ||
          result.error.message.includes('from')
        ) {
          console.warn(
            `[ResendService] Primary sender ${formattedFrom} unverified, retrying with fallback ${fallbackFrom}: ${result.error.message}`,
          );

          const fallbackResult = await this.resend.emails.send({
            from: fallbackFrom,
            replyTo: this.config.adminNotificationEmail,
            to: recipients,
            subject: options.subject,
            html: options.html,
            text: options.text,
          });

          if (fallbackResult.error) {
            return {
              success: false,
              error: fallbackResult.error.message,
              senderUsed: fallbackFrom,
            };
          }

          return {
            success: true,
            messageId: fallbackResult.data?.id,
            senderUsed: fallbackFrom,
          };
        }

        return {
          success: false,
          error: result.error.message,
          senderUsed: formattedFrom,
        };
      }

      return {
        success: true,
        messageId: result.data?.id,
        senderUsed: formattedFrom,
      };
    } catch (err: any) {
      console.error('[ResendService] Unexpected exception sending email:', err);
      // Attempt fallback on exception
      try {
        const fallbackResult = await this.resend.emails.send({
          from: fallbackFrom,
          to: recipients,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        if (fallbackResult.data?.id) {
          return {
            success: true,
            messageId: fallbackResult.data.id,
            senderUsed: fallbackFrom,
          };
        }
      } catch {
        // Ignore fallback error
      }

      return {
        success: false,
        error: err.message || 'Unknown email error',
      };
    }
  }
}

export const resendService = ResendService.getInstance();
