"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  function handleClick() {
    setError(undefined);
    startTransition(async () => {
      try {
        await signOutAction();
        router.push("/login");
        router.refresh();
      } catch {
        setError("No se ha podido cerrar sesión. Inténtalo de nuevo.");
      }
    });
  }

  return (
    <div>
      <Button variant="text" loading={isPending} onClick={handleClick}>
        Cerrar sesión
      </Button>
      {error ? (
        <p role="alert" style={{ color: "var(--risk)", fontSize: "0.8125rem" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
