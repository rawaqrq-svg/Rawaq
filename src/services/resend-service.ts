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
  private resend: Resend | null = null;

  private constructor() {
    // Lazy instantiation on first email send to prevent build-time failures
  }

  public static getInstance(): ResendService {
    if (!ResendService.instance) {
      ResendService.instance = new ResendService();
    }
    return ResendService.instance;
  }

  private getClient(): { client: Resend; config: ReturnType<typeof getBackupConfig> } | null {
    const config = getBackupConfig();
    const apiKey = process.env.RESEND_API_KEY || config.resendApiKey;

    if (!apiKey) {
      return null;
    }

    if (!this.resend) {
      this.resend = new Resend(apiKey);
    }

    return { client: this.resend, config };
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const resendContext = this.getClient();

    if (!resendContext) {
      console.warn('[ResendService] RESEND_API_KEY is missing. Email dispatch skipped.');
      return {
        success: false,
        error: 'RESEND_API_KEY is not configured in environment',
      };
    }

    const { client, config } = resendContext;
    let primaryFrom = config.resendFallbackFrom;

    if (options.type === 'orders') {
      primaryFrom = config.resendOrdersFrom;
    } else if (options.type === 'backup') {
      primaryFrom = config.resendBackupFrom;
    } else if (options.type === 'security') {
      primaryFrom = config.resendSecurityFrom;
    }

    // Format sender display name
    const formattedFrom = `رَواق | RAWAQ <${primaryFrom}>`;
    const fallbackFrom = `رَواق | RAWAQ <${config.resendFallbackFrom}>`;

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    try {
      // First attempt with primary domain
      const result = await client.emails.send({
        from: formattedFrom,
        replyTo: config.adminNotificationEmail,
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

          const fallbackResult = await client.emails.send({
            from: fallbackFrom,
            replyTo: config.adminNotificationEmail,
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
        const fallbackResult = await client.emails.send({
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
