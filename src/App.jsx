import { useState, useEffect, Component } from "react";
import { AppProvider, useApp } from "./store/AppContext";
import Hoy from "./screens/Hoy";
import Nutricion from "./screens/Nutricion";
import Entrenamiento from "./screens/Entrenamiento";
import Progreso from "./screens/Progreso";
import Onboarding from "./screens/Onboarding";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 32, textAlign: "center", color: "#f87171" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 16 }}>Algo salió mal en esta sección.</div>
        <button onClick={() => this.setState({ err: null })} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Reintentar</button>
      </div>
    );
    return this.props.children;
  }
}

const doHardReload = () => {
  if ("caches" in window) {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => window.location.reload(true));
  } else {
    window.location.reload(true);
  }
};

function useUpdateCheck() {
  const [updateReady, setUpdateReady] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const currentScript = document.querySelector('script[src*="assets/index-"]');
    if (!currentScript) return;
    const currentHash = currentScript.src.match(/index-([^.]+)\.js/)?.[1];
    if (!currentHash) return;

    const check = async () => {
      try {
        const res = await fetch("/jonatan/index.html?_=" + Date.now(), { cache: "no-store" });
        const html = await res.text();
        const servedHash = html.match(/assets\/index-([^.]+)\.js/)?.[1];
        if (servedHash && servedHash !== currentHash) setUpdateReady(true);
      } catch {}
    };

    const t = setTimeout(check, 8000);
    const interval = setInterval(check, 5 * 60 * 1000);

    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => { clearTimeout(t); clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const checkNow = async () => {
    setChecking(true);
    const currentScript = document.querySelector('script[src*="assets/index-"]');
    const currentHash = currentScript?.src.match(/index-([^.]+)\.js/)?.[1];
    try {
      const res = await fetch("/jonatan/index.html?_=" + Date.now(), { cache: "no-store" });
      const html = await res.text();
      const servedHash = html.match(/assets\/index-([^.]+)\.js/)?.[1];
      if (servedHash && servedHash !== currentHash) { setUpdateReady(true); }
      else { setChecking(false); }
    } catch { setChecking(false); }
  };

  return { updateReady, checking, checkNow };
}

function UpdateBanner({ updateReady }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (updateReady) setShow(true); }, [updateReady]);
  if (!show) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 200, padding: "0 12px", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ background: "#16a34a", borderRadius: "0 0 14px 14px", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>🔄 Nueva versión disponible</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShow(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Ignorar</button>
          <button onClick={doHardReload} style={{ background: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", color: "#16a34a", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "hoy",    label: "Hoy",     icon: (on) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on?2.2:1.8} strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22}}>
      <path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>
    </svg>
  )},
  { id: "nutri",  label: "Nutrición", icon: (on) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on?2.2:1.8} strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22}}>
      <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M8 12h8M12 8v8"/>
    </svg>
  )},
  { id: "entreno", label: "Entreno", icon: (on) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on?2.2:1.8} strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22}}>
      <path d="M6 4v16M18 4v16M6 12h12M3 8h3M18 8h3M3 16h3M18 16h3"/>
    </svg>
  )},
  { id: "progreso", label: "Progreso", icon: (on) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on?2.2:1.8} strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22}}>
      <path d="M4 19V5M4 19h16M8 15l3-4 3 3 5-7"/>
    </svg>
  )},
];

const C = {
  accent: { hoy:"#60a5fa", nutri:"#4ade80", entreno:"#f59e0b", progreso:"#a78bfa" },
};

function WatchKcalBanner({ data, onDismiss }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (data) setShow(true); }, [data]);
  if (!show || !data) return null;
  const { kcal, type, min } = data;
  const dismiss = () => { setShow(false); onDismiss(); };
  return (
    <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 201, padding: "0 12px", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ background: "#f59e0b", borderRadius: "0 0 14px 14px", padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>⌚ Entreno guardado desde el Watch</div>
            {type && <div style={{ fontSize: 11, color: "rgba(0,0,0,0.65)", marginTop: 2 }}>{type}</div>}
            <div style={{ fontSize: 12, color: "#000", marginTop: 3 }}>
              {min > 0 ? `${min} min · ` : ""}{kcal} kcal activas
            </div>
          </div>
          <button onClick={dismiss} style={{ background: "rgba(0,0,0,0.15)", border: "none", borderRadius: 8, padding: "4px 10px", color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginLeft: 12, flexShrink: 0 }}>OK</button>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState("hoy");
  const { state, setTodayLog } = useApp();
  const { updateReady, checking, checkNow } = useUpdateCheck();
  const [watchBanner, setWatchBanner] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !state.setupDone && !state.profile?.enabled && !state.nutrition?.planData
  );

  // Apple Watch kcal sync — three complementary mechanisms:
  // 1) inline script in index.html writes localStorage instantly when URL has ?kcal=X
  // 2) checkStorageKcal() reads localStorage on mount/resume (handles cross-tab scenario)
  // 3) tryClipboardImport() reads clipboard on resume (handles locked-screen scenario where
  //    iOS blocks "Open URL" but allows Shortcut to write to clipboard)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    const readWatchParams = () => {
      const params = new URLSearchParams(window.location.search);
      const kcal = parseInt(params.get("kcal"), 10);
      const type = params.get("type") || "";
      const min = parseInt(params.get("min"), 10) || 0;
      if (kcal > 0) {
        setTodayLog({ watchKcal: kcal, watchType: type, watchMin: min, trained: true });
        window.history.replaceState({}, "", window.location.pathname);
        setWatchBanner({ kcal, type, min });
      }
    };

    const checkStorageKcal = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("fitpro-v1") || "{}");
        const savedKcal = saved?.daily?.[today]?.watchKcal || 0;
        const savedType = saved?.daily?.[today]?.watchType || "";
        const savedMin  = saved?.daily?.[today]?.watchMin  || 0;
        const currentKcal = state.daily?.[today]?.watchKcal || 0;
        if (savedKcal > 0 && savedKcal !== currentKcal) {
          setTodayLog({ watchKcal: savedKcal, watchType: savedType, watchMin: savedMin, trained: true });
          setWatchBanner({ kcal: savedKcal, type: savedType, min: savedMin });
        }
      } catch {}
    };

    // Clipboard-based import: works even when iOS blocks URL-open on locked screen.
    // Shortcut writes the number (e.g. "524") to clipboard; app reads it on resume.
    // iOS asks "Allow paste?" once; after that it reads silently on every app open.
    const tryClipboardImport = async () => {
      try {
        if (!navigator?.clipboard?.readText) return;
        const text = (await navigator.clipboard.readText()).trim();
        if (!text) return;
        // Accept plain number "524" or "kcal: 524" or "524 kcal" formats
        const m = text.match(/^(?:k?cal[:\s]*)?(\d{2,4})(?:\s*k?cal)?$/i);
        if (!m) return;
        const kcal = parseInt(m[1], 10);
        if (kcal < 50 || kcal > 3000) return; // sanity range
        const saved = JSON.parse(localStorage.getItem("fitpro-v1") || "{}");
        const currentKcal = saved?.daily?.[today]?.watchKcal || 0;
        if (kcal !== currentKcal) {
          setTodayLog({ watchKcal: kcal, watchType: "Apple Watch", watchMin: 0, trained: true });
          setWatchBanner({ kcal, type: "Apple Watch", min: 0 });
          navigator.clipboard.writeText("").catch(() => {}); // clear to avoid re-import
        }
      } catch {}
    };

    readWatchParams();
    checkStorageKcal();
    tryClipboardImport();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        readWatchParams();
        checkStorageKcal();
        tryClipboardImport();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const accentColor = C.accent[tab] || "#4ade80";

  return (
    <div style={{ minHeight: "100dvh", background: "#080d08", fontFamily: "'DM Sans', sans-serif", color: "#e2e8f0", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <UpdateBanner updateReady={updateReady} />
      <WatchKcalBanner data={watchBanner} onDismiss={() => setWatchBanner(null)} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{margin:0;background:#080d08;overscroll-behavior:none}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1e3a1e;border-radius:2px}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:currentColor;cursor:pointer}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        select{-webkit-appearance:none;appearance:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .screen-enter{animation:fadeUp .35s ease}
        .tap-scale:active{transform:scale(.96)}
      `}</style>

      {/* Screens */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 72 }}>
        <ErrorBoundary key={tab}>
          {tab === "hoy"     && <Hoy     onNavigate={setTab} accentColor={accentColor} updateReady={updateReady} checking={checking} onCheckUpdate={checkNow} />}
          {tab === "nutri"   && <Nutricion accentColor={C.accent.nutri} />}
          {tab === "entreno" && <Entrenamiento accentColor={C.accent.entreno} onNavigate={setTab} />}
          {tab === "progreso"&& <Progreso accentColor={C.accent.progreso} onOpenSetup={() => setShowOnboarding(true)} />}
        </ErrorBoundary>
      </div>

      {/* Tab bar */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        background: "rgba(8,13,8,0.92)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)",
        height: 72,
      }}>
        {TABS.map(t => {
          const on = tab === t.id;
          const color = on ? C.accent[t.id] : "#475569";
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: "none", color, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: on ? 700 : 500, letterSpacing: ".04em", transition: "color .2s" }}>
              {t.icon(on)}
              {t.label}
            </button>
          );
        })}
      </div>
      {showOnboarding && (
        <Onboarding onDone={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
