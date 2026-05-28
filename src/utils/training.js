import { EX, TECH, SPLITS, byId, primary, cById } from "../data/exercises";

export function repScheme(goal) {
  if (goal === "fuerza") return { s: 5, r: 5, rest: 150 };
  if (goal === "grasa")  return { s: 3, r: 15, rest: 45 };
  return { s: 4, r: 10, rest: 75 };
}

export function canIntense(level) {
  return level === "inter" || level === "avz";
}

export function techFor(ex) {
  return TECH[ex.type] || TECH.iso;
}

export function pickEx(id, place) {
  let e = byId(id);
  if (!e) return null;
  if (place === "casa" && e.loc === "gym") {
    const a = EX.find(x => x.loc === "casa" && primary(x) === primary(e));
    if (a) e = a;
  }
  return e;
}

export function makeWO(name, ids, training) {
  const sc = repScheme(training.goal);
  const exercises = ids.split(",")
    .map(id => pickEx(id.trim(), training.place))
    .filter(Boolean);
  return {
    name,
    base: exercises.map(e => ({ id: e.id, sets: sc.s, reps: sc.r, rest: sc.rest })),
    t: null,
    kind: "pesas",
  };
}

export function estMin(plan) {
  let m = 0;
  plan.forEach(x => {
    if (x.cardioMin) { m += x.cardioMin; return; }
    m += x.sets * (x.rest + 42) / 60;
    if (x.tech) m += 0.6;
  });
  return Math.round(m);
}

export function muscleOf(x) {
  const e = byId(x.id);
  return e ? primary(e) : "?";
}

export function buildSession(entry, training) {
  if (!entry) return [];
  if (entry.kind === "cardio") return entry.base.map(x => ({ ...x }));
  const mins = entry.t || training.time;
  let plan = entry.base.map(x => ({ ...x, tech: null }));

  const getGroups = () => {
    const g = {};
    plan.forEach(x => { (g[muscleOf(x)] = g[muscleOf(x)] || []).push(x); });
    return g;
  };

  // Step 1: fits as-is
  if (estMin(plan) <= mins) return tagDefaults(plan, training);

  // Step 2: shorten rest periods
  const restFloor = training.goal === "fuerza" ? 90 : training.goal === "grasa" ? 35 : 50;
  plan = plan.map(x => ({ ...x, rest: Math.max(restFloor, Math.round(x.rest * 0.7)) }));
  if (estMin(plan) <= mins) return tagDefaults(plan, training);

  // Step 3: drop to 3 sets + add intensity techniques
  plan = plan.map(x => {
    const ex = byId(x.id);
    return { ...x, sets: Math.min(x.sets, 3), tech: canIntense(training.level) && ex ? techFor(ex).code : null };
  });
  if (estMin(plan) <= mins) return tagDefaults(plan, training);

  // Step 4: drop to 2 sets — always prefer this over removing exercises
  plan = plan.map(x => ({ ...x, sets: 2 }));
  if (estMin(plan) <= mins) return tagDefaults(plan, training);

  // Step 5: remove individual exercises as last resort, respecting minimums:
  // primary muscle group (most exercises) → keep at least 3
  // secondary muscle groups → keep at least 2
  const g0 = getGroups();
  const primaryMuscle = Object.keys(g0).sort((a, b) => g0[b].length - g0[a].length)[0];
  // Never go below initial count if it's already under the threshold
  const muscleMin = {};
  Object.entries(g0).forEach(([name, exs]) => {
    const threshold = name === primaryMuscle ? 3 : 2;
    muscleMin[name] = Math.min(exs.length, threshold);
  });

  while (estMin(plan) > mins) {
    const g = getGroups();
    let removed = false;
    // Remove from the group with the most excess first (secondary before primary)
    for (const name of Object.keys(g).sort((a, b) => {
      const excessA = g[a].length - (muscleMin[a] ?? 2);
      const excessB = g[b].length - (muscleMin[b] ?? 2);
      return excessB - excessA;
    })) {
      const min = muscleMin[name] ?? 2;
      if (g[name].length > min) {
        const toRemove = g[name][g[name].length - 1].id;
        plan = plan.filter(x => x.id !== toRemove);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  return tagDefaults(plan, training);
}

function tagDefaults(plan, training) {
  if (!canIntense(training.level)) return plan;
  const g = {};
  plan.forEach((x, i) => { (g[muscleOf(x)] = g[muscleOf(x)] || []).push(i); });
  Object.values(g).forEach(idxs => {
    const last = idxs[idxs.length - 1];
    if (!plan[last].tech) {
      const ex = byId(plan[last].id);
      if (ex) plan[last].tech = techFor(ex).code;
    }
  });
  return plan;
}

// Abs block: 3-4 exercises depending on level
export function buildAbsBlock(level) {
  const adv = level === "avz";
  return [
    { id: "crunch",            sets: 3, reps: adv ? 25 : 20, rest: 45, _isAbs: true },
    { id: "elevacion_piernas", sets: 3, reps: adv ? 15 : 12, rest: 45, _isAbs: true },
    { id: "plancha",           sets: 3, reps: "45s",          rest: 30, _isAbs: true },
    ...(adv ? [{ id: "russian_twist", sets: 3, reps: 20, rest: 30, _isAbs: true }] : []),
  ];
}

export function buildSchedule(training) {
  const days = Math.min(6, Math.max(3, training.days));
  const splits = SPLITS[days] || SPLITS[4];

  // Assign abs to sessions 0,2 (and 4 for 6-day) — ensures minimum 2 abs sessions per week
  const absSet = new Set(days >= 6 ? [0, 2, 4] : [0, 2]);

  const seq = splits.map(([n, ids], i) => {
    const entry = makeWO(n, ids, training);
    entry.hasAbs    = absSet.has(i);
    entry.hasCardio = !entry.hasAbs;
    return entry;
  });
  const today = new Date().toISOString().split("T")[0];
  return { ...training, seq, cursor: 0, weekStarted: false, lastTrainTs: null, mesocycleStart: today, mesocycleDuration: 5 };
}

// PR suggestion: suggest weight/reps increase based on history
export function suggestPR(history) {
  if (!history || history.length === 0) return null;
  const last = history[history.length - 1];
  if (!last.weight) return null;
  // If last session hit target reps, suggest +2.5kg or +5% whichever is larger
  const suggestion = last.reps >= (last.targetReps || 10)
    ? { weight: +(last.weight + Math.max(2.5, last.weight * 0.05)).toFixed(1), reps: last.reps, note: "Puedes subir de peso esta sesión." }
    : { weight: last.weight, reps: last.reps + 1, note: "Intenta una rep más con el mismo peso." };
  return suggestion;
}

// Returns a warm-up block based on session muscles (5-8 min)
export function buildWarmUp(plan) {
  const muscles = [...new Set(plan.flatMap(x => byId(x.id)?.m || []))];
  const hasPierna  = muscles.some(m => /cuádriceps|isquios|glúteo|pierna/i.test(m));
  const hasPecho   = muscles.some(m => /pecho|pectoral/i.test(m));
  const hasEspalda = muscles.some(m => /espalda|dorsal/i.test(m));
  const hasHombro  = muscles.some(m => /hombro|deltoides/i.test(m));

  const base = [
    { label: "Cardio suave", desc: "5 min en cinta o bici a baja intensidad", min: 5 },
    { label: "Rotaciones cervicales", desc: "10 rotaciones lentas a cada lado", reps: "10 c/l" },
    { label: "Círculos de hombros", desc: "15 círculos adelante y atrás", reps: "15 c/l" },
  ];
  if (hasPecho || hasHombro) base.push({ label: "Apertura de pecho", desc: "Stretch con banda o puerta · Mantén 20s", reps: "3×20s" });
  if (hasEspalda)            base.push({ label: "Gato-vaca", desc: "En cuadrupedia, alterna arco y redondeo de espalda", reps: "10 rep" });
  if (hasPierna) {
    base.push({ label: "Sentadilla libre profunda", desc: "Sin carga, rango completo. Active the hips.", reps: "2×15" });
    base.push({ label: "Estiramiento cuádriceps", desc: "De pie, tira del pie hacia glúteo 20s cada lado", reps: "20s c/l" });
  }
  return base;
}

// Returns a cool-down block (5-10 min static stretching)
export function buildCoolDown(plan) {
  const muscles = [...new Set(plan.flatMap(x => byId(x.id)?.m || []))];
  const hasPierna  = muscles.some(m => /cuádriceps|isquios|glúteo|pierna/i.test(m));
  const hasPecho   = muscles.some(m => /pecho|pectoral/i.test(m));
  const hasEspalda = muscles.some(m => /espalda|dorsal/i.test(m));

  const stretches = [
    { label: "Respiración diafragmática", desc: "4 segundos inhala · 4 mantén · 6 exhala. Repite 6 veces.", reps: "6 resp" },
  ];
  if (hasPecho) stretches.push({ label: "Stretch pectoral en puerta", desc: "Antebrazos en marco, inclina el tronco adelante. 30s.", reps: "2×30s" });
  if (hasEspalda) stretches.push({ label: "Postura del niño (Child's Pose)", desc: "Rodillas al pecho, brazos extendidos. Relaja espalda.", reps: "45s" });
  if (hasPierna) {
    stretches.push({ label: "Estiramiento isquiotibial tumbado", desc: "Tumbado, lleva pierna recta hacia ti. 30s cada lado.", reps: "30s c/l" });
    stretches.push({ label: "Piriforme (figura 4)", desc: "Tumbado, cruza tobillo sobre rodilla contraria. 30s.", reps: "30s c/l" });
  }
  stretches.push({ label: "Foam roller (opcional)", desc: "2 min rodillo por los grupos trabajados hoy.", reps: "2 min" });
  return stretches;
}

export function alternatives(id, place, exclude = []) {
  const e = byId(id);
  if (!e) return [];
  const pm = primary(e);
  return EX.filter(x =>
    x.id !== id &&
    primary(x) === pm &&
    !exclude.includes(x.id) &&
    (place === "gym" || x.loc === "casa" || x.eq.length === 0)
  );
}
