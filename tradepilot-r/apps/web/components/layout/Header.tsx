import Link from "next/link";
import { LogoutButton } from "@/components/layout/LogoutButton";
import styles from "./Header.module.css";

export interface HeaderProps {
  email: string;
}

export function Header({ email }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <p className={styles.brand}>TradePilot R</p>
        {/* En pantallas < 768 px la barra lateral se oculta: este enlace es la
            única navegación de primer nivel en el móvil. */}
        <nav className={styles.mobileNav} aria-label="Navegación móvil">
          <Link href="/cuentas" className={styles.mobileLink}>
            Cuentas
          </Link>
        </nav>
      </div>
      <div className={styles.userInfo}>
        <span className={styles.email}>{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
