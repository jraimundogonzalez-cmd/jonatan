import { useState, useMemo, useEffect } from "react";
import { useApp } from "../store/AppContext";
import { FOODS, CATS, ALLERGIES_OPT, MEALS_NAMES, DAYS, GOALS, ACTIVITY } from "../data/foods";
import { computeProfile, adjustMacros, buildPlan, buildShoppingList, generateRecipe } from "../utils/nutrition";
import { foodAllergenMatch } from "../utils/allergens";

const C = {
  wrap:  { minHeight: "100vh", background: "#080d08" },
  card:  { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 12 },
  btnG:  { background: "#16a34a", color: "#fff", border: "none", borderRadius: 11, padding: "13px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%", transition: "background .2s" },
  btnS:  { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", borderRadius: 10, padding: "10px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  tag:   { border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", borderRadius: 20, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  tagOn: { borderColor: "#4ade80", background: "rgba(74,222,128,0.1)", color: "#4ade80" },
  inp:   { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 13px", color: "#e2e8f0", fontSize: 14, fontFamily: "inherit", width: "100%", outline: "none" },
  lbl:   { color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", marginBottom: 8, display: "block" },
  mono:  { fontFamily: "'DM Mono',monospace" },
};

const STEPS = ["Perfil", "Alimentos", "Macros", "Plan"];

// ── Subcomponents ─────────────────────────────────────────────────

const PEXELS_KEY = "zGavr4Z4fCxMdbqCFvzuRLlqgMEAO4stKKEqfwC3Sn1eVKP3965YAsZ4";

function RecipeModal({ mealName, items, onClose }) {
  const recipe = useMemo(() => generateRecipe(mealName, items), [mealName, items]);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [imgErr, setImgErr] = useState(false);
  const cats = new Set(items.map(it => it.cat));
  const photoTerm = cats.has("aves") ? "grilled chicken breast plate"
    : cats.has("pescado") ? "grilled fish fillet plate"
    : cats.has("carnes") ? "beef steak meal plate"
    : cats.has("huevos") ? "cooked eggs plate healthy"
    : (cats.has("postreprot") || cats.has("lacteos")) ? "greek yogurt bowl healthy"
    : cats.has("verduras") ? "vegetable salad bowl healthy"
    : cats.has("legumbres") ? "lentils beans bowl meal"
    : "healthy meal plate food";
  const fallbackEmoji = cats.has("aves") ? "🍗" : cats.has("pescado") ? "🐟" : cats.has("carnes") ? "🥩" : cats.has("huevos") ? "🍳" : (cats.has("postreprot") || cats.has("lacteos")) ? "🥛" : "🍽️";

  useEffect(() => {
    const page = Math.floor(Math.random() * 8) + 1;
    fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(photoTerm)}&per_page=1&page=${page}&orientation=landscape`, {
      headers: { Authorization: PEXELS_KEY }
    })
      .then(r => r.json())
      .then(data => { if (data.photos?.[0]?.src?.large2x) setPhotoUrl(data.photos[0].src.large2x); })
      .catch(() => {});
  }, [photoTerm]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0f1a12", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>

        {/* Photo header */}
        <div style={{ position: "relative", height: 210, borderRadius: "20px 20px 0 0", overflow: "hidden", flexShrink: 0 }}>
          {photoUrl && !imgErr
            ? <img src={photoUrl} alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgErr(true)} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#14532d,#052e16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>{fallbackEmoji}</div>
          }
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(15,26,18,0.92) 0%,rgba(0,0,0,0.05) 55%)" }} />
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, background: "rgba(255,255,255,0.35)", borderRadius: 9 }} />
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 12, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
          <div style={{ position: "absolute", bottom: 14, left: 18, right: 52 }}>
            <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>{mealName} · Receta rápida</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0, lineHeight: 1.2 }}>{recipe.name}</h2>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "16px 18px 36px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <span style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>⏱ {recipe.time} min</span>
            <span style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{recipe.diff}</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>INGREDIENTES</div>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#cbd5e1" }}>
                <span style={{ color: "#4ade80", fontWeight: 700, flexShrink: 0 }}>•</span>{ing}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>PREPARACIÓN</div>
            {recipe.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#16a34a", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>{step}</p>
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 14px", background: "rgba(74,222,128,0.07)", borderRadius: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>ASÍ TIENE QUE QUEDAR</div>
            <p style={{ fontSize: 13, color: "#86efac", lineHeight: 1.6, margin: 0 }}>{recipe.result}</p>
          </div>

          {recipe.tips && (
            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.07)", borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: ".08em", marginBottom: 4 }}>💡 TIP PRO</div>
              <p style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.55, margin: 0 }}>{recipe.tips}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrainDayBanner({ isTrain, isRest, kcalWatch, extraHC, carbDelta, fatDelta, carbsMult, fatMult, sessionName, onSaveKcal }) {
  const [editing, setEditing] = useState(false);
  const [inp, setInp] = useState("");
  return (
    <div style={{ background: isTrain ? "rgba(245,158,11,0.07)" : "rgba(96,165,250,0.07)", border: `1px solid ${isTrain ? "rgba(245,158,11,0.25)" : "rgba(96,165,250,0.25)"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 20 }}>{isTrain ? "🏋️" : "😴"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: isTrain ? "#f59e0b" : "#60a5fa", marginBottom: 2 }}>
            {isTrain ? (sessionName ? `Entrenado hoy · ${sessionName}` : "Hoy has entrenado") : "Hoy es día de descanso"}
          </div>
          {isTrain ? (
            <>
              {kcalWatch > 0 ? (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>{kcalWatch} kcal</span> quemadas · +{extraHC}g HC extra añadidos a tus macros
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#64748b" }}>Registra las kcal del Apple Watch para ajustar tus macros de hoy</div>
              )}
              <button onClick={() => { setEditing(v => !v); setInp(kcalWatch > 0 ? String(kcalWatch) : ""); }}
                style={{ marginTop: 8, fontSize: 11, color: "#f59e0b", background: "none", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                ⌚ {kcalWatch > 0 ? `${kcalWatch} kcal ✏️` : "Registrar kcal Apple Watch"}
              </button>
              {editing && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input type="number" value={inp} onChange={e => setInp(e.target.value)} placeholder="kcal quemadas"
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 11px", color: "#e2e8f0", fontFamily: "'DM Mono',monospace", fontSize: 15, outline: "none" }} />
                  <button onClick={() => { onSaveKcal(+inp || 0); setEditing(false); }}
                    style={{ padding: "9px 14px", background: "#f59e0b", border: "none", borderRadius: 9, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>OK</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 11, color: "#64748b" }}>
              HC {carbDelta}g (×{carbsMult}) · Grasas +{fatDelta}g (×{fatMult}) · Aplica en el siguiente plan generado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShoppingList({ planData }) {
  const list = buildShoppingList(planData, CATS);
  const toKg = g => g >= 1000 ? `${(g / 1000).toFixed(2).replace(".", ",")} kg` : `${g} g`;
  return (
    <div>
      {list.map(group => (
        <div key={group.cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>{group.label}</div>
          {group.items.map(it => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#cbd5e1" }}>
              <span>{it.name}</span>
              <span style={{ ...C.mono, color: "#4ade80", fontWeight: 700, fontSize: 12 }}>{toKg(it.grams)}</span>
            </div>
          ))}
        </div>
      ))}
      <p style={{ fontSize: 11, color: "#475569", marginTop: 8, fontStyle: "italic" }}>Cantidades totales para {planData?.days?.length ?? 7} días (peso en crudo). Añade 10-15% por mermas de cocción.</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function Nutricion() {
  const { state, setState, setTodayLog } = useApp();
  const saved = state.nutrition || {};

  const [step, setStep] = useState(saved.planData ? 3 : 0);
  const [profile, setProfile] = useState(state.profile || { enabled: false, sex: "h", age: 30, height: 175, weight: 75, bodyFat: null, activity: "moderada", goal: "definicion" });
  const [macros, setMacros] = useState(saved.macros || { proteina: 180, carbos: 200, grasas: 70 });
  const [targetKcal, setTargetKcal] = useState(saved.targetKcal || null);
  const [meals, setMeals] = useState(saved.meals || 4);
  const [selected, setSelected] = useState(saved.selected || []);
  const [allergies, setAllergies] = useState(saved.allergies || []);
  const [priorities, setPriorities] = useState(saved.priorities || {});
  const [postWorkoutMeal, setPostWorkoutMeal] = useState(saved.postWorkoutMeal || {});
  const [refeedOn, setRefeedOn] = useState(saved.refeedOn || false);
  const [refeedDays, setRefeedDays] = useState(saved.refeedDays || []);
  const [refeedCarbs, setRefeedCarbs] = useState(saved.refeedCarbs || 350);
  const [shakeOn, setShakeOn] = useState(saved.shakeOn !== false);
  const [shakeProt, setShakeProt] = useState(saved.shakeProt || 27);
  const [shakeDays, setShakeDays] = useState(saved.shakeDays || []);
  const [planData, setPlanData] = useState(saved.planData || null);
  const [planDays, setPlanDays] = useState(saved.planDays || 7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [catFilter, setCat] = useState("all");
  const [showShopping, setShowShopping] = useState(false);
  const [swapping, setSwapping] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [viewTab, setViewTab] = useState("plan"); // "plan" | "shopping"
  const [localEdits, setLocalEdits] = useState({});  // { "di_mi_id": grams }
  const [savedDays, setSavedDays] = useState(new Set());

  const selFoods = useMemo(() => FOODS.filter(f => selected.includes(f.id)), [selected]);
  const kcal = Math.round(macros.proteina * 4 + macros.carbos * 4 + macros.grasas * 9);
  const mealNames = MEALS_NAMES[meals] || MEALS_NAMES[4];
  const computed = useMemo(() => computeProfile(profile), [profile]);
  const refeedFat = Math.max(30, Math.round(macros.grasas - (refeedCarbs - macros.carbos) * 0.3));
  const visible = FOODS.filter(f => (catFilter === "all" || f.cat === catFilter) && f.name.toLowerCase().includes(query.toLowerCase()));

  const save = (extra = {}) => {
    setState(s => ({
      ...s,
      profile,
      nutrition: {
        ...s.nutrition,
        macros, targetKcal, meals, selected, allergies,
        priorities, postWorkoutMeal, refeedOn, refeedDays, refeedCarbs,
        shakeOn, shakeProt, shakeDays, planData, ...extra,
      }
    }));
  };

  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleA = id => setAllergies(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  const weight = profile.weight || null;
  const fatMin = weight ? Math.round(weight * 0.8) : 30;
  const fatMax = weight ? Math.round(weight * 1.2) : 180;

  const updateMacro = (key, value) => {
    if (!targetKcal) { setMacros(m => ({ ...m, [key]: value })); return; }
    setMacros(m => adjustMacros({ ...m, [key]: value }, key, targetKcal, weight));
  };

  const generate = async () => {
    if (selFoods.length < 3) { setError("Selecciona al menos 3 alimentos"); return; }
    setLoading(true); setError("");
    await new Promise(r => setTimeout(r, 200));
    try {
      const data = buildPlan({ macros, meals, mealNames, selFoods, refeedOn, refeedDays, refeedCarbs, refeedFat, shakeOn, shakeProt, shakeDays, priorities, postWorkoutMeal, planDays });
      setPlanData(data);
      setLocalEdits({});
      setSavedDays(new Set());
      save({ planData: data, planDays });
      setStep(3);
    } catch (e) { setError(e.message || "Error generando el plan"); }
    finally { setLoading(false); }
  };

  // ── Slider edit helpers ───────────────────────────────────────
  const eKey = (di, mi, id) => `${di}_${mi}_${id}`;
  const effG = (di, mi, item) => localEdits[eKey(di, mi, item.id)] ?? item.grams;
  const dayHasEdits = (di) => Object.keys(localEdits).some(k => k.startsWith(`${di}_`));

  const handleFoodSlider = (di, mi, changedItem, newG) => {
    const meal = planData.days[di].meals[mi];
    const oldG = localEdits[eKey(di, mi, changedItem.id)] ?? changedItem.grams;
    const pPer100 = changedItem.grams > 0 ? changedItem.p / changedItem.grams * 100 : 0;
    const deltaP = (newG - oldG) * pPer100 / 100;
    const next = { ...localEdits, [eKey(di, mi, changedItem.id)]: newG };
    if (Math.abs(deltaP) > 0.5) {
      const comp = meal.items
        .filter(it => it.id !== changedItem.id && it.grams > 0)
        .map(it => ({ ...it, pp: it.p / it.grams * 100 }))
        .filter(it => it.pp > 5)
        .sort((a, b) => b.pp - a.pp)[0];
      if (comp) {
        const compOld = localEdits[eKey(di, mi, comp.id)] ?? comp.grams;
        const sStep = comp.pp > 50 ? 5 : 25;
        const raw = compOld - deltaP / (comp.pp / 100);
        next[eKey(di, mi, comp.id)] = Math.max(15, Math.round(raw / sStep) * sStep);
      }
    }
    setLocalEdits(next);
    setSavedDays(s => { const n = new Set(s); n.delete(di); return n; });
  };

  const saveDayEdits = (di) => {
    if (!planData) return;
    const np = {
      ...planData,
      days: planData.days.map((d, idx) => {
        if (idx !== di) return d;
        const newMeals = d.meals.map((m, mi) => {
          const newItems = m.items.map(item => {
            const g = localEdits[eKey(di, mi, item.id)];
            if (g === undefined) return item;
            const pp = item.grams > 0 ? item.p / item.grams * 100 : 0;
            const cp = item.grams > 0 ? item.c / item.grams * 100 : 0;
            const fp = item.grams > 0 ? item.f / item.grams * 100 : 0;
            return { ...item, grams: g, p: +(g*pp/100).toFixed(1), c: +(g*cp/100).toFixed(1), f: +(g*fp/100).toFixed(1) };
          });
          const t = newItems.reduce((a, i) => ({ p: a.p+i.p, c: a.c+i.c, f: a.f+i.f }), { p:0,c:0,f:0 });
          t.kcal = Math.round(t.p*4+t.c*4+t.f*9); t.p = Math.round(t.p); t.c = Math.round(t.c); t.f = Math.round(t.f);
          return { ...m, items: newItems, totals: t };
        });
        const dt = newMeals.reduce((a,m) => ({ p:a.p+m.totals.p,c:a.c+m.totals.c,f:a.f+m.totals.f,kcal:a.kcal+m.totals.kcal }), { p:0,c:0,f:0,kcal:0 });
        return { ...d, meals: newMeals, totals: dt, fatGapG: Math.max(0, Math.round(d.target.grasas - dt.f)) };
      })
    };
    setPlanData(np);
    save({ planData: np });
    // Save today's nutrition to daily log
    const todayStr = new Date().toISOString().slice(0, 10);
    setState(s => ({
      ...s,
      daily: {
        ...s.daily,
        [todayStr]: {
          ...(s.daily[todayStr] || {}),
          nutrition: { meals: np.days[di].meals, totals: np.days[di].totals, savedAt: Date.now() }
        }
      }
    }));
    setLocalEdits(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`${di}_`))));
    setSavedDays(s => new Set([...s, di]));
  };

  const generatePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, ML = 14, MR = 14, CW = W - ML - MR;
    let y = 0;

    const checkPage = (need = 10) => { if (y + need > 282) { doc.addPage(); y = 16; } };

    const txt = (str, x, sz, bold = false, r = 30, g = 30, b = 30) => {
      doc.setFontSize(sz); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(r, g, b); doc.text(str, x, y);
    };

    // ── Header bar ──────────────────────────────────────────────
    doc.setFillColor(22, 101, 52); doc.rect(0, 0, W, 26, 'F');
    y = 10; txt('Plan de Nutricion', ML, 16, true, 255, 255, 255);
    y += 7; txt(`${macros.proteina}g Proteina  ${macros.carbos}g HC  ${macros.grasas}g Grasa  ${kcal} kcal/dia  |  ${planDays === 1 ? 'Plan de hoy' : planDays === 7 ? 'Plan semanal' : `${planDays} dias`}`, ML, 9, false, 187, 247, 208);
    y = 34;

    planData.days.forEach((d, di) => {
      checkPage(16);
      // Day header
      doc.setFillColor(230, 252, 238); doc.rect(ML, y - 5, CW, 8, 'F');
      doc.setDrawColor(74, 222, 128); doc.setLineWidth(0.6); doc.line(ML, y - 5, ML, y + 3);
      txt(`Dia ${di + 1} - ${d.dayName}${d.isRefeed ? '  (REFEED)' : ''}`, ML + 4, 10.5, true, 15, 80, 35);
      y += 8;
      if (d.hasShake) { checkPage(6); txt(`  Batido post-entreno: +${d.shakeProt}g proteina`, ML + 4, 8.5, false, 59, 130, 246); y += 5; }

      d.meals.forEach((m, mi) => {
        checkPage(10);
        txt(m.name, ML + 2, 10, true, 50, 50, 50); y += 5;

        m.items.forEach(it => {
          checkPage(6);
          const g = effG(di, mi, it);
          const pp = it.grams > 0 ? it.p / it.grams * 100 : 0;
          const cp = it.grams > 0 ? it.c / it.grams * 100 : 0;
          const fp = it.grams > 0 ? it.f / it.grams * 100 : 0;
          const qty = it.u ? (() => { const n = Math.max(1, Math.round(it.grams / it.u)); return `${n} ${it.uLabel || 'ud'}${n > 1 ? 's' : ''}`; })() : `${g}g`;
          txt(`  - ${it.name}`, ML + 4, 9, false, 60, 60, 60);
          txt(qty, ML + CW * 0.55, 9, true, 22, 120, 60);
          txt(`P${Math.round(g*pp/100)} C${Math.round(g*cp/100)} G${Math.round(g*fp/100)}`, ML + CW * 0.75, 9, false, 130, 130, 130);
          y += 5;
        });

        // Meal total
        checkPage(5);
        const mt = m.items.reduce((a, it) => {
          const g = effG(di, mi, it), pp = it.grams > 0 ? it.p/it.grams*100 : 0, cp = it.grams > 0 ? it.c/it.grams*100 : 0, fp = it.grams > 0 ? it.f/it.grams*100 : 0;
          return { p: a.p+g*pp/100, c: a.c+g*cp/100, f: a.f+g*fp/100 };
        }, { p:0,c:0,f:0 });
        mt.kcal = Math.round(mt.p*4+mt.c*4+mt.f*9);
        txt(`   Total: ${Math.round(mt.p)}g P  ${Math.round(mt.c)}g HC  ${Math.round(mt.f)}g G  ${mt.kcal} kcal`, ML + 4, 8, false, 100, 130, 100);
        y += 6;
      });

      // Day total bar
      checkPage(8);
      const dt = d.meals.reduce((acc, m, mi) => {
        const mt = m.items.reduce((a, it) => {
          const g = effG(di, mi, it), pp = it.grams > 0 ? it.p/it.grams*100 : 0, cp = it.grams > 0 ? it.c/it.grams*100 : 0, fp = it.grams > 0 ? it.f/it.grams*100 : 0;
          return { p: a.p+g*pp/100, c: a.c+g*cp/100, f: a.f+g*fp/100 };
        }, { p:0,c:0,f:0 });
        return { p: acc.p+mt.p, c: acc.c+mt.c, f: acc.f+mt.f };
      }, { p:0,c:0,f:0 });
      if (d.hasShake) dt.p += d.shakeProt;
      dt.kcal = Math.round(dt.p*4+dt.c*4+dt.f*9);
      doc.setFillColor(230, 252, 238); doc.rect(ML, y - 4, CW, 7, 'F');
      txt(`TOTAL DIA: ${Math.round(dt.p)}g P  ${Math.round(dt.c)}g HC  ${Math.round(dt.f)}g G  ${dt.kcal} kcal`, ML + 3, 9, true, 22, 101, 52);
      y += 10;

      const fGap = Math.max(0, Math.round(d.target.grasas - dt.f));
      if (fGap > 20) {
        checkPage(7); txt(`  Nota: faltan ~${fGap}g grasa (${Math.round(fGap*9)} kcal). Annade aceite, aguacate o frutos secos.`, ML + 2, 8, false, 180, 100, 0); y += 6;
      }
      y += 2;
    });

    doc.save('plan-nutricion.pdf');
  };

  // ── Render steps ──────────────────────────────────────────────

  const Header = () => (
    <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 10px", position: "sticky", top: 0, background: "#080d08", zIndex: 5, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#4ade80", letterSpacing: 2, fontWeight: 500 }}>NUTRICIÓN</span>
        <div style={{ display: "flex", gap: 4 }}>
          {STEPS.map((l, i) => (
            <div key={i} onClick={() => { if (i <= step || planData) setStep(i); }}
              style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, background: step >= i ? "#4ade80" : "rgba(255,255,255,0.06)", color: step >= i ? "#080d08" : "#475569", cursor: i <= step ? "pointer" : "default", transition: "all .3s" }}>
              {step > i ? "✓" : i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 0: Perfil
  if (step === 0) return (
    <div>
      <Header />
      <div style={{ padding: "16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Perfil metabólico</h1>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>Opcional. Calcula kcal y macros automáticamente.</p>

        <div style={{ ...C.card, borderColor: profile.enabled ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: profile.enabled ? "#4ade80" : "#94a3b8", fontSize: 12, fontWeight: 700, margin: "0 0 2px" }}>🎯 PERFIL INTELIGENTE</p>
            <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>Cálculo automático de kcal y macros</p>
          </div>
          <div onClick={() => setProfile(p => ({ ...p, enabled: !p.enabled }))}
            style={{ width: 44, height: 24, borderRadius: 12, background: profile.enabled ? "#16a34a" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: profile.enabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
          </div>
        </div>

        {profile.enabled && <>
          <div style={C.card}>
            <span style={C.lbl}>SEXO</span>
            <div style={{ display: "flex", gap: 8 }}>
              {[["h","Hombre"],["m","Mujer"]].map(([v, l]) => (
                <div key={v} onClick={() => setProfile(p => ({ ...p, sex: v }))}
                  style={{ flex: 1, border: `1px solid ${profile.sex === v ? "#4ade80" : "rgba(255,255,255,0.08)"}`, background: profile.sex === v ? "rgba(74,222,128,0.08)" : "transparent", borderRadius: 10, padding: "10px", cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 600, color: profile.sex === v ? "#4ade80" : "#94a3b8" }}>
                  {l}
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...C.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Edad","age","number"],["Altura (cm)","height","number"],["Peso (kg)","weight","number"],["% Grasa (opt)","bodyFat","number"]].map(([label, key, type]) => (
              <div key={key}>
                <span style={{ ...C.lbl, marginBottom: 6 }}>{label.toUpperCase()}</span>
                <input type={type} value={profile[key] || ""} placeholder={key === "bodyFat" ? "ej: 18" : ""}
                  onChange={e => setProfile(p => ({ ...p, [key]: e.target.value ? +e.target.value : null }))}
                  style={C.inp} step={key === "weight" ? "0.1" : "1"} />
              </div>
            ))}
          </div>

          <div style={C.card}>
            <span style={C.lbl}>ACTIVIDAD DIARIA</span>
            {Object.entries(ACTIVITY).map(([key, act]) => (
              <div key={key} onClick={() => setProfile(p => ({ ...p, activity: key }))}
                style={{ border: `1px solid ${profile.activity === key ? "#4ade80" : "rgba(255,255,255,0.08)"}`, background: profile.activity === key ? "rgba(74,222,128,0.06)" : "transparent", borderRadius: 10, padding: "10px 12px", cursor: "pointer", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: profile.activity === key ? "#4ade80" : "#cbd5e1" }}>{act.label}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{act.desc}</div>
                </div>
                <span style={{ fontSize: 10, color: "#475569", ...C.mono }}>×{act.mult}</span>
              </div>
            ))}
          </div>

          <div style={C.card}>
            <span style={C.lbl}>OBJETIVO</span>
            {Object.entries(GOALS).map(([key, g]) => (
              <div key={key} onClick={() => setProfile(p => ({ ...p, goal: key }))}
                style={{ border: `1px solid ${profile.goal === key ? g.color : "rgba(255,255,255,0.08)"}`, background: profile.goal === key ? g.color + "18" : "transparent", borderRadius: 10, padding: "10px 12px", cursor: "pointer", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: profile.goal === key ? g.color : "#cbd5e1" }}>{g.emoji} {g.label}</span>
              </div>
            ))}
          </div>

          {computed && (
            <div style={{ ...C.card, background: "rgba(74,222,128,0.05)", borderColor: "rgba(74,222,128,0.2)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, color: "#cbd5e1", marginBottom: 10 }}>
                <div>BMR: <strong style={{ color: "#4ade80" }}>{computed.bmr} kcal</strong></div>
                <div>TDEE: <strong style={{ color: "#4ade80" }}>{computed.tdee} kcal</strong></div>
                <div>Objetivo: <strong style={{ color: "#4ade80" }}>{computed.targetKcal} kcal</strong></div>
                <div>Fórmula: <strong style={{ color: "#4ade80" }}>{computed.formula.split("-")[0]}</strong></div>
              </div>
              <button onClick={() => { setMacros(computed.macros); setTargetKcal(computed.targetKcal); }}
                style={{ width: "100%", background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 10, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ✓ Aplicar estos macros
              </button>
            </div>
          )}
        </>}

        <button onClick={() => { save(); setStep(1); }} style={C.btnG}>
          {profile.enabled ? "Continuar →" : "Saltar al paso de alimentos →"}
        </button>
      </div>
    </div>
  );

  // Step 1: Alimentos
  if (step === 1) return (
    <div>
      <Header />
      <div style={{ padding: "16px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Tus alimentos</h1>
        <p style={{ color: "#475569", fontSize: 13, marginBottom: 12 }}>{selected.length} seleccionados de {FOODS.length}</p>

        <input style={C.inp} placeholder="🔍 Buscar alimento..." value={query} onChange={e => setQuery(e.target.value)} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "10px 0 12px", paddingBottom: 4 }}>
          {Object.entries(CATS).map(([key, label]) => (
            <button key={key} onClick={() => setCat(key)}
              style={{ ...C.tag, ...(catFilter === key ? C.tagOn : {}), flexShrink: 0 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
          {visible.map(food => {
            const on = selected.includes(food.id);
            const { direct, traces } = allergies.length ? foodAllergenMatch(food, allergies) : { direct: [], traces: [] };
            const hasAlert = direct.length > 0;
            const hasTrace = !hasAlert && traces.length > 0;
            return (
              <div key={food.id} onClick={() => toggle(food.id)}
                style={{ border: `1px solid ${hasAlert ? "rgba(239,68,68,0.5)" : on ? "#4ade80" : "rgba(255,255,255,0.06)"}`, background: hasAlert ? "rgba(239,68,68,0.06)" : on ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 8px", cursor: "pointer", textAlign: "center", position: "relative" }}>
                {hasAlert && <div style={{ position: "absolute", top: 4, right: 5, fontSize: 10 }}>⚠️</div>}
                {hasTrace && !hasAlert && <div style={{ position: "absolute", top: 4, right: 5, fontSize: 10 }}>⚡</div>}
                <div style={{ fontSize: 11, fontWeight: 600, color: hasAlert ? "#fca5a5" : on ? "#4ade80" : "#cbd5e1", lineHeight: 1.3, marginBottom: 4 }}>{food.name}</div>
                <div style={{ fontSize: 9, color: "#475569" }}>P<span style={{ color: "#86efac" }}>{food.p}</span> C<span style={{ color: "#93c5fd" }}>{food.c}</span> G<span style={{ color: "#fcd34d" }}>{food.f}</span></div>
                {hasAlert && <div style={{ fontSize: 8, color: "#f87171", marginTop: 3, fontWeight: 700 }}>{direct.slice(0, 2).join(", ")}</div>}
                {on && !hasAlert && <div style={{ color: "#4ade80", fontSize: 14, marginTop: 3, fontWeight: 800 }}>✓</div>}
              </div>
            );
          })}
        </div>

        {/* Selected foods panel */}
        {selFoods.length > 0 && (() => {
          const totP = selFoods.reduce((a, f) => a + f.p, 0);
          const totC = selFoods.reduce((a, f) => a + f.c, 0);
          const totF = selFoods.reduce((a, f) => a + f.f, 0);
          return (
            <div style={{ ...C.card, borderColor: "rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.04)", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ ...C.lbl, marginBottom: 0, color: "#4ade80" }}>✓ SELECCIONADOS ({selFoods.length})</span>
                <div style={{ display: "flex", gap: 10, fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                  <span style={{ color: "#86efac" }}>P{Math.round(totP)}</span>
                  <span style={{ color: "#93c5fd" }}>C{Math.round(totC)}</span>
                  <span style={{ color: "#fcd34d" }}>G{Math.round(totF)}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selFoods.map(f => (
                  <div key={f.id} onClick={() => toggle(f.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80" }}>{f.name.split(" ").slice(0, 3).join(" ")}</span>
                    <span style={{ fontSize: 9, color: "#64748b" }}>×</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div style={C.card}>
          <span style={C.lbl}>ALERGIAS E INTOLERANCIAS</span>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: ".06em", marginBottom: 6 }}>PRINCIPALES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALLERGIES_OPT.filter(a => a.group === "main").map(a => (
                <button key={a.id} onClick={() => toggleA(a.id)} style={{ ...C.tag, ...(allergies.includes(a.id) ? { ...C.tagOn, borderColor: "#f87171", background: "rgba(239,68,68,0.12)", color: "#f87171" } : {}) }}>{a.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: ".06em", marginBottom: 6 }}>FRUTOS SECOS (individualizar)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALLERGIES_OPT.filter(a => a.group === "nuts").map(a => (
                <button key={a.id} onClick={() => toggleA(a.id)} style={{ ...C.tag, ...(allergies.includes(a.id) ? { ...C.tagOn, borderColor: "#f87171", background: "rgba(239,68,68,0.12)", color: "#f87171" } : {}) }}>{a.label}</button>
              ))}
            </div>
          </div>
          {allergies.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(239,68,68,0.07)", borderRadius: 8, fontSize: 11, color: "#fca5a5" }}>
              ⚠️ Los alimentos marcados en rojo contienen alguno de tus alérgenos. Los marcados con ⚡ pueden tener trazas.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setStep(0)} style={{ ...C.btnS, flex: 1 }}>← Volver</button>
          <button onClick={() => { save(); setStep(2); }} disabled={selected.length < 3}
            style={{ ...C.btnG, flex: 2, opacity: selected.length < 3 ? .5 : 1 }}>
            {selected.length < 3 ? `Selecciona 3+ (${selected.length}/3)` : `Continuar →`}
          </button>
        </div>
      </div>
    </div>
  );

  // Step 2: Macros & plan settings
  if (step === 2) return (
    <div>
      <Header />
      <div style={{ padding: "16px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Macros y comidas</h1>
        <p style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>{targetKcal ? `Objetivo perfil: ${targetKcal} kcal/día` : "Ajusta manualmente"}</p>

        {[
          { key: "proteina", label: "Proteína", color: "#4ade80", min: 60, max: 300, emoji: "💪" },
          { key: "carbos",   label: "Carbos",   color: "#60a5fa", min: 50, max: 500, emoji: "⚡" },
          { key: "grasas",   label: "Grasas",   color: "#f59e0b", min: fatMin, max: Math.max(fatMax, 180), emoji: "🔥" },
        ].map(({ key, label, color, min, max, emoji }) => {
          const val = macros[key];
          const fatBelowMin = key === "grasas" && val < fatMin;
          const fatAboveMax = key === "grasas" && val > fatMax;
          const sliderColor = fatBelowMin ? "#f87171" : fatAboveMax ? "#fbbf24" : color;
          return (
            <div key={key} style={{ ...C.card, borderColor: fatBelowMin ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{emoji} {label}</span>
                <span style={{ ...C.mono, fontSize: 22, color: sliderColor, fontWeight: 700 }}>{val}<span style={{ fontSize: 11, color: "#475569" }}>g</span></span>
              </div>
              {key === "grasas" && weight && (
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>Mín. {fatMin}g <span style={{ color: "#64748b" }}>(0,8g/kg)</span></span>
                  <span>Recomendado {Math.round(weight)}g <span style={{ color: "#64748b" }}>(1g/kg)</span></span>
                  <span>Máx. {fatMax}g <span style={{ color: "#64748b" }}>(1,2g/kg)</span></span>
                </div>
              )}
              <input type="range" min={min} max={max} value={val} onChange={e => updateMacro(key, +e.target.value)} style={{ width: "100%", accentColor: sliderColor, color: sliderColor }} />
              {fatBelowMin && (
                <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(239,68,68,0.1)", borderRadius: 8, fontSize: 11, color: "#f87171", fontWeight: 600 }}>
                  ⚠️ Por debajo del mínimo recomendado ({fatMin}g para tu peso). Puede afectar a hormonas y absorción de vitaminas.
                </div>
              )}
              {fatAboveMax && (
                <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,0.08)", borderRadius: 8, fontSize: 11, color: "#fbbf24" }}>
                  💡 Por encima del máximo habitual para tu objetivo ({fatMax}g). Los carbos se ajustarán en consecuencia.
                </div>
              )}
            </div>
          );
        })}

        {/* Kcal total + diferencia respecto al objetivo */}
        {(() => {
          const diff = targetKcal ? kcal - targetKcal : 0;
          const ok = Math.abs(diff) <= 15;
          return (
            <div style={{ ...C.card, background: ok ? "rgba(74,222,128,0.035)" : "rgba(245,158,11,0.06)", borderColor: ok ? "rgba(74,222,128,0.12)" : "rgba(245,158,11,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: ok ? "#86efac" : "#fde68a" }}>⚡ Total estimado</span>
                <span style={{ ...C.mono, color: ok ? "#4ade80" : "#fbbf24", fontWeight: 700, fontSize: 20 }}>{kcal} <span style={{ fontSize: 12, color: "#64748b" }}>kcal/día</span></span>
              </div>
              {targetKcal && !ok && (
                <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 6 }}>
                  {diff > 0 ? `+${diff}` : diff} kcal respecto al objetivo ({targetKcal} kcal) · Mueve un slider para rebalancear
                </div>
              )}
              {targetKcal && ok && (
                <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>✓ Ajustado al objetivo de {targetKcal} kcal</div>
              )}
            </div>
          );
        })()}

        {/* Días descanso */}
        <div style={C.card}>
          <span style={C.lbl}>DÍAS DESCANSO (ajuste automático)</span>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 0 }}>Los días que no entrenes: −25% carbos · +25% grasas. Se aplica desde la pantalla Hoy.</p>
        </div>

        {/* Nº comidas */}
        <div style={C.card}>
          <span style={C.lbl}>COMIDAS AL DÍA</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
            {[1,2,3,4,5,6].map(n => (
              <div key={n} onClick={() => setMeals(n)}
                style={{ border: `1px solid ${meals === n ? "#4ade80" : "rgba(255,255,255,0.08)"}`, background: meals === n ? "rgba(74,222,128,0.1)" : "transparent", borderRadius: 9, padding: "9px 4px", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: meals === n ? "#4ade80" : "#475569" }}>{n}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#4ade80", textAlign: "center", marginTop: 8 }}>{mealNames.join(" · ")}</div>
        </div>

        {/* Nº días */}
        <div style={C.card}>
          <span style={C.lbl}>DÍAS DEL PLAN</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
            {[1,2,3,4,5,6,7].map(n => (
              <div key={n} onClick={() => setPlanDays(n)}
                style={{ border: `1px solid ${planDays === n ? "#a78bfa" : "rgba(255,255,255,0.08)"}`, background: planDays === n ? "rgba(167,139,250,0.12)" : "transparent", borderRadius: 9, padding: "9px 3px", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: planDays === n ? "#a78bfa" : "#475569" }}>{n}</div>
                <div style={{ fontSize: 8, color: planDays === n ? "#c4b5fd" : "#334155", marginTop: 2 }}>{n === 1 ? "día" : "días"}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#a78bfa", textAlign: "center", marginTop: 8 }}>
            {planDays === 1 ? "Plan de un solo día · ideal para planificar hoy" : planDays <= 3 ? `${planDays} días · planificación corta` : planDays === 7 ? "Semana completa" : `${planDays} días`}
          </div>
        </div>

        {/* Shake */}
        <div style={{ ...C.card, borderColor: shakeOn ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: shakeOn ? "#60a5fa" : "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 2px" }}>🥤 BATIDO PROTEICO POST-ENTRENO</p>
              <p style={{ color: "#475569", fontSize: 10, margin: 0 }}>Se descuenta de la proteína del día</p>
            </div>
            <div onClick={() => setShakeOn(v => !v)}
              style={{ width: 44, height: 24, borderRadius: 12, background: shakeOn ? "#3b82f6" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: shakeOn ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </div>
          </div>
          {shakeOn && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Proteína por batido</span>
                <span style={{ ...C.mono, fontSize: 16, color: "#60a5fa", fontWeight: 700 }}>{shakeProt}g</span>
              </div>
              <input type="range" min={15} max={50} value={shakeProt} onChange={e => setShakeProt(+e.target.value)} style={{ width: "100%", accentColor: "#3b82f6", color: "#3b82f6" }} />
              <div style={{ marginTop: 10 }}>
                <p style={{ color: "#3b82f6", fontSize: 10, fontWeight: 700, margin: "0 0 6px" }}>DÍAS QUE TOMAS BATIDO</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                  {DAYS.map((d, i) => {
                    const on = shakeDays.includes(i);
                    return <div key={i} onClick={() => setShakeDays(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])}
                      style={{ border: `1px solid ${on ? "#3b82f6" : "rgba(255,255,255,0.08)"}`, background: on ? "rgba(59,130,246,0.15)" : "transparent", borderRadius: 8, padding: "7px 2px", cursor: "pointer", textAlign: "center", fontSize: 11, fontWeight: 700, color: on ? "#60a5fa" : "#64748b" }}>
                      {d.slice(0, 3)}
                    </div>;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setStep(1)} style={{ ...C.btnS, flex: 1 }}>← Volver</button>
          <button onClick={generate} disabled={loading}
            style={{ ...C.btnG, flex: 2, opacity: loading ? .7 : 1 }}>
            {loading ? "⏳ Generando..." : "✨ Generar Plan"}
          </button>
        </div>
        {error && <div style={{ marginTop: 10, padding: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#fca5a5", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );

  // Step 3: Plan
  return (
    <div>
      <Header />
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: "0 0 2px" }}>
              {planDays === 1 ? "Tu plan de hoy" : planDays === 7 ? "Tu plan semanal" : `Tu plan de ${planDays} días`}
            </h1>
            <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>{macros.proteina}g P · {macros.carbos}g HC · {macros.grasas}g G · {meals} comidas</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={generatePDF}
              style={{ ...C.btnS, fontSize: 10, padding: "6px 10px", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
              📄 PDF
            </button>
            <button onClick={() => { setStep(1); setPlanData(null); save({ planData: null }); }}
              style={{ ...C.btnS, fontSize: 10, padding: "6px 10px" }}>Nuevo plan</button>
          </div>
        </div>

        {/* Tabs: plan / shopping */}
        <div style={{ display: "flex", gap: 0, marginBottom: 14, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4 }}>
          {[["plan","📅 Plan"], ["shopping","🛒 Compra"]].map(([id, label]) => (
            <button key={id} onClick={() => setViewTab(id)}
              style={{ flex: 1, padding: "9px 8px", border: "none", borderRadius: 9, background: viewTab === id ? "rgba(74,222,128,0.15)" : "transparent", color: viewTab === id ? "#4ade80" : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
              {label}
            </button>
          ))}
        </div>

        {viewTab === "shopping" && planData && <ShoppingList planData={planData} />}

        {viewTab === "plan" && planData && (
          <>
            <button onClick={generate} disabled={loading}
              style={{ ...C.btnS, width: "100%", marginBottom: 14, fontSize: 12 }}>
              🔄 Regenerar plan
            </button>

            {/* Feature 7: Nutrición periódica — daily adjustment banner */}
            {(() => {
              const todayKey = new Date().toISOString().slice(0, 10);
              const todayLog = state.daily?.[todayKey] || {};
              const isTrain = !!todayLog.trained;
              const isRest  = todayLog.trained === false;
              if (!isTrain && !isRest) return null;
              const adj = saved.restDayAdjust || { carbsMult: 0.75, fatMult: 1.25 };
              const carbDelta = isRest ? Math.round(macros.carbos * (adj.carbsMult - 1)) : 0;
              const fatDelta  = isRest ? Math.round(macros.grasas  * (adj.fatMult  - 1)) : 0;
              const kcalWatch = todayLog.watchKcal || todayLog.training?.kcal || 0;
              const extraHC   = kcalWatch > 0 ? Math.round(kcalWatch / 4) : 0;
              return (
                <TrainDayBanner
                  isTrain={isTrain}
                  isRest={isRest}
                  kcalWatch={kcalWatch}
                  extraHC={extraHC}
                  carbDelta={carbDelta}
                  fatDelta={fatDelta}
                  carbsMult={adj.carbsMult}
                  fatMult={adj.fatMult}
                  sessionName={todayLog.training?.name || ""}
                  onSaveKcal={(v) => {
                    setTodayLog({ watchKcal: v });
                    setState(s => ({ ...s, daily: { ...s.daily, [todayKey]: { ...(s.daily[todayKey] || {}), watchKcal: v, training: { ...(s.daily[todayKey]?.training || {}), kcal: v } } } }));
                  }}
                />
              );
            })()}

            {planData.days.map((d, di) => (
              <div key={di} style={{ marginBottom: 20 }}>
                <div style={{ background: d.isRefeed ? "rgba(245,158,11,0.1)" : "rgba(74,222,128,0.07)", borderLeft: `3px solid ${d.isRefeed ? "#f59e0b" : "#4ade80"}`, borderRadius: "0 8px 8px 0", padding: "8px 12px", marginBottom: 8, color: d.isRefeed ? "#fbbf24" : "#4ade80", fontSize: 13, fontWeight: 700 }}>
                  📅 Día {di + 1} — {d.dayName}{d.isRefeed ? " 💥 REFEED" : ""}
                </div>

                {d.hasShake && (
                  <div style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "6px 11px", marginBottom: 8, fontSize: 11, color: "#93c5fd" }}>
                    🥤 Batido post-entreno: <strong style={{ color: "#60a5fa" }}>{d.shakeProt}g proteína</strong>
                  </div>
                )}

                {d.meals.map((m, mi) => (
                  <div key={mi} style={{ ...C.card, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ color: m.isPostWorkout ? "#c084fc" : "#a3e635", fontWeight: 700, fontSize: 13 }}>
                        {m.name}{m.isPostWorkout ? " 🏋️" : ""}
                      </span>
                      <button onClick={() => setRecipe({ mealName: m.name, items: m.items })}
                        style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#4ade80", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                        🍳 Receta
                      </button>
                    </div>

                    {m.items.map((it, ii) => {
                      const food = FOODS.find(f => f.id === it.id);
                      const { direct: da, traces: ta } = food && allergies.length ? foodAllergenMatch(food, allergies) : { direct: [], traces: [] };
                      const hasSlider = !it.u && it.grams > 0;
                      const g = effG(di, mi, it);
                      const isEdited = g !== it.grams;
                      const pp = it.grams > 0 ? it.p / it.grams * 100 : 0;
                      const cp = it.grams > 0 ? it.c / it.grams * 100 : 0;
                      const fp = it.grams > 0 ? it.f / it.grams * 100 : 0;
                      const adjP = g * pp / 100, adjC = g * cp / 100, adjF = g * fp / 100;
                      const sMin = pp > 50 ? 15 : 50;
                      const sMax = pp > 50 ? 80 : (it.cat === "postreprot" || it.cat === "lacteos" ? 1000 : 700);
                      const sStep = pp > 50 ? 5 : 25;
                      const qty = it.u
                        ? (() => { const n = Math.max(1, Math.round(it.grams / it.u)); return `${n} ${it.uLabel || "ud"}${n > 1 ? "s" : ""}`; })()
                        : `${g}g`;
                      return (
                        <div key={ii}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0 1px 8px", fontSize: 12 }}>
                            <span style={{ color: da.length ? "#fca5a5" : "#cbd5e1" }}>• {it.name} — <strong style={{ color: da.length ? "#f87171" : isEdited ? "#c084fc" : "#e2e8f0" }}>{qty}</strong></span>
                            <span style={{ fontSize: 10, color: "#475569" }}>P{Math.round(adjP)} C{Math.round(adjC)} G{Math.round(adjF)}</span>
                          </div>
                          {hasSlider && (
                            <div style={{ paddingLeft: 14, paddingRight: 4, paddingBottom: 4 }}>
                              <input type="range" min={sMin} max={sMax} step={sStep} value={g}
                                onChange={e => handleFoodSlider(di, mi, it, +e.target.value)}
                                style={{ width: "100%", accentColor: isEdited ? "#c084fc" : "#4ade80", cursor: "pointer", height: 4 }}
                              />
                            </div>
                          )}
                          {da.length > 0 && (
                            <div style={{ margin: "2px 8px 4px", padding: "4px 8px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontSize: 10, color: "#f87171", fontWeight: 700 }}>
                              🚨 CONTIENE: {da.join(", ").toUpperCase()}
                            </div>
                          )}
                          {ta.length > 0 && !da.length && (
                            <div style={{ margin: "2px 8px 4px", padding: "4px 8px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>
                              ⚡ Puede contener trazas de: {ta.join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(() => {
                      const t = m.items.reduce((a, it) => {
                        const g = effG(di, mi, it);
                        const pp = it.grams > 0 ? it.p / it.grams * 100 : 0;
                        const cp = it.grams > 0 ? it.c / it.grams * 100 : 0;
                        const fp = it.grams > 0 ? it.f / it.grams * 100 : 0;
                        return { p: a.p + g*pp/100, c: a.c + g*cp/100, f: a.f + g*fp/100 };
                      }, { p:0, c:0, f:0 });
                      t.kcal = Math.round(t.p*4 + t.c*4 + t.f*9);
                      return (
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          {Math.round(t.p)}g P · {Math.round(t.c)}g HC · {Math.round(t.f)}g G · {t.kcal} kcal
                        </div>
                      );
                    })()}
                  </div>
                ))}

                {(() => {
                  const dt = d.meals.reduce((acc, m, mi) => {
                    const mt = m.items.reduce((a, it) => {
                      const g = effG(di, mi, it);
                      const pp = it.grams > 0 ? it.p / it.grams * 100 : 0;
                      const cp = it.grams > 0 ? it.c / it.grams * 100 : 0;
                      const fp = it.grams > 0 ? it.f / it.grams * 100 : 0;
                      return { p: a.p+g*pp/100, c: a.c+g*cp/100, f: a.f+g*fp/100 };
                    }, { p:0,c:0,f:0 });
                    return { p: acc.p+mt.p, c: acc.c+mt.c, f: acc.f+mt.f };
                  }, { p:0,c:0,f:0 });
                  if (d.hasShake) dt.p += d.shakeProt;
                  dt.kcal = Math.round(dt.p*4 + dt.c*4 + dt.f*9);
                  const fGap = Math.max(0, Math.round(d.target.grasas - dt.f));
                  return (<>
                    <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#86efac", fontWeight: 600 }}>
                      📊 TOTAL: {Math.round(dt.p)}g P · {Math.round(dt.c)}g HC · {Math.round(dt.f)}g G · {dt.kcal} kcal
                    </div>
                    {fGap > 20 && (
                      <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: 10, marginTop: 8, fontSize: 12, color: "#fbbf24", lineHeight: 1.5 }}>
                        ⚠️ Faltan ~{fGap}g de grasa ({Math.round(fGap * 9)} kcal) para llegar a tu objetivo calórico. Añade a tus alimentos: aceite de oliva, aguacate o frutos secos.
                      </div>
                    )}
                  </>);
                })()}
                <button onClick={() => saveDayEdits(di)} style={{ marginTop: 10, width: "100%", background: savedDays.has(di) && !dayHasEdits(di) ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.13)", border: `1px solid ${savedDays.has(di) && !dayHasEdits(di) ? "rgba(74,222,128,0.2)" : "rgba(74,222,128,0.35)"}`, borderRadius: 10, padding: "10px", fontSize: 12, color: savedDays.has(di) && !dayHasEdits(di) ? "#4ade80" : "#86efac", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  {savedDays.has(di) && !dayHasEdits(di) ? "✓ Guardado" : dayHasEdits(di) ? "💾 Guardar cambios" : "💾 Guardar día"}
                </button>
              </div>
            ))}
          </>
        )}

        {!planData && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "#475569", fontSize: 14 }}>No hay plan generado.</p>
            <button onClick={() => setStep(2)} style={{ ...C.btnG, marginTop: 14 }}>Generar plan →</button>
          </div>
        )}
      </div>

      {recipe && <RecipeModal mealName={recipe.mealName} items={recipe.items} onClose={() => setRecipe(null)} />}
    </div>
  );
}
