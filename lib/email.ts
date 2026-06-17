// Email sending via Resend. Gated: if not configured, callers skip sending.
import { Resend } from 'resend';

export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.QUOTE_FROM_EMAIL;
  return (
    !!key &&
    key.startsWith('re_') &&
    !key.includes('your-') &&
    !!from &&
    !from.includes('yourdomain')
  );
}

export interface EmailAttachment {
  filename: string;
  /** base64-encoded content */
  content: string;
}

export async function sendQuoteEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const bcc = process.env.QUOTE_NOTIFY_EMAIL;
  const { error } = await resend.emails.send({
    from: process.env.QUOTE_FROM_EMAIL!,
    to: opts.to,
    ...(bcc ? { bcc } : {}),
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
  // Resend reports API failures via the response, not by throwing.
  if (error) throw new Error(error.message ?? 'Email send failed');
}
