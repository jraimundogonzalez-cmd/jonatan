import { useState, useEffect, useRef } from "react";
import { useApp } from "../store/AppContext";
import { EX, TECH, CARDIO, SPLITS, byId, cById, primary } from "../data/exercises";
import { buildSchedule, buildSession, buildAbsBlock, buildWarmUp, buildCoolDown, estMin, canIntense, techFor, repScheme, alternatives, suggestPR } from "../utils/training";
import { recommendSubstitutes, generateRoutine, buildSessionFromCats, inferCats, analyzeRoutine, GYM_DEFAULT, HOME_DEFAULT, CAT_LABELS_MAP } from "../utils/ai";

const C = {
  card:  { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 12 },
  btnA:  { background: "#f59e0b", color: "#000", border: "none", borderRadius: 11, padding: "13px 20px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", width: "100%" },
  btnS:  { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", borderRadius: 10, padding: "10px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  lbl:   { color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8, display: "block" },
  mono:  { fontFamily: "'DM Mono',monospace" },
  accent:"#f59e0b",
};

const GOAL_N = { musculo:"ganar músculo", grasa:"perder grasa", recomp:"recomposición", fuerza:"fuerza", salud:"salud general" };

const CARDIO_MENU = [
  { id:"bici",      ic:"🚴", n:"Bici estática",   zona:"Z2 · 80-90 rpm" },
  { id:"andar",     ic:"🚶", n:"Cinta andar",      zona:"Z1-Z2 · inclinación 3-6%" },
  { id:"correr",    ic:"🏃", n:"Cinta correr",     zona:"Z2-Z3 · ritmo sostenido" },
  { id:"escalera",  ic:"🪜", n:"Escaladora",       zona:"Z2-Z3 · paso completo" },
  { id:"remoergo",  ic:"🛶", n:"Remo ergómetro",   zona:"Z2-Z3 · cuerpo completo" },
  { id:"eliptica",  ic:"🤸", n:"Elíptica",         zona:"Z2 · bajo impacto" },
  { id:"natacion",  ic:"🏊", n:"Natación",         zona:"Z2-Z3 · técnica libre" },
  { id:"hiit",      ic:"⚡", n:"HIIT intervalos",  zona:"Z4-Z5 · 30s/90s" },
];

const MESOCYCLE_PHASES = [
  { name:"Acumulación",     color:"#60a5fa", desc:"Volumen alto, intensidad moderada. Construyes base." },
  { name:"Intensificación", color:"#f59e0b", desc:"Volumen moderado, intensidad alta. Cargas suben." },
  { name:"Realización",     color:"#ef4444", desc:"Volumen bajo, intensidad máxima. Pico de fuerza." },
  { name:"Descarga",        color:"#4ade80", desc:"Volumen muy bajo. El cuerpo supracompensa y crece." },
];

const MUSCLE_GROUPS = [
  { id:"Pecho",     icon:"🫁" },
  { id:"Espalda",   icon:"🦾" },
  { id:"Hombros",   icon:"⬆️" },
  { id:"Bíceps",    icon:"💪" },
  { id:"Tríceps",   icon:"👊" },
  { id:"Cuádriceps",icon:"🦵" },
  { id:"Isquios",   icon:"🦵" },
  { id:"Glúteos",   icon:"🍑" },
  { id:"Core",      icon:"⚡" },
];

const MUSCLE_MAP = {
  "Pecho":["pecho","pectoral","Pecho","Pectoral"],
  "Espalda":["espalda","dorsal","Espalda","Dorsal"],
  "Hombros":["hombro","deltoides","Hombro","Hombros","Deltoides"],
  "Bíceps":["bíceps","biceps","Bíceps"],
  "Tríceps":["tríceps","triceps","Tríceps"],
  "Cuádriceps":["cuádriceps","cuadriceps","Cuádriceps"],
  "Isquios":["isquios","femoral","Isquios","Femorales"],
  "Glúteos":["glúteo","gluteo","Glúteos","Glúteo"],
  "Core":["core","Core","abdomen","Abdomen","Abdominales","oblicuos"],
};

function muscleStatus(muscleId, lastMuscles, prevMuscles) {
  const aliases = MUSCLE_MAP[muscleId] || [muscleId];
  const inLast = lastMuscles.some(m => aliases.some(a => m.toLowerCase().includes(a.toLowerCase())));
  const inPrev = prevMuscles.some(m => aliases.some(a => m.toLowerCase().includes(a.toLowerCase())));
  if (inLast) return "fatigado";
  if (inPrev) return "recuperando";
  return "fresco";
}

function getCoachMessage(sessionName, muscles, rpe) {
  const rpeN = +rpe;
  let msg = "";
  if (rpeN <= 3) msg = "Sesión muy suave. Si te encuentras bien, podrías subir un poco la intensidad la próxima vez.";
  else if (rpeN <= 5) msg = "Ritmo controlado. Estás acumulando volumen de calidad. Sigue así.";
  else if (rpeN <= 7) msg = "Zona óptima de progreso. Intensidad correcta para crecer sin sobreentrenar.";
  else if (rpeN <= 8) msg = "Sesión exigente. Tu cuerpo tiene todo lo que necesita para mejorar. Prioriza el descanso y la proteína.";
  else msg = "Esfuerzo máximo. Recuperación prioritaria: 8h de sueño, 2-2.5g proteína/kg y evita más entrenos duros en 48h.";

  const hasPierna = muscles.some(m => ["Cuádriceps","Isquios","Glúteos"].some(g => m.includes(g) || g.includes(m)));
  const hasEspalda = muscles.some(m => m.includes("espalda") || m.includes("Espalda") || m.includes("dorsal"));
  if (hasPierna) msg += " Las piernas tardan 72-96h en recuperar — no fuerces trabajo de cuádriceps mañana.";
  else if (hasEspalda) msg += " La espalda trabaja en casi todos los empujes. Cuida la postura las próximas 48h.";

  return msg;
}

// ── Goal Date Card ────────────────────────────────────────────────
function GoalDateCard({ training, setState }) {
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState(training.goalDate ? training.goalDate.slice(0, 10) : "");

  const save = () => {
    if (!dateInput) return;
    setState(s => ({ ...s, training: { ...s.training, goalDate: dateInput } }));
    setEditing(false);
  };
  const clear = () => {
    setState(s => ({ ...s, training: { ...s.training, goalDate: null } }));
    setDateInput("");
    setEditing(false);
  };

  const goalDate = training.goalDate ? new Date(training.goalDate + "T12:00:00") : null;
  const today = new Date();
  const daysLeft = goalDate ? Math.ceil((goalDate - today) / (1000 * 60 * 60 * 24)) : null;
  const weeksLeft = daysLeft !== null ? Math.floor(daysLeft / 7) : null;
  const cyclesLeft = weeksLeft !== null ? Math.floor(weeksLeft / 4) : null;
  const phasesLeft = weeksLeft !== null ? weeksLeft % 4 : null;

  const urgency = daysLeft !== null ? (daysLeft <= 14 ? "#ef4444" : daysLeft <= 42 ? "#f59e0b" : "#4ade80") : "#64748b";

  return (
    <div style={{ ...C.card, border: `1px solid ${urgency}30`, background: `${urgency}08` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: urgency, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 3 }}>
            Objetivo · Fecha pico
          </div>
          <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 700 }}>
            Abdomen seco y muy definido
          </div>
        </div>
        <button onClick={() => setEditing(e => !e)}
          style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#64748b", padding: "0 4px" }}>
          {editing ? "×" : "✏️"}
        </button>
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 12px", color: "#f1f5f9", fontSize: 14, outline: "none", width: "100%" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} style={{ ...C.btnA, flex: 2, padding: "11px 0" }}>Guardar fecha</button>
            {training.goalDate && <button onClick={clear} style={{ flex: 1, background: "none", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: 11, padding: "11px 0", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Quitar</button>}
          </div>
        </div>
      ) : goalDate ? (
        <div>
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 36, fontWeight: 800, color: urgency, lineHeight: 1 }}>{Math.max(0, daysLeft)}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>días</div>
            </div>
            <div style={{ flex: 1 }}>
              {cyclesLeft > 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>
                {cyclesLeft} mesociclo{cyclesLeft !== 1 ? "s" : ""} + {phasesLeft} semana{phasesLeft !== 1 ? "s" : ""}
              </div>}
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                {goalDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
              {daysLeft <= 0 && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, marginTop: 4 }}>Fecha alcanzada</div>}
              {daysLeft > 0 && daysLeft <= 14 && <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginTop: 4 }}>Fase final · máxima intensidad</div>}
            </div>
          </div>
          {daysLeft > 0 && (
            <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 9, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${urgency}, ${urgency}99)`,
                width: `${Math.max(2, Math.min(100, 100 - (daysLeft / 365) * 100))}%`, transition: "width .4s" }} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <button onClick={() => setEditing(true)}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 20px", color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            + Fijar fecha objetivo
          </button>
        </div>
      )}
    </div>
  );
}

// ── Cardio Picker Modal ───────────────────────────────────────────
function CardioPickerModal({ onSave, onSkip, minMin = 20 }) {
  const [selected, setSelected] = useState(null);
  const [duration, setDuration] = useState(minMin);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 250, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#080d08", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 16px 40px" }}>
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Cardio del día</div>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>Elige tu cardio</h2>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>Mínimo {minMin} minutos. Zona de frecuencia cardíaca moderada.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {CARDIO_MENU.map(c => (
            <div key={c.id} onClick={() => setSelected(c.id)}
              style={{ border: `1.5px solid ${selected === c.id ? "#60a5fa" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, padding: "12px 10px", cursor: "pointer", background: selected === c.id ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.025)", textAlign: "center", transition: "all .15s" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{c.ic}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: selected === c.id ? "#93c5fd" : "#e2e8f0", marginBottom: 2 }}>{c.n}</div>
              <div style={{ fontSize: 10, color: "#475569" }}>{c.zona}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={C.lbl}>Duración</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={minMin} max={90} value={duration} onChange={e => setDuration(+e.target.value)}
              style={{ flex: 1, accentColor: "#60a5fa" }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: "#60a5fa", minWidth: 50, textAlign: "right" }}>{duration}m</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 2 }}>
            <span>{minMin} min</span><span>60 min</span><span>90 min</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => selected && onSave(selected, duration)} disabled={!selected}
            style={{ ...C.btnA, flex: 2, background: selected ? "linear-gradient(135deg,#3b82f6,#1d4ed8)" : "#1e293b", color: selected ? "#fff" : "#475569", opacity: selected ? 1 : .7 }}>
            Guardar cardio ({duration} min)
          </button>
          <button onClick={onSkip}
            style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11, padding: "13px 8px", fontSize: 12, color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}>
            Saltar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recovery Map ─────────────────────────────────────────────────
function RecoveryMap({ daily }) {
  const entries = Object.entries(daily || {})
    .filter(([, v]) => v.training?.muscles?.length > 0)
    .sort(([a], [b]) => b.localeCompare(a));
  const lastMuscles  = entries[0]?.[1]?.training?.muscles || [];
  const prevMuscles  = entries[1]?.[1]?.training?.muscles || [];

  if (lastMuscles.length === 0) return null;

  const STATUS = {
    fatigado:    { color: "#ef4444", dot: "#ef4444", label: "Fatigado", bg: "rgba(239,68,68,0.1)" },
    recuperando: { color: "#f59e0b", dot: "#f59e0b", label: "Recuperando", bg: "rgba(245,158,11,0.08)" },
    fresco:      { color: "#4ade80", dot: "#4ade80", label: "Listo",  bg: "rgba(74,222,128,0.06)" },
  };

  return (
    <div style={C.card}>
      <span style={C.lbl}>Mapa de recuperación muscular</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {MUSCLE_GROUPS.map(({ id, icon }) => {
          const st = muscleStatus(id, lastMuscles, prevMuscles);
          const s = STATUS[st];
          return (
            <div key={id} style={{ background: s.bg, borderRadius: 10, padding: "8px 6px", textAlign: "center", border: `1px solid ${s.color}25` }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{id}</div>
              <div style={{ fontSize: 9, color: s.color, fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: "#475569" }}>
        <span><span style={{ color: "#ef4444" }}>●</span> Fatigado (&lt;48h)</span>
        <span><span style={{ color: "#f59e0b" }}>●</span> Recuperando</span>
        <span><span style={{ color: "#4ade80" }}>●</span> Listo</span>
      </div>
    </div>
  );
}

// ── Post-Session Modal (RPE + Coach) ──────────────────────────────
function PostSessionModal({ sessionName, muscles, hasCardio, onDone }) {
  const [rpe, setRpe] = useState(7);
  const [step, setStep] = useState(hasCardio ? "cardio" : "rpe"); // cardio → rpe → coach
  const [cardioSel, setCardioSel] = useState(null);
  const [cardioDur, setCardioDur] = useState(20);
  const [cardioSelecting, setCardioSelecting] = useState(null);

  const coachMsg = getCoachMessage(sessionName, muscles, rpe);

  const finish = () => onDone({ rpe, cardio: cardioSel ? { id: cardioSel, min: cardioDur } : null });

  if (step === "cardio") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 250, display: "flex", alignItems: "flex-end" }}>
        <div style={{ background: "#080d08", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 16px 40px" }}>
          <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Cardio del día</div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>¿Añadir cardio?</h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>Hoy es día de cardio · mínimo 20 min</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {CARDIO_MENU.map(c => (
              <div key={c.id} onClick={() => setCardioSelecting(c.id)}
                style={{ border: `1.5px solid ${cardioSelecting === c.id ? "#60a5fa" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, padding: "12px 10px", cursor: "pointer", background: cardioSelecting === c.id ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.025)", textAlign: "center" }}>
                <div style={{ fontSize: 26, marginBottom: 3 }}>{c.ic}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: cardioSelecting === c.id ? "#93c5fd" : "#e2e8f0" }}>{c.n}</div>
              </div>
            ))}
          </div>
          {cardioSelecting && (
            <div style={{ marginBottom: 14 }}>
              <span style={C.lbl}>Duración</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min={20} max={90} value={cardioDur} onChange={e => setCardioDur(+e.target.value)}
                  style={{ flex: 1, accentColor: "#60a5fa" }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: "#60a5fa", minWidth: 50, textAlign: "right" }}>{cardioDur}m</span>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { if (cardioSelecting) setCardioSel(cardioSelecting); setStep("rpe"); }}
              disabled={!cardioSelecting}
              style={{ ...C.btnA, flex: 2, background: cardioSelecting ? "linear-gradient(135deg,#3b82f6,#1d4ed8)" : "#1e293b", color: cardioSelecting ? "#fff" : "#475569" }}>
              Añadir {cardioDur} min de cardio
            </button>
            <button onClick={() => setStep("rpe")} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11, padding: "13px 8px", fontSize: 12, color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}>
              Sin cardio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "rpe") {
    const rpeColor = rpe <= 4 ? "#4ade80" : rpe <= 6 ? "#f59e0b" : rpe <= 8 ? "#f97316" : "#ef4444";
    const rpeLabels = ["","Muy fácil","Fácil","Suave","Moderado","Moderado+","Difícil","Difícil+","Muy difícil","Máximo-1","Máximo"];
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 250, display: "flex", alignItems: "flex-end" }}>
        <div style={{ background: "#080d08", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 16px 40px" }}>
          <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Valoración RPE</div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>¿Cómo fue la sesión?</h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px" }}>Rate of Perceived Exertion · 1 (muy fácil) → 10 (máximo)</p>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 64, fontWeight: 800, color: rpeColor, lineHeight: 1 }}>{rpe}</div>
            <div style={{ fontSize: 14, color: rpeColor, fontWeight: 600, marginTop: 4 }}>{rpeLabels[rpe]}</div>
          </div>
          <input type="range" min={1} max={10} value={rpe} onChange={e => setRpe(+e.target.value)}
            style={{ width: "100%", accentColor: rpeColor, marginBottom: 20, height: 6 }} />
          <button onClick={() => setStep("coach")} style={{ ...C.btnA }}>Ver feedback del coach →</button>
        </div>
      </div>
    );
  }

  if (step === "coach") {
    const cardioInfo = cardioSel ? CARDIO_MENU.find(c => c.id === cardioSel) : null;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 250, display: "flex", alignItems: "flex-end" }}>
        <div style={{ background: "#080d08", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "80vh", overflowY: "auto", padding: "20px 16px 40px" }}>
          <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Coach IA</div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", margin: "0 0 16px" }}>Análisis post-sesión</h2>

          <div style={{ padding: "14px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.65 }}>{coachMsg}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>RPE</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 800, color: rpe >= 8 ? "#ef4444" : rpe >= 6 ? "#f59e0b" : "#4ade80" }}>{rpe}/10</div>
            </div>
            {cardioInfo && (
              <div style={{ background: "rgba(96,165,250,0.06)", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid rgba(96,165,250,0.15)" }}>
                <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, marginBottom: 4 }}>Cardio</div>
                <div style={{ fontSize: 22 }}>{cardioInfo.ic}</div>
                <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 700 }}>{cardioDur} min</div>
              </div>
            )}
          </div>

          {muscles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>Músculos trabajados</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {muscles.slice(0, 8).map((m, i) => (
                  <span key={i} style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#fbbf24" }}>{m}</span>
                ))}
              </div>
            </div>
          )}

          <button onClick={finish} style={{ ...C.btnA }}>Finalizar sesión</button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Onboarding ─────────────────────────────────────────────────────
const ONB = [
  { k:"place", q:"¿Dónde entrenas?", o:[["gym","🏋️","Gimnasio","Máquinas y barras"],["casa","🏠","En casa","Mancuernas / peso corporal"]] },
  { k:"goal",  q:"¿Tu objetivo?",    o:[["musculo","💪","Ganar músculo","Hipertrofia"],["grasa","🔥","Perder grasa","Definición"],["recomp","⚖️","Recomposición","Las dos"],["fuerza","🏆","Fuerza","Más kilos"],["salud","🌿","Salud","Sentirte bien"]] },
  { k:"days",  q:"¿Días por semana?",o:[[3,"3️⃣","3 días","Lo justo"],[4,"4️⃣","4 días","Equilibrado"],[5,"5️⃣","5 días","Ritmo alto"],[6,"6️⃣","6 días","Volumen máximo"]] },
  { k:"time",  q:"¿Tiempo por sesión?",o:[[30,"⚡","30 min","Express"],[45,"⏱️","45 min","Estándar"],[60,"🕐","60 min","Completo"],[90,"💯","90 min","Sin prisa"]] },
  { k:"level", q:"¿Tu nivel?",       o:[["ppal","🌱","Principiante","< 1 año"],["inter","📈","Intermedio","1-3 años"],["avz","🔺","Avanzado","+3 años"]] },
];

function Onboarding({ step, answers, onPick, onBack, onDone }) {
  const def = ONB[step];

  const pick = (k, v) => {
    const val = (k === "days" || k === "time") ? +v : v;
    const next = { ...answers, [k]: val };
    if (step < ONB.length - 1) { onPick(next, step + 1); }
    else onDone(next);
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={onBack} disabled={step === 0}
            style={{ background: "none", border: "none", color: step === 0 ? "#334155" : "#94a3b8", fontSize: 13, cursor: step === 0 ? "default" : "pointer", fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            ← Volver
          </button>
          <div style={{ display: "flex", gap: 5 }}>
            {ONB.map((_, i) => (
              <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: step > i ? "#f59e0b" : step === i ? "#f59e0b" : "rgba(255,255,255,0.08)", color: step >= i ? "#000" : "#475569", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {step > i ? "✓" : i + 1}
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Paso {step + 1} de {ONB.length}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: "6px 0 0" }}>{def.q}</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {def.o.map(([v, ic, label, sub]) => {
          const isSelected = answers[def.k] !== undefined && answers[def.k] === ((def.k === "days" || def.k === "time") ? +v : v);
          return (
            <div key={v} onClick={() => pick(def.k, v)}
              style={{ border: `1.5px solid ${isSelected ? "#f59e0b" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, background: isSelected ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.025)" }}>
              <span style={{ fontSize: 22 }}>{ic}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: isSelected ? "#fbbf24" : "#f1f5f9" }}>{label}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div>
              </div>
              {isSelected && <span style={{ color: "#f59e0b", fontSize: 18 }}>✓</span>}
            </div>
          );
        })}
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

// ── Plan Editor (customize muscle groups per day) ─────────────────
const ALL_CATS = [
  ["pecho","💪 Pecho"],["espalda","🦾 Espalda"],["hombro","⬆️ Hombro"],
  ["trapecio","🔺 Trapecio"],["biceps","💪 Bíceps"],["triceps","👊 Tríceps"],
  ["antebrazo","🤜 Antebrazo"],["cuadriceps","🦵 Cuádriceps"],["isquios","🦵 Isquios"],
  ["gluteos","🍑 Glúteos"],["abductores","↔️ Abductores"],["aductores","↔️ Aductores"],
  ["gemelos","🦶 Gemelos"],["core","🎯 Core"],["abdominales","⚡ Abdominales"],
  ["oblicuos","〽️ Oblicuos"],["lumbar","🔙 Lumbar"],["cardio","🏃 Cardio"],
];

function PlanEditor({ seq, training, onSave, onClose }) {
  const [days, setDays] = useState(() =>
    seq.map(s => ({ name: s.name, cats: inferCats(s) }))
  );
  const [addingTo, setAddingTo] = useState(null);
  // tap-to-move: { dayIdx, cat } — selected chip waiting to be placed
  const [moving, setMoving] = useState(null);

  const removeFromDay = (dayIdx, cat) => {
    setMoving(null);
    setDays(d => d.map((day, i) =>
      i !== dayIdx ? day : { ...day, cats: day.cats.filter(c => c !== cat) }
    ));
  };

  const addToDay = (dayIdx, cat) => {
    setDays(d => d.map((day, i) => {
      if (i !== dayIdx) return day;
      if (day.cats.includes(cat)) return day;
      return { ...day, cats: [...day.cats, cat] };
    }));
    setAddingTo(null);
  };

  const selectForMove = (dayIdx, cat) => {
    if (moving?.dayIdx === dayIdx && moving?.cat === cat) {
      setMoving(null); // tap again to deselect
    } else {
      setMoving({ dayIdx, cat });
      setAddingTo(null);
    }
  };

  const placeInDay = (toDayIdx) => {
    if (!moving) return;
    const { dayIdx: from, cat } = moving;
    if (from === toDayIdx) { setMoving(null); return; }
    setDays(d => d.map((day, i) => {
      if (i === from) return { ...day, cats: day.cats.filter(c => c !== cat) };
      if (i === toDayIdx && !day.cats.includes(cat)) return { ...day, cats: [...day.cats, cat] };
      return day;
    }));
    setMoving(null);
  };

  const moveDay = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= days.length) return;
    setDays(d => {
      const next = [...d];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
  };

  const save = () => {
    const equipment = training.equipment && training.equipment.length > 0
      ? training.equipment : (training.place === "casa" ? HOME_DEFAULT : GYM_DEFAULT);
    const newSeq = days.map(day => buildSessionFromCats(day.cats, {
      goal: training.goal, time: training.time,
      place: training.place, availableEq: equipment,
    }));
    onSave(newSeq);
  };

  const catLabel = (c) => CAT_LABELS_MAP[c] || c;

  return (
    <div style={{ background: "#080d08", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "#080d08", zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>Personalizar plan</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Elige tus grupos musculares</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>×</button>
      </div>

      {/* Move mode banner */}
      {moving && (
        <div style={{ margin: "10px 16px 0", padding: "10px 14px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#c4b5fd", fontWeight: 700 }}>
            ✋ Moviendo: <strong style={{ color: "#fff" }}>{catLabel(moving.cat)}</strong> → toca el día destino
          </span>
          <button onClick={() => setMoving(null)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
      )}

      <div style={{ padding: "12px 16px 120px" }}>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          Toca <span style={{ color: "#ef4444" }}>✕</span> para quitar · <span style={{ color: "#a78bfa" }}>toca el nombre</span> del chip para moverlo a otro día
        </p>

        {days.map((day, di) => {
          const isTarget = moving && moving.dayIdx !== di;
          const isSource = moving?.dayIdx === di;
          return (
            <div key={di}
              onClick={isTarget ? () => placeInDay(di) : undefined}
              style={{ ...C.card, marginBottom: 12, position: "relative", border: isTarget ? "1.5px solid rgba(167,139,250,0.6)" : isSource ? "1.5px solid rgba(167,139,250,0.3)" : C.card.border, background: isTarget ? "rgba(167,139,250,0.08)" : C.card.background, cursor: isTarget ? "pointer" : "default", transition: "all .15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: isTarget ? "#c4b5fd" : "#a78bfa", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  {isTarget ? "👉 " : ""}Día {di + 1}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#475569" }}>{day.cats.length} grupo{day.cats.length !== 1 ? "s" : ""}</span>
                  {!moving && (
                    <div style={{ display: "flex", gap: 2 }}>
                      <button onClick={e => { e.stopPropagation(); moveDay(di, di - 1); }} disabled={di === 0}
                        style={{ background: di === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, width: 26, height: 26, color: di === 0 ? "#334155" : "#94a3b8", fontSize: 13, cursor: di === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>↑</button>
                      <button onClick={e => { e.stopPropagation(); moveDay(di, di + 1); }} disabled={di === days.length - 1}
                        style={{ background: di === days.length - 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, width: 26, height: 26, color: di === days.length - 1 ? "#334155" : "#94a3b8", fontSize: 13, cursor: di === days.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>↓</button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 36 }}>
                {day.cats.length === 0 && (
                  <span style={{ fontSize: 12, color: isTarget ? "#a78bfa" : "#475569", padding: "6px 0" }}>
                    {isTarget ? "Soltar aquí" : "Sin grupos asignados"}
                  </span>
                )}
                {day.cats.map(cat => {
                  const isSelected = moving?.dayIdx === di && moving?.cat === cat;
                  return (
                    <div key={cat}
                      style={{ display: "flex", alignItems: "center", gap: 5, background: isSelected ? "rgba(167,139,250,0.35)" : "rgba(167,139,250,0.12)", border: `1px solid ${isSelected ? "rgba(167,139,250,0.8)" : "rgba(167,139,250,0.25)"}`, borderRadius: 20, padding: "6px 10px 6px 12px", cursor: "pointer", transition: "all .15s" }}>
                      <span
                        onClick={e => { e.stopPropagation(); selectForMove(di, cat); }}
                        style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "#fff" : "#c4b5fd", userSelect: "none" }}>
                        {isSelected ? "✋ " : ""}{catLabel(cat)}
                      </span>
                      <button onClick={e => { e.stopPropagation(); removeFromDay(di, cat); }}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 0 0 2px", fontFamily: "inherit" }}>✕</button>
                    </div>
                  );
                })}

                {!moving && (
                  <button onClick={e => { e.stopPropagation(); setAddingTo(addingTo === di ? null : di); }}
                    style={{ background: "rgba(74,222,128,0.1)", border: "1px dashed rgba(74,222,128,0.3)", borderRadius: 20, padding: "6px 12px", fontSize: 12, color: "#4ade80", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    + Añadir
                  </button>
                )}
              </div>

              {addingTo === di && !moving && (
                <div style={{ marginTop: 10, padding: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", marginBottom: 8 }}>AÑADIR GRUPO MUSCULAR</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ALL_CATS.map(([cat, label]) => {
                      const alreadyIn = day.cats.includes(cat);
                      return (
                        <button key={cat} onClick={() => !alreadyIn && addToDay(di, cat)} disabled={alreadyIn}
                          style={{ background: alreadyIn ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "5px 10px", fontSize: 11, color: alreadyIn ? "#334155" : "#e2e8f0", cursor: alreadyIn ? "default" : "pointer", fontFamily: "inherit" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p style={{ fontSize: 11, color: "#475569", textAlign: "center", marginBottom: 16 }}>
          Los ejercicios se regeneran automáticamente según los grupos que elijas.
        </p>
      </div>

      {/* Save bar — z-index 60 to appear above the tab bar (z-index 50) */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, padding: "12px 16px calc(env(safe-area-inset-bottom) + 80px)", background: "linear-gradient(transparent, #080d08 30%)", zIndex: 60 }}>
        <button onClick={save} style={{ ...C.btnA, background: "linear-gradient(135deg,#a78bfa,#7c3aed)", color: "#fff", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
          ✓ Guardar cambios y regenerar entrenamiento
        </button>
      </div>
    </div>
  );
}

// ── Swap (substitute exercise) Modal ──────────────────────────────
function SwapModal({ exerciseId, training, onPick, onClose }) {
  const availableEq = training.equipment && training.equipment.length > 0
    ? training.equipment
    : (training.place === "casa" ? HOME_DEFAULT : GYM_DEFAULT);
  const suggestions = recommendSubstitutes(exerciseId, {
    availableEq, location: training.place, maxResults: 8,
  });
  const original = byId(exerciseId);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 220, display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0d1a0d", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 18px 36px", width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Sustituir ejercicio · IA</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{original?.n}</h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>Alternativas según tu equipo y objetivo</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {suggestions.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            No encontramos alternativas con tu equipo disponible.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map(({ ex, reason, score }) => (
              <div key={ex.id} onClick={() => { onPick(ex.id); onClose(); }}
                style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", background: "rgba(255,255,255,0.025)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{ex.n}</div>
                  <div style={{ fontSize: 10, color: "#f59e0b", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{score}</div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{ex.m?.join(" · ")}</div>
                {reason && <div style={{ fontSize: 11, color: "#4ade80" }}>{reason}</div>}
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ ...C.btnS, width: "100%", marginTop: 18 }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Session Player ────────────────────────────────────────────────
function SessionPlayer({ entry, training, onComplete, onExit }) {
  const { logPR, state } = useApp();
  const absBlock = entry.hasAbs ? buildAbsBlock(training.level) : [];
  const initialPlan = [...buildSession(entry, training), ...absBlock];
  const [plan, setPlan] = useState(initialPlan);
  const [showPost, setShowPost] = useState(false);
  const [showWarmUp, setShowWarmUp] = useState(false);
  const [showCoolDown, setShowCoolDown] = useState(false);
  const warmUp   = buildWarmUp(initialPlan);
  const coolDown = buildCoolDown(initialPlan);
  const [done, setDone] = useState([]);
  const [restIdx, setRestIdx] = useState(null);
  const [restTime, setRestTime] = useState(0);
  const [prModal, setPrModal] = useState(null);
  const [techModal, setTechModal] = useState(null);
  const [swapModal, setSwapModal] = useState(null);
  const [ytModal, setYtModal] = useState(null);
  const intervalRef = useRef(null);

  const swapExercise = (idx, newId) => {
    setPlan(p => p.map((x, i) => i === idx ? { ...x, id: newId } : x));
  };

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

      {/* Warm-up */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setShowWarmUp(v => !v)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: showWarmUp ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${showWarmUp ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: showWarmUp ? "#4ade80" : "#64748b" }}>🌡️ Calentamiento ({warmUp.length} ejercicios)</span>
          <span style={{ color: "#64748b", fontSize: 14 }}>{showWarmUp ? "▲" : "▼"}</span>
        </button>
        {showWarmUp && (
          <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: "0 0 12px 12px", padding: "10px 14px", borderTop: "none" }}>
            {warmUp.map((w, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < warmUp.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(74,222,128,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#4ade80", flexShrink: 0 }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{w.label} <span style={{ fontSize: 11, color: "#4ade80", marginLeft: 4 }}>{w.reps || w.min && `${w.min} min`}</span></div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  <button onClick={() => setSwapModal({ idx, id: x.id })}
                    style={{ fontSize: 11, color: "#a78bfa", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    🔄 Sustituir
                  </button>
                  <button onClick={() => setYtModal(ex)}
                    style={{ fontSize: 11, color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    ▶ Ver
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

      {/* Abs section label */}
      {entry.hasAbs && plan.some(x => x._isAbs) && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8, paddingTop: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>⚡ Bloque Abdominales</div>
        </div>
      )}

      {/* Cardio badge */}
      {entry.hasCardio && (
        <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 12, padding: "10px 14px", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🚴</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd" }}>Cardio del día</div>
            <div style={{ fontSize: 11, color: "#475569" }}>Elige tipo y duración al finalizar · mín. 20 min</div>
          </div>
        </div>
      )}

      {/* Cool-down */}
      <div style={{ marginTop: 10, marginBottom: 4 }}>
        <button onClick={() => setShowCoolDown(v => !v)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: showCoolDown ? "rgba(96,165,250,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${showCoolDown ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: showCoolDown ? "#60a5fa" : "#64748b" }}>❄️ Enfriamiento ({coolDown.length} estiramientos)</span>
          <span style={{ color: "#64748b", fontSize: 14 }}>{showCoolDown ? "▲" : "▼"}</span>
        </button>
        {showCoolDown && (
          <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: "0 0 12px 12px", padding: "10px 14px", borderTop: "none" }}>
            {coolDown.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < coolDown.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#60a5fa", flexShrink: 0 }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{s.label} <span style={{ fontSize: 11, color: "#60a5fa", marginLeft: 4 }}>{s.reps}</span></div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete */}
      <button onClick={() => setShowPost(true)} style={{ ...C.btnA, marginTop: 12 }}>
        ✅ Completar entrenamiento
      </button>

      {/* Post-session modal */}
      {showPost && (
        <PostSessionModal
          sessionName={entry.name}
          muscles={[...new Set(plan.flatMap(x => byId(x.id)?.m || []))]}
          hasCardio={!!entry.hasCardio}
          onDone={(result) => { setShowPost(false); onComplete(result); }}
        />
      )}

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

      {/* Swap (substitute exercise) Modal */}
      {swapModal && (
        <SwapModal exerciseId={swapModal.id} training={training}
          onPick={(newId) => swapExercise(swapModal.idx, newId)}
          onClose={() => setSwapModal(null)} />
      )}

      {/* YouTube Tutorial Modal */}
      {ytModal && (
        <div onClick={() => setYtModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d0d0d", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "20px 20px 0 0", padding: "20px 18px 40px", width: "100%" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 9, margin: "0 auto 18px" }} />
            <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Tutorial de ejercicio</div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{ytModal.n}</h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 22 }}>{ytModal.m?.join(", ")}</p>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ytModal.n + " ejercicio técnica correcta")}&hl=es`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "15px 16px", background: "#dc2626", borderRadius: 13, color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>▶</span> Buscar en YouTube
            </a>
            <button onClick={() => setYtModal(null)} style={{ ...C.btnS, width: "100%", textAlign: "center", padding: "12px" }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session Detail (preview) ──────────────────────────────────────
function SessionDetailView({ entry, training, isCurrent, onBack, onStart, onSaveDone }) {
  const absBlock = entry.hasAbs ? buildAbsBlock(training.level) : [];
  const plan = buildSession(entry, training);
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    onSaveDone?.();
    setSaved(true);
  };
  return (
    <div style={{ minHeight: "100vh", background: "#080d08" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 16px", position: "sticky", top: 0, background: "#080d08", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onBack} style={{ ...C.btnS, fontSize: 11, padding: "7px 12px" }}>← Volver</button>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#f59e0b", fontWeight: 600, letterSpacing: 1 }}>VISTA PREVIA</span>
          {isCurrent
            ? <button onClick={onStart} style={{ ...C.btnA, width: "auto", padding: "8px 14px", fontSize: 12 }}>▶ Empezar</button>
            : <div style={{ width: 80 }} />}
        </div>
      </div>
      <div style={{ padding: "16px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px" }}>{entry.name}</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#64748b" }}>
            {plan.length} ejercicios · {estMin(plan)} min{isCurrent ? " · siguiente" : ""}
          </span>
          {entry.hasAbs && <span style={{ background: "rgba(167,139,250,0.12)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>⚡ Abdominales</span>}
          {entry.hasCardio && <span style={{ background: "rgba(96,165,250,0.1)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#93c5fd", fontWeight: 700 }}>🚴 Cardio</span>}
        </div>
        {plan.map((x, idx) => {
          const ex = byId(x.id);
          if (!ex) return null;
          return (
            <div key={idx} style={{ ...C.card, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#f59e0b", flexShrink: 0, fontFamily: "'DM Mono',monospace" }}>{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{ex.n}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>{ex.m?.join(", ")}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "3px 8px", fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono',monospace" }}>{x.sets} × {x.reps}</span>
                    <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "3px 8px", fontSize: 11, color: "#64748b" }}>{x.rest}s descanso</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* Abs block preview */}
        {absBlock.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid rgba(167,139,250,0.15)", margin: "12px 0 8px", paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>⚡ Bloque Abdominales</div>
            </div>
            {absBlock.map((x, idx) => {
              const ex = byId(x.id);
              if (!ex) return null;
              return (
                <div key={idx} style={{ ...C.card, marginBottom: 10, border: "1px solid rgba(167,139,250,0.15)", background: "rgba(167,139,250,0.04)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>⚡</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{ex.n}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ background: "rgba(167,139,250,0.1)", borderRadius: 8, padding: "3px 8px", fontSize: 11, color: "#c4b5fd", fontFamily: "'DM Mono',monospace" }}>{x.sets} × {x.reps}</span>
                        <span style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "3px 8px", fontSize: 11, color: "#64748b" }}>{x.rest}s descanso</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Cardio notice in detail view */}
        {entry.hasCardio && (
          <div style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 12, padding: "12px 14px", marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", marginBottom: 3 }}>🚴 Cardio del día</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Elige tipo y duración al finalizar la sesión · mínimo 20 min</div>
          </div>
        )}

        {isCurrent && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={onStart} style={{ ...C.btnA, flex: 2 }}>▶ Empezar entrenamiento</button>
            <button onClick={handleSave} style={{ flex: 1, background: saved ? "rgba(74,222,128,0.08)" : "rgba(245,158,11,0.12)", border: `1px solid ${saved ? "rgba(74,222,128,0.25)" : "rgba(245,158,11,0.3)"}`, borderRadius: 11, padding: "13px 8px", fontSize: 12, fontWeight: 700, color: saved ? "#4ade80" : "#f59e0b", cursor: "pointer", fontFamily: "inherit" }}>
              {saved ? "✓ Guardado" : "💾 Guardar sesión"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Day Detail Modal ──────────────────────────────────────────────
function DayDetailModal({ dateStr, daily, onClose }) {
  const log = daily?.[dateStr] || {};
  const { nutrition, training } = log;
  const [y, m, d] = dateStr.split("-");
  const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const DAYS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const dt = new Date(`${dateStr}T12:00:00`);
  const dateLabel = `${DAYS[dt.getDay()]} ${+d} de ${MONTHS[+m - 1]} ${y}`;
  const hasData = nutrition || training || log.trained;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0a120a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 18px 0" }}>
          <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 9, margin: "0 auto 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>Resumen del día</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0, textTransform: "capitalize" }}>{dateLabel}</h2>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ padding: "0 18px 36px" }}>
          {/* Nutrition */}
          {nutrition ? (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>🥗 Nutrición</div>
              {nutrition.meals?.map((m, mi) => (
                <div key={mi} style={{ marginBottom: 12, background: "rgba(255,255,255,0.025)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#a3e635", marginBottom: 6 }}>{m.name}</div>
                  {m.items?.map((it, ii) => (
                    <div key={ii} style={{ fontSize: 12, color: "#94a3b8", padding: "2px 0" }}>• {it.name} — {it.grams}g</div>
                  ))}
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    {Math.round(m.totals?.p || 0)}g P · {Math.round(m.totals?.c || 0)}g HC · {Math.round(m.totals?.f || 0)}g G · {m.totals?.kcal || 0} kcal
                  </div>
                </div>
              ))}
              <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#86efac", fontWeight: 600 }}>
                TOTAL: {Math.round(nutrition.totals?.p || 0)}g P · {Math.round(nutrition.totals?.c || 0)}g HC · {Math.round(nutrition.totals?.f || 0)}g G · {nutrition.totals?.kcal || 0} kcal
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 18, padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: 10, fontSize: 12, color: "#334155", textAlign: "center" }}>
              Sin registro de nutrición este día
            </div>
          )}

          {/* Training */}
          {training ? (
            <div>
              <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>🏋️ Entrenamiento</div>
              <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 12, padding: "12px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>{training.name}</div>
                {training.muscles?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {training.muscles.map((m, i) => (
                      <span key={i} style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: "3px 9px", fontSize: 11, color: "#f59e0b" }}>{m}</span>
                    ))}
                  </div>
                )}
                {training.exercises?.map((ex, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#94a3b8", padding: "3px 0" }}>• {ex.name} — {ex.sets}×{ex.reps}</div>
                ))}
                {training.rpe && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>RPE:</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: training.rpe >= 8 ? "#ef4444" : training.rpe >= 6 ? "#f59e0b" : "#4ade80" }}>{training.rpe}/10</span>
                  </div>
                )}
                {training.cardio && (() => {
                  const c = CARDIO_MENU.find(x => x.id === training.cardio.id);
                  return c ? (
                    <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 6 }}>
                      {c.ic} {c.n} · {training.cardio.min} min
                    </div>
                  ) : null;
                })()}
                {training.hasAbs && <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 4 }}>⚡ Bloque abdominales completado</div>}
                {training.kcal > 0 && <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>🔥 {training.kcal} kcal quemadas</div>}
              </div>
            </div>
          ) : log.trained ? (
            <div style={{ padding: "12px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 10, fontSize: 12, color: "#92400e" }}>
              🏋️ Entrenó este día (sin detalle)
            </div>
          ) : (
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: 10, fontSize: 12, color: "#334155", textAlign: "center" }}>
              Sin registro de entrenamiento este día
            </div>
          )}

          {!hasData && (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#334155", fontSize: 13 }}>Sin actividad registrada</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Training Calendar ─────────────────────────────────────────────
function TrainingCalendar({ done = [], daily = {}, onDayPress }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const WEEK = ["L","M","X","J","V","S","D"];
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthPfx = `${year}-${String(month+1).padStart(2,"0")}`;
  const trainedThisMonth = (daily ? Object.entries(daily).filter(([k, v]) => k.startsWith(monthPfx) && (v.training || v.trained)) : []).length;
  const nutThisMonth = (daily ? Object.entries(daily).filter(([k, v]) => k.startsWith(monthPfx) && v.nutrition) : []).length;

  return (
    <div style={{ ...C.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", padding: "0 6px", lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{MONTHS[month]} {year}</span>
        <button onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", padding: "0 6px", lineHeight: 1 }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
        {WEEK.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#475569" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ds = `${monthPfx}-${String(d).padStart(2,"0")}`;
          const log = daily?.[ds] || {};
          const hasTrain = !!(log.training || log.trained);
          const hasNut = !!log.nutrition;
          const isToday = ds === today;
          const bg = (hasTrain && hasNut) ? "rgba(250,200,40,0.18)" : hasTrain ? "rgba(245,158,11,0.18)" : hasNut ? "rgba(74,222,128,0.12)" : isToday ? "rgba(255,255,255,0.06)" : "transparent";
          const numColor = hasTrain ? "#fbbf24" : hasNut ? "#4ade80" : isToday ? "#f59e0b" : "#475569";
          return (
            <div key={d} onClick={() => (hasTrain || hasNut || log.trained) && onDayPress?.(ds)}
              style={{ aspectRatio: "1", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: bg, border: `1px solid ${isToday ? "rgba(245,158,11,0.45)" : "transparent"}`, cursor: (hasTrain || hasNut || log.trained) ? "pointer" : "default" }}>
              <span style={{ fontSize: 12, fontWeight: (hasTrain || hasNut || isToday) ? 700 : 400, color: numColor, lineHeight: 1.2 }}>{d}</span>
              <div style={{ display: "flex", gap: 2, marginTop: 1 }}>
                {hasTrain && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#f59e0b" }} />}
                {hasNut && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ade80" }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 12, fontSize: 11, color: "#475569" }}>
        {trainedThisMonth > 0 && <span><span style={{ color: "#f59e0b" }}>●</span> {trainedThisMonth} entrenos</span>}
        {nutThisMonth > 0 && <span><span style={{ color: "#4ade80" }}>●</span> {nutThisMonth} dietas</span>}
        {trainedThisMonth === 0 && nutThisMonth === 0 && <span>Sin registros este mes</span>}
      </div>
    </div>
  );
}

// ── Main Entrenamiento ────────────────────────────────────────────
export default function Entrenamiento({ onNavigate }) {
  const { state, setState, markTrained, todayLog } = useApp();
  const training = state.training;
  const [view, setView] = useState(() => state.training._view || "home");
  const [onbStep, setOnbStep] = useState(() => state.training._onbStep || 0);
  const [onbAnswers, setOnbAnswers] = useState(() => state.training._onbAnswers || {});
  const [kcalInput, setKcalInput] = useState("");
  const [showKcal, setShowKcal] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const setupDone = training.seq && training.seq.length > 0;

  // Only show "trained today" if a workout was actually completed today
  const todayKey = new Date().toISOString().slice(0, 10);
  const trainedToday = (training.done || []).some(d => d.date?.slice(0, 10) === todayKey);

  const cursor    = training.cursor || 0;
  const seq       = training.seq || [];
  const nextWO    = seq[cursor % seq.length];

  // Persist view & onboarding state across tab switches
  const persistView = (v) => {
    setView(v);
    setState(s => ({ ...s, training: { ...s.training, _view: v } }));
  };
  const persistOnb = (answers, step) => {
    setOnbAnswers(answers);
    setOnbStep(step);
    setState(s => ({ ...s, training: { ...s.training, _onbStep: step, _onbAnswers: answers } }));
  };

  const finishSetup = (answers) => {
    const merged = { ...training, ...answers, streak: 0, hist: {}, done: [], chat: [], _onbStep: 0, _onbAnswers: {}, _view: "home" };
    if (!merged.equipment || merged.equipment.length === 0) {
      merged.equipment = merged.place === "casa" ? HOME_DEFAULT : GYM_DEFAULT;
    }
    const newTraining = buildSchedule(merged);
    setState(s => ({ ...s, training: newTraining }));
    setOnbStep(0);
    setOnbAnswers({});
    setView("home");
  };

  const goToConfig = () => {
    const prefilled = Object.fromEntries(
      [["place", training.place], ["goal", training.goal], ["days", training.days], ["time", training.time], ["level", training.level]]
        .filter(([, v]) => v !== undefined && v !== null)
    );
    persistOnb(prefilled, 0);
    persistView("config-edit");
  };

  const resetAll = () => {
    if (!window.confirm("¿Empezar desde cero? Se perderán las sesiones completadas y tu racha actual.")) return;
    setOnbAnswers({});
    setOnbStep(0);
    setState(s => ({ ...s, training: { seq: [], cursor: 0, streak: 0, done: [], chat: [], _onbStep: 0, _onbAnswers: {}, _view: "home" } }));
  };

  const regenerateWithAI = () => {
    if (!window.confirm("¿Generar una rutina nueva con IA basada en tu equipo, objetivo y tiempo?")) return;
    const equipment = training.equipment && training.equipment.length > 0
      ? training.equipment
      : (training.place === "casa" ? HOME_DEFAULT : GYM_DEFAULT);
    const sessions = generateRoutine({
      goal: training.goal,
      days: training.days,
      time: training.time,
      level: training.level,
      place: training.place,
      availableEq: equipment,
      priorities: [],
    });
    setState(s => ({
      ...s,
      training: { ...s.training, seq: sessions, cursor: 0, weekStarted: false, done: [], streak: 0, equipment }
    }));
  };

  const logWorkoutToDaily = (entry, kcalBurned = 0, postResult = {}) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const absBlock = entry?.hasAbs ? buildAbsBlock(training.level) : [];
    const plan = [...buildSession(entry, training), ...absBlock];
    const muscles = [...new Set(plan.flatMap(x => byId(x.id)?.m || []))];
    const exercises = plan.map(x => ({ id: x.id, name: byId(x.id)?.n || "", sets: x.sets, reps: x.reps }));
    setState(s => ({
      ...s,
      daily: {
        ...s.daily,
        [todayStr]: {
          ...(s.daily[todayStr] || {}),
          trained: true,
          watchKcal: kcalBurned || (s.daily[todayStr]?.watchKcal || 0),
          training: {
            name: entry?.name || "",
            muscles, exercises, kcal: kcalBurned,
            rpe: postResult.rpe || null,
            cardio: postResult.cardio || null,
            hasAbs: !!entry?.hasAbs,
            savedAt: Date.now()
          }
        }
      }
    }));
  };

  const completeWorkout = (postResult = {}) => {
    const kcalBurned = +kcalInput || todayLog.watchKcal || 0;
    markTrained(kcalBurned);
    logWorkoutToDaily(nextWO, kcalBurned, postResult);
    setState(s => ({
      ...s,
      training: {
        ...s.training,
        cursor: (s.training.cursor || 0) + 1,
        weekStarted: true,
        lastTrainTs: Date.now(),
        done: [...(s.training.done || []), { name: nextWO?.name, date: new Date().toISOString(), kcal: kcalBurned, rpe: postResult.rpe }],
        streak: (s.training.streak || 0) + 1,
      }
    }));
    persistView("home");
    setKcalInput("");
  };

  if (!setupDone) {
    return (
      <div style={{ background: "#080d08", minHeight: "100vh" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#f59e0b", letterSpacing: 2, fontWeight: 500 }}>ENTRENO</span>
        </div>
        <Onboarding
          step={onbStep}
          answers={onbAnswers}
          onPick={persistOnb}
          onBack={() => persistOnb(onbAnswers, Math.max(0, onbStep - 1))}
          onDone={finishSetup}
        />
      </div>
    );
  }

  if (view === "playing" && nextWO) {
    return (
      <SessionPlayer entry={nextWO} training={training}
        onComplete={completeWorkout} onExit={() => persistView("home")} />
    );
  }

  if (view === "plan-editor") {
    return (
      <PlanEditor seq={seq} training={training}
        onSave={(newSeq) => {
          setState(s => ({ ...s, training: { ...s.training, seq: newSeq, cursor: 0 } }));
          persistView("home");
        }}
        onClose={() => persistView("home")} />
    );
  }

  if (view === "session-detail" && selectedIdx !== null && seq[selectedIdx]) {
    const entry = seq[selectedIdx];
    const currentPos = cursor % seq.length;
    return (
      <SessionDetailView
        entry={entry}
        training={training}
        isCurrent={selectedIdx === currentPos}
        onBack={() => persistView("home")}
        onStart={() => persistView("playing")}
        onSaveDone={() => {
          logWorkoutToDaily(entry, 0);
          markTrained(0);
          setState(s => ({
            ...s,
            training: {
              ...s.training,
              cursor: (s.training.cursor || 0) + 1,
              weekStarted: true,
              lastTrainTs: Date.now(),
              done: [...(s.training.done || []), { name: entry?.name, date: new Date().toISOString(), kcal: 0 }],
              streak: (s.training.streak || 0) + 1,
            }
          }));
        }}
      />
    );
  }

  if (view === "config-edit") {
    return (
      <div style={{ background: "#080d08", minHeight: "100vh" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 10px", position: "sticky", top: 0, background: "#080d08", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => persistView("home")} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>← Cancelar</button>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#f59e0b", letterSpacing: 2, fontWeight: 500 }}>CONFIGURACIÓN</span>
            <div style={{ width: 70 }} />
          </div>
        </div>
        <Onboarding
          step={onbStep}
          answers={onbAnswers}
          onPick={(answers, nextStep) => persistOnb(answers, nextStep)}
          onBack={() => onbStep === 0 ? persistView("home") : persistOnb(onbAnswers, onbStep - 1)}
          onDone={(final) => finishSetup(final)}
        />
      </div>
    );
  }

  return (
    <div style={{ background: "#080d08", minHeight: "100vh" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 10px", position: "sticky", top: 0, background: "#080d08", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#f59e0b", letterSpacing: 2, fontWeight: 500 }}>ENTRENO</span>
          <button onClick={goToConfig} title="Editar configuración"
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>⚙️</button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Goal Date Countdown */}
        <GoalDateCard training={training} setState={setState} />

        {/* Migration notice: old plans don't have abs/cardio flags */}
        {seq.length > 0 && !seq.some(e => e.hasAbs !== undefined) && (
          <div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd", marginBottom: 4 }}>⚡ Nuevas funciones disponibles</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Abdominales 2x/semana, cardio después de sesiones, calentamiento y más. Regenera tu plan para activarlas.</div>
            <button onClick={() => { if (window.confirm("¿Regenerar el plan con abdominales y cardio?")) { finishSetup({ place: training.place, goal: training.goal, days: training.days, time: training.time, level: training.level }); }}}
              style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#c4b5fd", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              🔄 Regenerar plan ahora
            </button>
          </div>
        )}

        {/* Today status */}
        {trainedToday ? (
          <div style={{ ...C.card, background: "rgba(74,222,128,0.05)", borderColor: "rgba(74,222,128,0.2)", textAlign: "center", padding: "24px 16px" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#4ade80", margin: "0 0 6px" }}>Hoy ya entrenaste</h2>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Descansa. El músculo crece fuera del gimnasio.</p>
          </div>
        ) : (
          <div style={{ ...C.card, background: "linear-gradient(160deg,#1a1200,rgba(54,48,36,.5))", borderColor: "rgba(245,158,11,0.2)" }}>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Siguiente en tu plan</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px" }}>{nextWO?.name}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{buildSession(nextWO, training).length} ejercicios · {estMin(buildSession(nextWO, training))} min</span>
              {nextWO?.hasAbs && <span style={{ fontSize: 11, color: "#a78bfa", background: "rgba(167,139,250,0.12)", borderRadius: 10, padding: "1px 9px", fontWeight: 700 }}>⚡ Abdominales</span>}
              {nextWO?.hasCardio && <span style={{ fontSize: 11, color: "#60a5fa", background: "rgba(96,165,250,0.1)", borderRadius: 10, padding: "1px 9px", fontWeight: 700 }}>🚴 Cardio</span>}
            </div>

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

            <button onClick={() => persistView("playing")} style={C.btnA}>Empezar entrenamiento →</button>
          </div>
        )}

        {/* Sequence */}
        <div style={C.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={C.lbl}>Tu secuencia de entrenos</span>
            <button onClick={() => persistView("plan-editor")}
              style={{ fontSize: 11, color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 9, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, whiteSpace: "nowrap" }}>
              ✏️ Personalizar
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>No es por días fijos. Avanza cuando completes cada sesión.</p>
          {seq.map((e, i) => {
            const pos = cursor % seq.length;
            const isPast = i < pos;
            const isCurrent = i === pos;
            return (
              <div key={i} onClick={() => { setSelectedIdx(i); persistView("session-detail"); }}
                style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < seq.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", alignItems: "center", cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: isCurrent ? "#f59e0b" : isPast ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)", color: isCurrent ? "#000" : isPast ? "#4ade80" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isCurrent ? 12 : 14, fontWeight: 800, flexShrink: 0 }}>
                  {isCurrent ? "▶" : isPast ? "✓" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? "#fbbf24" : "#e2e8f0" }}>{e.name}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{buildSession(e, training).length} ej · {estMin(buildSession(e, training))} min</span>
                    {e.hasAbs && <span style={{ fontSize: 10, color: "#a78bfa", background: "rgba(167,139,250,0.1)", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>⚡ Abs</span>}
                    {e.hasCardio && <span style={{ fontSize: 10, color: "#60a5fa", background: "rgba(96,165,250,0.08)", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>🚴 Cardio</span>}
                    {isCurrent && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>· siguiente</span>}
                  </div>
                </div>
                <span style={{ color: "#334155", fontSize: 18, flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>

        {/* Stats + Mesocycle */}
        {(training.done?.length > 0 || training.streak > 0) && (() => {
          const doneCount = training.done?.length || 0;
          const daysPerWeek = training.days || 4;
          const cycleSessions = daysPerWeek * 4;
          const posInCycle = doneCount % cycleSessions;
          const weekInCycle = Math.min(4, Math.floor(posInCycle / daysPerWeek) + 1);
          const phase = MESOCYCLE_PHASES[weekInCycle - 1];
          const cycleNum = Math.floor(doneCount / cycleSessions) + 1;
          return (
            <div style={{ ...C.card }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>{doneCount}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Sesiones</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 700, color: "#4ade80" }}>{training.streak || 0}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Racha</div>
                </div>
              </div>
              <div style={{ background: `${phase.color}12`, border: `1px solid ${phase.color}30`, borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ fontSize: 10, color: phase.color, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    Mesociclo {cycleNum} · Semana {weekInCycle}/4
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[1,2,3,4].map(w => (
                      <div key={w} style={{ width: 14, height: 14, borderRadius: 4, background: w <= weekInCycle ? phase.color : "rgba(255,255,255,0.08)" }} />
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{phase.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{phase.desc}</div>
              </div>
            </div>
          );
        })()}

        {/* Calendar */}
        <TrainingCalendar done={training.done || []} daily={state.daily || {}} onDayPress={ds => setSelectedDay(ds)} />

        {/* Recovery Map */}
        <RecoveryMap daily={state.daily || {}} />

        {/* AI regenerate */}
        <button onClick={regenerateWithAI}
          style={{ ...C.btnA, background: "linear-gradient(135deg,#a78bfa,#7c3aed)", color: "#fff", marginTop: 4 }}>
          🤖 Generar rutina inteligente con IA
        </button>

        {/* Reset */}
        <button onClick={() => { if (window.confirm("¿Regenerar el plan desde cero?")) { finishSetup({ place: training.place, goal: training.goal, days: training.days, time: training.time, level: training.level }); }}}
          style={{ ...C.btnS, width: "100%", marginTop: 8 }}>🔄 Regenerar plantilla clásica</button>
        <button onClick={resetAll}
          style={{ ...C.btnS, width: "100%", marginTop: 8, color: "#f87171", borderColor: "rgba(248,113,113,0.2)" }}>
          🗑️ Empezar desde cero
        </button>
      </div>
      {selectedDay && <DayDetailModal dateStr={selectedDay} daily={state.daily || {}} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}
