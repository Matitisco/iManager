import nodemailer from "nodemailer";

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
}

export type Mailer = (message: MailMessage) => Promise<void>;

export function smtpConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.SMTP_HOST?.trim() && (env.SMTP_FROM?.trim() || env.SMTP_USER?.trim()));
}

/** Uses the SMTP_* variables already defined for the API. Returns null when the host or sender is missing. */
export function createSmtpMailer(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const from = env.SMTP_FROM?.trim() || user;
  if (!host || !from) return null;
  const port = Number(env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: port === 465,
    auth: user ? { user, pass: env.SMTP_PASS ?? "" } : undefined,
  });
  return async (message) => {
    await transporter.sendMail({
      from,
      to: message.to.join(", "),
      subject: message.subject,
      text: message.text,
    });
  };
}
