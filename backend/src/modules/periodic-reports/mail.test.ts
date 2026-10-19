import { describe, expect, it } from "vitest";
import { createSmtpMailer, smtpConfigured } from "./mail.js";

describe("correo SMTP", () => {
  it("no arma un enviador si falta el host o el remitente", () => {
    expect(createSmtpMailer({ SMTP_USER: "mailer@example.com", SMTP_PASS: "secret" })).toBeNull();
    expect(createSmtpMailer({ SMTP_HOST: "smtp.example.com" })).toBeNull();
    expect(smtpConfigured({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "reportes@example.com" })).toBe(true);
    expect(typeof createSmtpMailer({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "reportes@example.com", SMTP_PORT: "587" })).toBe("function");
  });
});
