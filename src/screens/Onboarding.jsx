import { useState } from "react";
import { useApp } from "../store/AppContext";
import { computeProfile } from "../utils/nutrition";
import { buildSchedule } from "../utils/training";
import { HOME_DEFAULT, GYM_DEFAULT } from "../utils/ai";
import { GOALS, ACTIVITY } from "../data/foods";
import ScrollPicker from "../components/ScrollPicker";

const TOTAL_STEPS = 9;

const btn = (primary = true) => ({
  width: "100%", padding: "16px", border: "none", borderRadius: 16,
  fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer",
  background: primary ? "#4ade80" : "rgba(255,255,255,0.07)",
  color: primary ? "#000" : "#94a3b8",
});

const DAYS_ES = [
  { key: "lunes",     short: "L" },
  { key: "martes",    short: "M" },
  { key: "miercoles", short: "X" },
  { key: "jueves",    short: "J" },
  { key: "viernes",   short: "V" },
  { key: "sabado",    short: "S" },
  { key: "domingo",   short: "D" },
];

// Maps nutrition goal → training repScheme goal
const GOAL_TO_TRAINING = { definicion: "musculo", ganar: "musculo", mantener: "musculo", perder: "grasa" };

export default function Onboarding({ onDone }) {
  const { setState } = useApp();
  const [step, setStep] = useState(0);

  // Profile data
  const [name, setName]         = useState("");
  const [sex, setSex]           = useState("h");
  const [goal, setGoal]         = useState("definicion");
  const [activity, setActivity] = useState("moderada");
  const [weight, setWeight]     = useState(80);
  const [height, setHeight]     = useState(175);
  const [age, setAge]           = useState(28);

  // Training config
  const [place, setPlace]           = useState("gym");
  const [trainingDays, setTrainingDays] = useState(4);
  const [trainingTime, setTrainingTime] = useState(60);
  const [level, setLevel]           = useState("inter");

  // Reminders
  const [remDays, setRemDays] = useState({ lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false, domingo: false });
  const [remTime, setRemTime] = useState("18:30");

  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep(s => Math.max(s - 1, 0));
  const toggleDay = (key) => setRemDays(d => ({ ...d, [key]: !d[key] }));

  const finish = () => {
    const profile = {
      enabled: true, name: name.trim() || "Usuario",
      sex, age: parseInt(age) || 28, height: parseInt(height) || 175,
      weight, bodyFat: null, activity, goal,
    };
    const computed = computeProfile(profile);
    const equipment = place === "casa" ? HOME_DEFAULT : GYM_DEFAULT;
    const trainingSchedule = buildSchedule({
      goal: GOAL_TO_TRAINING[goal] || "musculo",
      days: trainingDays,
      time: trainingTime,
      level,
      place,
      equipment,
    });
    setState(s => ({
      ...s,
      setupDone: true,
      profile,
      nutrition: { ...s.nutrition, macros: computed.macros, targetKcal: computed.targetKcal },
      training: { ...trainingSchedule, equipment },
      reminders: { days: remDays, time: remTime },
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>

        {/* STEP 0: Welcome */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 20 }}>🏋️</div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#f1f5f9", margin: "0 0 12px", lineHeight: 1.2 }}>
              Tu entrenamiento.<br />Tu nutrición.<br /><span style={{ color: "#4ade80" }}>Todo en uno.</span>
            </h1>
            <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, margin: "0 0 40px" }}>
              Configuremos tu perfil para darte un plan personalizado a nivel de preparación para competir.
            </p>
            <button onClick={next} style={{ ...btn(), fontSize: 16, padding: "18px" }}>Empezar →</button>
            <button onClick={finish} style={{ ...btn(false), marginTop: 10 }}>Ya tengo datos, saltar</button>
          </div>
        )}

        {/* STEP 1: Name */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 1 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>¿Cómo te llamas?</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Solo para personalizar la app.</p>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && next()}
              placeholder="Tu nombre" autoFocus
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
                    padding: "28px 16px", borderRadius: 18,
                    border: `2px solid ${sex === v ? "#4ade80" : "rgba(255,255,255,0.08)"}`,
                    background: sex === v ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.03)",
                    color: sex === v ? "#4ade80" : "#94a3b8", fontFamily: "inherit", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all .2s",
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
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Define tu plan de nutrición y entrenamiento.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {Object.entries(GOALS).map(([key, g]) => (
                <button key={key} onClick={() => { setGoal(key); setTimeout(next, 220); }}
                  style={{
                    padding: "16px 18px", borderRadius: 14,
                    border: `2px solid ${goal === key ? g.color : "rgba(255,255,255,0.08)"}`,
                    background: goal === key ? `${g.color}18` : "rgba(255,255,255,0.03)",
                    color: goal === key ? g.color : "#94a3b8", fontFamily: "inherit", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 14, textAlign: "left", transition: "all .2s",
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

        {/* STEP 4: Stats — weight, height, age, activity */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 4 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>Tus medidas</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>Para calcular tus macros exactos.</p>

            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Peso</div>
              <ScrollPicker min={40} max={180} value={weight} onChange={setWeight} unit="kg" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Altura</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <input type="number" value={height}
                    onChange={e => setHeight(e.target.value)}
                    onBlur={() => { const n = parseInt(height); setHeight(isNaN(n) || n < 100 ? 175 : n > 250 ? 250 : n); }}
                    min="140" max="220"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 700, color: "#e2e8f0", width: "100%", textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: "#64748b" }}>cm</span>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Edad</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <input type="number" value={age}
                    onChange={e => setAge(e.target.value)}
                    onBlur={() => { const n = parseInt(age); setAge(isNaN(n) || n < 10 ? 18 : n > 100 ? 100 : n); }}
                    min="10" max="100"
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 700, color: "#e2e8f0", width: "100%", textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: "#64748b" }}>años</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Nivel de actividad diaria</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(ACTIVITY).map(([key, a]) => (
                  <button key={key} onClick={() => setActivity(key)}
                    style={{
                      padding: "12px 14px", borderRadius: 12,
                      border: `1.5px solid ${activity === key ? "#4ade80" : "rgba(255,255,255,0.07)"}`,
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

        {/* STEP 5: Training place */}
        {step === 5 && (
          <div>
            <p style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 5 de {TOTAL_STEPS} · Entrenamiento</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>¿Dónde entrenas?</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Define el equipo disponible para tu plan.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              {[
                { v: "gym",  emoji: "🏋️", label: "Gimnasio", desc: "Barras, máquinas, poleas" },
                { v: "casa", emoji: "🏠", label: "Casa",      desc: "Mancuernas, bandas, peso corporal" },
              ].map(({ v, emoji, label, desc }) => (
                <button key={v} onClick={() => { setPlace(v); setTimeout(next, 220); }}
                  style={{
                    padding: "24px 16px", borderRadius: 18,
                    border: `2px solid ${place === v ? "#f59e0b" : "rgba(255,255,255,0.08)"}`,
                    background: place === v ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                    color: place === v ? "#f59e0b" : "#94a3b8", fontFamily: "inherit", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all .2s",
                  }}>
                  <span style={{ fontSize: 36 }}>{emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: place === v ? "#f59e0b" : "#e2e8f0" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: Days + Time */}
        {step === 6 && (
          <div>
            <p style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 6 de {TOTAL_STEPS} · Entrenamiento</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>Volumen semanal</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>¿Cuánto tiempo puedes dedicarle?</p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Días por semana</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[[3,"3 días","Lo justo"],[4,"4 días","Equilibrado"],[5,"5 días","Alto"],[6,"6 días","Máximo"]].map(([d, label, sub]) => (
                  <button key={d} onClick={() => setTrainingDays(d)}
                    style={{
                      padding: "14px 8px", borderRadius: 14, textAlign: "center",
                      border: `2px solid ${trainingDays === d ? "#f59e0b" : "rgba(255,255,255,0.08)"}`,
                      background: trainingDays === d ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                      color: "#e2e8f0", fontFamily: "inherit", cursor: "pointer",
                    }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: trainingDays === d ? "#f59e0b" : "#e2e8f0" }}>{d}</div>
                    <div style={{ fontSize: 10, color: trainingDays === d ? "#f59e0b" : "#64748b", marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Duración por sesión</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[[30,"30 min","Express"],[45,"45 min","Estándar"],[60,"60 min","Completo"],[90,"90 min","Sin prisa"]].map(([t, label, sub]) => (
                  <button key={t} onClick={() => setTrainingTime(t)}
                    style={{
                      padding: "14px 8px", borderRadius: 14, textAlign: "center",
                      border: `2px solid ${trainingTime === t ? "#f59e0b" : "rgba(255,255,255,0.08)"}`,
                      background: trainingTime === t ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                      color: "#e2e8f0", fontFamily: "inherit", cursor: "pointer",
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: trainingTime === t ? "#f59e0b" : "#e2e8f0" }}>{label}</div>
                    <div style={{ fontSize: 10, color: trainingTime === t ? "#f59e0b" : "#64748b", marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={next} style={{ ...btn(), background: "#f59e0b", color: "#000" }}>Siguiente →</button>
          </div>
        )}

        {/* STEP 7: Training level */}
        {step === 7 && (
          <div>
            <p style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 7 de {TOTAL_STEPS} · Entrenamiento</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>¿Cuál es tu nivel?</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Define la complejidad técnica de los ejercicios.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                { v: "ppal",  emoji: "🌱", label: "Principiante", desc: "Menos de 1 año entrenando · Técnica básica" },
                { v: "inter", emoji: "📈", label: "Intermedio",    desc: "1-3 años · Dominas los patrones básicos" },
                { v: "avz",   emoji: "🔺", label: "Avanzado",      desc: "+3 años · Técnica sólida · Prep competición" },
              ].map(({ v, emoji, label, desc }) => (
                <button key={v} onClick={() => { setLevel(v); setTimeout(next, 220); }}
                  style={{
                    padding: "16px 18px", borderRadius: 16,
                    border: `2px solid ${level === v ? "#f59e0b" : "rgba(255,255,255,0.08)"}`,
                    background: level === v ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                    fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 14, transition: "all .2s",
                  }}>
                  <span style={{ fontSize: 30 }}>{emoji}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: level === v ? "#f59e0b" : "#e2e8f0" }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{desc}</div>
                  </div>
                  {level === v && <span style={{ marginLeft: "auto", color: "#f59e0b", fontSize: 16 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 8: Reminders */}
        {step === 8 && (
          <div>
            <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Paso 8 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>Recordatorios</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>¿Qué días quieres que te avisemos para entrenar?</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 20 }}>
              {DAYS_ES.map(({ key, short }) => (
                <button key={key} onClick={() => toggleDay(key)}
                  style={{
                    aspectRatio: "1", borderRadius: 12,
                    border: `1.5px solid ${remDays[key] ? "#4ade80" : "rgba(255,255,255,0.1)"}`,
                    background: remDays[key] ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)",
                    color: remDays[key] ? "#4ade80" : "#64748b", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                  {short}
                </button>
              ))}
            </div>
            {Object.values(remDays).some(Boolean) && (
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Hora</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <input type="time" value={remTime} onChange={e => setRemTime(e.target.value)}
                    style={{ background: "transparent", border: "none", outline: "none", fontFamily: "'DM Mono',monospace", fontSize: 36, fontWeight: 700, color: "#e2e8f0", cursor: "pointer" }} />
                </div>
              </div>
            )}
            <button onClick={next} style={btn()}>Siguiente →</button>
            <button onClick={next} style={{ ...btn(false), marginTop: 10 }}>Sin recordatorios</button>
          </div>
        )}

        {/* STEP 9: Done */}
        {step === 9 && (() => {
          const profile = { enabled: true, name: name.trim() || "Usuario", sex, age: parseInt(age) || 28, height: parseInt(height) || 175, weight, bodyFat: null, activity, goal };
          const computed = computeProfile(profile);
          const g = GOALS[goal];
          return (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px" }}>
                ¡Listo{name.trim() ? `, ${name.split(" ")[0]}` : ""}!
              </h2>
              <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>Tu plan está calculado.</p>

              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "20px", marginBottom: 14, textAlign: "left" }}>
                <div style={{ fontSize: 11, color: g.color, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>{g.emoji} {g.label} · Macros diarios</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#4ade80", fontFamily: "'DM Mono',monospace" }}>{computed.macros.proteina}g</div><div style={{ fontSize: 11, color: "#64748b" }}>Proteína</div></div>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#60a5fa", fontFamily: "'DM Mono',monospace" }}>{computed.macros.carbos}g</div><div style={{ fontSize: 11, color: "#64748b" }}>Carbos</div></div>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{computed.macros.grasas}g</div><div style={{ fontSize: 11, color: "#64748b" }}>Grasas</div></div>
                  <div><div style={{ fontSize: 24, fontWeight: 800, color: "#e2e8f0", fontFamily: "'DM Mono',monospace" }}>{computed.targetKcal}</div><div style={{ fontSize: 11, color: "#64748b" }}>kcal/día</div></div>
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 20px", marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>🏋️ Plan de entrenamiento</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div><div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{trainingDays}</div><div style={{ fontSize: 11, color: "#64748b" }}>días/semana</div></div>
                  <div><div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{trainingTime}</div><div style={{ fontSize: 11, color: "#64748b" }}>min/sesión</div></div>
                  <div><div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{place === "gym" ? "🏋️" : "🏠"}</div><div style={{ fontSize: 11, color: "#64748b" }}>{place === "gym" ? "Gimnasio" : "Casa"}</div></div>
                </div>
              </div>

              <button onClick={finish} style={{ ...btn(), fontSize: 16, padding: "18px" }}>Ir a mi plan →</button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
