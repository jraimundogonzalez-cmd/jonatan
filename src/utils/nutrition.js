import { ACTIVITY, GOALS } from "../data/foods";

// ── Metabolic calculations ──────────────────────────────────────
export const calcMifflin = (sex, weight, height, age) => {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(sex === "h" ? base + 5 : base - 161);
};
export const calcKatch = (weight, bodyFat) =>
  Math.round(370 + 21.6 * weight * (1 - bodyFat / 100));

export const computeProfile = (profile) => {
  if (!profile.enabled || !profile.weight || !profile.height || !profile.age) return null;
  const useKatch = profile.bodyFat >= 5 && profile.bodyFat <= 50;
  const bmr = useKatch
    ? calcKatch(profile.weight, profile.bodyFat)
    : calcMifflin(profile.sex, profile.weight, profile.height, profile.age);
  const act = ACTIVITY[profile.activity] || ACTIVITY["moderada"] || Object.values(ACTIVITY)[2];
  const tdee = Math.round(bmr * act.mult);
  const goal = GOALS[profile.goal] || GOALS["mantener"] || Object.values(GOALS)[0];
  const targetKcal = Math.round(tdee * (1 + goal.deficit));
  const prot = Math.round(profile.weight * goal.protPerKg);
  const fat  = Math.round(profile.weight * goal.fatPerKg);
  const carbs = Math.max(40, Math.round(Math.max(0, targetKcal - prot * 4 - fat * 9) / 4));
  return {
    formula: useKatch ? "Katch-McArdle" : "Mifflin-St Jeor",
    leanMass: useKatch ? +(profile.weight * (1 - profile.bodyFat / 100)).toFixed(1) : null,
    bmr, tdee, targetKcal,
    macros: { proteina: prot, carbos: carbs, grasas: fat },
    goalInfo: goal,
  };
};

export const adjustMacros = (newMacros, changedKey, targetKcal, weight = null) => {
  const m = { ...newMacros };

  // Fat constraints: 0.8g/kg min (aggressive cut), 1.2g/kg max, fallback 30–180g
  const fatMin = weight ? Math.round(weight * 0.8) : 30;
  const fatMax = weight ? Math.round(weight * 1.2) : 180;

  if (changedKey === "proteina" || changedKey === "grasas") {
    // Clamp fat within healthy range
    m.grasas = Math.min(fatMax, Math.max(fatMin, m.grasas));
    // Carbs fill remaining kcal (min 40g = 160 kcal)
    const remaining = Math.max(160, targetKcal - m.proteina * 4 - m.grasas * 9);
    m.carbos = Math.round(remaining / 4);
  } else if (changedKey === "carbos") {
    // Carbs changed → adjust protein to maintain total kcal, fat stays in range
    m.grasas = Math.min(fatMax, Math.max(fatMin, m.grasas));
    const protKcal = Math.max(160, targetKcal - m.carbos * 4 - m.grasas * 9);
    m.proteina = Math.round(protKcal / 4);
  }

  return m;
};

// ── Plan builder ─────────────────────────────────────────────────
const r5 = (x) => Math.max(0, Math.round(x / 5) * 5);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const BERRY_IDS = [102, 103];
const YOGURT_IDS = [46, 121];
const PROT_CATS = new Set(["aves","carnes","pescado","marisco","huevos","lacteos","quesos","fiambres","conservas","postreprot"]);

export const buildMeal = ({ tP, tC, tF, dayIdx, mealIdx, mealNames, selFoods, usedFoodIds, usedCats, priorityFoods, assignedFoods }) => {
  const normFood = (f) => f.u ? { ...f, p: +(f.p * 100 / f.u).toFixed(1), c: +(f.c * 100 / f.u).toFixed(1), f: +(f.f * 100 / f.u).toFixed(1), cal: Math.round(f.cal * 100 / f.u) } : f;
  const nFoods = selFoods.map(normFood);
  const origById = Object.fromEntries(selFoods.map(f => [f.id, f]));

  const items = [];
  const push = (food, grams) => {
    if (grams < 5) return;
    const orig = origById[food.id] || food;
    const roundedGrams = orig.u ? Math.max(orig.u, Math.round(grams / orig.u) * orig.u) : grams;
    items.push({ id: food.id, name: food.name, cat: food.cat, grams: roundedGrams,
      u: orig.u || null, uLabel: orig.uLabel || null,
      p: +(roundedGrams * food.p / 100).toFixed(1), c: +(roundedGrams * food.c / 100).toFixed(1), f: +(roundedGrams * food.f / 100).toFixed(1) });
  };
  const makeTotals = () => {
    const t = items.reduce((a, i) => ({ p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { p: 0, c: 0, f: 0 });
    t.kcal = Math.round(t.p * 4 + t.c * 4 + t.f * 9);
    t.p = Math.round(t.p); t.c = Math.round(t.c); t.f = Math.round(t.f);
    return t;
  };

  // ── TinyPool direct mode: all assigned foods appear, quantities meet targets ──
  if (assignedFoods && assignedFoods.length > 0) {
    const nA = assignedFoods.map(normFood).sort((a, b) => b.p - a.p);
    const mainProt = nA[0];
    const rest = nA.slice(1);
    // Default portions for secondary foods
    const defaultG = (f) => f.p > 50 ? 40 : f.p > 15 ? 150 : f.c > 20 ? 150 : 200;
    const restItems = rest.map(f => ({ food: f, grams: r5(defaultG(f)) }));
    const restSum = restItems.reduce((a, it) => ({
      p: a.p + it.grams * it.food.p / 100, c: a.c + it.grams * it.food.c / 100,
    }), { p: 0, c: 0 });
    // Main protein: adjust grams to meet remaining P target
    const maxPg = mainProt.p > 50 ? 80 : 500;
    const pg = r5(clamp(mainProt.p > 0 ? Math.max(0, tP - restSum.p) / (mainProt.p / 100) : 50, 30, maxPg));
    // Adjust the highest-carb secondary food to meet carb target if it has meaningful carbs
    const cIdx = restItems.reduce((bi, it, i) => it.food.c > (restItems[bi]?.food.c || 0) ? i : bi, 0);
    if (restItems.length > 0 && restItems[cIdx].food.c >= 8) {
      const remC = Math.max(0,
        tC - pg * mainProt.c / 100
           - restItems.reduce((a, it, i) => a + (i === cIdx ? 0 : it.grams * it.food.c / 100), 0));
      const maxCg = restItems[cIdx].food.p > 8 ? 350 : 600;
      const adjG = restItems[cIdx].food.c > 0
        ? r5(clamp(remC / (restItems[cIdx].food.c / 100), restItems[cIdx].grams, maxCg))
        : restItems[cIdx].grams;
      restItems[cIdx] = { ...restItems[cIdx], grams: adjG };
    }
    push(mainProt, pg);
    restItems.forEach(it => push(it.food, it.grams));
    return { items, totals: makeTotals() };
  }

  // ── Standard pool-based algorithm (large food selections) ──
  const priorityList = (priorityFoods || []).map(id => nFoods.find(f => f.id === id)).filter(Boolean);
  const forcedItems = [];
  const portionForPriority = (f) => {
    if (f.p >= 18) return 180; if (f.p >= 12) return 150;
    if (f.c >= 50) return 80;  if (f.c >= 20) return 150;
    if (f.f >= 40) return 25;  if (f.f >= 15) return 50;
    return f.cal <= 60 ? 150 : 100;
  };
  priorityList.forEach(f => forcedItems.push({ food: f, grams: portionForPriority(f) }));
  const hasBerry = priorityList.some(f => BERRY_IDS.includes(f.id));
  const yogurtInSelected = nFoods.find(f => YOGURT_IDS.includes(f.id));
  if (hasBerry && yogurtInSelected && !forcedItems.some(it => it.food.id === yogurtInSelected.id))
    forcedItems.push({ food: yogurtInSelected, grams: 150 });

  const forcedMacros = forcedItems.reduce((a, it) => ({
    p: a.p + it.grams * it.food.p / 100, c: a.c + it.grams * it.food.c / 100, f: a.f + it.grams * it.food.f / 100,
  }), { p: 0, c: 0, f: 0 });
  const remP = Math.max(0, tP - forcedMacros.p);
  const remC = Math.max(0, tC - forcedMacros.c);
  const remF = Math.max(0, tF - forcedMacros.f);

  const forcedIds = new Set(forcedItems.map(it => it.food.id));
  const forcedCats = new Set(forcedItems.map(it => it.food.cat));
  const blockedIds = new Set([...usedFoodIds, ...forcedIds]);
  const blockedCats = new Set([...usedCats, ...forcedCats]);

  const tinyPool = selFoods.length <= 5;
  const freeBlocked = (list) => tinyPool ? list.filter(f => !forcedIds.has(f.id)) : list.filter(f => !blockedIds.has(f.id) && !blockedCats.has(f.cat));
  const freeBlockedRelaxed = (list) => tinyPool ? list : list.filter(f => !blockedIds.has(f.id));
  const pickBlocked = (pool, offset) => {
    let pick = freeBlocked(pool);
    if (!pick.length) pick = freeBlockedRelaxed(pool);
    if (!pick.length) pick = pool;
    return pick[offset % pick.length];
  };

  const lean = nFoods.filter(f => (PROT_CATS.has(f.cat) || f.p >= 10) && f.f <= 20).sort((a, b) => b.p - a.p || a.f - b.f);
  const protPool = lean.length ? lean : nFoods.filter(f => PROT_CATS.has(f.cat) || f.p >= 7).sort((a, b) => b.p - a.p);
  const carbPool = nFoods.filter(f => f.c >= 10).sort((a, b) => b.c - a.c);
  const carbPoolNF = carbPool.filter(f => f.cat !== "frutas");
  const fatPool  = nFoods.filter(f => f.f >= 25).sort((a, b) => b.f - a.f);
  const vegPool  = nFoods.filter(f => f.cat === "verduras" && f.cal <= 40 && f.c < 12 && f.f < 3);

  const needPro  = remP > 15 && protPool.length > 0;
  const needCarb = remC > 10 && (carbPoolNF.length > 0 || carbPool.length > 0);
  const needFat  = remF > 10 && fatPool.length > 0;

  const pf = needPro ? pickBlocked(protPool, dayIdx + mealIdx) : null;
  if (pf) { blockedIds.add(pf.id); blockedCats.add(pf.cat); }
  const carbBase = carbPoolNF.length ? carbPoolNF : carbPool;
  const cf = needCarb ? pickBlocked(carbBase, dayIdx * 2 + mealIdx + 1) : null;
  if (cf) { blockedIds.add(cf.id); blockedCats.add(cf.cat); }
  let cf2 = null;
  if (cf && cf.c < 25 && remC > 80) {
    cf2 = pickBlocked(carbBase, dayIdx * 3 + mealIdx + 7);
    if (cf2 && cf2.c < 25) cf2 = null;
    if (cf2) { blockedIds.add(cf2.id); blockedCats.add(cf2.cat); }
  }
  const ff = needFat ? pickBlocked(fatPool, dayIdx + mealIdx * 2) : null;
  const isMain = /almuerzo|cena|comida/i.test(mealNames[mealIdx]);
  const vf = (isMain && vegPool.length && !forcedItems.some(it => it.food.cat === "verduras"))
    ? pickBlocked(vegPool, dayIdx + mealIdx) : null;

  const pgInit = pf ? (pf.p < 10 ? 250 : 150) : 0;
  let pg = pgInit, cg = cf ? 80 : 0, c2g = cf2 ? 50 : 0, fg = ff ? 8 : 0;
  const vg = vf ? 150 : 0;
  const vP = vf ? vg * vf.p / 100 : 0, vC = vf ? vg * vf.c / 100 : 0, vF = vf ? vg * vf.f / 100 : 0;

  if (pf || cf || ff) {
    const pMax = pf ? Math.min(clamp((remP / (pf.p / 100 || 1)) * 1.3, 150, 600), 600) : 0;
    const cMax = cf ? Math.min(clamp((remC / (cf.c / 100 || 1)) * 1.3, 150, 350), 350) : 0;
    const fMax = ff ? Math.min(clamp((remF / (ff.f / 100 || 1)) * 1.4, 25, 60), 60) : 0;
    for (let it = 0; it < 30; it++) {
      const curP = (pf?pg*pf.p/100:0)+(cf?cg*cf.p/100:0)+(cf2?c2g*cf2.p/100:0)+(ff?fg*ff.p/100:0)+vP;
      const curC = (pf?pg*pf.c/100:0)+(cf?cg*cf.c/100:0)+(cf2?c2g*cf2.c/100:0)+(ff?fg*ff.c/100:0)+vC;
      const curF = (pf?pg*pf.f/100:0)+(cf?cg*cf.f/100:0)+(cf2?c2g*cf2.f/100:0)+(ff?fg*ff.f/100:0)+vF;
      if (pf && pf.p > 0) pg += ((remP - curP) / (pf.p / 100)) * 0.55;
      if (cf && cf.c > 0) {
        if (cf2 && cf2.c > 0 && cg >= cMax * 0.85) c2g += ((remC - curC) / (cf2.c / 100)) * 0.45;
        else cg += ((remC - curC) / (cf.c / 100)) * 0.55;
      }
      if (ff && ff.f > 0) fg += ((remF - curF) / (ff.f / 100)) * 0.55;
      if (pf) pg = clamp(pg, 50, pMax); if (cf) cg = clamp(cg, 0, cMax);
      if (cf2) c2g = clamp(c2g, 0, 220); if (ff) fg = clamp(fg, 0, fMax);
    }
    pg = r5(pg); cg = r5(cg); c2g = r5(c2g); fg = r5(fg);
  }

  forcedItems.forEach(it => push(it.food, it.grams));
  if (pf) push(pf, pg);
  if (cf && (!pf || cf.id !== pf.id)) push(cf, cg);
  if (cf2 && cf2.id !== pf?.id && cf2.id !== cf?.id) push(cf2, c2g);
  if (ff && (!pf || ff.id !== pf.id) && (!cf || ff.id !== cf.id)) push(ff, fg);
  if (vf) push(vf, vg);

  return { items, totals: makeTotals() };
};

export const buildPlan = ({ macros, meals, mealNames, selFoods, refeedOn, refeedDays, refeedCarbs, refeedFat, shakeOn, shakeProt, shakeDays, priorities, postWorkoutMeal, planDays = 7 }) => {
  const ALL_DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
  const DAYS = ALL_DAYS.slice(0, Math.min(7, Math.max(1, planDays)));
  const w = mealNames.length;
  const baseWeights = mealNames.map((_, i) => w === 1 ? 1 : (/almuerzo|cena|comida/i.test(mealNames[i]) ? 1.3 : 0.8));
  const baseSum = baseWeights.reduce((a, b) => a + b, 0);

  // With ≤6 foods selected, pre-assign all foods across meals so every food appears
  const tinyPool = selFoods.length <= 6 && meals > 0;
  let mealFoodAssignments = null;
  if (tinyPool) {
    // Sort: highest protein density first so protein sources lead each meal
    const byProtDens = [...selFoods].sort((a, b) => {
      const aD = a.p / Math.max(1, a.c * 0.4 + a.f * 0.3 + 0.5);
      const bD = b.p / Math.max(1, b.c * 0.4 + b.f * 0.3 + 0.5);
      return bD - aD;
    });
    mealFoodAssignments = Array.from({ length: meals }, () => []);
    byProtDens.forEach((f, i) => mealFoodAssignments[i % meals].push(f));
  }

  const days = DAYS.map((dayName, di) => {
    const isRefeed = refeedOn && refeedDays.includes(di);
    const hasShake = shakeOn && shakeDays.includes(di);
    const shakeP = hasShake ? shakeProt : 0;
    const dMacros = isRefeed ? { proteina: macros.proteina, carbos: refeedCarbs, grasas: refeedFat } : { ...macros };
    const dProtTarget = Math.max(40, dMacros.proteina - shakeP);
    const pwm = postWorkoutMeal[di] != null ? postWorkoutMeal[di] : null;
    const carbWeights = pwm !== null ? mealNames.map((_, i) => i === pwm ? 6.0 : 1.0) : baseWeights;
    const carbWeightSum = carbWeights.reduce((a, b) => a + b, 0);

    const usedFoodIds = new Set(), usedCats = new Set();
    const dayMeals = mealNames.map((mealName, mi) => {
      const fracPF = baseWeights[mi] / baseSum, fracC = carbWeights[mi] / carbWeightSum;
      const { items, totals } = buildMeal({
        tP: dProtTarget * fracPF, tC: dMacros.carbos * fracC, tF: dMacros.grasas * fracPF,
        dayIdx: di, mealIdx: mi, mealNames, selFoods, usedFoodIds, usedCats,
        priorityFoods: priorities[`${di}_${mi}`] || [],
        assignedFoods: mealFoodAssignments ? mealFoodAssignments[mi] : null,
      });
      items.forEach(it => { usedFoodIds.add(it.id); usedCats.add(it.cat); });
      return { name: mealName, items, totals, isPostWorkout: mi === pwm };
    });

    const dayTotals = dayMeals.reduce((a, m) => ({ p: a.p + m.totals.p, c: a.c + m.totals.c, f: a.f + m.totals.f, kcal: a.kcal + m.totals.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
    if (hasShake) { dayTotals.p += shakeP; dayTotals.kcal += shakeP * 4; }
    return { dayIdx: di, dayName, isRefeed, hasShake, shakeProt: shakeP, postWorkoutMeal: pwm,
      target: { ...dMacros, kcal: Math.round(dMacros.proteina*4 + dMacros.carbos*4 + dMacros.grasas*9) },
      meals: dayMeals, totals: dayTotals };
  });
  return { days };
};

// ── Recipe generator ─────────────────────────────────────────────
const COOK_METHODS = {
  aves:     { verb:"cocina", method:"a la plancha o al horno", time:15, tip:"Corta en dados para que se haga más rápido y quede jugoso por dentro." },
  carnes:   { verb:"cocina", method:"a la plancha a fuego alto", time:12, tip:"Saca la carne de la nevera 10 min antes. Alta temperatura, poco tiempo." },
  pescado:  { verb:"cocina", method:"al vapor o en sartén con tapa", time:10, tip:"El pescado no necesita más de 3-4 min por lado. Si es salmón, déjalo rosado por dentro." },
  marisco:  { verb:"saltea", method:"en sartén a fuego fuerte 2-3 min", time:5,  tip:"El marisco se hace muy rápido. En cuanto cambia de color, ya está." },
  huevos:   { verb:"cocina", method:"en sartén antiadherente o cocidos", time:8,  tip:"Para tortilla de claras: fondo a fuego medio, tapa y deja cuajar sin remover." },
  fiambres: { verb:"sirve",  method:"directamente (no necesita cocción)", time:2,  tip:"Combina con queso o verduras frescas para un plato completo sin cocinar." },
  conservas:{ verb:"calienta o sirve", method:"directamente de la lata", time:3,  tip:"El atún al natural es versátil: mezcla con limón, sal y pimienta y listo." },
  cereales: { verb:"cuece",  method:"en agua hirviendo con sal", time:12, tip:"Arroz: 1 parte de arroz, 2 de agua. Tapa y a fuego bajo 12 min sin abrir." },
  pasta:    { verb:"cuece",  method:"en agua hirviendo con sal al dente", time:10, tip:"Al dente significa 1-2 min menos de lo que dice el paquete." },
  legumbres:{ verb:"calienta", method:"en sartén o directamente si es conserva", time:5, tip:"Las legumbres en conserva ya están listas. Solo caliéntalas con especias." },
  verduras: { verb:"cocina", method:"al vapor 5 min o salteadas en sartén", time:6,  tip:"Al vapor conserva más nutrientes. En microondas con un poco de agua también funciona." },
  frutas:   { verb:"sirve",  method:"fresca o con yogur", time:1,  tip:"Corta y sirve. La fruta no necesita preparación." },
  lacteos:  { verb:"sirve",  method:"frío o a temperatura ambiente", time:1,  tip:"El yogur proteico es perfecto con fruta y avena para un desayuno rápido." },
  quesos:   { verb:"sirve",  method:"directamente o fundido", time:2,  tip:"El requesón o la mozzarella se pueden mezclar con otros ingredientes fácilmente." },
  grasas:   { verb:"añade",  method:"al final como condimento o en crudo", time:1,  tip:"El aguacate maduro se aplasta con tenedor en 30s. El aceite de oliva, un chorrito al final." },
};

const SEASON = {
  aves:    "sal, pimienta, ajo en polvo, orégano",
  carnes:  "sal, pimienta negra, ajo, pimentón",
  pescado: "sal, limón, eneldo o perejil",
  marisco: "ajo, limón, perejil",
  huevos:  "sal, pimienta, orégano",
  default: "sal, pimienta, especias al gusto",
};

export function generateRecipe(mealName, items) {
  const PROT_CATS = ["aves","carnes","pescado","marisco","huevos","fiambres","conservas"];
  const CARB_CATS = ["cereales","pasta","legumbres"];
  const VEG_CATS  = ["verduras"];
  const FAT_CATS  = ["grasas"];
  const DAIRY_CATS= ["lacteos","quesos"];
  const FRUIT_CATS= ["frutas"];

  const protein = items.find(i => PROT_CATS.includes(i.cat));
  const carb    = items.find(i => CARB_CATS.includes(i.cat));
  const veggie  = items.find(i => VEG_CATS.includes(i.cat));
  const fat     = items.find(i => FAT_CATS.includes(i.cat));
  const dairy   = items.find(i => DAIRY_CATS.includes(i.cat));
  const fruit   = items.find(i => FRUIT_CATS.includes(i.cat));

  const isMorning = /desayuno|media mañana/i.test(mealName);
  const isSnack   = /merienda/i.test(mealName);

  // Morning/snack bowls
  if (isMorning || isSnack) {
    if (dairy && (fruit || carb)) {
      const carbItem = carb || fruit;
      return {
        name: `Bowl de ${dairy.name}${fruit ? " con " + fruit.name : ""}${carb ? " y " + carb.name : ""}`,
        time: 5, diff: "Muy fácil",
        ingredients: [
          `${dairy.grams}g de ${dairy.name}`,
          carbItem ? `${carbItem.grams}g de ${carbItem.name}` : null,
          fat ? `${fat.grams}g de ${fat.name}` : null,
          "Canela o vainilla al gusto (opcional)",
        ].filter(Boolean),
        steps: [
          `Vierte ${dairy.grams}g de ${dairy.name} en un bol.`,
          carbItem ? `Añade ${carbItem.grams}g de ${carbItem.name}${carb?.cat === "cereales" ? ". Si es avena, remoja 5 min antes para que ablande." : "."}` : null,
          fat ? `Incorpora ${fat.grams}g de ${fat.name} mezclando bien.` : null,
          "Mezcla y sirve. Listo en menos de 5 minutos.",
        ].filter(Boolean),
        result: `Bol cremoso y saciante. El ${dairy.name} debe tener textura suave. Si ves líquido encima, remueve antes de servir. Color blanco/crema con los toques de ${carbItem?.name || "los ingredientes"}.`,
        tips: "Puedes preparar este bol la noche anterior en un tarro y tenerlo listo por la mañana (overnight oats / overnight skyr).",
      };
    }
    if (protein && (protein.cat === "huevos")) {
      return {
        name: `Tortilla de ${protein.name}${carb ? " con " + carb.name : ""}`,
        time: 10, diff: "Fácil",
        ingredients: [
          `${protein.grams}g de ${protein.name}`,
          carb ? `${carb.grams}g de ${carb.name} (o tostadas integrales)` : null,
          "Sal, pimienta, orégano",
          "Spray de aceite o media cucharadita",
        ].filter(Boolean),
        steps: [
          "Bate los huevos/claras con sal, pimienta y orégano en un bol.",
          "Calienta sartén antiadherente a fuego medio con spray de aceite.",
          "Vierte la mezcla, tapa y deja cuajar 2-3 min sin remover.",
          carb ? `Sirve con ${carb.grams}g de ${carb.name} al lado.` : "Dobla la tortilla por la mitad y sirve.",
        ].filter(Boolean),
        result: "La tortilla debe estar cuajada por fuera pero ligeramente cremosa por dentro. Si está muy seca, la próxima vez baja el fuego o tapa antes.",
        tips: "Añade espinacas, tomate o champiñones sin cost calórico para añadir volumen y nutrientes.",
      };
    }
  }

  // Main meals with protein + carb
  if (protein && carb) {
    const pCook = COOK_METHODS[protein.cat] || COOK_METHODS.aves;
    const cCook = COOK_METHODS[carb.cat] || COOK_METHODS.cereales;
    const season = SEASON[protein.cat] || SEASON.default;
    return {
      name: `${protein.name} con ${carb.name}${veggie ? " y " + veggie.name : ""}`,
      time: Math.max(pCook.time, cCook.time) + 2,
      diff: "Fácil",
      ingredients: [
        `${protein.grams}g de ${protein.name}`,
        `${carb.grams}g de ${carb.name} (en crudo)`,
        veggie ? `${veggie.grams}g de ${veggie.name}` : null,
        fat ? `${fat.grams}g de ${fat.name}` : null,
        `${season}`,
        "Un chorrito de aceite de oliva virgen extra",
      ].filter(Boolean),
      steps: [
        `Empieza por el ${carb.name}: ${cCook.verb} ${cCook.method} (${cCook.time} min). ${cCook.tip}`,
        veggie ? `Mientras, ${COOK_METHODS.verduras.verb} los ${veggie.grams}g de ${veggie.name} ${COOK_METHODS.verduras.method}. ${COOK_METHODS.verduras.tip}` : null,
        `Sazona los ${protein.grams}g de ${protein.name} con ${season}.`,
        `${pCook.verb.charAt(0).toUpperCase() + pCook.verb.slice(1)} ${pCook.method} unos ${pCook.time} min. ${pCook.tip}`,
        fat ? `Al emplatar, añade ${fat.grams}g de ${fat.name} como condimento final.` : null,
        "Sirve todo en el mismo plato o bol. Equilibrado y listo.",
      ].filter(Boolean),
      result: `Plato completo con proteína + carbohidrato + ${veggie ? "verdura" : "grasa"}. La ${protein.name} debe estar ${protein.cat === "pescado" ? "jugosa y apenas opaca por dentro" : protein.cat === "huevos" ? "cuajada" : "dorada por fuera y jugosa por dentro"}. El ${carb.name} debe estar ${carb.cat === "pasta" ? "al dente" : "suelto y sin apelmazarse"}.`,
      tips: `${pCook.tip} Prepara el doble de ${carb.name} y guarda en tupper para mañana. Aguanta 3-4 días en nevera.`,
    };
  }

  // Protein only (high protein snack)
  if (protein) {
    const pCook = COOK_METHODS[protein.cat] || COOK_METHODS.aves;
    const season = SEASON[protein.cat] || SEASON.default;
    return {
      name: `${protein.name}${veggie ? " con " + veggie.name : ""}${fat ? " y " + fat.name : ""}`,
      time: pCook.time,
      diff: "Muy fácil",
      ingredients: [
        `${protein.grams}g de ${protein.name}`,
        veggie ? `${veggie.grams}g de ${veggie.name}` : null,
        fat ? `${fat.grams}g de ${fat.name}` : null,
        season,
      ].filter(Boolean),
      steps: [
        `Sazona el ${protein.name} con ${season}.`,
        `${pCook.verb.charAt(0).toUpperCase() + pCook.verb.slice(1)} ${pCook.method}. ${pCook.tip}`,
        veggie ? `Añade ${veggie.name} al vapor o salteada de acompañamiento.` : null,
        fat ? `Sirve con ${fat.grams}g de ${fat.name}.` : "Sirve y listo.",
      ].filter(Boolean),
      result: `Comida high-protein rápida. Sin carbos, perfecta para ajustar el plan en días donde ya has alcanzado los carbohidratos.`,
      tips: pCook.tip,
    };
  }

  // Fallback: salad/bowl style
  return {
    name: `Bowl de ${mealName}`,
    time: 5, diff: "Muy fácil",
    ingredients: items.map(i => `${i.grams}g de ${i.name}`),
    steps: [
      "Prepara cada ingrediente según su tipo (los que necesiten cocción, cocínalos primero).",
      "Combina todos en un bol o plato.",
      "Sazona al gusto con sal, pimienta y un chorrito de aceite de oliva.",
    ],
    result: "Plato variado. Ajusta los condimentos a tu gusto.",
    tips: "Si tienes poco tiempo, elige siempre conservas (atún, legumbres) y frutas: cero cocción.",
  };
}

// ── Shopping list builder ─────────────────────────────────────────
export const buildShoppingList = (planData, CATS) => {
  if (!planData?.days) return [];
  const totals = {};
  planData.days.forEach(d => d.meals.forEach(m => m.items.forEach(it => {
    if (!totals[it.id]) totals[it.id] = { id: it.id, name: it.name, cat: it.cat, grams: 0 };
    totals[it.id].grams += it.grams;
  })));
  const byCat = {};
  Object.values(totals).forEach(t => {
    if (!byCat[t.cat]) byCat[t.cat] = [];
    byCat[t.cat].push(t);
  });
  return Object.entries(byCat)
    .map(([cat, items]) => ({ cat, label: CATS[cat] || cat, items: items.sort((a, b) => b.grams - a.grams) }))
    .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
};
