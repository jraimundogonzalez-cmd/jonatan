"use client";

// Sidebar — un único destino real en MVP 0.1 (Cuentas); el resto del
// catálogo de navegación (Analytics, Journal...) no existe todavía (§4 de
// mvp-0.1.md) y no se anticipa aquí con enlaces muertos.
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
