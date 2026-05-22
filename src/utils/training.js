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

  const groups = () => {
    const g = {};
    plan.forEach(x => { (g[muscleOf(x)] = g[muscleOf(x)] || []).push(x); });
    return g;
  };

  if (estMin(plan) <= mins) return tagDefaults(plan, training);
  const restFloor = training.goal === "fuerza" ? 90 : training.goal === "grasa" ? 35 : 50;
  plan = plan.map(x => ({ ...x, rest: Math.max(restFloor, Math.round(x.rest * 0.7)) }));
  if (estMin(plan) <= mins) return tagDefaults(plan, training);
  plan = plan.map(x => {
    let s = x.sets; if (s > 3) s = 3;
    const ex = byId(x.id);
    return { ...x, sets: s, tech: canIntense(training.level) && ex ? techFor(ex).code : null };
  });
  if (estMin(plan) <= mins) return tagDefaults(plan, training);
  while (estMin(plan) > mins) {
    const g = groups(), names = Object.keys(g);
    if (names.length <= 1) break;
    const cand = names.sort((a, b) => g[a].length - g[b].length)[0];
    plan = plan.filter(x => muscleOf(x) !== cand);
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

export function buildSchedule(training) {
  const days = Math.min(6, Math.max(3, training.days));
  const splits = SPLITS[days] || SPLITS[4];
  const seq = splits.map(([n, ids]) => makeWO(n, ids, training));
  return { ...training, seq, cursor: 0, weekStarted: false, lastTrainTs: null };
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
