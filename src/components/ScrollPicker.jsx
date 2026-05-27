import { useRef, useEffect, useState, useCallback } from "react";

const ITEM_H = 56;
const VISIBLE = 5;
const PAD = 2; // items above/below center

export default function ScrollPicker({ min, max, value, onChange, unit = "" }) {
  const items = [];
  for (let v = min; v <= max; v++) items.push(v);

  const ref = useRef(null);
  const timer = useRef(null);
  const [active, setActive] = useState(value);

  // Scroll to initial value on mount
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(value);
    if (idx >= 0) el.scrollTop = idx * ITEM_H;
  }, []);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    setActive(items[clamped]);

    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      onChange(items[clamped]);
    }, 150);
  }, [items, onChange]);

  return (
    <div style={{ position: "relative", height: VISIBLE * ITEM_H, overflow: "hidden", userSelect: "none", touchAction: "pan-y" }}>
      {/* Selection highlight */}
      <div style={{
        position: "absolute", top: PAD * ITEM_H, left: 8, right: 8, height: ITEM_H,
        background: "rgba(74,222,128,0.1)", borderRadius: 14,
        border: "1px solid rgba(74,222,128,0.3)", pointerEvents: "none", zIndex: 1,
      }} />
      {/* Top/bottom fade */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
        background: "linear-gradient(to bottom, rgba(8,13,8,.95) 0%, rgba(8,13,8,.25) 28%, transparent 42%, transparent 58%, rgba(8,13,8,.25) 72%, rgba(8,13,8,.95) 100%)",
      }} />
      {/* Scrollable list */}
      <div
        ref={ref}
        onScroll={onScroll}
        style={{
          position: "absolute", inset: 0,
          overflowY: "scroll", scrollSnapType: "y mandatory",
          scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
          paddingTop: PAD * ITEM_H, paddingBottom: PAD * ITEM_H,
        }}
      >
        {items.map(v => {
          const dist = Math.abs(v - active);
          const isSelected = dist === 0;
          return (
            <div key={v} style={{
              height: ITEM_H, display: "flex", alignItems: "center", justifyContent: "center",
              scrollSnapAlign: "center", gap: 4,
              fontFamily: "'DM Mono', monospace",
              fontSize: isSelected ? 30 : dist === 1 ? 20 : 15,
              fontWeight: isSelected ? 700 : 400,
              color: isSelected ? "#e2e8f0" : dist === 1 ? "#4b5563" : "#1f2937",
              transition: "font-size .1s, color .1s",
            }}>
              {v}
              {isSelected && unit && (
                <span style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>{unit}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
