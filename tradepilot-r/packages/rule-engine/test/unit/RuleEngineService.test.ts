import { describe, expect, it } from "vitest";
import { RuleEngineService, estaVigente, ordenarTopologicamente } from "../../src/services/RuleEngineService.js";
import type { FrozenInstance, RuleProfileSnapshot } from "../../src/domain/types.js";
import {
  FakeAccountFactsProvider,
  FakeEvaluationRepository,
  FakeOperationFactsProvider,
  FakeRiskMagnitudesProvider,
  FakeSnapshotRepository,
  HECHOS_CUENTA,
  HECHOS_OPERACION,
  MAGNITUDES,
  evento,
} from "../fakes/index.js";

function instancia(over: Partial<FrozenInstance> & { key: string; archetype: FrozenInstance["definition"]["archetype"] }): FrozenInstance {
  const { key, archetype, ...resto } = over;
  return {
    definition: {
      key,
      version: 1,
      archetype,
      archetype_version: `${archetype}.v1`,
      scope: archetype === "set_membership" || archetype === "time_window" ? "operation_event" : "account_state",
      ...(over.definition?.depends_on_definition_key
        ? { depends_on_definition_key: over.definition.depends_on_definition_key }
        : {}),
    },
    parameters: {},
    mode: "enforced",
    ...resto,
  } as FrozenInstance;
}

function snapshot(instancias: readonly FrozenInstance[]): RuleProfileSnapshot {
  return { id: "snap-1", frozen_instances: instancias };
}

function servicio(snap: RuleProfileSnapshot | null, repo = new FakeEvaluationRepository()) {
  return {
    repo,
    service: new RuleEngineService(
      new FakeSnapshotRepository(snap),
      new FakeAccountFactsProvider(HECHOS_CUENTA),
      new FakeRiskMagnitudesProvider(MAGNITUDES),
      new FakeOperationFactsProvider(HECHOS_OPERACION),
      repo,
    ),
  };
}

const DRAWDOWN = instancia({
  key: "static_drawdown",
  archetype: "static_threshold",
  parameters: { input: "drawdown_restante_pct", operator: "gte", threshold: "2.0000" },
});

describe("evaluar — pipeline completo", () => {
  it("produce una evaluación por regla vigente, con su evidencia", async () => {
    const { service } = servicio(snapshot([DRAWDOWN]));
    const r = await service.evaluar(evento());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.evaluaciones).toHaveLength(1);
    expect(r.value.evaluaciones[0]!.verdict).toBe("compliant");
    expect(r.value.persistido).toBe(true);
  });

  it("SNAPSHOT_NOT_FOUND cuando la Cuenta no adoptó ningún perfil — nunca asume cumplimiento", async () => {
    const { service } = servicio(null);
    const r = await service.evaluar(evento());
    expect(r).toEqual({ ok: false, error: { code: "SNAPSHOT_NOT_FOUND", account_id: "acc-1" } });
  });
});

describe("idempotencia (punto 2)", () => {
  it("el mismo event_id nunca produce dos evaluaciones distintas", async () => {
    const { service, repo } = servicio(snapshot([DRAWDOWN]));
    const primera = await service.evaluar(evento());
    const segunda = await service.evaluar(evento());

    expect(primera.ok && primera.value.persistido).toBe(true);
    expect(segunda.ok && segunda.value.persistido).toBe(false);
    expect(repo.persistidas).toHaveLength(1);
  });
});

describe("determinismo y reproducibilidad (puntos 1 y 6)", () => {
  it("mismo evento + mismo snapshot + misma versión de regla ⇒ resultado idéntico", async () => {
    const snap = snapshot([DRAWDOWN]);
    const a = await servicio(snap).service.evaluar(evento());
    const b = await servicio(snap).service.evaluar(evento());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("una versión distinta de la misma regla produce una evaluación distinguible, sin alterar la histórica", async () => {
    const v1 = instancia({ ...DRAWDOWN, key: "static_drawdown", archetype: "static_threshold" });
    const { service: s1, repo } = servicio(snapshot([v1]));
    await s1.evaluar(evento({ event_id: "evt-v1" }));

    const v2: FrozenInstance = {
      ...v1,
      definition: { ...v1.definition, version: 2, archetype_version: "static_threshold.v2" },
      parameters: { input: "drawdown_restante_pct", operator: "gte", threshold: "9.0000" },
    };
    const { service: s2 } = servicio(snapshot([v2]), repo);
    await s2.evaluar(evento({ event_id: "evt-v2", event_sequence: 11 }));

    expect(repo.persistidas).toHaveLength(2);
    // La evaluación histórica conserva su versión y su veredicto originales.
    expect(repo.persistidas[0]!.rule_definition_version).toBe(1);
    expect(repo.persistidas[0]!.archetype_version).toBe("static_threshold.v1");
    expect(repo.persistidas[0]!.verdict).toBe("compliant");
    expect(repo.persistidas[1]!.rule_definition_version).toBe(2);
    expect(repo.persistidas[1]!.verdict).toBe("violated");
  });
});

describe("explicabilidad sin IA (punto 3)", () => {
  it("cada evaluación responde qué regla, qué evidencia y por qué — solo con datos", async () => {
    const { service } = servicio(snapshot([DRAWDOWN]));
    const r = await service.evaluar(evento());
    if (!r.ok) throw new Error("unreachable");
    const ctx = r.value.evaluaciones[0]!.evaluation_context as Record<string, unknown>;

    expect(ctx["archetype"]).toBe("static_threshold");
    expect(ctx["archetype_version"]).toBe("static_threshold.v1");
    expect(ctx["parameters"]).toEqual(DRAWDOWN.parameters);
    const echo = ctx["inputs_echo"] as Record<string, unknown>;
    expect((echo["risk_magnitudes"] as Record<string, string>)["drawdown_restante_pct"]).toBe("5.26");
    expect(ctx["resultado"]).toEqual({ verdict: "compliant", margin: "3.2600" });
    expect(ctx["triggering_event"]).toMatchObject({ id: "evt-1", sequence: 10 });
  });
});

describe("desacoplamiento de ejecución (punto 5) y de Quant Engine (punto 4)", () => {
  it("solo emite ReglaIncumplida para 'violated' en modo enforced, nunca en shadow", async () => {
    const incumple = { input: "drawdown_restante_pct", operator: "gte", threshold: "99.0000" };
    const enforced = instancia({ key: "dd_enforced", archetype: "static_threshold", parameters: incumple });
    const shadow = instancia({ key: "dd_shadow", archetype: "static_threshold", parameters: incumple, mode: "shadow" });

    const { service, repo } = servicio(snapshot([enforced, shadow]));
    const r = await service.evaluar(evento());
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.evaluaciones.map((e) => e.verdict)).toEqual(["violated", "violated"]);
    // Ambas se auditan; solo la 'enforced' emite el incumplimiento.
    expect(repo.persistidas).toHaveLength(2);
    expect(repo.eventosEmitidos).toEqual(["dd_enforced"]);
  });

  it("solo pide magnitudes a Risk Engine cuando el arquetipo las necesita", async () => {
    const provider = new FakeRiskMagnitudesProvider(MAGNITUDES);
    const repo = new FakeEvaluationRepository();
    const service = new RuleEngineService(
      new FakeSnapshotRepository(snapshot([
        instancia({ key: "instrumento", archetype: "set_membership", parameters: { field: "symbol", allowed: ["EURUSD"] } }),
      ])),
      new FakeAccountFactsProvider(HECHOS_CUENTA),
      provider,
      new FakeOperationFactsProvider(HECHOS_OPERACION),
      repo,
    );
    await service.evaluar(evento({ trade_id: "trade-1" }));
    expect(provider.llamadas).toBe(0);
  });
});

describe("scope, vigencia y dependencias", () => {
  it("una regla operation_event no se evalúa si el evento no trae Operación", async () => {
    const { service } = servicio(snapshot([
      instancia({ key: "instrumento", archetype: "set_membership", parameters: { field: "symbol", allowed: ["EURUSD"] } }),
    ]));
    const r = await service.evaluar(evento()); // sin trade_id
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.evaluaciones).toHaveLength(0);
  });

  it("respeta effective_from/until y active_only_in_status", () => {
    const base = instancia({ key: "x", archetype: "static_threshold" });
    expect(estaVigente({ ...base, effective_from: "2027-01-01T00:00:00Z" }, "2026-01-05T14:00:00Z", "funded")).toBe(false);
    expect(estaVigente({ ...base, effective_until: "2025-01-01T00:00:00Z" }, "2026-01-05T14:00:00Z", "funded")).toBe(false);
    expect(estaVigente({ ...base, active_only_in_status: ["challenge"] }, "2026-01-05T14:00:00Z", "funded")).toBe(false);
    expect(estaVigente({ ...base, active_only_in_status: ["funded"] }, "2026-01-05T14:00:00Z", "funded")).toBe(true);
  });

  it("evalúa las hojas antes que las compuestas, sea cual sea el orden de entrada", async () => {
    const objetivo = instancia({
      key: "profit_target",
      archetype: "progress_to_target",
      parameters: { input: "current_capital", target: "9000.0000" },
    });
    const consistencia: FrozenInstance = {
      ...instancia({ key: "consistency", archetype: "composite", parameters: { requires_compliant: ["profit_target"] } }),
      definition: {
        key: "consistency",
        version: 1,
        archetype: "composite",
        archetype_version: "composite.v1",
        scope: "account_state",
        depends_on_definition_key: "profit_target",
      },
    };

    // Compuesta declarada ANTES que su dependencia: el orden topológico debe corregirlo.
    const { service } = servicio(snapshot([consistencia, objetivo]));
    const r = await service.evaluar(evento());
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.evaluaciones.map((e) => e.rule_definition_key)).toEqual(["profit_target", "consistency"]);
    expect(r.value.evaluaciones[1]!.verdict).toBe("compliant");
  });

  it("detecta un ciclo en la Library en vez de colgarse", () => {
    const a: FrozenInstance = {
      ...instancia({ key: "a", archetype: "composite" }),
      definition: { key: "a", version: 1, archetype: "composite", archetype_version: "composite.v1", scope: "account_state", depends_on_definition_key: "b" },
    };
    const b: FrozenInstance = {
      ...instancia({ key: "b", archetype: "composite" }),
      definition: { key: "b", version: 1, archetype: "composite", archetype_version: "composite.v1", scope: "account_state", depends_on_definition_key: "a" },
    };
    const r = ordenarTopologicamente([a, b]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error.code).toBe("CYCLIC_DEPENDENCY_IN_LIBRARY");
  });

  it("una dependencia ausente produce unavailable, nunca cumplimiento asumido", async () => {
    const consistencia: FrozenInstance = {
      ...instancia({ key: "consistency", archetype: "composite", parameters: { requires_compliant: ["profit_target"] } }),
      definition: { key: "consistency", version: 1, archetype: "composite", archetype_version: "composite.v1", scope: "account_state", depends_on_definition_key: "profit_target" },
    };
    const { service, repo } = servicio(snapshot([consistencia]));
    const r = await service.evaluar(evento());
    if (!r.ok) throw new Error("unreachable");
    expect(r.value.evaluaciones[0]!.verdict).toBe("unavailable");
    expect(r.value.evaluaciones[0]!.margin).toBeNull();
    expect(repo.eventosEmitidos).toEqual([]); // unavailable nunca emite incumplimiento
  });
});
