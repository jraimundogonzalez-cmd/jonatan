import Link from "next/link";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format/money";
import { formatAccountStatus } from "@/lib/format/status";
import type { Account } from "@/types/funding";
import styles from "./AccountCard.module.css";

export interface AccountCardProps {
  account: Account;
  propFirmName: string;
}

export function AccountCard({ account, propFirmName }: AccountCardProps) {
  return (
    <Link href={`/cuentas/${account.id}`} className={styles.card}>
      <Card interactive>
        <div className={styles.header}>
          <p className={styles.name}>{account.name}</p>
          <span className={styles.status}>{formatAccountStatus(account.status)}</span>
        </div>
        <p className={styles.propFirm}>{propFirmName}</p>
        <p className={`${styles.capital} font-mono-num`}>{formatMoney(account.current_capital, account.currency)}</p>
      </Card>
    </Link>
  );
}
