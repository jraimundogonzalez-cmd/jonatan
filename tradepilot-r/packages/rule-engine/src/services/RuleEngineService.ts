/**
 * Rule Engine — orquestador del pipeline de evaluación (SPEC-004 §4.3).
 *
 * **Es un motor de evaluación, nunca de ejecución.** Sus tres únicas salidas
 * son: evaluaciones registradas, eventos emitidos, y el resultado devuelto al
 * llamador. No escribe en `accounts`, `trades` ni ninguna entidad de otro
 * módulo — Resolución 1: la actualización de cachés derivados corresponde
 * siempre al módulo propietario (I17, Evaluar ≠ Actuar).
 *
 * No importa `@tradepilot/quant-engine` en ningún punto: cuando necesita una
 * magnitud, la pide a Risk Engine a través de un puerto (SPEC-004 §14.1).
 */
import { err, ok } from "@tradepilot/risk-engine";
import type { Result } from "@tradepilot/risk-engine";
import type {
  DomainEventRef,
  EvaluationInputs,
  FrozenInstance,
  RuleEngineError,
  RuleEvaluation,
  RuleProfileSnapshot,
  Veredicto,
} from "../domain/types.js";
import { EVALUADORES, describirVeredicto } from "../evaluators/index.js";
import type {
  AccountFactsProvider,
  EvaluationRepository,
  OperationFactsProvider,
  RiskMagnitudesProvider,
  SnapshotRepository,
} from "../ports/index.js";

export interface ResultadoEvaluacion {
  readonly evaluaciones: readonly RuleEvaluation[];
  /** `false` cuando el evento ya se había procesado — idempotencia (SPEC-004 §4). */
  readonly persistido: boolean;
}

/**
 * Orden topológico por dependencia declarada en la Library (SPEC-004 §5):
 * hojas primero, compuestas después. Detecta ciclos con marcado tri-estado
 * (DFS con back-edge). El grafo lo cura el equipo, no cada Empresa, así que
 * un ciclo aquí es un error de catálogo, no de composición del usuario.
 */
export function ordenarTopologicamente(
  instancias: readonly FrozenInstance[],
): Result<readonly FrozenInstance[], RuleEngineError> {
  const porClave = new Map<string, FrozenInstance>();
  for (const i of instancias) porClave.set(i.definition.key, i);

  const estado = new Map<string, "visitando" | "listo">();
  const ordenadas: FrozenInstance[] = [];
  let ciclo: string[] | null = null;

  const visitar = (instancia: FrozenInstance, camino: readonly string[]): void => {
    if (ciclo) return;
    const clave = instancia.definition.key;
    const marca = estado.get(clave);
    if (marca === "listo") return;
    if (marca === "visitando") {
      ciclo = [...camino, clave];
      return;
    }

    estado.set(clave, "visitando");
    const dependencia = instancia.definition.depends_on_definition_key;
    if (dependencia) {
      const hermana = porClave.get(dependencia);
      // Una dependencia ausente no es un ciclo: se resuelve como
      // `unavailable` en la evaluación, nunca como cumplimiento asumido.
      if (hermana) visitar(hermana, [...camino, clave]);
    }
    estado.set(clave, "listo");
    ordenadas.push(instancia);
  };

  for (const instancia of instancias) visitar(instancia, []);

  if (ciclo) return err({ code: "CYCLIC_DEPENDENCY_IN_LIBRARY", path: ciclo });
  return ok(ordenadas);
}

/** Vigencia temporal y por fase de cuenta (SPEC-004 §4.3 paso 2c, §10). */
export function estaVigente(
  instancia: FrozenInstance,
  momento: string,
  estadoCuenta: string,
): boolean {
  const t = new Date(momento).getTime();
  if (instancia.effective_from && t < new Date(instancia.effective_from).getTime()) return false;
  if (instancia.effective_until && t > new Date(instancia.effective_until).getTime()) return false;
  if (instancia.active_only_in_status && instancia.active_only_in_status.length > 0) {
    if (!instancia.active_only_in_status.includes(estadoCuenta as never)) return false;
  }
  return true;
}

export class RuleEngineService {
  constructor(
    private readonly snapshots: SnapshotRepository,
    private readonly accountFacts: AccountFactsProvider,
    private readonly riskMagnitudes: RiskMagnitudesProvider,
    private readonly operationFacts: OperationFactsProvider,
    private readonly evaluations: EvaluationRepository,
  ) {}

  /**
   * Pipeline completo (SPEC-004 §4.3). Siempre asíncrono respecto al
   * productor del evento: nunca bloquea el camino crítico de Operations
   * Engine (§6, SPEC-002 §4.2).
   */
  async evaluar(evento: DomainEventRef): Promise<Result<ResultadoEvaluacion, RuleEngineError>> {
    const snapshotResult = await this.snapshots.obtenerVigente(evento.account_id);
    if (!snapshotResult.ok) return snapshotResult;
    if (!snapshotResult.value) {
      return err({ code: "SNAPSHOT_NOT_FOUND", account_id: evento.account_id });
    }
    const snapshot: RuleProfileSnapshot = snapshotResult.value;

    const factsResult = await this.accountFacts.obtenerHechos(evento.account_id);
    if (!factsResult.ok) return factsResult;
    const account_facts = factsResult.value;

    let operation_facts;
    if (evento.trade_id) {
      const opResult = await this.operationFacts.obtenerHechosOperacion(evento.trade_id);
      if (!opResult.ok) return opResult;
      operation_facts = opResult.value ?? undefined;
    }

    // Paso 2a: por scope. Una regla `operation_event` solo aplica si el
    // evento trae una Operación; `account_state` aplica siempre.
    const aplicables = snapshot.frozen_instances.filter((i) =>
      i.definition.scope === "operation_event" ? Boolean(evento.trade_id) : true,
    );

    // Paso 2c: vigencia temporal y por fase de cuenta.
    const vigentes = aplicables.filter((i) => estaVigente(i, evento.occurred_at, account_facts.status));

    // Paso 4: orden topológico — hojas antes que compuestas.
    const ordenadasResult = ordenarTopologicamente(vigentes);
    if (!ordenadasResult.ok) return ordenadasResult;

    const veredictosPorClave: Record<string, Veredicto> = {};
    const evaluaciones: RuleEvaluation[] = [];

    for (const instancia of ordenadasResult.value) {
      const { definition, parameters, mode } = instancia;

      // Paso 3: las magnitudes de riesgo se piden a Risk Engine, y solo
      // cuando el arquetipo las necesita — nunca a Quant Engine.
      let risk_magnitudes;
      if (definition.archetype === "static_threshold" || definition.archetype === "dynamic_threshold") {
        const magsResult = await this.riskMagnitudes.obtenerDrawdownState(evento.account_id, parameters);
        if (!magsResult.ok) return magsResult;
        risk_magnitudes = magsResult.value ?? undefined;
      }

      const inputs: EvaluationInputs = {
        account_facts,
        ...(risk_magnitudes ? { risk_magnitudes } : {}),
        ...(operation_facts ? { operation_facts } : {}),
        ...(definition.archetype === "composite" ? { sibling_verdicts: veredictosPorClave } : {}),
      };

      // Paso 5: evaluador puro. Un arquetipo desconocido nunca se asume
      // cumplido — se reporta como no disponible.
      const evaluador = EVALUADORES[definition.archetype];
      const veredicto: Veredicto = evaluador
        ? evaluador(parameters, inputs)
        : { verdict: "unavailable", reason: `arquetipo '${definition.archetype}' sin evaluador` };

      veredictosPorClave[definition.key] = veredicto;

      const descrito = describirVeredicto(veredicto);
      evaluaciones.push({
        rule_definition_key: definition.key,
        rule_definition_version: definition.version,
        archetype_version: definition.archetype_version,
        mode,
        ...(evento.trade_id ? { trade_id: evento.trade_id } : {}),
        verdict: veredicto.verdict,
        margin: veredicto.verdict === "unavailable" ? null : veredicto.margin,
        triggering_event_sequence: evento.event_sequence,
        // Explicabilidad sin IA: qué regla, con qué evidencia, y por qué.
        // Todos los valores provienen de hechos ya calculados por sus
        // módulos propietarios — ninguno se genera aquí.
        evaluation_context: {
          archetype: definition.archetype,
          archetype_version: definition.archetype_version,
          parameters,
          inputs_echo: {
            account_facts: {
              current_capital: account_facts.current_capital.raw.toFixed(4),
              peak_capital: account_facts.peak_capital.raw.toFixed(4),
              initial_capital: account_facts.initial_capital.raw.toFixed(4),
              status: account_facts.status,
            },
            risk_magnitudes: risk_magnitudes
              ? {
                  piso_vigente: risk_magnitudes.piso_vigente.raw.toFixed(4),
                  drawdown_restante_eur: risk_magnitudes.drawdown_restante_eur.raw.toFixed(4),
                  drawdown_restante_pct: risk_magnitudes.drawdown_restante_pct.raw.toFixed(2),
                }
              : null,
            operation_facts: operation_facts
              ? {
                  trade_id: operation_facts.trade_id,
                  symbol: operation_facts.symbol,
                  side: operation_facts.side,
                  opened_at: operation_facts.opened_at,
                  risk_pct: operation_facts.risk_pct.raw.toFixed(2),
                }
              : null,
          },
          resultado: descrito,
          triggering_event: { id: evento.event_id, type: evento.event_type, sequence: evento.event_sequence },
        },
      });
    }

    // Pasos 6 y 8: persistencia atómica + emisión de `ReglaIncumplida` por
    // cada `violated` en modo `enforced`. El paso 7 de SPEC-004 (actualizar
    // `accounts.compliance_flag`) NO se ejecuta aquí: pertenece a Funding
    // Management, su módulo propietario, que reacciona al evento emitido.
    const persistResult = await this.evaluations.persistir({
      accountId: evento.account_id,
      evento,
      snapshotId: snapshot.id,
      evaluaciones,
    });
    if (!persistResult.ok) return persistResult;

    return ok({ evaluaciones, persistido: persistResult.value.persisted });
  }
}
