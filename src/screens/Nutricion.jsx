import { useState, useMemo, useEffect } from "react";
import { useApp } from "../store/AppContext";
import { FOODS, CATS, ALLERGIES_OPT, MEALS_NAMES, DAYS, GOALS, ACTIVITY } from "../data/foods";
import { computeProfile, adjustMacros, buildPlan, buildShoppingList, generateRecipe } from "../utils/nutrition";

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

function RecipeModal({ mealName, items, onClose }) {
  const recipe = useMemo(() => generateRecipe(mealName, items), [mealName, items]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end", padding: "0" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0f1a12", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>{mealName} · Receta rápida</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0, lineHeight: 1.3 }}>{recipe.name}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <span style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>⏱ {recipe.time} min</span>
          <span style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{recipe.diff}</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>INGREDIENTES</div>
          {recipe.ingredients.map((ing, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#cbd5e1" }}>
              <span style={{ color: "#4ade80", fontWeight: 700, flexShrink: 0 }}>•</span>
              {ing}
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
  const { state, setState } = useApp();
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
  const updateMacro = (key, value) => {
    if (!targetKcal || key === "carbos") { setMacros(m => ({ ...m, [key]: value })); return; }
    setMacros(m => adjustMacros({ ...m, [key]: value }, key, targetKcal));
  };

  const generate = async () => {
    if (selFoods.length < 3) { setError("Selecciona al menos 3 alimentos"); return; }
    setLoading(true); setError("");
    await new Promise(r => setTimeout(r, 200));
    try {
      const data = buildPlan({ macros, meals, mealNames, selFoods, refeedOn, refeedDays, refeedCarbs, refeedFat, shakeOn, shakeProt, shakeDays, priorities, postWorkoutMeal, planDays });
      setPlanData(data);
      save({ planData: data, planDays });
      setStep(3);
    } catch (e) { setError(e.message || "Error generando el plan"); }
    finally { setLoading(false); }
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
            return (
              <div key={food.id} onClick={() => toggle(food.id)}
                style={{ border: `1px solid ${on ? "#4ade80" : "rgba(255,255,255,0.06)"}`, background: on ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 8px", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: on ? "#4ade80" : "#cbd5e1", lineHeight: 1.3, marginBottom: 4 }}>{food.name}</div>
                <div style={{ fontSize: 9, color: "#475569" }}>P<span style={{ color: "#86efac" }}>{food.p}</span> C<span style={{ color: "#93c5fd" }}>{food.c}</span> G<span style={{ color: "#fcd34d" }}>{food.f}</span></div>
                {on && <div style={{ color: "#4ade80", fontSize: 14, marginTop: 3, fontWeight: 800 }}>✓</div>}
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
          <span style={C.lbl}>RESTRICCIONES</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALLERGIES_OPT.map(a => (
              <button key={a.id} onClick={() => toggleA(a.id)} style={{ ...C.tag, ...(allergies.includes(a.id) ? C.tagOn : {}) }}>{a.label}</button>
            ))}
          </div>
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
          { key: "grasas",   label: "Grasas",   color: "#f59e0b", min: 30, max: 200, emoji: "🔥" },
        ].map(({ key, label, color, min, max, emoji }) => (
          <div key={key} style={C.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>{emoji} {label}</span>
              <span style={{ ...C.mono, fontSize: 22, color, fontWeight: 700 }}>{macros[key]}<span style={{ fontSize: 11, color: "#475569" }}>g</span></span>
            </div>
            <input type="range" min={min} max={max} value={macros[key]} onChange={e => updateMacro(key, +e.target.value)} style={{ width: "100%", accentColor: color, color }} />
          </div>
        ))}

        <div style={{ ...C.card, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(74,222,128,0.035)", borderColor: "rgba(74,222,128,0.12)" }}>
          <span style={{ fontSize: 12, color: "#86efac" }}>⚡ Total estimado</span>
          <span style={{ ...C.mono, color: "#4ade80", fontWeight: 700, fontSize: 20 }}>{kcal} <span style={{ fontSize: 12, color: "#64748b" }}>kcal/día</span></span>
        </div>

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
          <button onClick={() => { setStep(1); setPlanData(null); save({ planData: null }); }}
            style={{ ...C.btnS, fontSize: 10, padding: "6px 10px" }}>Nuevo plan</button>
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
                      const qty = it.u
                        ? (() => { const n = Math.max(1, Math.round(it.grams / it.u)); return `${n} ${it.uLabel || "ud"}${n > 1 ? "s" : ""}`; })()
                        : `${it.grams}g`;
                      return (
                        <div key={ii} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 4px 8px", fontSize: 12 }}>
                          <span style={{ color: "#cbd5e1" }}>• {it.name} — <strong style={{ color: "#e2e8f0" }}>{qty}</strong></span>
                          <span style={{ fontSize: 10, color: "#475569" }}>P{Math.round(it.p)} C{Math.round(it.c)} G{Math.round(it.f)}</span>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      {Math.round(m.totals.p)}g P · {Math.round(m.totals.c)}g HC · {Math.round(m.totals.f)}g G · {m.totals.kcal} kcal
                    </div>
                  </div>
                ))}

                <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#86efac", fontWeight: 600 }}>
                  📊 TOTAL: {Math.round(d.totals.p)}g P · {Math.round(d.totals.c)}g HC · {Math.round(d.totals.f)}g G · {d.totals.kcal} kcal
                </div>
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
