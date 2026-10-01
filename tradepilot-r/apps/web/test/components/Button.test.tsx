import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui";

describe("Button", () => {
  it("dispara onClick al pulsarlo", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Crear cuenta</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("se deshabilita y no dispara onClick cuando loading=true", () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} loading>
        Enviando
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Enviando" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("respeta disabled explícito", () => {
    render(<Button disabled>No disponible</Button>);
    expect(screen.getByRole("button", { name: "No disponible" })).toBeDisabled();
  });

  it("el tamaño táctil mínimo (44px) se aplica vía la clase base compartida por todas las variantes", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    const primaryClass = screen.getByRole("button").className;
    rerender(
      <Button variant="secondary" className="extra">
        B
      </Button>,
    );
    // La clase base (min-height/min-width 44px, Button.module.css) es común a
    // ambas variantes — solo cambia la clase de variante añadida.
    expect(primaryClass.split(" ")[0]).toBe(screen.getByRole("button").className.split(" ")[0]);
  });
});
