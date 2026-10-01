import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui";

describe("Input", () => {
  it("asocia la etiqueta con el campo vía htmlFor/id", () => {
    render(<Input label="Email" name="email" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("muestra el error y lo asocia mediante aria-describedby", () => {
    render(<Input label="Capital inicial" name="initial_capital" value="" onChange={() => {}} error="Debe ser mayor que 0" />);
    const input = screen.getByLabelText("Capital inicial");
    const errorNode = screen.getByRole("alert");
    expect(errorNode).toHaveTextContent("Debe ser mayor que 0");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(errorNode.id);
  });

  it("no marca aria-invalid cuando no hay error", () => {
    render(<Input label="Nombre" name="name" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid");
  });

  it("aplica la clase monoespaciada cuando numeric=true", () => {
    render(<Input label="Importe" name="amount" numeric value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Importe").className).toMatch(/numeric/);
  });
});
