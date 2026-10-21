import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";
import { signInWithMagicLink } from "@/actions/auth";

// El límite de red real (Supabase Auth) se sustituye aquí — es la frontera
// externa de este componente, no una reimplementación de la lógica de
// producción. La lógica de producción (actions/auth.ts) tiene sus propios
// tests en test/actions/auth.test.ts contra un doble del cliente de Supabase.
vi.mock("@/actions/auth", () => ({
  signInWithMagicLink: vi.fn(),
}));

const signInWithMagicLinkMock = vi.mocked(signInWithMagicLink);

describe("LoginForm", () => {
  it("bloquea el envío si el email no es válido y nunca llama a la acción", () => {
    render(<LoginForm redirectTo="/" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "no-es-un-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace de acceso" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Ese email no parece válido");
    expect(signInWithMagicLinkMock).not.toHaveBeenCalled();
  });

  it("llama a signInWithMagicLink con el email y el redirectTo, y muestra el estado de éxito", async () => {
    signInWithMagicLinkMock.mockResolvedValueOnce({ ok: true });
    render(<LoginForm redirectTo="/cuentas/abc" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "trader@tradepilot.app" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace de acceso" }));

    await waitFor(() => {
      expect(signInWithMagicLinkMock).toHaveBeenCalledWith("trader@tradepilot.app", "/cuentas/abc");
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Revisa tu correo");
  });

  it("muestra el mensaje de error que devuelve la acción si falla", async () => {
    signInWithMagicLinkMock.mockResolvedValueOnce({ ok: false, message: "No se ha podido enviar el enlace de acceso." });
    render(<LoginForm redirectTo="/" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "trader@tradepilot.app" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace de acceso" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido enviar el enlace de acceso.");
  });
});
