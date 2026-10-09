import { describe, expect, it } from "vitest";
import { normalizeArWhatsapp, repairCode, repairReadyMessage, repairWhatsappUrl } from "./repairs.whatsapp.js";

describe("repair whatsapp link", () => {
  it("formats the order code and an Argentina mobile link", () => {
    expect(repairCode(95)).toBe("OT-0095");
    expect(normalizeArWhatsapp("261 400-0000")).toBe("5492614000000");
    expect(normalizeArWhatsapp("5492614000000")).toBe("5492614000000");
    expect(normalizeArWhatsapp("+54 261 400 0000")).toBe("5492614000000");
    expect(normalizeArWhatsapp("")).toBeNull();

    const url = repairWhatsappUrl("2614000000", repairReadyMessage({
      clientName: "Ejemplo C",
      device: "iPhone 14",
      code: "OT-0095",
      storeName: "Mi Tienda",
    }));
    expect(url?.startsWith("https://wa.me/5492614000000?text=")).toBe(true);
    expect(decodeURIComponent(url!.split("text=")[1]!)).toContain("orden #OT-0095");
    expect(decodeURIComponent(url!.split("text=")[1]!)).toContain("Mi Tienda");
  });
});
