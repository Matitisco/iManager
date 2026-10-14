import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("../context/AppContext", () => ({
  useAppContext: () => ({ updateGettingStarted: vi.fn() }),
}));
import { WelcomeVideo } from "./WelcomeVideo";
describe("video opcional", () => {
  it("muestra un poster lazy sin montar ni descargar un video inicialmente", () => {
    const { container } = render(<WelcomeVideo />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });
  it("informa que falta el archivo sin bloquear cuando aún no está configurado", () => {
    render(<WelcomeVideo />);
    fireEvent.click(
      screen.getByRole("button", { name: "Reproducir video de bienvenida" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Podés seguir");
  });
});
