import nodemailer from "nodemailer";
import { prisma } from "../../plugins/prisma.js";
import { env } from "../../config/env.js";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error(
      "SMTP no configurado. Configurá SMTP_HOST, SMTP_USER y SMTP_PASS en las variables de entorno."
    );
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export async function sendTwoFactorCode(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.email) {
    throw new Error("El usuario no tiene email asociado.");
  }

  const code = generateCode();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorCode: code, twoFactorExpiry: expiry },
  });

  const transporter = getTransporter();
  const from = env.SMTP_FROM ?? env.SMTP_USER;

  await transporter.sendMail({
    from: `"iManager" <${from}>`,
    to: user.email,
    subject: "Tu código de verificación — iManager",
    text: `Tu código de verificación es: ${code}\n\nVence en 10 minutos. Si no lo solicitaste, ignorá este mensaje.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Código de verificación</h2>
        <p style="margin:0 0 24px;color:#555;font-size:14px">Ingresá este código en iManager para activar la autenticación de dos factores:</p>
        <div style="background:#111;color:#fff;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;border-radius:8px">
          ${code}
        </div>
        <p style="margin:24px 0 0;color:#999;font-size:12px">Vence en 10 minutos. Si no solicitaste esto, ignorá este mensaje.</p>
      </div>
    `,
  });
}

export async function verifyTwoFactorCode(
  userId: string,
  code: string
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.twoFactorCode || !user.twoFactorExpiry) {
    throw new Error("No hay código pendiente. Solicitá uno nuevo.");
  }

  if (new Date() > user.twoFactorExpiry) {
    throw new Error("El código expiró. Solicitá uno nuevo.");
  }

  if (user.twoFactorCode !== code.trim()) {
    throw new Error("Código incorrecto.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorCode: null,
      twoFactorExpiry: null,
    },
  });
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorCode: null,
      twoFactorExpiry: null,
    },
  });
}
