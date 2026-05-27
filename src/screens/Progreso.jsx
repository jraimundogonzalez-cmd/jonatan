import { useState } from "react";
import { useApp } from "../store/AppContext";
import { byId } from "../data/exercises";

// Body fat estimation (Deurenberg formula)
function estimateBodyFat(weight, heightCm, age, sex) {
  if (!weight || !heightCm || !age) return null;
  const h = heightCm / 100;
  const bmi = weight / (h * h);
  const isMale = sex !== "m";
  const bf = 1.20 * bmi + 0.23 * age - (isMale ? 16.2 : 5.4);
  return Math.max(5, Math.min(50, +bf.toFixed(1)));
}

function BodyCompositionCard({ measurements, profile }) {
  const latest = measurements[measurements.length - 1];
  const first  = measurements[0];
  if (!latest) return null;

  const { sex = "h", age = 30, height = 175 } = profile || {};
  const bfLatest = estimateBodyFat(latest.weight, height, age, sex);
  const bfFirst  = first !== latest ? estimateBodyFat(first.weight, height, age, sex) : null;

  const leanKg  = bfLatest && latest.weight ? +(latest.weight * (1 - bfLatest / 100)).toFixed(1) : null;
  const fatKg   = bfLatest && latest.weight ? +(latest.weight * (bfLatest / 100)).toFixed(1) : null;

  const bfCategory = !bfLatest ? "" :
    sex === "m" ? (bfLatest < 14 ? "Atlético" : bfLatest < 21 ? "En forma" : bfLatest < 26 ? "Promedio" : "Alto") :
    (bfLatest < 21 ? "Atlético" : bfLatest < 28 ? "En forma" : bfLatest < 35 ? "Promedio" : "Alto");
  const bfColor = bfLatest ? (bfLatest < 15 ? "#4ade80" : bfLatest < 22 ? "#f59e0b" : bfLatest < 28 ? "#f97316" : "#ef4444") : "#64748b";

  return (
    <div style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>Composición Corporal</div>
      {bfLatest && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 800, color: bfColor }}>{bfLatest}%</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>GRASA CORPORAL</div>
              <div style={{ fontSize: 10, color: bfColor, fontWeight: 700 }}>{bfCategory}</div>
            </div>
            {leanKg && <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 800, color: "#4ade80" }}>{leanKg}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>KG MÚSCULO</div>
            </div>}
            {fatKg && <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 800, color: "#f87171" }}>{fatKg}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>KG GRASA</div>
            </div>}
          </div>

          {/* Visual bar */}
          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 9, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ width: `${bfLatest}%`, height: "100%", background: `linear-gradient(90deg, ${bfColor}, ${bfColor}88)`, borderRadius: 9 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}>
            <span style={{ color: "#4ade80" }}>5% (mínimo)</span>
            <span style={{ color: "#f59e0b" }}>15-20% (atlético)</span>
            <span style={{ color: "#ef4444" }}>+30%</span>
          </div>
        </>
      )}

      {bfFirst && bfLatest && bfFirst !== bfLatest && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, fontSize: 12 }}>
          <span style={{ color: "#64748b" }}>Inicio: {bfFirst}% → Ahora: {bfLatest}% </span>
          <span style={{ color: bfLatest < bfFirst ? "#4ade80" : "#ef4444", fontWeight: 700 }}>
            {bfLatest < bfFirst ? "↓" : "↑"}{Math.abs(+(bfLatest - bfFirst).toFixed(1))}%
          </span>
        </div>
      )}

      {latest.waist && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 12, color: "#64748b" }}>
          Cintura/cadera: {latest.waist && latest.hips
            ? `${+(latest.waist / latest.hips).toFixed(2)} ratio`
            : `${latest.waist} cm cintura`}
          {latest.waist && height && (
            <span style={{ marginLeft: 8, color: latest.waist / height < 0.5 ? "#4ade80" : "#f59e0b" }}>
              · ratio cint/altura: {+(latest.waist / height).toFixed(2)}
            </span>
          )}
        </div>
      )}
      <p style={{ fontSize: 10, color: "#334155", marginTop: 8, marginBottom: 0 }}>
        Estimación basada en fórmula Deurenberg (BMI + edad). Mide con báscula de bioimpedancia para mayor precisión.
      </p>
    </div>
  );
}

const C = {
  card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 12 },
  inp:  { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 14, fontFamily: "inherit", width: "100%", outline: "none" },
  lbl:  { color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6, display: "block" },
  mono: { fontFamily: "'DM Mono',monospace" },
  accent: "#a78bfa",
};

const MEASURE_FIELDS = [
  { key: "weight", label: "Peso corporal", unit: "kg", emoji: "⚖️" },
  { key: "waist",  label: "Cintura",       unit: "cm", emoji: "📏" },
  { key: "hips",   label: "Cadera",        unit: "cm", emoji: "📏" },
  { key: "chest",  label: "Pecho",         unit: "cm", emoji: "📏" },
  { key: "armL",   label: "Brazo izq.",    unit: "cm", emoji: "💪" },
  { key: "armR",   label: "Brazo der.",    unit: "cm", emoji: "💪" },
  { key: "thigh",  label: "Muslo",         unit: "cm", emoji: "📏" },
];

function WeightChart({ measurements }) {
  if (!measurements || measurements.length < 2) return (
    <p style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "20px 0" }}>Registra al menos 2 semanas para ver la gráfica.</p>
  );
  const weights = measurements.map(m => m.weight).filter(Boolean);
  if (weights.length < 2) return null;
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;
  const range = max - min || 1;
  const w = 300, h = 80;

  const points = weights.map((wt, i) => ({
    x: (i / (weights.length - 1)) * (w - 20) + 10,
    y: h - ((wt - min) / range) * (h - 16) - 8,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 80 }}>
      <path d={path} fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#a78bfa" />
      ))}
    </svg>
  );
}

function MeasureForm({ onSave }) {
  const [vals, setVals] = useState({});
  const [note, setNote] = useState("");
  const set = (k, v) => setVals(m => ({ ...m, [k]: v }));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {MEASURE_FIELDS.map(f => (
          <div key={f.key}>
            <span style={C.lbl}>{f.emoji} {f.label} ({f.unit})</span>
            <input type="number" step="0.1" placeholder={`0 ${f.unit}`} value={vals[f.key] || ""}
              onChange={e => set(f.key, e.target.value ? +e.target.value : "")}
              style={{ ...C.inp, fontSize: 16, textAlign: "center", padding: "10px 8px" }} />
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={C.lbl}>📸 Nota / foto del día</span>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Cómo te has sentido, fotos tomadas, observaciones..."
          style={{ ...C.inp, minHeight: 70, resize: "vertical" }} />
      </div>
      <button onClick={() => { onSave({ ...vals, note }); setVals({}); setNote(""); }}
        disabled={Object.keys(vals).length === 0}
        style={{ width: "100%", background: "#a78bfa", color: "#fff", border: "none", borderRadius: 11, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: Object.keys(vals).length === 0 ? .5 : 1 }}>
        Guardar mediciones
      </button>
    </div>
  );
}

function WaistChart({ measurements }) {
  const waists = measurements.map(m => m.waist).filter(Boolean);
  if (waists.length < 2) return null;
  const min = Math.min(...waists) - 2, max = Math.max(...waists) + 2;
  const range = max - min || 1;
  const w = 300, h = 60;
  const points = waists.map((wt, i) => ({
    x: (i / (waists.length - 1)) * (w - 20) + 10,
    y: h - ((wt - min) / range) * (h - 16) - 8,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Evolución cintura (cm)</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 60 }}>
        <path d={path} fill="none" stroke="#4ade80" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#4ade80" />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 2 }}>
        <span>Inicio: {waists[0]} cm</span>
        <span style={{ color: waists[waists.length-1] < waists[0] ? "#4ade80" : "#f59e0b", fontWeight: 700 }}>
          {waists[waists.length-1] < waists[0] ? "↓" : "↑"}{Math.abs(waists[waists.length-1] - waists[0]).toFixed(1)} cm total
        </span>
        <span>Ahora: {waists[waists.length-1]} cm</span>
      </div>
    </div>
  );
}

export default function Progreso({ onOpenSetup }) {
  const { state, addMeasurement } = useApp();
  const [tab, setTab] = useState("body"); // body | prs | history
  const [showForm, setShowForm] = useState(false);
  const [showPREx, setShowPREx] = useState(null);

  const measurements = state.progress?.measurements || [];
  const prs = state.progress?.prs || {};
  const history = state.training?.done || [];
  const daily = state.daily || {};
  const profile = state.profile || {};

  const latest = measurements[measurements.length - 1];
  const prev    = measurements[measurements.length - 2];

  const diff = (key) => {
    if (!latest?.[key] || !prev?.[key]) return null;
    const d = +(latest[key] - prev[key]).toFixed(1);
    return { val: d, up: d > 0 };
  };

  return (
    <div style={{ background: "#080d08", minHeight: "100vh" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 16px 10px", position: "sticky", top: 0, background: "#080d08", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#a78bfa", letterSpacing: 2, fontWeight: 500 }}>PROGRESO</span>
          {onOpenSetup && (
            <button onClick={onOpenSetup}
              style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "6px 12px", fontSize: 11, color: "#a78bfa", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ⚙️ Configuración
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4 }}>
          {[["body","📏 Cuerpo"],["comp","🧬 Composición"],["prs","🏆 PRs"],["history","📋 Historial"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: "8px 4px", border: "none", borderRadius: 9, background: tab === id ? "rgba(167,139,250,0.15)" : "transparent", color: tab === id ? "#a78bfa" : "#64748b", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body measurements */}
        {tab === "body" && (
          <>
            {latest && (
              <div style={{ ...C.card, background: "rgba(167,139,250,0.04)", borderColor: "rgba(167,139,250,0.2)" }}>
                <span style={C.lbl}>Última medición — {latest.date}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {MEASURE_FIELDS.filter(f => latest[f.key]).map(f => {
                    const d = diff(f.key);
                    return (
                      <div key={f.key} style={{ textAlign: "center" }}>
                        <div style={{ ...C.mono, fontSize: 20, fontWeight: 700, color: "#a78bfa" }}>{latest[f.key]}</div>
                        <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: ".06em" }}>{f.label.toUpperCase()}</div>
                        {d && <div style={{ fontSize: 10, color: d.up ? "#ef4444" : "#4ade80", fontWeight: 700 }}>{d.up ? "+" : ""}{d.val}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {measurements.length > 1 && (
              <div style={C.card}>
                <span style={C.lbl}>Evolución del peso (kg)</span>
                <WeightChart measurements={measurements} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 4 }}>
                  <span>Inicio: {measurements[0]?.weight || "—"} kg</span>
                  <span>Ahora: {latest?.weight || "—"} kg</span>
                  {measurements[0]?.weight && latest?.weight && (
                    <span style={{ color: latest.weight < measurements[0].weight ? "#4ade80" : "#f59e0b", fontWeight: 700 }}>
                      {latest.weight < measurements[0].weight ? "↓" : "↑"}{Math.abs(+(latest.weight - measurements[0].weight).toFixed(1))} kg total
                    </span>
                  )}
                </div>
                <WaistChart measurements={measurements} />
              </div>
            )}

            <button onClick={() => setShowForm(v => !v)}
              style={{ width: "100%", background: showForm ? "rgba(167,139,250,0.15)" : "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: "13px", color: "#a78bfa", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
              {showForm ? "↑ Ocultar formulario" : "＋ Registrar mediciones de hoy"}
            </button>

            {showForm && (
              <div style={C.card}>
                <MeasureForm onSave={(m) => { addMeasurement(m); setShowForm(false); }} />
              </div>
            )}

            {measurements.length > 0 && (
              <div style={C.card}>
                <span style={C.lbl}>Historial de mediciones</span>
                {measurements.slice().reverse().slice(0, 8).map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                    <span style={{ color: "#94a3b8" }}>{m.date}</span>
                    <div style={{ display: "flex", gap: 10 }}>
                      {m.weight && <span style={{ ...C.mono, color: "#a78bfa" }}>{m.weight}kg</span>}
                      {m.waist  && <span style={{ ...C.mono, color: "#64748b" }}>C:{m.waist}cm</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Body Composition */}
        {tab === "comp" && (
          <div>
            {measurements.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ color: "#475569", fontSize: 14 }}>Registra mediciones para ver la composición corporal.</p>
                <button onClick={() => setTab("body")} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: "10px 20px", color: "#a78bfa", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>
                  → Ir a mediciones
                </button>
              </div>
            ) : (
              <>
                <BodyCompositionCard measurements={measurements} profile={profile} />

                {/* How to use guide */}
                <div style={C.card}>
                  <span style={C.lbl}>Cómo interpretar los datos</span>
                  {[
                    { color: "#4ade80", label: "Atlético (hombres <14%, mujeres <21%)", desc: "Definición muscular visible. Venoso en brazos y abdomen." },
                    { color: "#f59e0b", label: "En forma (hombres 14-21%, mujeres 21-28%)", desc: "Buena forma física. Abdomen plano. Objetivo realista." },
                    { color: "#f97316", label: "Promedio (hombres 21-26%, mujeres 28-35%)", desc: "Salud aceptable. Margen de mejora con ejercicio y dieta." },
                    { color: "#ef4444", label: "Alto (hombres >26%, mujeres >35%)", desc: "Riesgo metabólico elevado. Priorizar pérdida de grasa." },
                  ].map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{c.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Training stats */}
                {Object.values(daily).some(d => d.training?.rpe) && (
                  <div style={C.card}>
                    <span style={C.lbl}>Intensidad media (RPE)</span>
                    {(() => {
                      const rpeEntries = Object.entries(daily)
                        .filter(([, v]) => v.training?.rpe)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .slice(-10);
                      const avg = rpeEntries.reduce((s, [, v]) => s + v.training.rpe, 0) / rpeEntries.length;
                      return (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 36, fontWeight: 800, color: avg >= 8 ? "#ef4444" : avg >= 6 ? "#f59e0b" : "#4ade80" }}>{avg.toFixed(1)}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>Media de las últimas {rpeEntries.length} sesiones</div>
                          </div>
                          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 40 }}>
                            {rpeEntries.map(([date, v], i) => (
                              <div key={i} style={{ flex: 1, background: v.training.rpe >= 8 ? "#ef4444" : v.training.rpe >= 6 ? "#f59e0b" : "#4ade80", borderRadius: "3px 3px 0 0", height: `${(v.training.rpe / 10) * 100}%`, opacity: 0.8 }} title={`${date}: RPE ${v.training.rpe}`} />
                            ))}
                          </div>
                          <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>Óptimo: RPE 6-8 para hipertrofia | RPE 8-9 para fuerza</div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PRs */}
        {tab === "prs" && (
          <>
            {Object.keys(prs).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ color: "#475569", fontSize: 14 }}>Aún no has registrado ningún PR.</p>
                <p style={{ color: "#64748b", fontSize: 12 }}>Durante el entrenamiento, pulsa "Log PR" en cada ejercicio.</p>
              </div>
            ) : (
              Object.entries(prs).map(([exId, records]) => {
                const ex = byId(exId);
                if (!ex) return null;
                const best = records.reduce((a, r) => r.weight > a.weight ? r : a, records[0]);
                const last = records[records.length - 1];
                const isOpen = showPREx === exId;
                return (
                  <div key={exId} style={{ ...C.card, cursor: "pointer" }} onClick={() => setShowPREx(isOpen ? null : exId)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{ex.n}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{ex.m.join(", ")}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ ...C.mono, fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{best.weight}kg</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Mejor · {best.reps} reps</div>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={C.lbl}>Historial</span>
                        {records.slice().reverse().map((r, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                            <span style={{ color: "#64748b" }}>{r.date}</span>
                            <span style={{ ...C.mono, color: "#f59e0b" }}>{r.weight}kg × {r.reps} × {r.sets}</span>
                          </div>
                        ))}
                        {last && (
                          <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(245,158,11,0.07)", borderRadius: 10, fontSize: 12, color: "#fde68a" }}>
                            💡 Último: {last.weight}kg × {last.reps} · Intenta {last.reps >= 10 ? `${+(last.weight + 2.5).toFixed(1)}kg` : `${last.reps + 1} reps`} la próxima.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* Training history */}
        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ color: "#475569", fontSize: 14 }}>Aún no has completado ningún entreno.</p>
              </div>
            ) : (
              <div style={C.card}>
                <span style={C.lbl}>Sesiones completadas ({history.length})</span>
                {history.slice().reverse().map((d, i) => {
                  const dateKey = d.date?.slice(0, 10);
                  const log = dateKey ? daily[dateKey]?.training : null;
                  return (
                    <div key={i} style={{ padding: "10px 0", borderBottom: i < history.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{d.name}</div>
                          <div style={{ color: "#64748b" }}>{d.date ? new Date(d.date).toLocaleDateString("es-ES") : "—"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {d.rpe && (
                            <span style={{ ...C.mono, fontSize: 12, fontWeight: 700, color: d.rpe >= 8 ? "#ef4444" : d.rpe >= 6 ? "#f59e0b" : "#4ade80" }}>
                              RPE {d.rpe}
                            </span>
                          )}
                          {d.kcal > 0 && <span style={{ ...C.mono, fontSize: 12, color: "#f59e0b" }}>⌚ {d.kcal}</span>}
                          {log?.hasAbs && <span style={{ fontSize: 10, color: "#a78bfa" }}>⚡abs</span>}
                        </div>
                      </div>
                      {log?.muscles?.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                          {log.muscles.slice(0, 5).map((m, j) => (
                            <span key={j} style={{ fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "1px 6px" }}>{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ ...C.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ ...C.mono, fontSize: 32, fontWeight: 700, color: "#a78bfa" }}>{history.length}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Sesiones totales</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ ...C.mono, fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>
                  {history.filter(h => h.kcal > 0).reduce((a, h) => a + (h.kcal || 0), 0)}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Kcal totales quemadas</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
