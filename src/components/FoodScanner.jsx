import { useState, useRef } from "react";
import { useApp } from "../store/AppContext";
import { analyzeFood, getApiKey, saveApiKey } from "../utils/aiVision";
import { MEALS_NAMES } from "../data/foods";

function getMealSlot(hour, mealsCount) {
  const names = MEALS_NAMES[mealsCount] || MEALS_NAMES[4];
  if (mealsCount === 1) return names[0];
  if (mealsCount === 2) return hour < 15 ? names[0] : names[1];
  if (mealsCount === 3) return hour < 11 ? names[0] : hour < 17 ? names[1] : names[2];
  if (mealsCount === 4) return hour < 11 ? names[0] : hour < 15 ? names[1] : hour < 19 ? names[2] : names[3];
  if (mealsCount === 5) return hour < 9 ? names[0] : hour < 12 ? names[1] : hour < 16 ? names[2] : hour < 19 ? names[3] : names[4];
  return names[names.length - 1];
}

function extractGrams(porcion) {
  if (!porcion) return null;
  const m = porcion.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  return m ? Math.round(parseFloat(m[1].replace(",", "."))) : null;
}

function scaleResult(base, newGrams, baseGrams) {
  if (!baseGrams || baseGrams <= 0 || !newGrams || newGrams <= 0) return base;
  const r = newGrams / baseGrams;
  return {
    ...base,
    proteina: Math.round(base.proteina * r),
    carbos:   Math.round(base.carbos   * r),
    grasas:   Math.round(base.grasas   * r),
    kcal:     Math.round(base.kcal     * r),
  };
}

const inp = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontFamily: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box" };

export default function FoodScanner() {
  const { state, todayLog, setTodayLog } = useApp();
  const mealsCount = state.nutrition?.meals || 4;

  const [open, setOpen]         = useState(false);
  const [apiKey, setApiKey]     = useState(() => getApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [baseResult, setBase]   = useState(null);
  const [editGrams, setEditGrams] = useState("");
  const [error, setError]       = useState("");
  const [preview, setPreview]   = useState(null);
  const [editingEntry, setEditingEntry] = useState(null); // { idx, grams }
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    setBase(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      setLoading(true);
      try {
        const data = await analyzeFood(dataUrl.split(",")[1], file.type, apiKey);
        const g = extractGrams(data.porcion);
        setBase(data);
        setResult(data);
        setEditGrams(g != null ? String(g) : "");
      } catch (err) {
        setError(err.message);
        setPreview(null);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGramsInput = (val) => {
    setEditGrams(val);
    const g = parseInt(val, 10);
    const base = extractGrams(baseResult?.porcion);
    if (baseResult && g > 0 && base > 0) {
      setResult(scaleResult(baseResult, g, base));
    }
  };

  const addToLog = () => {
    if (!result) return;
    const hour = new Date().getHours();
    const meal = getMealSlot(hour, mealsCount);
    const base = extractGrams(baseResult?.porcion || result.porcion);
    const g = parseInt(editGrams, 10) || base;
    const existing = todayLog.scannedFoods || [];
    setTodayLog({
      scannedFoods: [...existing, {
        ...result,
        ts: Date.now(),
        meal,
        grams: g || null,
        baseGrams: base || null,
        baseProteina: baseResult?.proteina ?? result.proteina,
        baseCarbos:   baseResult?.carbos   ?? result.carbos,
        baseGrasas:   baseResult?.grasas   ?? result.grasas,
        baseKcal:     baseResult?.kcal     ?? result.kcal,
      }],
    });
    setResult(null);
    setBase(null);
    setEditGrams("");
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const discard = () => {
    setResult(null);
    setBase(null);
    setEditGrams("");
    setPreview(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeEntry = (i) => {
    setTodayLog({ scannedFoods: (todayLog.scannedFoods || []).filter((_, j) => j !== i) });
    if (editingEntry?.idx === i) setEditingEntry(null);
  };

  const confirmGramsEdit = () => {
    if (!editingEntry) return;
    const { idx, grams } = editingEntry;
    const g = parseInt(grams, 10);
    const entry = (todayLog.scannedFoods || [])[idx];
    if (!entry || !g || g <= 0) { setEditingEntry(null); return; }
    const base = entry.baseGrams;
    if (base && base > 0) {
      const updated = scaleResult(
        { ...entry, proteina: entry.baseProteina, carbos: entry.baseCarbos, grasas: entry.baseGrasas, kcal: entry.baseKcal },
        g, base,
      );
      updated.grams = g;
      setTodayLog({
        scannedFoods: (todayLog.scannedFoods || []).map((f, j) => j === idx ? { ...f, ...updated } : f),
      });
    }
    setEditingEntry(null);
  };

  const saveKey = () => { saveApiKey(keyInput); setApiKey(keyInput.trim()); setKeyInput(""); };

  const scanned = todayLog.scannedFoods || [];
  const totals = scanned.reduce((acc, f) => ({
    proteina: acc.proteina + (f.proteina || 0),
    carbos:   acc.carbos   + (f.carbos   || 0),
    grasas:   acc.grasas   + (f.grasas   || 0),
    kcal:     acc.kcal     + (f.kcal     || 0),
  }), { proteina: 0, carbos: 0, grasas: 0, kcal: 0 });

  const baseGramsForResult = extractGrams(baseResult?.porcion);

  return (
    <div style={{ background: "rgba(239,68,68,0.025)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div>
          <span style={{ color: "#f87171", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", display: "block" }}>📷 Registrar comida con IA</span>
          {scanned.length > 0 && (
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              {scanned.length} alimento{scanned.length > 1 ? "s" : ""} · {totals.kcal} kcal registradas hoy
            </div>
          )}
        </div>
        <span style={{ color: "#64748b", fontSize: 16, lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {!apiKey ? (
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, lineHeight: 1.65 }}>
                Necesitas una API key de Anthropic.{" "}
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: "#f87171" }}>console.anthropic.com</a>
                {" "}→ API Keys.
              </div>
              <input type="text" placeholder="sk-ant-..." value={keyInput} onChange={e => setKeyInput(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
              <button onClick={saveKey} disabled={!keyInput.trim()}
                style={{ width: "100%", padding: "12px", background: keyInput.trim() ? "#dc2626" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 10, color: keyInput.trim() ? "#fff" : "#475569", fontWeight: 700, fontSize: 14, cursor: keyInput.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                Guardar API key
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>
                🔑 API key activa ·{" "}
                <span onClick={() => { saveApiKey(""); setApiKey(""); }} style={{ color: "#f87171", cursor: "pointer" }}>Cambiar</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />

              {!loading && !result && !preview && (
                <button onClick={() => fileRef.current?.click()}
                  style={{ width: "100%", padding: "16px", background: "rgba(239,68,68,0.08)", border: "1.5px dashed rgba(239,68,68,0.35)", borderRadius: 13, color: "#f87171", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  📷 Hacer foto o subir imagen
                </button>
              )}

              {loading && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>
                  🔍 Analizando con IA…
                </div>
              )}

              {error && (
                <div>
                  <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 10, color: "#fca5a5", fontSize: 13, marginBottom: 10 }}>
                    ⚠️ {error}
                  </div>
                  <button onClick={discard} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontFamily: "inherit", cursor: "pointer" }}>Reintentar</button>
                </div>
              )}

              {result && (
                <div>
                  {preview && <img src={preview} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 12, maxHeight: 180, objectFit: "cover" }} />}
                  <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{result.descripcion}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{result.porcion}</div>

                    {/* Gram editor */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>Gramos reales:</span>
                      <input
                        type="number"
                        value={editGrams}
                        onChange={e => handleGramsInput(e.target.value)}
                        placeholder={baseGramsForResult ? String(baseGramsForResult) : "ej. 200"}
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>g</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, textAlign: "center" }}>
                      <div><div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80", fontFamily: "'DM Mono',monospace" }}>{result.proteina}g</div><div style={{ fontSize: 10, color: "#64748b" }}>Prot</div></div>
                      <div><div style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", fontFamily: "'DM Mono',monospace" }}>{result.carbos}g</div><div style={{ fontSize: 10, color: "#64748b" }}>Carbos</div></div>
                      <div><div style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{result.grasas}g</div><div style={{ fontSize: 10, color: "#64748b" }}>Grasas</div></div>
                      <div><div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Mono',monospace" }}>{result.kcal}</div><div style={{ fontSize: 10, color: "#64748b" }}>kcal</div></div>
                    </div>
                    {result.nota && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10, fontStyle: "italic" }}>💬 {result.nota}</div>}
                    <div style={{ fontSize: 10, marginTop: 6, color: result.confianza === "alta" ? "#4ade80" : result.confianza === "media" ? "#f59e0b" : "#f87171" }}>
                      Confianza IA: {result.confianza}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={discard} style={{ padding: "11px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      Descartar
                    </button>
                    <button onClick={addToLog} style={{ padding: "11px", background: "#4ade80", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      ✓ Añadir a mi plan de hoy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {scanned.length > 0 && (
            <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Registrado hoy</div>
              {scanned.map((f, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      {f.meal && <div style={{ fontSize: 9, color: "#a78bfa", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 2 }}>{f.meal}</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{f.descripcion}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{f.proteina}p / {f.carbos}c / {f.grasas}g · {f.kcal} kcal</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {f.baseGrams && (
                        <button onClick={() => setEditingEntry(editingEntry?.idx === i ? null : { idx: i, grams: String(f.grams || f.baseGrams) })}
                          style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#64748b", fontSize: 11, cursor: "pointer", padding: "2px 7px", fontFamily: "inherit" }}>
                          {f.grams ? `${f.grams}g` : "✏️g"}
                        </button>
                      )}
                      <button onClick={() => removeEntry(i)} style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>
                    </div>
                  </div>
                  {editingEntry?.idx === i && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>Gramos:</span>
                      <input
                        type="number"
                        value={editingEntry.grams}
                        onChange={e => setEditingEntry({ idx: i, grams: e.target.value })}
                        onKeyDown={e => e.key === "Enter" && confirmGramsEdit()}
                        autoFocus
                        style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontFamily: "'DM Mono',monospace", fontSize: 14, outline: "none" }}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>g</span>
                      <button onClick={confirmGramsEdit}
                        style={{ padding: "6px 12px", background: "#4ade80", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 12, textAlign: "center", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80", fontFamily: "'DM Mono',monospace" }}>{totals.proteina}g</div><div style={{ fontSize: 10, color: "#64748b" }}>Prot</div></div>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", fontFamily: "'DM Mono',monospace" }}>{totals.carbos}g</div><div style={{ fontSize: 10, color: "#64748b" }}>Carbos</div></div>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{totals.grasas}g</div><div style={{ fontSize: 10, color: "#64748b" }}>Grasas</div></div>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: "'DM Mono',monospace" }}>{totals.kcal}</div><div style={{ fontSize: 10, color: "#64748b" }}>kcal</div></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
