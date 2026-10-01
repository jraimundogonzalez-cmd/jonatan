"use client";

// Sidebar — sólo destinos que existen. El resto del catálogo de navegación
// (Analytics, Journal...) sigue sin construirse y no se anticipa aquí con
// enlaces muertos.
//
// BUILD 019 no añade una entrada «Operaciones» de primer nivel: una Operación
// pertenece siempre a una Cuenta, y no hay ninguna vista de Operaciones que no
// esté acotada a una. Se llega a ellas desde el Detalle de Cuenta.
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [{ href: "/cuentas", label: "Cuentas" }] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar} aria-label="Navegación principal">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[styles.link, isActive ? styles.linkActive : ""].filter(Boolean).join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
