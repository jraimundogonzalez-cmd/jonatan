import { LogoutButton } from "@/components/layout/LogoutButton";
import styles from "./Header.module.css";

export interface HeaderProps {
  email: string;
}

export function Header({ email }: HeaderProps) {
  return (
    <header className={styles.header}>
      <p className={styles.brand}>TradePilot R</p>
      <div className={styles.userInfo}>
        <span className={styles.email}>{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
