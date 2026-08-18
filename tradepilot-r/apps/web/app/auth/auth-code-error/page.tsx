import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { Button } from "@/components/ui";

export default function AuthCodeErrorPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <EmptyState
        title="El enlace de acceso no es válido"
        description="Puede haber caducado o ya haberse usado. Pide un nuevo enlace para entrar."
        action={
          <Link href="/login">
            <Button variant="primary">Volver a intentarlo</Button>
          </Link>
        }
      />
    </main>
  );
}
