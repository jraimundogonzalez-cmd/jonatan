import { useState } from "react";
import { useApp } from "../store/AppContext";
import { computeProfile } from "../utils/nutrition";
import { GOALS, ACTIVITY } from "../data/foods";
import ScrollPicker from "../components/ScrollPicker";

const TOTAL_STEPS = 6; // 0-5 (0=welcome counts as step 0 before progress bar)

const btn = (primary = true) => ({
  width: "100%", padding: "16px", border: "none", borderRadius: 16,
  fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer",
  background: primary ? "#4ade80" : "rgba(255,255,255,0.07)",
  color: primary ? "#000" : "#94a3b8",
});

const DAYS_ES = [
  { key: "lunes",     label: "Lunes",     short: "L" },
  { key: "martes",    label: "Martes",    short: "M" },
  { key: "miercoles", label: "Miércoles", short: "X" },
  { key: "jueves",    label: "Jueves",    short: "J" },
  { key: "viernes",   label: "Viernes",   short: "V" },
  { key: "sabado",    label: "Sábado",    short: "S" },
  { key: "domingo",   label: "Domingo",   short: "D" },
];

export default function Onboarding({ onDone }) {
  const { setState } = useApp();
  const [step, setStep] = useState(0);

  // Collected data
  const [name, setName]         = useState("");
  const [sex, setSex]           = useState("h");
  const [goal, setGoal]         = useState("definicion");
  const [activity, setActivity] = useState("moderada");
  const [weight, setWeight]     = useState(80);
  const [height, setHeight]     = useState(175);
  const [age, setAge]           = useState(28);
  const [remDays, setRemDays]   = useState({ lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false, domingo: false });
  const [remTime, setRemTime]   = useState("18:30");

  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const toggleDay = (key) => setRemDays(d => ({ ...d, [key]: !d[key] }));

  const finish = () => {
    const profile = { enabled: true, name: name.trim() || "Usuario", sex, age, height, weight, bodyFat: null, activity, goal };
    const computed = computeProfile(profile);
    setState(s => ({
      ...s,
      setupDone: true,
      profile,
      nutrition: {
        ...s.nutrition,
        macros: computed.macros,
        targetKcal: computed.targetKcal,
      },
      reminders: {
        days: remDays,
        time: remTime,
      },
    }));
    onDone();
  };

  const progress = step === 0 ? 0 : (step / TOTAL_STEPS) * 100;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#080d08", zIndex: 1000,
      display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto",
      padding: "0 24px", paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* Progress bar */}
      {step > 0 && (
        <div style={{ paddingTop: 16, paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            {step > 1 && (
              <button onClick={back} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>
            )}
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#4ade80", borderRadius: 4, transition: "width .4s ease" }} />
            </div>
            <button onClick={finish} style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Saltar</button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>

        {/* STEP 0: Welcome */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 20 }}>🏋️</div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#f1f5f9", margin: "0 0 12px", lineHeight: 1.2 }}>
              Tu entrenamiento.<br />Tu nutrición.<br /><span style={{ color: "#4ade80" }}>Todo en uno.</span>
            </h1>
            <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, margin: "0 0 40px" }}>
              Configuremos tu perfil en 2 minutos para darte un plan personalizado.
            </p>
            <button onClick={next} style={{ ...btn(), fontSize: 16, padding: "18px" }}>
              Empezar →
            </button>
            <button onClick={finish} style={{ ...btn(false), marginTop: 10 }}>
              Ya tengo datos, saltar
            </button>
          </div>
        )}

        {/* STEP 1: Name */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 1 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>¿Cómo te llamas?</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Solo para personalizar la app.</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && next()}
              placeholder="Tu nombre"
              autoFocus
              style={{
                width: "100%", padding: "18px 16px", fontSize: 20, fontWeight: 600,
                background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: 14, color: "#e2e8f0", outline: "none", fontFamily: "inherit",
                boxSizing: "border-box", marginBottom: 24,
              }}
            />
            <button onClick={next} style={btn()}>Siguiente →</button>
          </div>
        )}

        {/* STEP 2: Gender */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 2 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>¿Cuál es tu género?</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Afecta al cálculo de tus macros.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              {[{ v: "h", emoji: "♂️", label: "Hombre" }, { v: "m", emoji: "♀️", label: "Mujer" }].map(({ v, emoji, label }) => (
                <button key={v} onClick={() => { setSex(v); setTimeout(next, 220); }}
                  style={{
                    padding: "28px 16px", borderRadius: 18, border: `2px solid ${sex === v ? "#4ade80" : "rgba(255,255,255,0.08)"}`,
                    background: sex === v ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.03)",
                    color: sex === v ? "#4ade80" : "#94a3b8", fontFamily: "inherit", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                    transition: "all .2s",
                  }}>
                  <span style={{ fontSize: 40 }}>{emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Goal */}
        {step === 3 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 3 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>¿Cuál es tu objetivo?</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Define tu plan de nutrición.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {Object.entries(GOALS).map(([key, g]) => (
                <button key={key} onClick={() => { setGoal(key); setTimeout(next, 220); }}
                  style={{
                    padding: "16px 18px", borderRadius: 14, border: `2px solid ${goal === key ? g.color : "rgba(255,255,255,0.08)"}`,
                    background: goal === key ? `${g.color}18` : "rgba(255,255,255,0.03)",
                    color: goal === key ? g.color : "#94a3b8", fontFamily: "inherit", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                    transition: "all .2s",
                  }}>
                  <span style={{ fontSize: 24 }}>{g.emoji}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: goal === key ? g.color : "#e2e8f0" }}>{g.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {key === "definicion" ? "Mantener músculo, reducir grasa" : key === "perder" ? "Déficit calórico intenso" : key === "mantener" ? "Calorías de mantenimiento" : "Superávit moderado"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: Stats — weight picker + height + age */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 4 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>Tus medidas</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>Para calcular tus macros exactos.</p>

            {/* Weight scroll picker */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Peso</div>
              <ScrollPicker min={40} max={180} value={weight} onChange={setWeight} unit="kg" />
            </div>

            {/* Height + Age in a row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Altura</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <input type="number" value={height} onChange={e => setHeight(+e.target.value || 175)} min="140" max="220"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 700, color: "#e2e8f0", width: "100%", textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: "#64748b" }}>cm</span>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Edad</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <input type="number" value={age} onChange={e => setAge(+e.target.value || 25)} min="14" max="80"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 700, color: "#e2e8f0", width: "100%", textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: "#64748b" }}>años</span>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Nivel de actividad</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(ACTIVITY).map(([key, a]) => (
                  <button key={key} onClick={() => setActivity(key)}
                    style={{
                      padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${activity === key ? "#4ade80" : "rgba(255,255,255,0.07)"}`,
                      background: activity === key ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.02)",
                      color: "#e2e8f0", fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: activity === key ? "#4ade80" : "#e2e8f0" }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{a.desc}</div>
                    </div>
                    {activity === key && <span style={{ color: "#4ade80" }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={next} style={btn()}>Siguiente →</button>
          </div>
        )}

        {/* STEP 5: Reminders */}
        {step === 5 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 5 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>Recordatorios</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>¿Qué días quieres que te avisemos para entrenar?</p>

            {/* Days grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 20 }}>
              {DAYS_ES.map(({ key, short }) => (
                <button key={key} onClick={() => toggleDay(key)}
                  style={{
                    aspectRatio: "1", borderRadius: 12, border: `1.5px solid ${remDays[key] ? "#4ade80" : "rgba(255,255,255,0.1)"}`,
                    background: remDays[key] ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)",
                    color: remDays[key] ? "#4ade80" : "#64748b", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                  {short}
                </button>
              ))}
            </div>

            {/* Time picker */}
            {Object.values(remDays).some(Boolean) && (
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Hora</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <input type="time" value={remTime} onChange={e => setRemTime(e.target.value)}
                    style={{ background: "transparent", border: "none", outline: "none", fontFamily: "'DM Mono',monospace", fontSize: 36, fontWeight: 700, color: "#e2e8f0", cursor: "pointer" }} />
                </div>
              </div>
            )}

            <button onClick={next} style={btn()}>Siguiente →</button>
            <button onClick={next} style={{ ...btn(false), marginTop: 10 }}>Sin recordatorios</button>
          </div>
        )}

        {/* STEP 6: Done */}
        {step === 6 && (() => {
          const profile = { enabled: true, name: name.trim() || "Usuario", sex, age, height, weight, bodyFat: null, activity, goal };
          const computed = computeProfile(profile);
          const g = GOALS[goal];
          return (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>
                ¡Listo{name.trim() ? `, ${name.split(" ")[0]}` : ""}!
              </h2>
              <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>Tu plan está calculado.</p>

              {/* Macro summary */}
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "20px", marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 11, color: g.color, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>{g.emoji} {g.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#4ade80", fontFamily: "'DM Mono',monospace" }}>{computed.macros.proteina}g</div><div style={{ fontSize: 11, color: "#64748b" }}>Proteína</div></div>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#60a5fa", fontFamily: "'DM Mono',monospace" }}>{computed.macros.carbos}g</div><div style={{ fontSize: 11, color: "#64748b" }}>Carbos</div></div>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{computed.macros.grasas}g</div><div style={{ fontSize: 11, color: "#64748b" }}>Grasas</div></div>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#e2e8f0", fontFamily: "'DM Mono',monospace" }}>{computed.targetKcal}</div><div style={{ fontSize: 11, color: "#64748b" }}>kcal/día</div></div>
                </div>
              </div>

              <button onClick={finish} style={{ ...btn(), fontSize: 16, padding: "18px" }}>
                Ir a mi plan →
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
