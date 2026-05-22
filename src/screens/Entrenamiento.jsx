import { useState, useEffect, useRef } from "react";
import { useApp } from "../store/AppContext";
import { EX, TECH, CARDIO, SPLITS, byId, cById, primary } from "../data/exercises";
import { buildSchedule, buildSession, estMin, canIntense, techFor, repScheme, alternatives, suggestPR } from "../utils/training";

const C = {
  card:  { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 12 },
  btnA:  { background: "#f59e0b", color: "#000", border: "none", borderRadius: 11, padding: "13px 20px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", width: "100%" },
  btnS:  { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", borderRadius: 10, padding: "10px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  lbl:   { color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8, display: "block" },
  mono:  { fontFamily: "'DM Mono',monospace" },
  accent:"#f59e0b",
};

const GOAL_N = { musculo:"ganar músculo", grasa:"perder grasa", recomp:"recomposición", fuerza:"fuerza", salud:"salud general" };

// ── Onboarding ─────────────────────────────────────────────────────
const ONB = [
  { k:"place", q:"¿Dónde entrenas?", o:[["gym","🏋️","Gimnasio","Máquinas y barras"],["casa","🏠","En casa","Mancuernas / peso corporal"]] },
  { k:"goal",  q:"¿Tu objetivo?",    o:[["musculo","💪","Ganar músculo","Hipertrofia"],["grasa","🔥","Perder grasa","Definición"],["recomp","⚖️","Recomposición","Las dos"],["fuerza","🏆","Fuerza","Más kilos"],["salud","🌿","Salud","Sentirte bien"]] },
  { k:"days",  q:"¿Días por semana?",o:[[3,"3️⃣","3 días","Lo justo"],[4,"4️⃣","4 días","Equilibrado"],[5,"5️⃣","5 días","Ritmo alto"],[6,"6️⃣","6 días","Volumen máximo"]] },
  { k:"time",  q:"¿Tiempo por sesión?",o:[[30,"⚡","30 min","Express"],[45,"⏱️","45 min","Estándar"],[60,"🕐","60 min","Completo"],[90,"💯","90 min","Sin prisa"]] },
  { k:"level", q:"¿Tu nivel?",       o:[["ppal","🌱","Principiante","< 1 año"],["inter","📈","Intermedio","1-3 años"],["avz","🔺","Avanzado","+3 años"]] },
];

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const def = ONB[step];

  const pick = (k, v) => {
    const val = (k === "days" || k === "time") ? +v : v;
    const next = { ...answers, [k]: val };
    if (step < ONB.length - 1) { setAnswers(next); setStep(s => s + 1); }
    else onDone(next);
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Paso {step + 1} de {ONB.length}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: "6px 0 0" }}>{def.q}</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {def.o.map(([v, ic, label, sub]) => (
          <div key={v} onClick={() => pick(def.k, v)}
            style={{ border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.025)" }}>
            <span style={{ fontSize: 22 }}>{ic}</span>
            <div><div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{label}</div><div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PR Modal ──────────────────────────────────────────────────────
function PRModal({ exercise, history, onSave, onClose }) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState(exercise?.sets || 4);
  const suggestion = suggestPR(history);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0d1a0d", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Registrar PR</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{byId(exercise?.id)?.n || exercise?.id}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {suggestion && (
          <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 10, marginBottom: 14, fontSize: 12, color: "#fde68a" }}>
            💡 Sugerencia: <strong>{suggestion.weight}kg × {suggestion.reps} reps</strong> — {suggestion.note}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[["Peso (kg)", weight, setWeight], ["Reps", reps, setReps], ["Series", sets, setSets]].map(([label, val, setter], i) => (
            <div key={i}>
              <span style={C.lbl}>{label}</span>
              <input type="number" value={val} onChange={e => setter(e.target.value)} step={i === 0 ? "0.5" : "1"}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 8px", color: "#e2e8f0", fontFamily: "'DM Mono',monospace", fontSize: 20, textAlign: "center", width: "100%", outline: "none" }} />
            </div>
          ))}
        </div>

        {history?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <span style={C.lbl}>Historial reciente</span>
            {history.slice(-4).reverse().map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "#94a3b8" }}>
                <span>{h.date}</span>
                <span style={{ ...C.mono, color: "#f59e0b" }}>{h.weight}kg × {h.reps} × {h.sets}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => { onSave({ weight: +weight, reps: +reps, sets: +sets, targetReps: exercise?.reps }); onClose(); }}
          disabled={!weight || !reps}
          style={{ ...C.btnA, opacity: !weight || !reps ? .5 : 1 }}>
          Guardar PR
        </button>
      </div>
    </div>
  );
}

// ── Session Player ────────────────────────────────────────────────
function SessionPlayer({ entry, training, onComplete, onExit }) {
  const { logPR, state } = useApp();
  const plan = buildSession(entry, training);
  const [done, setDone] = useState([]);
  const [restIdx, setRestIdx] = useState(null);
  const [restTime, setRestTime] = useState(0);
  const [prModal, setPrModal] = useState(null);
  const [techModal, setTechModal] = useState(null);
  const [swapModal, setSwapModal] = useState(null);
  const intervalRef = useRef(null);

  const startRest = (secs) => {
    setRestTime(secs);
    intervalRef.current = setInterval(() => {
      setRestTime(t => { if (t <= 1) { clearInterval(intervalRef.current); setRestIdx(null); return 0; } return t - 1; });
    }, 1000);
  };

  const toggleDone = (idx) => {
    const ex = plan[idx];
    if (!done.includes(idx)) {
      setDone(d => [...d, idx]);
      setRestIdx(idx);
      startRest(ex.rest || 75);
    } else {
      setDone(d => d.filter(i => i !== idx));
    }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct = Math.round((done.length / plan.length) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "#080d08", padding: "0 16px 40px" }}>
      {/* Header */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onExit} style={{ ...C.btnS, fontSize: 11, padding: "7px 12px" }}>← Salir</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>{entry.name}</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>{done.length}/{plan.length} ejercicios · {pct}%</div>
        </div>
        <button onClick={onComplete} style={{ ...C.btnA, width: "auto", padding: "8px 14px", fontSize: 12 }}>✓ Fin</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 9, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#f59e0b", borderRadius: 9, transition: "width .4s" }} />
      </div>

      {/* Rest timer */}
      {restIdx !== null && restTime > 0 && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14, padding: "14px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Descansando</div>
            <div style={{ ...C.mono, fontSize: 32, color: "#fbbf24", fontWeight: 700 }}>{fmt(restTime)}</div>
          </div>
          <button onClick={() => { clearInterval(intervalRef.current); setRestIdx(null); setRestTime(0); }}
            style={{ ...C.btnS, fontSize: 12, padding: "8px 14px" }}>Saltar</button>
        </div>
      )}

      {/* Exercises */}
      {plan.map((x, idx) => {
        const ex = byId(x.id);
        if (!ex) return null;
        const isDone = done.includes(idx);
        const hasTech = x.tech && canIntense(training.level);
        const prHistory = state.progress?.prs?.[x.id] || [];
        return (
          <div key={idx} style={{ ...C.card, borderColor: isDone ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.07)", background: isDone ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.025)", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: isDone ? "#f59e0b" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: isDone ? "#000" : "#64748b", flexShrink: 0, ...C.mono }}>
                {isDone ? "✓" : idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{ex.n}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{ex.m.join(", ")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 9px", fontSize: 11, color: "#94a3b8", ...C.mono }}>
                    {x.sets} × {x.reps}
                  </span>
                  <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 9px", fontSize: 11, color: "#94a3b8" }}>
                    {x.rest}s descanso
                  </span>
                  {hasTech && (
                    <span onClick={() => setTechModal(x)} style={{ background: "rgba(239,68,68,0.12)", borderRadius: 8, padding: "4px 9px", fontSize: 11, color: "#fca5a5", cursor: "pointer", fontWeight: 700 }}>
                      🔥 {TECH[x.tech]?.short}
                    </span>
                  )}
                </div>
                {prHistory.length > 0 && (
                  <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6 }}>
                    Último: {prHistory[prHistory.length - 1].weight}kg × {prHistory[prHistory.length - 1].reps} reps
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPrModal(x)}
                    style={{ fontSize: 11, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    📊 Log PR
                  </button>
                  <button onClick={() => setTechModal({ ...x, showHow: true })}
                    style={{ fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                    ℹ Técnica
                  </button>
                </div>
              </div>
              <button onClick={() => toggleDone(idx)}
                style={{ width: 44, height: 44, borderRadius: "50%", border: `2px solid ${isDone ? "#f59e0b" : "rgba(255,255,255,0.15)"}`, background: isDone ? "#f59e0b" : "transparent", color: isDone ? "#000" : "#475569", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isDone ? "✓" : "○"}
              </button>
            </div>
          </div>
        );
      })}

      {/* Complete */}
      <button onClick={onComplete} style={{ ...C.btnA, marginTop: 8 }}>
        ✅ Completar entrenamiento
      </button>

      {/* PR Modal */}
      {prModal && (
        <PRModal exercise={prModal} history={state.progress?.prs?.[prModal.id] || []}
          onSave={entry => logPR(prModal.id, entry)} onClose={() => setPrModal(null)} />
      )}

      {/* Tech Modal */}
      {techModal && (
        <div onClick={() => setTechModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 16px" }} />
            {techModal.showHow ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>{byId(techModal.id)?.n}</h2>
                <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65, marginBottom: 12 }}>{byId(techModal.id)?.how}</p>
                <div style={{ marginBottom: 10 }}>
                  {byId(techModal.id)?.key?.map((k, i) => <div key={i} style={{ fontSize: 12, color: "#4ade80", padding: "4px 0" }}>✓ {k}</div>)}
                </div>
                <div>
                  {byId(techModal.id)?.err?.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#fca5a5", padding: "4px 0" }}>✗ {e}</div>)}
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{TECH[techModal.tech]?.label}</h2>
                {TECH[techModal.tech]?.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#f59e0b", color: "#000", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>{s}</p>
                  </div>
                ))}
                {TECH[techModal.tech]?.tip && (
                  <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 10, fontSize: 12, color: "#fde68a" }}>
                    💡 {TECH[techModal.tech].tip}
                  </div>
                )}
              </>
            )}
            <button onClick={() => setTechModal(null)} style={{ ...C.btnS, width: "100%", marginTop: 16 }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Entrenamiento ────────────────────────────────────────────
export default function Entrenamiento({ onNavigate }) {
  const { state, setState, markTrained, todayLog } = useApp();
  const training = state.training;
  const [view, setView] = useState("home"); // home | playing
  const [kcalInput, setKcalInput] = useState("");
  const [showKcal, setShowKcal] = useState(false);

  const setupDone = training.seq && training.seq.length > 0;
  const trained   = todayLog.trained === true;
  const cursor    = training.cursor || 0;
  const seq       = training.seq || [];
  const nextWO    = seq[cursor % seq.length];

  const finishSetup = (answers) => {
    const newTraining = buildSchedule({ ...training, ...answers, streak: 0, hist: {}, done: [], chat: [] });
    setState(s => ({ ...s, training: newTraining }));
  };

  const completeWorkout = () => {
    const kcalBurned = +kcalInput || todayLog.watchKcal || 0;
    markTrained(kcalBurned);
    setState(s => ({
      ...s,
      training: {
        ...s.training,
        cursor: (s.training.cursor || 0) + 1,
        weekStarted: true,
        lastTrainTs: Date.now(),
        done: [...(s.training.done || []), { name: nextWO?.name, date: new Date().toISOString(), kcal: kcalBurned }],
        streak: (s.training.streak || 0) + 1,
      }
    }));
    setView("home");
    setKcalInput("");
  };

  if (!setupDone) {
    return (
      <div style={{ background: "#080d08", minHeight: "100vh" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#f59e0b", letterSpacing: 2, fontWeight: 500 }}>ENTRENO</span>
        </div>
        <Onboarding onDone={finishSetup} />
      </div>
    );
  }

  if (view === "playing" && nextWO) {
    return (
      <SessionPlayer entry={nextWO} training={training}
        onComplete={completeWorkout} onExit={() => setView("home")} />
    );
  }

  return (
    <div style={{ background: "#080d08", minHeight: "100vh" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 10px", position: "sticky", top: 0, background: "#080d08", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 5 }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#f59e0b", letterSpacing: 2, fontWeight: 500 }}>ENTRENO</span>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Today status */}
        {trained ? (
          <div style={{ ...C.card, background: "rgba(74,222,128,0.05)", borderColor: "rgba(74,222,128,0.2)", textAlign: "center", padding: "24px 16px" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#4ade80", margin: "0 0 6px" }}>Hoy ya entrenaste</h2>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Descansa. El músculo crece fuera del gimnasio.</p>
          </div>
        ) : (
          <div style={{ ...C.card, background: "linear-gradient(160deg,#1a1200,rgba(54,48,36,.5))", borderColor: "rgba(245,158,11,0.2)" }}>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Siguiente en tu plan</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>{nextWO?.name}</h2>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px" }}>
              {buildSession(nextWO, training).length} ejercicios · {estMin(buildSession(nextWO, training))} min
            </p>

            {/* Apple Watch kcal */}
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setShowKcal(v => !v)}
                style={{ fontSize: 12, color: "#f59e0b", background: "none", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                ⌚ {todayLog.watchKcal > 0 ? `${todayLog.watchKcal} kcal ✏️` : "Registrar kcal Apple Watch"}
              </button>
              {showKcal && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <input type="number" value={kcalInput} onChange={e => setKcalInput(e.target.value)} placeholder="kcal quemadas"
                    style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontFamily: "'DM Mono',monospace", fontSize: 16, outline: "none" }} />
                  <button onClick={() => setShowKcal(false)}
                    style={{ padding: "10px 14px", background: "#f59e0b", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>OK</button>
                </div>
              )}
            </div>

            <button onClick={() => setView("playing")} style={C.btnA}>Empezar entrenamiento →</button>
          </div>
        )}

        {/* Sequence */}
        <div style={C.card}>
          <span style={C.lbl}>Tu secuencia de entrenos</span>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>No es por días fijos. Avanza cuando completes cada sesión.</p>
          {seq.map((e, i) => {
            const pos = cursor % seq.length;
            const isPast = i < pos;
            const isCurrent = i === pos;
            return (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < seq.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: isCurrent ? "#f59e0b" : isPast ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)", color: isCurrent ? "#000" : isPast ? "#4ade80" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isCurrent ? 12 : 14, fontWeight: 800, flexShrink: 0 }}>
                  {isCurrent ? "▶" : isPast ? "✓" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? "#fbbf24" : "#e2e8f0" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{buildSession(e, training).length} ejercicios · {estMin(buildSession(e, training))} min{isCurrent ? " · siguiente" : ""}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats */}
        {(training.done?.length > 0 || training.streak > 0) && (
          <div style={{ ...C.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>{training.done?.length || 0}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Sesiones completadas</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 700, color: "#4ade80" }}>{training.streak || 0}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Racha actual</div>
            </div>
          </div>
        )}

        {/* Reset */}
        <button onClick={() => { if (window.confirm("¿Regenerar el plan desde cero?")) { finishSetup({ place: training.place, goal: training.goal, days: training.days, time: training.time, level: training.level }); }}}
          style={{ ...C.btnS, width: "100%", marginTop: 4 }}>🔄 Regenerar secuencia</button>
      </div>
    </div>
  );
}
