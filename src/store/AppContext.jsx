import { createContext, useContext, useState, useEffect, useCallback } from "react";

const KEY = "fitpro-v1";
const AppContext = createContext(null);

const DEFAULT = {
  // Onboarding
  setupDone: false,

  // Profile
  profile: {
    enabled: false, name: "Usuario",
    sex: "h", age: 30, height: 175, weight: 75, bodyFat: null,
    activity: "moderada", goal: "definicion",
  },

  // Nutrition
  nutrition: {
    macros: { proteina: 180, carbos: 200, grasas: 70 },
    targetKcal: null,
    meals: 4,
    allergies: [],
    selected: [],
    priorities: {},
    postWorkoutMeal: {},
    refeedOn: false, refeedDays: [], refeedCarbs: 350,
    shakeOn: true, shakeProt: 27, shakeDays: [],
    creatineOn: true, creatineG: 5,
    // Rest day: less carbs, more fat (auto-calculated on save)
    restDayAdjust: { carbsMult: 0.75, fatMult: 1.25 },
    planData: null,
  },

  // Training
  training: {
    place: "gym",
    goal: "musculo",
    days: 4,
    time: 60,
    level: "inter",
    seq: [],
    cursor: 0,
    weekStarted: false,
    lastTrainTs: null,
    done: [],
    streak: 0,
    hist: {},
    chat: [],
  },

  // Daily log: keyed by "YYYY-MM-DD"
  daily: {},

  // Reminders
  reminders: {
    days: { lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false, domingo: false },
    time: "18:30",
  },

  // Progress
  progress: {
    measurements: [], // [{date, weight, waist, chest, hips, armL, armR, thigh, note}]
    prs: {},          // {exerciseId: [{date, weight, reps, sets, kcal}]}
  },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function AppProvider({ children }) {
  const [state, setStateRaw] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) return { ...DEFAULT, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT;
  });

  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Daily log helpers
  const today = todayKey();
  const todayLog = state.daily[today] || { trained: null, watchKcal: 0, notes: "" };

  const setTodayLog = useCallback((patch) => {
    setState(s => ({
      ...s,
      daily: { ...s.daily, [today]: { ...(s.daily[today] || { trained: null, watchKcal: 0, notes: "" }), ...patch } }
    }));
  }, [setState, today]);

  // Computed: effective macros for today
  const getEffectiveMacros = useCallback(() => {
    const base = state.nutrition.macros;
    const log = state.daily[today] || {};
    const isTrainDay = log.trained === true;
    const isRestDay = log.trained === false;
    const watchKcal = log.watchKcal || 0;
    const adj = state.nutrition.restDayAdjust;

    let macros = { ...base };
    if (isRestDay) {
      macros = {
        proteina: base.proteina,
        carbos: Math.round(base.carbos * adj.carbsMult),
        grasas: Math.round(base.grasas * adj.fatMult),
      };
    }
    // Add watch kcal as extra carbs on training day
    if (isTrainDay && watchKcal > 0) {
      const extraCarbs = Math.round(watchKcal / 4);
      macros = { ...macros, carbos: macros.carbos + extraCarbs };
    }
    const kcal = macros.proteina * 4 + macros.carbos * 4 + macros.grasas * 9;
    return { ...macros, kcal: Math.round(kcal), watchKcal, isTrainDay, isRestDay };
  }, [state.nutrition.macros, state.nutrition.restDayAdjust, state.daily, today]);

  // Training helpers
  const markTrained = useCallback((kcalBurned = 0) => {
    setTodayLog({ trained: true, watchKcal: kcalBurned });
    setState(s => ({
      ...s,
      training: { ...s.training, lastTrainTs: Date.now() }
    }));
  }, [setTodayLog, setState]);

  const logPR = useCallback((exerciseId, entry) => {
    setState(s => {
      const existing = s.progress.prs[exerciseId] || [];
      return {
        ...s,
        progress: {
          ...s.progress,
          prs: { ...s.progress.prs, [exerciseId]: [...existing, { date: today, ...entry }] }
        }
      };
    });
  }, [setState, today]);

  const addMeasurement = useCallback((m) => {
    setState(s => ({
      ...s,
      progress: {
        ...s.progress,
        measurements: [...s.progress.measurements.filter(x => x.date !== today), { date: today, ...m }]
      }
    }));
  }, [setState, today]);

  const value = {
    state, setState,
    today, todayLog, setTodayLog,
    getEffectiveMacros, markTrained, logPR, addMeasurement,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
