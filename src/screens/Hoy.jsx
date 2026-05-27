import { useState } from "react";
import { useApp } from "../store/AppContext";
import { getDailyQuote } from "../data/quotes";

const doHardReload = () => {
  if ("caches" in window) {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => window.location.reload(true));
  } else {
    window.location.reload(true);
  }
};

const S = {
  card:   { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16, marginBottom: 12 },
  lbl:    { color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8, display: "block" },
  val:    { fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 700, lineHeight: 1 },
  badge:  { display: "inline-block", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, letterSpacing: ".04em" },
};

function MacroBar({ label, value, max, color, unit = "g" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span style={{ color, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{value}<span style={{ color: "#475569", fontWeight: 400 }}>/{max}{unit}</span></span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 9, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 9, transition: "width .5s" }} />
      </div>
    </div>
  );
}

function Ring({ value, max, color, label, sub }) {
  const r = 42, stroke = 6;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const dash = pct * circ;
  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'DM Mono',monospace" }}>{value}</span>
        <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600, letterSpacing: ".06em" }}>{sub}</span>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function Hoy({ onNavigate, updateReady, checking, onCheckUpdate }) {
  const { state, todayLog, setTodayLog, getEffectiveMacros } = useApp();
  const [watchInput, setWatchInput] = useState(todayLog.watchKcal || 0);
  const [showWatchEdit, setShowWatchEdit] = useState(false);

  const quote = getDailyQuote();
  const macros = getEffectiveMacros();
  const plan = state.nutrition.nutrition?.planData || state.nutrition.planData;
  const creatineOn = state.nutrition.creatineOn !== false;
  const creatineG  = state.nutrition.creatineG || 5;

  const today = new Date();
  const dayNames = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const dayName = dayNames[today.getDay()];
  const dateStr = today.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

  const trained   = todayLog.trained === true;
  const restDay   = todayLog.trained === false;
  const undecided = todayLog.trained === null || todayLog.trained === undefined;

  // Next workout from training sequence
  const seq = state.training.seq || [];
  const cursor = state.training.cursor || 0;
  const nextWO = seq[cursor % seq.length];

  // Reminder for today
  const todayKeyName = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"][today.getDay()];
  const remDays = state.reminders?.days || {};
  const remTime = state.reminders?.time || "18:30";
  const isTodayReminderDay = !!remDays[todayKeyName];
  const showReminderBanner = isTodayReminderDay && undecided;

  const kcalBase = macros.kcal;
  const kcalBurned = macros.watchKcal || 0;
  const kcalAvailable = kcalBase;

  return (
    <div className="screen-enter" style={{ padding: "0 16px 16px" }}>
      {/* Header */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 24px) 0 16px", position: "sticky", top: 0, background: "linear-gradient(#080d08 75%, transparent)", zIndex: 5 }}>
        <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase" }}>{dayName} · {dateStr}</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "4px 0 0", color: "#f1f5f9" }}>Buenos días 👋</h1>
      </div>

      {/* Training reminder banner */}
      {showReminderBanner && (
        <div style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.07))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⏰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>Hoy toca entrenar</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Tienes recordatorio a las {remTime}. ¡Tú puedes!</div>
          </div>
          <button onClick={() => setTodayLog({ trained: true })}
            style={{ background: "#f59e0b", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: "#000", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            ✓ Voy
          </button>
        </div>
      )}

      {/* Quote card */}
      <div style={{ ...S.card, background: "linear-gradient(135deg,rgba(96,165,250,0.08),rgba(74,222,128,0.05))", borderColor: "rgba(96,165,250,0.15)", marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, fontStyle: "italic", margin: "0 0 6px" }}>"{quote.text}"</p>
        {quote.author && <p style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, margin: 0 }}>— {quote.author}</p>}
      </div>

      {/* Training status */}
      <div style={{ ...S.card, borderColor: trained ? "rgba(245,158,11,0.3)" : restDay ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.07)" }}>
        <span style={S.lbl}>¿Entrenas hoy?</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: trained ? 14 : 0 }}>
          <button className="tap-scale" onClick={() => setTodayLog({ trained: true })}
            style={{ padding: "12px 8px", borderRadius: 12, border: `1.5px solid ${trained ? "#f59e0b" : "rgba(255,255,255,0.08)"}`, background: trained ? "rgba(245,158,11,0.1)" : "transparent", color: trained ? "#fbbf24" : "#64748b", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            🏋️ Sí, entreno
          </button>
          <button className="tap-scale" onClick={() => setTodayLog({ trained: false })}
            style={{ padding: "12px 8px", borderRadius: 12, border: `1.5px solid ${restDay ? "#60a5fa" : "rgba(255,255,255,0.08)"}`, background: restDay ? "rgba(96,165,250,0.1)" : "transparent", color: restDay ? "#60a5fa" : "#64748b", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            😴 Día descanso
          </button>
        </div>

        {restDay && (
          <div style={{ padding: "10px 12px", background: "rgba(96,165,250,0.07)", borderRadius: 10, fontSize: 12, color: "#93c5fd" }}>
            Macros ajustados: <strong>↓ carbos · ↑ grasas</strong> para día de descanso
          </div>
        )}

        {/* Apple Watch data */}
        {trained && (
          <div style={{ marginTop: 4 }}>
            {kcalBurned > 0 && (todayLog.watchType || todayLog.watchMin > 0) ? (
              <div style={{ padding: "12px 14px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>⌚ Apple Watch</div>
                  <button onClick={() => setShowWatchEdit(!showWatchEdit)}
                    style={{ background: "none", border: "none", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✏️ Editar</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: todayLog.watchMin > 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8, textAlign: "center" }}>
                  {todayLog.watchMin > 0 && (
                    <div style={{ padding: "8px 6px", background: "rgba(0,0,0,0.15)", borderRadius: 8 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#fde68a", fontFamily: "'DM Mono',monospace" }}>{todayLog.watchMin}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>min</div>
                    </div>
                  )}
                  <div style={{ padding: "8px 6px", background: "rgba(0,0,0,0.15)", borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#f97316", fontFamily: "'DM Mono',monospace" }}>{kcalBurned}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>kcal</div>
                  </div>
                  <div style={{ padding: "8px 6px", background: "rgba(0,0,0,0.15)", borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#4ade80", fontFamily: "'DM Mono',monospace" }}>+{Math.round(kcalBurned / 4)}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>g carbos</div>
                  </div>
                </div>
                {todayLog.watchType && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, textAlign: "center" }}>{todayLog.watchType}</div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>⌚ Kcal quemadas (Apple Watch)</div>
                  <button onClick={() => setShowWatchEdit(!showWatchEdit)}
                    style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {kcalBurned > 0 ? `${kcalBurned} kcal ✏️` : "+ Añadir"}
                  </button>
                </div>
                {kcalBurned > 0 && (
                  <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 10, fontSize: 12, color: "#fde68a" }}>
                    +{Math.round(kcalBurned / 4)}g carbos extra añadidos al presupuesto de hoy
                  </div>
                )}
              </div>
            )}
            {showWatchEdit && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <input type="number" value={watchInput} onChange={e => setWatchInput(+e.target.value)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontFamily: "'DM Mono',monospace", fontSize: 18, textAlign: "center", outline: "none" }}
                  placeholder="0" />
                <button onClick={() => { setTodayLog({ watchKcal: watchInput }); setShowWatchEdit(false); }}
                  style={{ padding: "10px 16px", background: "#f59e0b", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  OK
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kcal & Macros */}
      <div style={{ ...S.card, background: "rgba(74,222,128,0.03)", borderColor: "rgba(74,222,128,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
          <div>
            <span style={S.lbl}>Presupuesto calórico</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ ...S.val, color: "#4ade80", fontSize: 34 }}>{kcalAvailable}</span>
              <span style={{ color: "#475569", fontSize: 13 }}>kcal</span>
            </div>
            {kcalBurned > 0 && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 2 }}>⌚ +{kcalBurned} quemadas incluidas</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            {trained   && <span style={{ ...S.badge, background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>DÍA ENTRENO</span>}
            {restDay   && <span style={{ ...S.badge, background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>DESCANSO</span>}
            {undecided && <span style={{ ...S.badge, background: "rgba(255,255,255,0.06)", color: "#64748b" }}>SIN DEFINIR</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <Ring value={macros.proteina} max={macros.proteina} color="#4ade80" label="Proteína" sub="g" />
          <Ring value={macros.carbos}   max={macros.carbos}   color="#60a5fa" label="Carbos"   sub="g" />
          <Ring value={macros.grasas}   max={macros.grasas}   color="#f59e0b" label="Grasas"   sub="g" />
        </div>

        <div style={{ fontSize: 11, color: "#475569", textAlign: "center", fontStyle: "italic" }}>
          Pesos objetivo del día · Márcalos al comer para ver el balance
        </div>
      </div>

      {/* Creatine reminder */}
      {creatineOn && (
        <div style={{ ...S.card, borderColor: "rgba(168,85,247,0.2)", background: "rgba(168,85,247,0.04)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>💊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#c084fc" }}>Creatina al mediodía</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{creatineG}g · Mezclada con agua o con la comida</div>
          </div>
        </div>
      )}

      {/* Next workout */}
      {nextWO && (
        <div style={{ ...S.card, borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.03)" }}>
          <span style={S.lbl}>Próximo entrenamiento</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24" }}>{nextWO.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{nextWO.base?.length || 0} ejercicios</div>
            </div>
            <button className="tap-scale" onClick={() => onNavigate("entreno")}
              style={{ padding: "10px 16px", background: "#f59e0b", border: "none", borderRadius: 12, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Empezar →
            </button>
          </div>
        </div>
      )}

      {/* Update button */}
      <div style={{ marginBottom: 12 }}>
        {updateReady ? (
          <button onClick={doHardReload}
            style={{ width: "100%", padding: "13px", background: "#16a34a", border: "none", borderRadius: 13, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            🔄 Actualizar app — nueva versión disponible
          </button>
        ) : (
          <button onClick={onCheckUpdate} disabled={checking}
            style={{ width: "100%", padding: "11px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 13, color: checking ? "#475569" : "#64748b", fontWeight: 500, fontSize: 12, cursor: checking ? "default" : "pointer", fontFamily: "inherit" }}>
            {checking ? "Buscando actualización…" : "🔄 Buscar actualización"}
          </button>
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button className="tap-scale" onClick={() => onNavigate("nutri")}
          style={{ padding: "16px 12px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 14, color: "#4ade80", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
          🥗<br /><span style={{ fontSize: 11, fontWeight: 500, color: "#64748b" }}>Ver plan nutricional</span>
        </button>
        <button className="tap-scale" onClick={() => onNavigate("progreso")}
          style={{ padding: "16px 12px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 14, color: "#a78bfa", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
          📊<br /><span style={{ fontSize: 11, fontWeight: 500, color: "#64748b" }}>Ver progreso</span>
        </button>
      </div>
    </div>
  );
}
