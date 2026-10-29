import nodemailer from 'nodemailer';

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}
export type Mailer = (message: MailMessage) => Promise<string | void>;
export function smtpConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.SMTP_HOST?.trim() && (env.SMTP_FROM?.trim() || env.SMTP_USER?.trim()) && (!env.SMTP_USER?.trim() || env.SMTP_PASS));
}
export function createSmtpMailer(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const from = env.SMTP_FROM?.trim() || env.MAIL_FROM?.trim();
    if (!from) return null;
    return async message => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
          },
          body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.text, html: message.html }),
        });
        if (!response.ok) throw new Error('Resend send failed');
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id.trim()) {
          throw new Error('Resend returned no message id');
        }
        return result.id;
      } finally {
        clearTimeout(timeout);
      }
    };
  }
  if (!smtpConfigured(env)) return null;
  const port = Number(env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST!.trim(), port, secure: port === 465 || port === 2465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return async message => {
    const result = await transporter.sendMail({
      from: env.SMTP_FROM?.trim() || env.SMTP_USER, to: message.to.join(', '), subject: message.subject, text: message.text, html: message.html,
      messageId: message.idempotencyKey ? `<${message.idempotencyKey}@reports.imanager>` : undefined,
      headers: message.idempotencyKey ? { 'Resend-Idempotency-Key': message.idempotencyKey } : undefined,
    });
    if (!result.accepted.length || result.rejected.length) throw new Error('SMTP recipient rejected');
    return result.messageId;
  };
}
