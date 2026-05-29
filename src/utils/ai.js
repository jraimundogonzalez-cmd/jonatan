// AI engine for routine optimization and exercise substitution
import { EX, byId, primary } from "../data/exercises";
import { EX_SUBGROUPS } from "../data/coverage";

// Available equipment categories used by the app
export const EQUIPMENT_OPTIONS = [
  { id: "barbell",       label: "🏋️ Barra olímpica" },
  { id: "dumbbell",      label: "💪 Mancuernas" },
  { id: "kettlebell",    label: "🔔 Kettlebells" },
  { id: "cable",         label: "🔗 Poleas" },
  { id: "machine",       label: "⚙️ Máquinas guiadas" },
  { id: "smith",         label: "🏗 Multipower / Smith" },
  { id: "bench",         label: "🛋 Banco regulable" },
  { id: "bands",         label: "🎀 Gomas elásticas" },
  { id: "bodyweight",    label: "🙌 Peso corporal" },
  { id: "wheel",         label: "⊙ Rueda abdominal" },
  { id: "accessories",   label: "🎯 Accesorios (TRX, paralelas, cajón)" },
  { id: "cardio_machine", label: "🚴 Máquinas cardio" },
];

// Gym default: all equipment available except home-only stuff
export const GYM_DEFAULT = ["barbell","dumbbell","kettlebell","cable","machine","smith","bench","bands","bodyweight","wheel","accessories","cardio_machine"];
export const HOME_DEFAULT = ["dumbbell","bands","bodyweight","bench","kettlebell"];

// ─── Equipment availability check ────────────────────────────────
export function canDo(ex, availableEq) {
  if (!availableEq || availableEq.length === 0) return true;
  const need = ex.equipment;
  if (!need) return true;
  if (need === "none" || need === "bodyweight") return true;
  return availableEq.includes(need);
}

// ─── Substitution recommendation ─────────────────────────────────
// Returns scored alternatives for a given exercise considering:
// - Same primary muscle group
// - Available equipment
// - Equivalents (explicit) take priority
// - Pattern similarity bonus
// - Difficulty proximity bonus
export function recommendSubstitutes(exerciseId, opts = {}) {
  const ex = byId(exerciseId);
  if (!ex) return [];

  const { availableEq, location, maxResults = 6, excludeIds = [] } = opts;
  const pm = (ex.muscles_primary || [])[0];

  const candidates = EX.filter(c => {
    if (c.id === ex.id) return false;
    if (excludeIds.includes(c.id)) return false;
    if (availableEq && !canDo(c, availableEq)) return false;
    if (location === "casa" && c.loc === "gym" && !c.home_friendly) return false;
    // Must target same primary muscle (legacy m[0] or muscles_primary[0])
    const cpm = (c.muscles_primary || [])[0];
    const samePrimary = pm && cpm && (cpm === pm);
    const sameLegacy = primary(c) === primary(ex);
    return samePrimary || sameLegacy;
  });

  // Score each candidate
  const scored = candidates.map(c => {
    let score = 0;
    // Explicit equivalence is huge
    if ((ex.equivalents || []).includes(c.id)) score += 50;
    // Same pattern
    if (ex.pattern && c.pattern === ex.pattern) score += 25;
    // Same muscle category
    if (ex.cat === c.cat) score += 15;
    // Similar difficulty (within 1)
    const dDiff = Math.abs((ex.technical_difficulty || 3) - (c.technical_difficulty || 3));
    score += Math.max(0, 10 - dDiff * 4);
    // Similar stimulus (hypertrophy)
    const sDiff = Math.abs((ex.hypertrophy_eff || 3) - (c.hypertrophy_eff || 3));
    score += Math.max(0, 8 - sDiff * 2);
    // Bonus if it's also a compound when original is compound
    if (ex.type === c.type) score += 5;
    return { ex: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(s => ({
    ex: s.ex,
    score: s.score,
    reason: buildReason(ex, s.ex),
  }));
}

function buildReason(orig, sub) {
  const parts = [];
  if ((orig.equivalents || []).includes(sub.id)) parts.push("✓ Equivalente directo");
  if (orig.pattern && sub.pattern === orig.pattern) parts.push("Mismo patrón");
  if (orig.cat === sub.cat) parts.push("Mismo grupo muscular");
  if ((sub.hypertrophy_eff || 0) > (orig.hypertrophy_eff || 0)) parts.push("+ hipertrofia");
  if ((sub.technical_difficulty || 3) < (orig.technical_difficulty || 3)) parts.push("Más fácil");
  if ((sub.technical_difficulty || 3) > (orig.technical_difficulty || 3)) parts.push("Más avanzado");
  return parts.slice(0, 3).join(" · ");
}

// ─── Progression / Regression helpers ─────────────────────────────
export function getProgression(exerciseId) {
  const ex = byId(exerciseId);
  if (!ex) return null;
  const progs = (ex.progressions || []).map(byId).filter(Boolean);
  return progs[0] || null;
}

export function getRegression(exerciseId) {
  const ex = byId(exerciseId);
  if (!ex) return null;
  const regs = (ex.regressions || []).map(byId).filter(Boolean);
  return regs[0] || null;
}

// ─── Routine generation (AI) ─────────────────────────────────────
// Generates an optimal training split based on:
//   goal      - "musculo" | "fuerza" | "grasa"
//   days      - 3..6
//   time      - minutes per session
//   level     - "prin" | "inter" | "avz"
//   place     - "gym" | "casa"
//   availableEq - array of equipment IDs
//   priorities - array of muscle categories to emphasize
export function generateRoutine(opts) {
  const { goal = "musculo", days = 4, time = 60, level = "inter",
          place = "gym", availableEq = GYM_DEFAULT, priorities = [] } = opts;

  // Volume per muscle group based on goal
  const volumeByGoal = {
    musculo: { compound: 2, isolation: 2 },
    fuerza:  { compound: 3, isolation: 1 },
    grasa:   { compound: 2, isolation: 2 },
  };
  const vol = volumeByGoal[goal] || volumeByGoal.musculo;

  // Split templates by days
  const splitTemplates = {
    3: [["pecho","hombro","triceps"], ["espalda","biceps"], ["cuadriceps","gluteos","isquios","gemelos","core"]],
    4: [["pecho","triceps"], ["espalda","biceps"], ["cuadriceps","gluteos","isquios","gemelos"], ["hombro","trapecio","core"]],
    5: [["pecho"], ["espalda"], ["cuadriceps","gemelos"], ["hombro","trapecio"], ["biceps","triceps","antebrazo","core"]],
    6: [["pecho"], ["espalda"], ["cuadriceps","gemelos"], ["hombro","trapecio"], ["biceps","triceps","antebrazo"], ["gluteos","isquios","abductores","aductores","core"]],
  };
  const split = splitTemplates[days] || splitTemplates[4];

  // For each day pick exercises
  const sessions = split.map((cats, dayIdx) => {
    const exercisesForDay = [];
    cats.forEach(cat => {
      // Pool: available, in category, sorted by stimulus
      const pool = EX.filter(e => e.cat === cat && canDo(e, availableEq) && (place === "gym" || e.home_friendly));
      if (pool.length === 0) return;

      // Sort by stimulus + hypertrophy
      pool.sort((a, b) => {
        const sA = (a.stimulus_score || 3) + (a.hypertrophy_eff || 3) + (priorities.includes(cat) ? 2 : 0);
        const sB = (b.stimulus_score || 3) + (b.hypertrophy_eff || 3) + (priorities.includes(cat) ? 2 : 0);
        return sB - sA;
      });

      // Pick 1 compound (or comp-like) + 1 isolation
      const compounds = pool.filter(e => e.type === "comp" || e.type === "mach");
      const isolations = pool.filter(e => e.type === "iso" || e.type === "body");

      const picked = [];
      if (compounds[0]) picked.push(compounds[0]);
      if (compounds[1] && cats.length === 1) picked.push(compounds[1]);
      if (isolations[0] && picked.length < (priorities.includes(cat) ? 3 : 2)) picked.push(isolations[0]);

      // Filter out exercises that would cause fatigue overlap (same pattern in same day)
      picked.forEach(p => {
        const overlap = exercisesForDay.find(e => e.pattern && e.pattern === p.pattern && e.cat === p.cat);
        if (!overlap) exercisesForDay.push(p);
      });
    });

    // Adjust to time budget
    const sessionMin = time;
    const repScheme = goal === "fuerza" ? { s: 5, r: 5, rest: 150 }
                    : goal === "grasa"  ? { s: 3, r: 15, rest: 45 }
                    :                     { s: 4, r: 10, rest: 75 };

    // Trim to fit time
    let plan = exercisesForDay.map(e => ({
      id: e.id, sets: repScheme.s, reps: repScheme.r, rest: repScheme.rest
    }));
    while (plan.length > 0 && estimateMin(plan) > sessionMin) {
      plan.pop();
    }

    return {
      name: cats.map(c => labelOf(c)).join(" + "),
      cats,
      base: plan,
      t: null,
      kind: "pesas",
    };
  });

  return sessions;
}

// ─── Build session from custom categories (for plan editor) ──────
// Like generateRoutine but for a single day with given cats array
export function buildSessionFromCats(cats, opts = {}) {
  const { goal = "musculo", time = 60, place = "gym",
          availableEq = GYM_DEFAULT, priorities = [] } = opts;

  const repSchemeMap = {
    fuerza: { s: 5, r: 5, rest: 150 },
    grasa:  { s: 3, r: 15, rest: 45 },
    musculo: { s: 4, r: 10, rest: 75 },
  };
  const repScheme = repSchemeMap[goal] || repSchemeMap.musculo;

  // Big muscle groups get 4 exercises; arm groups get 3 (one per subgroup); small groups get 2
  const BIG_CATS = new Set(["pecho","espalda","cuadriceps","isquios","gluteos","pierna"]);
  const ARM_CATS = new Set(["biceps","triceps"]);

  const exercisesForDay = [];
  cats.forEach(cat => {
    const pool = EX.filter(e =>
      e.cat === cat &&
      canDo(e, availableEq) &&
      (place === "gym" || e.home_friendly)
    );
    if (pool.length === 0) return;

    pool.sort((a, b) => {
      let sA = (a.stimulus_score || 3) + (a.hypertrophy_eff || 3) + (priorities.includes(cat) ? 2 : 0);
      let sB = (b.stimulus_score || 3) + (b.hypertrophy_eff || 3) + (priorities.includes(cat) ? 2 : 0);
      // Penalize high-systemic-fatigue exercises for hypertrophy (e.g. peso_muerto_barra in back sessions)
      if (goal === "musculo") {
        if ((a.systemic_fatigue || 3) >= 5) sA -= 4;
        if ((b.systemic_fatigue || 3) >= 5) sB -= 4;
      }
      return sB - sA;
    });

    const maxEx = BIG_CATS.has(cat) ? 4 : ARM_CATS.has(cat) ? 3 : 2;
    const compounds = pool.filter(e => e.type === "comp" || e.type === "mach");
    const isolations = pool.filter(e => e.type === "iso" || e.type === "body");

    const picked = [];
    // For arm categories: use subgroup-based dedup so all 3 subgroups get covered
    // For other categories: use movement pattern dedup to avoid redundant exercises
    const isDupFor = ARM_CATS.has(cat)
      ? (e, list) => {
          const eSubs = EX_SUBGROUPS[e.id] || [];
          return eSubs.length > 0 && list.some(p => {
            const pSubs = EX_SUBGROUPS[p.id] || [];
            return eSubs.some(s => pSubs.includes(s));
          });
        }
      : (e, list) => e.pattern && list.some(p => p.pattern === e.pattern);

    for (const e of [...compounds, ...isolations]) {
      if (picked.length >= maxEx) break;
      if (!isDupFor(e, picked)) picked.push(e);
    }

    picked.forEach(p => {
      const overlap = exercisesForDay.find(e => e.pattern && e.pattern === p.pattern && e.cat === p.cat);
      if (!overlap) exercisesForDay.push(p);
    });
  });

  // Always add face_pull to back sessions — rear delt health is non-negotiable in prep
  if (cats.includes("espalda") && !exercisesForDay.find(e => e.id === "face_pull")) {
    const fp = byId("face_pull");
    if (fp && canDo(fp, availableEq)) exercisesForDay.push(fp);
  }

  // Never remove exercises to fit time — only sets reduction handles that (same as buildSession)
  const plan = exercisesForDay.map(e => ({
    id: e.id, sets: repScheme.s, reps: repScheme.r, rest: repScheme.rest
  }));

  return {
    name: cats.map(c => labelOf(c)).join(" + "),
    cats,
    base: plan,
    t: null,
    kind: "pesas",
  };
}

// ─── Infer cats from an existing session's exercises ────────────
export function inferCats(session) {
  if (session.cats && session.cats.length > 0) return session.cats;
  const seen = new Set();
  (session.base || []).forEach(item => {
    const ex = byId(item.id);
    if (ex?.cat) seen.add(ex.cat);
  });
  return [...seen];
}

// Publicly accessible label map
export const CAT_LABELS_MAP = {
  pecho:"Pecho", espalda:"Espalda", hombro:"Hombro", trapecio:"Trapecio",
  biceps:"Bíceps", triceps:"Tríceps", antebrazo:"Antebrazo",
  cuadriceps:"Cuádriceps", isquios:"Isquios", gluteos:"Glúteos",
  abductores:"Abductores", aductores:"Aductores", gemelos:"Gemelos",
  core:"Core", abdominales:"Abdominales", oblicuos:"Oblicuos", lumbar:"Lumbar",
  cuello:"Cuello", cardio:"Cardio", movilidad:"Movilidad", estiramiento:"Estiramientos",
};

function estimateMin(plan) {
  let m = 0;
  plan.forEach(x => { m += x.sets * (x.rest + 42) / 60; });
  return Math.round(m);
}

const CAT_LABELS = {
  pecho:"Pecho", espalda:"Espalda", hombro:"Hombro", trapecio:"Trapecio",
  biceps:"Bíceps", triceps:"Tríceps", antebrazo:"Antebrazo",
  cuadriceps:"Cuádriceps", isquios:"Isquios", gluteos:"Glúteos",
  abductores:"Abductores", aductores:"Aductores", gemelos:"Gemelos",
  core:"Core", abdominales:"Abdominales", oblicuos:"Oblicuos", lumbar:"Lumbar",
  cardio:"Cardio", movilidad:"Movilidad", estiramiento:"Estiramientos",
};
function labelOf(c) { return CAT_LABELS[c] || c; }

// ─── Routine analysis ────────────────────────────────────────────
export function analyzeRoutine(sessions) {
  // Returns insights: muscle volume per week, fatigue distribution, overlap warnings
  const volumeByCategory = {};
  const fatigueByDay = [];

  sessions.forEach((s, idx) => {
    let dayFatigue = 0;
    s.base.forEach(item => {
      const ex = byId(item.id);
      if (!ex) return;
      const cat = ex.cat;
      const setsCount = item.sets;
      volumeByCategory[cat] = (volumeByCategory[cat] || 0) + setsCount;
      dayFatigue += (ex.systemic_fatigue || 3) * setsCount / 4;
    });
    fatigueByDay.push({ day: idx + 1, name: s.name, fatigue: Math.round(dayFatigue) });
  });

  // Warnings
  const warnings = [];
  for (let i = 1; i < sessions.length; i++) {
    const prev = sessions[i - 1];
    const curr = sessions[i];
    const prevCats = new Set(prev.base.map(x => byId(x.id)?.cat).filter(Boolean));
    const currCats = new Set(curr.base.map(x => byId(x.id)?.cat).filter(Boolean));
    const overlap = [...prevCats].filter(c => currCats.has(c));
    if (overlap.length > 0) {
      warnings.push({
        day: i + 1,
        msg: `${overlap.map(labelOf).join(", ")} trabaja en días consecutivos`,
        type: "overlap",
      });
    }
  }

  return { volumeByCategory, fatigueByDay, warnings };
}
