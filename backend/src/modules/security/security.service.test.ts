import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMailMock, createTransportMock, prismaMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
  prismaMock: {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import { disableTwoFactor, sendTwoFactorCode, verifyTwoFactorCode } from "./security.service.js";

describe("security.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      twoFactorCode: "123456",
      twoFactorExpiry: new Date(Date.now() + 60_000),
    });
    prismaMock.user.update.mockResolvedValue({});
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "mailer@example.com";
    process.env.SMTP_PASS = "secret";
  });

  it("sends a 2fa code by email", async () => {
    await sendTwoFactorCode("user-1");

    expect(prismaMock.user.update).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@example.com",
      subject: expect.stringContaining("c\u00f3digo"),
    }));
  });

  it("rejects an invalid 2fa code", async () => {
    await expect(verifyTwoFactorCode("user-1", "000000")).rejects.toThrow("C\u00f3digo incorrecto.");
  });

  it("disables 2fa and clears pending codes", async () => {
    await disableTwoFactor("user-1");

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        twoFactorEnabled: false,
        twoFactorCode: null,
        twoFactorExpiry: null,
      },
    });
  });
});
