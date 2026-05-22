import { useState } from "react";
import { AppProvider, useApp } from "./store/AppContext";
import Hoy from "./screens/Hoy";
import Nutricion from "./screens/Nutricion";
import Entrenamiento from "./screens/Entrenamiento";
import Progreso from "./screens/Progreso";

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

function Shell() {
  const [tab, setTab] = useState("hoy");
  const { state } = useApp();

  const accentColor = C.accent[tab] || "#4ade80";

  return (
    <div style={{ minHeight: "100dvh", background: "#080d08", fontFamily: "'DM Sans', sans-serif", color: "#e2e8f0", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", position: "relative" }}>
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
        .screen-enter{animation:fadeUp .35s ease}
        .tap-scale:active{transform:scale(.96)}
      `}</style>

      {/* Screens */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 72 }}>
        {tab === "hoy"     && <Hoy     onNavigate={setTab} accentColor={accentColor} />}
        {tab === "nutri"   && <Nutricion accentColor={C.accent.nutri} />}
        {tab === "entreno" && <Entrenamiento accentColor={C.accent.entreno} onNavigate={setTab} />}
        {tab === "progreso"&& <Progreso accentColor={C.accent.progreso} />}
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
