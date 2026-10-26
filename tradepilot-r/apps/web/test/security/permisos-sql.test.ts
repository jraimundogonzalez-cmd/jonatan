// Guardas estáticas sobre el SQL versionado de permisos y propiedad. No
// sustituyen a supabase/tests/17_permisos_y_aislamiento.sql, que es la que lo
// ejecuta contra un PostgreSQL real; detectan que alguien deshaga la forma de
// los tres cambios sin darse cuenta:
//   · la migración de permisos solo concede a `authenticated`, nunca TRUNCATE
//     ni ALL, y nunca revoca ni redefine nada;
//   · `registrar_operacion` comprueba la propiedad de la Cuenta ANTES de buscar
//     por la clave de idempotencia (es SECURITY DEFINER: sin RLS);
//   · `crear_operacion_nucleo` también se revoca a `anon`.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SUPABASE = join(__dirname, "..", "..", "..", "..", "supabase");
const MIGRACION = "20261026120000_explicit_authenticated_grants.sql";

function sinComentarios(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

function sentencias(sql: string): string[] {
  return sinComentarios(sql)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);
}

describe("migración de permisos explícitos", () => {
  const sql = readFileSync(join(SUPABASE, "migrations", MIGRACION), "utf8");
  const todas = sentencias(sql);

  it("solo contiene GRANT a authenticated", () => {
    expect(todas.length).toBeGreaterThan(0);
    for (const s of todas) {
      expect(s).toMatch(/^grant /);
      expect(s).toMatch(/ to authenticated$/);
    }
  });

  it("no concede TRUNCATE, ALL ni nada a anon o service_role", () => {
    for (const s of todas) {
      expect(s).not.toMatch(/\btruncate\b|\ball\b|\banon\b|\bservice_role\b|\bpublic\s*;?$/);
    }
  });

  it("no concede escritura sobre las tablas que 016B e importaciones cerraron", () => {
    const escrituras = todas.filter((s) => /^grant (insert|update|delete)/.test(s));
    for (const s of escrituras) {
      expect(s).not.toMatch(/public\.(trades|trade_partials_planned|trade_partials_executed|import_batches|imported_trade_rows)\b/);
    }
  });

  it("solo nombra tablas que crean las migraciones", () => {
    const creadas = new Set(
      readdirSync(join(SUPABASE, "migrations"))
        .filter((f) => f.endsWith(".sql"))
        .flatMap((f) => [...readFileSync(join(SUPABASE, "migrations", f), "utf8").matchAll(/create table public\.(\w+)/g)])
        .map((m) => m[1]),
    );
    const nombradas = [...sinComentarios(sql).matchAll(/public\.(\w+)/g)].map((m) => m[1]);
    expect(nombradas.length).toBeGreaterThan(0);
    for (const t of nombradas) expect(creadas.has(t), t).toBe(true);
  });
});

describe("operations.sql: propiedad antes que idempotencia", () => {
  const sql = sinComentarios(readFileSync(join(SUPABASE, "functions", "sql", "operations.sql"), "utf8"));

  function cuerpo(nombre: string): string {
    const inicio = sql.indexOf(`create or replace function public.${nombre}(`);
    expect(inicio, nombre).toBeGreaterThanOrEqual(0);
    const fin = sql.indexOf("$$;", sql.indexOf("$$", inicio) + 2);
    return sql.slice(inicio, fin);
  }

  it("registrar_operacion comprueba la Cuenta del usuario antes de devolver nada por clave", () => {
    const f = cuerpo("registrar_operacion").replace(/\s+/g, " ");
    const propiedad = f.indexOf("from public.accounts where id = p_account_id and user_id = auth.uid()");
    const idempotencia = f.indexOf("idempotency_key = p_idempotency_key");
    expect(propiedad).toBeGreaterThan(0);
    expect(idempotencia).toBeGreaterThan(propiedad);
    expect(f).toMatch(/idempotency_key = p_idempotency_key and user_id = auth\.uid\(\)/);
  });

  it("crear_operacion_nucleo se revoca a public, authenticated y anon", () => {
    const plano = sql.replace(/\s+/g, " ");
    expect(plano).toMatch(/revoke execute on function public\.crear_operacion_nucleo\([^)]*\) from public, authenticated;/);
    expect(plano).toMatch(
      /if exists \(select 1 from pg_roles where rolname = 'anon'\) then revoke execute on function public\.crear_operacion_nucleo\([^)]*\) from anon;/,
    );
  });
});
