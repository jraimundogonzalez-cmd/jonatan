import { LoginForm } from "@/components/auth/LoginForm";
import { sanitizeRedirectTarget } from "@/lib/validation/redirect";

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;
  const safeRedirectTo = sanitizeRedirectTarget(redirectTo);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "var(--space-6)" }}>TradePilot R</h1>
        <LoginForm redirectTo={safeRedirectTo} />
      </div>
    </main>
  );
}
