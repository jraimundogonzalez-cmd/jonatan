import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/LogoutButton", () => ({ LogoutButton: () => null }));

import { Header } from "@/components/layout/Header";

describe("Header — navegación en el móvil", () => {
  it("ofrece un enlace a Cuentas, que en < 768 px es la única navegación de primer nivel", () => {
    render(<Header email="trader@example.com" />);
    const enlace = screen.getByRole("link", { name: "Cuentas" });
    expect(enlace.getAttribute("href")).toBe("/cuentas");
    expect(screen.getByRole("navigation", { name: "Navegación móvil" })).toBeTruthy();
  });
});
