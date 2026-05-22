import { useState, useEffect, useMemo } from "react";

// ══════════════════════════════════════════════════════════════
// CONSTANTS & FOOD DATABASE
// ══════════════════════════════════════════════════════════════

const CATS = {
  all:"✦ Todos", aves:"🍗 Aves", carnes:"🥩 Carnes", pescado:"🐟 Pescado",
  marisco:"🦐 Marisco", huevos:"🥚 Huevos", lacteos:"🥛 Lácteos",
  quesos:"🧀 Quesos", fiambres:"🥓 Fiambres", legumbres:"🫘 Legumbres",
  cereales:"🌾 Cereales", pasta:"🍝 Pasta", verduras:"🥦 Verduras",
  frutas:"🍎 Frutas", grasas:"🫒 Grasas", conservas:"🥫 Conservas",
};

const FOODS = [
  // AVES
  {id:1,  name:"Pechuga de Pollo",              cat:"aves",      p:23, c:0,  f:3,  cal:118},
  {id:2,  name:"Contramuslo Pollo Deshuesado",  cat:"aves",      p:19, c:0,  f:9,  cal:153},
  {id:3,  name:"Muslo de Pollo",                cat:"aves",      p:20, c:0,  f:9,  cal:157},
  {id:4,  name:"Carne Picada de Pollo",         cat:"aves",      p:20, c:0,  f:4,  cal:116},
  {id:5,  name:"Pechuga de Pavo (Filete)",      cat:"aves",      p:24, c:0,  f:0,  cal:96 },
  {id:6,  name:"Muslo de Pavo",                 cat:"aves",      p:20, c:0,  f:7,  cal:143},
  {id:7,  name:"Hamburguesa Pollo Baja Grasa",  cat:"aves",      p:22, c:0,  f:3,  cal:111},
  {id:8,  name:"Hamburguesa Pavo Baja Grasa",   cat:"aves",      p:23, c:0,  f:0,  cal:92 },
  {id:9,  name:"Alitas de Pollo Adobadas",     cat:"aves",      p:16, c:3,  f:7,  cal:139},
  {id:10, name:"Brochetas de Pollo",            cat:"aves",      p:15, c:0,  f:10, cal:150},
  {id:11, name:"Albóndigas Pollo y Pavo",       cat:"aves",      p:16, c:11, f:8,  cal:184},
  {id:12, name:"Carne Picada Pollo Muy Magra",  cat:"aves",      p:21, c:0,  f:0,  cal:84 },
  // CARNES
  {id:13, name:"Filete de Ternera Magro",       cat:"carnes",    p:20, c:0,  f:5,  cal:125},
  {id:14, name:"Carne Picada Ternera Magra",    cat:"carnes",    p:23, c:0,  f:3,  cal:119},
  {id:15, name:"Carne Picada Ternera",          cat:"carnes",    p:17, c:0,  f:12, cal:176},
  {id:16, name:"Carne Picada Cerdo y Vacuno",   cat:"carnes",    p:18, c:3,  f:16, cal:226},
  {id:17, name:"Lomo de Cerdo Adobado",         cat:"carnes",    p:20, c:0,  f:4,  cal:116},
  {id:18, name:"Cinta de Lomo de Cerdo",        cat:"carnes",    p:24, c:0,  f:6,  cal:154},
  {id:19, name:"Conejo",                        cat:"carnes",    p:33, c:0,  f:4,  cal:164},
  {id:20, name:"Hamburguesa Ternera Muy Magra", cat:"carnes",    p:24, c:0,  f:3,  cal:123},
  {id:21, name:"Costilla de Cerdo",             cat:"carnes",    p:17, c:0,  f:24, cal:280},
  {id:22, name:"Solomillo de Cerdo",            cat:"carnes",    p:17, c:0,  f:3,  cal:95 },
  {id:23, name:"Entrecot de Ternera",           cat:"carnes",    p:20, c:0,  f:9,  cal:161},
  // PESCADO
  {id:24, name:"Atún Fresco",                   cat:"pescado",   p:22, c:0,  f:4,  cal:120},
  {id:25, name:"Salmón",                        cat:"pescado",   p:25, c:0,  f:18, cal:258},
  {id:26, name:"Merluza",                       cat:"pescado",   p:13, c:0,  f:3,  cal:75 },
  {id:27, name:"Bacalao",                       cat:"pescado",   p:18, c:0,  f:0,  cal:72 },
  {id:28, name:"Dorada",                        cat:"pescado",   p:20, c:0,  f:7,  cal:143},
  {id:29, name:"Lubina",                        cat:"pescado",   p:28, c:0,  f:8,  cal:180},
  {id:30, name:"Caballa en Aceite de Oliva",    cat:"pescado",   p:24, c:0,  f:11, cal:195},
  {id:31, name:"Boquerones",                    cat:"pescado",   p:18, c:0,  f:6,  cal:126},
  {id:32, name:"Filetes de Anchoa en Aceite",   cat:"pescado",   p:25, c:0,  f:10, cal:190},
  {id:33, name:"Bacalao Ahumado",               cat:"pescado",   p:21, c:0,  f:0,  cal:84 },
  // MARISCO
  {id:34, name:"Gambas Cocidas",                cat:"marisco",   p:20, c:0,  f:0,  cal:80 },
  {id:35, name:"Mejillones",                    cat:"marisco",   p:24, c:0,  f:4,  cal:128},
  {id:36, name:"Calamar Limpio",                cat:"marisco",   p:18, c:0,  f:0,  cal:72 },
  {id:37, name:"Langostinos",                   cat:"marisco",   p:21, c:0,  f:0,  cal:84 },
  {id:38, name:"Almejas al Natural",            cat:"marisco",   p:11, c:3,  f:2,  cal:72 },
  // HUEVOS
  {id:39, name:"Huevo Entero L (unidad ~60g)",  cat:"huevos",    p:8,  c:0,  f:6,  cal:82 },
  {id:40, name:"Claras de Huevo (100g)",        cat:"huevos",    p:11, c:0,  f:0,  cal:44 },
  {id:41, name:"Huevos Cocidos (unidad ~60g)",  cat:"huevos",    p:8,  c:0,  f:6,  cal:82 },
  // LÁCTEOS
  {id:42, name:"Leche Entera",                  cat:"lacteos",   p:3,  c:5,  f:3,  cal:59 },
  {id:43, name:"Leche Desnatada",               cat:"lacteos",   p:3,  c:5,  f:0,  cal:32 },
  {id:44, name:"Leche Desnatada +Proteína",     cat:"lacteos",   p:6,  c:5,  f:0,  cal:44 },
  {id:45, name:"Kéfir",                         cat:"lacteos",   p:4,  c:5,  f:4,  cal:68 },
  {id:46, name:"Yogur Proteico / Skyr",         cat:"lacteos",   p:10, c:4,  f:0,  cal:56 },
  {id:121,name:"Yogur Griego Light Carrefour",  cat:"lacteos",   p:6,  c:4,  f:2,  cal:58 },
  {id:47, name:"Nata Ligera para Cocinar",      cat:"lacteos",   p:2,  c:5,  f:15, cal:159},
  {id:48, name:"Batido Proteico Chocolate",     cat:"lacteos",   p:36, c:17, f:1,  cal:221},
  // QUESOS
  {id:49, name:"Mozzarella",                    cat:"quesos",    p:20, c:2,  f:16, cal:228},
  {id:50, name:"Mozzarella Light",              cat:"quesos",    p:21, c:2,  f:9,  cal:169},
  {id:51, name:"Mozzarella Proteica Skyrella",  cat:"quesos",    p:23, c:2,  f:3,  cal:127},
  {id:52, name:"Requesón",                      cat:"quesos",    p:11, c:3,  f:4,  cal:90 },
  {id:53, name:"Queso Crema Light",             cat:"quesos",    p:10, c:7,  f:18, cal:230},
  {id:54, name:"Burrata",                       cat:"quesos",    p:14, c:5,  f:20, cal:256},
  {id:55, name:"Mini Babybel (unidad 22g)",     cat:"quesos",    p:5,  c:0,  f:5,  cal:65 },
  // FIAMBRES
  {id:56, name:"Jamón Serrano Magro",           cat:"fiambres",  p:34, c:0,  f:12, cal:244},
  {id:57, name:"Jamón Cocido Calidad >85%",     cat:"fiambres",  p:19, c:0,  f:3,  cal:101},
  {id:58, name:"Lomo Embuchado",                cat:"fiambres",  p:39, c:0,  f:5,  cal:201},
  {id:59, name:"Fiambre de Pavo >85%",          cat:"fiambres",  p:20, c:0,  f:0,  cal:80 },
  {id:60, name:"Fiambre de Pollo >85%",         cat:"fiambres",  p:19, c:0,  f:0,  cal:76 },
  {id:61, name:"Cecina de Vacuno",              cat:"fiambres",  p:30, c:0,  f:6,  cal:174},
  {id:62, name:"Chorizo de Pavo Extra",         cat:"fiambres",  p:26, c:3,  f:15, cal:247},
  {id:63, name:"Jamón Ibérico de Bellota",      cat:"fiambres",  p:35, c:0,  f:20, cal:320},
  {id:64, name:"Jamón Serrano Ibérico de Cebo", cat:"fiambres",  p:31, c:0,  f:28, cal:380},
  // LEGUMBRES
  {id:65, name:"Lentejas (secas)",              cat:"legumbres", p:25, c:48, f:0,  cal:292},
  {id:66, name:"Lentejas Cocidas / Conserva",   cat:"legumbres", p:6,  c:11, f:0,  cal:68 },
  {id:67, name:"Garbanzos (secos)",             cat:"legumbres", p:19, c:49, f:0,  cal:272},
  {id:68, name:"Garbanzos en Conserva",         cat:"legumbres", p:6,  c:10, f:0,  cal:64 },
  {id:69, name:"Alubias",                       cat:"legumbres", p:21, c:40, f:0,  cal:244},
  {id:70, name:"Edamame",                       cat:"legumbres", p:11, c:10, f:4,  cal:120},
  {id:71, name:"Edamame Tostado",               cat:"legumbres", p:46, c:18, f:12, cal:364},
  {id:72, name:"Fusilli de Lentejas Rojas",     cat:"legumbres", p:26, c:50, f:0,  cal:304},
  {id:73, name:"Judías Blancas",                cat:"legumbres", p:6,  c:11, f:0,  cal:68 },
  // CEREALES
  {id:74, name:"Arroz Blanco",                  cat:"cereales",  p:0,  c:77, f:0,  cal:308},
  {id:75, name:"Arroz Basmati",                 cat:"cereales",  p:0,  c:78, f:0,  cal:312},
  {id:76, name:"Arroz Integral",                cat:"cereales",  p:0,  c:72, f:0,  cal:288},
  {id:77, name:"Arroz Basmati Tarrina Brillante",cat:"cereales", p:0,  c:39, f:0,  cal:156},
  {id:78, name:"Avena / Copos de Avena",        cat:"cereales",  p:0,  c:60, f:0,  cal:240},
  {id:79, name:"Harina de Avena (HSN)",         cat:"cereales",  p:14, c:53, f:11, cal:369},
  {id:80, name:"Cous Cous",                     cat:"cereales",  p:0,  c:70, f:0,  cal:280},
  {id:81, name:"Avena Molida Hacendado",        cat:"cereales",  p:0,  c:59, f:0,  cal:236},
  {id:82, name:"Arroz Integral Tarrina 1 min",  cat:"cereales",  p:0,  c:41, f:0,  cal:164},
  // PASTA
  {id:83, name:"Espaguetis / Macarrones",       cat:"pasta",     p:0,  c:72, f:0,  cal:288},
  {id:84, name:"Pasta Integral",                cat:"pasta",     p:0,  c:65, f:0,  cal:260},
  {id:85, name:"Macarrones de Guisante",        cat:"pasta",     p:18, c:60, f:0,  cal:312},
  {id:86, name:"Fusilli de Lentejas (pasta)",   cat:"pasta",     p:26, c:50, f:0,  cal:304},
  {id:87, name:"Espaguetis de Soja",             cat:"pasta",     p:15, c:2,  f:2,  cal:86 },
  {id:88, name:"Ñoquis de Patata",              cat:"pasta",     p:0,  c:38, f:0,  cal:152},
  // VERDURAS
  {id:89, name:"Espinacas",                     cat:"verduras",  p:0,  c:0,  f:0,  cal:20 },
  {id:90, name:"Brócoli",                       cat:"verduras",  p:0,  c:5,  f:0,  cal:28 },
  {id:91, name:"Calabacín",                     cat:"verduras",  p:0,  c:4,  f:0,  cal:16 },
  {id:92, name:"Tomate",                        cat:"verduras",  p:0,  c:4,  f:0,  cal:16 },
  {id:93, name:"Guisantes",                     cat:"verduras",  p:5,  c:14, f:0,  cal:76 },
  {id:94, name:"Judías Verdes",                 cat:"verduras",  p:0,  c:7,  f:0,  cal:28 },
  {id:95, name:"Batata / Boniato",              cat:"verduras",  p:2,  c:21, f:0,  cal:92 },
  {id:96, name:"Patata",                        cat:"verduras",  p:2,  c:15, f:0,  cal:68 },
  {id:122,name:"Patatas Congeladas Rústicas",   cat:"verduras",  p:2,  c:20, f:6,  cal:142},
  {id:97, name:"Acelgas / Espinacas cocidas",   cat:"verduras",  p:0,  c:4,  f:0,  cal:16 },
  {id:98, name:"Calabaza",                      cat:"verduras",  p:0,  c:5,  f:0,  cal:20 },
  // FRUTAS
  {id:99, name:"Plátano",                       cat:"frutas",    p:1,  c:23, f:0,  cal:96 },
  {id:100,name:"Manzana",                       cat:"frutas",    p:0,  c:10, f:0,  cal:40 },
  {id:101,name:"Naranja",                       cat:"frutas",    p:0,  c:10, f:0,  cal:40 },
  {id:102,name:"Fresas",                        cat:"frutas",    p:0,  c:7,  f:0,  cal:28 },
  {id:103,name:"Arándanos (congelados)",        cat:"frutas",    p:0,  c:11, f:0,  cal:44 },
  {id:104,name:"Kiwi",                          cat:"frutas",    p:0,  c:13, f:0,  cal:52 },
  {id:105,name:"Melocotón",                     cat:"frutas",    p:0,  c:14, f:0,  cal:56 },
  {id:106,name:"Mango",                         cat:"frutas",    p:0,  c:18, f:0,  cal:72 },
  // GRASAS
  {id:107,name:"Aguacate",                      cat:"grasas",    p:0,  c:9,  f:15, cal:159},
  {id:108,name:"Aceite de Oliva (por cda.)",    cat:"grasas",    p:0,  c:0,  f:14, cal:126},
  {id:109,name:"Nueces",                        cat:"grasas",    p:0,  c:0,  f:65, cal:585},
  {id:110,name:"Almendras",                     cat:"grasas",    p:0,  c:0,  f:53, cal:477},
  {id:111,name:"Crema de Cacahuete Natural",    cat:"grasas",    p:24, c:13, f:48, cal:580},
  {id:112,name:"Aceitunas",                     cat:"grasas",    p:0,  c:0,  f:15, cal:135},
  // CONSERVAS
  {id:113,name:"Atún al Natural (lata 56g)",    cat:"conservas", p:20, c:0,  f:0,  cal:80 },
  {id:114,name:"Atún en Aceite Oliva (lata)",   cat:"conservas", p:14, c:0,  f:5,  cal:101},
  {id:115,name:"Mejillones al Natural (lata)",  cat:"conservas", p:17, c:3,  f:4,  cal:116},
  {id:116,name:"Caballa en Salsa Tomate",       cat:"conservas", p:14, c:2,  f:3,  cal:91 },
  {id:117,name:"Lentejas con Verduras (bote)",  cat:"conservas", p:9,  c:18, f:8,  cal:180},
  {id:118,name:"Garbanzos con Espinacas(bote)", cat:"conservas", p:11, c:29, f:10, cal:250},
  {id:119,name:"Bonito del Norte en Aceite",    cat:"conservas", p:13, c:0,  f:7,  cal:119},
  {id:120,name:"Almejas al Natural (lata)",     cat:"conservas", p:11, c:3,  f:2,  cal:74 },
];

const ALLERGIES_OPT = [
  {id:"gluten",       label:"Sin Gluten"},
  {id:"lactosa",      label:"Sin Lactosa"},
  {id:"frutos_secos", label:"Sin Frutos Secos"},
  {id:"marisco",      label:"Sin Marisco"},
  {id:"vegetariano",  label:"Vegetariano"},
  {id:"vegano",       label:"Vegano"},
];

const MEALS_NAMES = {
  1: ["Comida Principal"],
  2: ["Almuerzo","Cena"],
  3: ["Almuerzo","Merienda","Cena"],
  4: ["Desayuno","Almuerzo","Merienda","Cena"],
  5: ["Desayuno","Almuerzo","Merienda","Cena","Post-entreno"],
  6: ["Desayuno","Media Mañana","Almuerzo","Merienda","Cena","Post-entreno"],
};

const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const BERRY_IDS  = [102, 103];
const YOGURT_IDS = [46, 121];

// Objetivos y reglas de coach
const GOALS = {
  perdida_agresiva: {
    label: "Pérdida agresiva", emoji: "🔥",
    deficit: -0.27, protPerKg: 2.4, fatPerKg: 0.7,
    warn: "Déficit alto. Puede haber pérdida muscular si la proteína no se cumple. Máx 6-8 semanas seguidas.",
    color: "#ef4444",
  },
  definicion: {
    label: "Definición", emoji: "💪",
    deficit: -0.18, protPerKg: 2.1, fatPerKg: 0.9,
    warn: "Déficit óptimo para mantener músculo y energía.",
    color: "#4ade80",
  },
  mantenimiento: {
    label: "Mantenimiento", emoji: "⚖️",
    deficit: 0.00, protPerKg: 1.8, fatPerKg: 1.0,
    warn: "Calorías de mantenimiento. Ideal para recomposición.",
    color: "#60a5fa",
  },
  volumen_limpio: {
    label: "Volumen limpio", emoji: "📈",
    deficit: 0.10, protPerKg: 1.8, fatPerKg: 1.0,
    warn: "Superávit moderado, óptimo para ganar músculo con poca grasa.",
    color: "#a3e635",
  },
  volumen_agresivo: {
    label: "Volumen agresivo", emoji: "🚀",
    deficit: 0.17, protPerKg: 1.8, fatPerKg: 1.0,
    warn: "Superávit alto. Más músculo pero también más grasa.",
    color: "#f59e0b",
  },
};

const ACTIVITY = {
  muy_baja:  { label: "Muy baja",  desc: "Oficina/conductor, casi sin caminar", mult: 1.30 },
  baja:      { label: "Baja",      desc: "Trabajo sentado + algo de caminata",  mult: 1.45 },
  moderada:  { label: "Moderada",  desc: "Trabajo activo o caminas mucho",      mult: 1.62 },
  alta:      { label: "Alta",      desc: "Trabajo físico o deportista activo",  mult: 1.85 },
};

// ══════════════════════════════════════════════════════════════
// METABOLIC CALCULATIONS
// ══════════════════════════════════════════════════════════════

// Mifflin-St Jeor (cuando no hay %grasa)
const calcMifflin = (sex, weight, height, age) => {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(sex === "h" ? base + 5 : base - 161);
};

// Katch-McArdle (con %grasa)
const calcKatch = (weight, bodyFat) => {
  const leanMass = weight * (1 - bodyFat / 100);
  return Math.round(370 + 21.6 * leanMass);
};

const computeProfile = (profile) => {
  if (!profile.enabled || !profile.weight || !profile.height || !profile.age) return null;

  const useKatch = profile.bodyFat && profile.bodyFat >= 5 && profile.bodyFat <= 50;
  const bmr = useKatch
    ? calcKatch(profile.weight, profile.bodyFat)
    : calcMifflin(profile.sex, profile.weight, profile.height, profile.age);

  const tdee = Math.round(bmr * ACTIVITY[profile.activity].mult);
  const goal = GOALS[profile.goal];
  const targetKcal = Math.round(tdee * (1 + goal.deficit));

  const prot = Math.round(profile.weight * goal.protPerKg);
  const fat  = Math.round(profile.weight * goal.fatPerKg);
  const carbsKcal = targetKcal - prot * 4 - fat * 9;
  const carbs = Math.max(40, Math.round(carbsKcal / 4));

  return {
    formula: useKatch ? "Katch-McArdle" : "Mifflin-St Jeor",
    leanMass: useKatch ? +(profile.weight * (1 - profile.bodyFat/100)).toFixed(1) : null,
    bmr, tdee, targetKcal,
    macros: { proteina: prot, carbos: carbs, grasas: fat },
    goalInfo: goal,
  };
};

// Sliders enlazados: al cambiar uno, los carbos compensan para mantener kcal
const adjustMacros = (newMacros, changedKey, targetKcal) => {
  const m = { ...newMacros };
  if (changedKey === "carbos") return m; // los carbos son el balance
  const protKcal = m.proteina * 4;
  const fatKcal  = m.grasas * 9;
  const carbsKcal = Math.max(160, targetKcal - protKcal - fatKcal); // mínimo ~40g
  m.carbos = Math.round(carbsKcal / 4);
  return m;
};

// Avisos contextuales basados en macros y perfil
const macroWarnings = (macros, profile, computed) => {
  const warns = [];
  if (!profile.enabled || !computed) return warns;

  const minFat = +(profile.weight * 0.6).toFixed(0);
  const minProt = +(profile.weight * 1.6).toFixed(0);
  const targetKcal = computed.targetKcal;
  const actualKcal = macros.proteina * 4 + macros.carbos * 4 + macros.grasas * 9;

  if (macros.grasas < minFat) {
    warns.push({ type: "warn", text: `⚠️ ${macros.grasas}g de grasa es bajo para tu perfil (mínimo recomendado: ${minFat}g). Las grasas son esenciales para hormonas.` });
  }
  if (macros.proteina < minProt) {
    warns.push({ type: "warn", text: `⚠️ ${macros.proteina}g de proteína es bajo. Recomendado: ${minProt}g+ para preservar músculo.` });
  }
  if (Math.abs(actualKcal - targetKcal) > 150) {
    warns.push({ type: "info", text: `ℹ️ Estás en ${actualKcal} kcal (objetivo: ${targetKcal} kcal). Diferencia: ${actualKcal > targetKcal ? "+" : ""}${actualKcal - targetKcal}.` });
  }
  if (profile.goal === "perdida_agresiva") {
    warns.push({ type: "warn", text: "🔥 Pérdida agresiva: máx 6-8 semanas seguidas. Puede haber pérdida muscular leve aunque la proteína esté alta." });
  }
  return warns;
};

// ══════════════════════════════════════════════════════════════
// NUTRITION PLANNING ALGORITHM
// ══════════════════════════════════════════════════════════════

const r5 = (x) => Math.max(0, Math.round(x / 5) * 5);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Construye una comida individual con todas las reglas:
// - Prioridades fijas, frutos rojos→yogur, no repetir familias,
// - Carbos post-entreno concentrados, proteínas magras.
const buildMeal = ({
  tP, tC, tF, dayIdx, mealIdx, mealNames, selFoods,
  usedFoodIds, usedCats, priorityFoods,
}) => {
  const priorityList = (priorityFoods || []).map(id => FOODS.find(f => f.id === id)).filter(Boolean);
  const forcedItems = [];

  const portionForPriority = (f) => {
    if (f.p >= 18) return 180;
    if (f.p >= 12) return 150;
    if (f.c >= 50) return 80;
    if (f.c >= 20) return 150;
    if (f.f >= 40) return 25;
    if (f.f >= 15) return 50;
    if (f.cal <= 30) return 150;
    if (f.cal <= 60) return 150;
    return 100;
  };
  priorityList.forEach(f => forcedItems.push({ food: f, grams: portionForPriority(f) }));

  // Regla automática: frutos rojos siempre con yogur
  const hasBerry = priorityList.some(f => BERRY_IDS.includes(f.id));
  const yogurtInSelected = selFoods.find(f => YOGURT_IDS.includes(f.id));
  if (hasBerry && yogurtInSelected && !forcedItems.some(it => it.food.id === yogurtInSelected.id)) {
    forcedItems.push({ food: yogurtInSelected, grams: 150 });
  }

  const forcedMacros = forcedItems.reduce(
    (a, it) => ({
      p: a.p + it.grams * it.food.p / 100,
      c: a.c + it.grams * it.food.c / 100,
      f: a.f + it.grams * it.food.f / 100,
    }), { p: 0, c: 0, f: 0 }
  );

  const remP = Math.max(0, tP - forcedMacros.p);
  const remC = Math.max(0, tC - forcedMacros.c);
  const remF = Math.max(0, tF - forcedMacros.f);

  const forcedIds  = new Set(forcedItems.map(it => it.food.id));
  const forcedCats = new Set(forcedItems.map(it => it.food.cat));
  const blockedIds  = new Set([...usedFoodIds, ...forcedIds]);
  const blockedCats = new Set([...usedCats, ...forcedCats]);

  const freeBlocked = (list) => list.filter(f => !blockedIds.has(f.id) && !blockedCats.has(f.cat));
  const freeBlockedRelaxed = (list) => list.filter(f => !blockedIds.has(f.id));
  const pickBlocked = (pool, offset) => {
    let pick = freeBlocked(pool);
    if (!pick.length) pick = freeBlockedRelaxed(pool);
    if (!pick.length) pick = pool;
    return pick[offset % pick.length];
  };

  const allProt = selFoods.filter(f => f.p >= 12);
  const lean = allProt.filter(f => f.f <= 12).sort((a, b) => a.f - b.f || b.p - a.p);
  const protPool = lean.length ? lean : (allProt.length ? [...allProt].sort((a, b) => a.f - b.f) : []);
  const carbPool = [...selFoods.filter(f => f.c >= 20)].sort((a, b) => b.c - a.c);
  const carbPoolNF = carbPool.filter(f => f.cat !== "frutas");
  const fatPool  = [...selFoods.filter(f => f.f >= 25)].sort((a, b) => b.f - a.f);
  const vegPool  = selFoods.filter(f => f.cat === "verduras" && f.cal <= 40 && f.c < 12 && f.f < 3);

  const needPro  = remP > 15 && protPool.length > 0;
  const needCarb = remC > 10 && (carbPoolNF.length > 0 || carbPool.length > 0);
  const needFat  = remF > 10 && fatPool.length > 0;

  const pf = needPro ? pickBlocked(protPool, dayIdx + mealIdx) : null;
  if (pf) { blockedIds.add(pf.id); blockedCats.add(pf.cat); }
  const carbBase = carbPoolNF.length ? carbPoolNF : carbPool;
  const cf = needCarb ? pickBlocked(carbBase, dayIdx * 2 + mealIdx + 1) : null;
  if (cf) { blockedIds.add(cf.id); blockedCats.add(cf.cat); }

  // Si la primera fuente de carbo es de baja densidad (<25g HC/100g) y el objetivo es alto (>80g),
  // añadir una segunda fuente densa para poder cuadrar carbos sin porciones absurdas.
  let cf2 = null;
  if (cf && cf.c < 25 && remC > 80) {
    cf2 = pickBlocked(carbBase, dayIdx * 3 + mealIdx + 7);
    if (cf2 && cf2.c < 25) cf2 = null;
    if (cf2) { blockedIds.add(cf2.id); blockedCats.add(cf2.cat); }
  }
  const ff = needFat ? pickBlocked(fatPool, dayIdx + mealIdx * 2) : null;

  const isMain = /almuerzo|cena|comida/i.test(mealNames[mealIdx]);
  const vf = (isMain && vegPool.length && !forcedItems.some(it => it.food.cat === "verduras"))
    ? pickBlocked(vegPool, dayIdx + mealIdx)
    : null;
  const hasVeg = !!vf;

  let pg = pf ? 150 : 0;
  let cg = cf ?  70 : 0;
  let c2g = cf2 ? 50 : 0;
  let fg = ff ?   8 : 0;
  const vg = hasVeg ? 150 : 0;
  const vP = hasVeg ? vg * vf.p / 100 : 0;
  const vC = hasVeg ? vg * vf.c / 100 : 0;
  const vF = hasVeg ? vg * vf.f / 100 : 0;

  if (pf || cf || ff) {
    const pMax = pf ? Math.min(clamp((remP / (pf.p / 100 || 1)) * 1.3, 150, 400), 400) : 0;
    const cMax = cf ? Math.min(clamp((remC / (cf.c / 100 || 1)) * 1.3, 150, 350), 350) : 0;
    const c2Max = cf2 ? 220 : 0;
    const fMax = ff ? Math.min(clamp((remF / (ff.f / 100 || 1)) * 1.4, 25, 60), 60) : 0;
    for (let it = 0; it < 30; it++) {
      const curP = (pf?pg*pf.p/100:0) + (cf?cg*cf.p/100:0) + (cf2?c2g*cf2.p/100:0) + (ff?fg*ff.p/100:0) + vP;
      const curC = (pf?pg*pf.c/100:0) + (cf?cg*cf.c/100:0) + (cf2?c2g*cf2.c/100:0) + (ff?fg*ff.c/100:0) + vC;
      const curF = (pf?pg*pf.f/100:0) + (cf?cg*cf.f/100:0) + (cf2?c2g*cf2.f/100:0) + (ff?fg*ff.f/100:0) + vF;
      if (pf && pf.p > 0) pg += ((remP - curP) / (pf.p / 100)) * 0.55;
      if (cf && cf.c > 0) {
        // Repartir el déficit de carbos entre cf y cf2 si existe
        if (cf2 && cf2.c > 0 && cg >= cMax * 0.85) {
          c2g += ((remC - curC) / (cf2.c / 100)) * 0.45;
        } else {
          cg += ((remC - curC) / (cf.c / 100)) * 0.55;
        }
      }
      if (ff && ff.f > 0) fg += ((remF - curF) / (ff.f / 100)) * 0.55;
      if (pf) pg = clamp(pg, 50, pMax);
      if (cf) cg = clamp(cg, 0, cMax);
      if (cf2) c2g = clamp(c2g, 0, c2Max);
      if (ff) fg = clamp(fg, 0, fMax);
    }
    pg = r5(pg); cg = r5(cg); c2g = r5(c2g); fg = r5(fg);
  }

  const items = [];
  const push = (food, grams) => {
    if (grams < 5) return;
    const ip = +(grams * food.p / 100).toFixed(1);
    const ic = +(grams * food.c / 100).toFixed(1);
    const ifa = +(grams * food.f / 100).toFixed(1);
    items.push({ id: food.id, name: food.name, cat: food.cat, grams, p: ip, c: ic, f: ifa });
  };
  forcedItems.forEach(it => push(it.food, it.grams));
  if (pf) push(pf, pg);
  if (cf && (!pf || cf.id !== pf.id)) push(cf, cg);
  if (cf2 && cf2.id !== pf?.id && cf2.id !== cf?.id) push(cf2, c2g);
  if (ff && (!pf || ff.id !== pf.id) && (!cf || ff.id !== cf.id)) push(ff, fg);
  if (hasVeg) push(vf, vg);

  const totals = items.reduce((a,i)=>({p:a.p+i.p,c:a.c+i.c,f:a.f+i.f}),{p:0,c:0,f:0});
  totals.kcal = Math.round(totals.p*4 + totals.c*4 + totals.f*9);
  totals.p = Math.round(totals.p);
  totals.c = Math.round(totals.c);
  totals.f = Math.round(totals.f);

  return { items, totals };
};

const buildPlan = ({
  macros, meals, mealNames, selFoods,
  refeedOn, refeedDays, refeedCarbs, refeedFat,
  shakeOn, shakeProt, shakeDays,
  priorities, postWorkoutMeal,
}) => {
  const w = mealNames.length;
  // Distribución base de macros por comida
  const baseWeights = mealNames.map((_, i) =>
    w === 1 ? 1 : (/almuerzo|cena|comida/i.test(mealNames[i]) ? 1.3 : 0.8)
  );
  const baseSum = baseWeights.reduce((a,b)=>a+b,0);

  const days = DAYS.map((dayName, di) => {
    const isRefeed = refeedOn && refeedDays.includes(di);
    const hasShake = shakeOn && shakeDays.includes(di);
    const shakeP = hasShake ? shakeProt : 0;

    const dMacros = isRefeed
      ? { proteina: macros.proteina, carbos: refeedCarbs, grasas: refeedFat }
      : { ...macros };
    const dProtTarget = Math.max(40, dMacros.proteina - shakeP);

    // Distribución de CARBOS: 50-60% a la comida post-entreno si está definida
    const pwm = (postWorkoutMeal && postWorkoutMeal[di] != null) ? postWorkoutMeal[di] : null;
    let carbWeights;
    if (pwm !== null && pwm >= 0 && pwm < w) {
      carbWeights = mealNames.map((_, i) => i === pwm ? 6.0 : 1.0); // ratio fuerte
    } else {
      carbWeights = baseWeights;
    }
    const carbWeightSum = carbWeights.reduce((a,b)=>a+b,0);

    const usedFoodIds = new Set();
    const usedCats    = new Set();
    const dayMeals = [];

    mealNames.forEach((mealName, mi) => {
      const fracPF = baseWeights[mi] / baseSum;
      const fracC  = carbWeights[mi] / carbWeightSum;
      const tP = dProtTarget * fracPF;
      const tC = dMacros.carbos  * fracC;
      const tF = dMacros.grasas  * fracPF;
      const priorityFoods = priorities[`${di}_${mi}`] || [];

      const { items, totals } = buildMeal({
        tP, tC, tF, dayIdx: di, mealIdx: mi, mealNames, selFoods,
        usedFoodIds, usedCats, priorityFoods,
      });
      items.forEach(it => { usedFoodIds.add(it.id); usedCats.add(it.cat); });
      dayMeals.push({ name: mealName, items, totals, isPostWorkout: mi === pwm });
    });

    const dayTotals = dayMeals.reduce(
      (a, m) => ({
        p: a.p + m.totals.p, c: a.c + m.totals.c,
        f: a.f + m.totals.f, kcal: a.kcal + m.totals.kcal,
      }),
      { p: 0, c: 0, f: 0, kcal: 0 }
    );
    if (hasShake) { dayTotals.p += shakeP; dayTotals.kcal += shakeP * 4; }

    return {
      dayIdx: di, dayName, isRefeed,
      hasShake, shakeProt: shakeP,
      postWorkoutMeal: pwm,
      target: { ...dMacros, kcal: Math.round(dMacros.proteina*4 + dMacros.carbos*4 + dMacros.grasas*9) },
      meals: dayMeals, totals: dayTotals,
    };
  });

  return { days };
};

// ══════════════════════════════════════════════════════════════
// REACT COMPONENT
// ══════════════════════════════════════════════════════════════

export default function NutriPlanPro() {
  // ── Step navigation: 0=perfil 1=alimentos 2=objetivos 3=prioridades 4=plan ──
  const [step, setStep] = useState(0);

  // ── Profile (paso 0) ──
  const [profile, setProfile] = useState({
    enabled: false,
    sex: "h", age: 30, height: 175, weight: 75, bodyFat: 18,
    activity: "moderada", goal: "definicion",
  });

  // ── Foods & macros ──
  const [selected, setSelected] = useState([]);
  const [query, setQuery]       = useState("");
  const [catFilter, setCat]     = useState("all");
  const [macros, setMacros]     = useState({ proteina: 180, carbos: 200, grasas: 70 });
  const [targetKcal, setTargetKcal] = useState(null); // del perfil, para sliders enlazados
  const [meals, setMeals]       = useState(2);
  const [allergies, setAllergies] = useState([]);

  // ── Refeed ──
  const [refeedOn, setRefeedOn]       = useState(false);
  const [refeedDays, setRefeedDays]   = useState([5]); // ahora array
  const [refeedCarbs, setRefeedCarbs] = useState(350);

  // ── Batido proteico ──
  const [shakeOn, setShakeOn]         = useState(false);
  const [shakeProt, setShakeProt]     = useState(27);
  const [shakeDays, setShakeDays]     = useState([]);

  // ── Prioridades & post-entreno ──
  const [priorities, setPriorities]     = useState({});
  const [postWorkoutMeal, setPostWorkoutMeal] = useState({}); // {dayIdx: mealIdx}

  // ── Plan ──
  const [planData, setPlanData] = useState(null);
  const [plan, setPlan]         = useState(""); // texto para PDF
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [progress, setProgress] = useState("");
  const [saveMsg, setSaveMsg]   = useState("");
  const [exportUrl, setExportUrl] = useState("");

  // ── UI auxiliares ──
  const [showShopping, setShowShopping] = useState(false);
  const [swapping, setSwapping]         = useState(null); // {di,mi,ii,mode:"swap"|"grams"}

  // ── Memo: alimentos seleccionados, kcal, mealNames ──
  const selFoods = useMemo(() => FOODS.filter(f => selected.includes(f.id)), [selected]);
  const kcal = Math.round(macros.proteina*4 + macros.carbos*4 + macros.grasas*9);
  const mealNames = MEALS_NAMES[meals];
  const computed = useMemo(() => computeProfile(profile), [profile]);
  const warnings = useMemo(() => macroWarnings(macros, profile, computed), [macros, profile, computed]);

  const refeedFat = Math.max(30, Math.round(macros.grasas - (refeedCarbs - macros.carbos) * 0.3));
  const refeedKcal = Math.round(macros.proteina*4 + refeedCarbs*4 + refeedFat*9);

  // ── Load profile on mount ──
  useEffect(() => {
    try {
      const r = localStorage.getItem("np-v3-profile");
      if (!r) return;
      const p = JSON.parse(r);
      if (p.profile) setProfile(p.profile);
      if (p.macros) setMacros(p.macros);
      if (typeof p.targetKcal === "number") setTargetKcal(p.targetKcal);
      if (p.meals) setMeals(p.meals);
      if (Array.isArray(p.allergies)) setAllergies(p.allergies);
      if (Array.isArray(p.selected)) setSelected(p.selected);
      if (typeof p.refeedOn === "boolean") setRefeedOn(p.refeedOn);
      if (Array.isArray(p.refeedDays)) setRefeedDays(p.refeedDays);
      if (typeof p.refeedCarbs === "number") setRefeedCarbs(p.refeedCarbs);
      if (typeof p.shakeOn === "boolean") setShakeOn(p.shakeOn);
      if (typeof p.shakeProt === "number") setShakeProt(p.shakeProt);
      if (Array.isArray(p.shakeDays)) setShakeDays(p.shakeDays);
      if (p.priorities) setPriorities(p.priorities);
      if (p.postWorkoutMeal) setPostWorkoutMeal(p.postWorkoutMeal);
    } catch {}
  }, []);

  const saveProfile = () => {
    try {
      localStorage.setItem("np-v3-profile", JSON.stringify({
        profile, macros, targetKcal, meals, allergies, selected,
        refeedOn, refeedDays, refeedCarbs,
        shakeOn, shakeProt, shakeDays,
        priorities, postWorkoutMeal,
      }));
      setSaveMsg("✓ Guardado");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch { setSaveMsg("Error"); }
  };

  // ── Aplicar perfil → macros automáticos ──
  const applyProfileMacros = () => {
    if (!computed) return;
    setMacros(computed.macros);
    setTargetKcal(computed.targetKcal);
  };

  // ── Sliders enlazados ──
  const updateMacro = (key, value) => {
    if (!targetKcal || key === "carbos") {
      setMacros(m => ({ ...m, [key]: value }));
      return;
    }
    // Si hay perfil activo: cambiar prot o grasa recalcula carbos
    setMacros(m => {
      const next = { ...m, [key]: value };
      return adjustMacros(next, key, targetKcal);
    });
  };

  const toggle  = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const toggleA = (id) => setAllergies(a => a.includes(id) ? a.filter(x=>x!==id) : [...a, id]);
  const toggleRefeedDay = (i) => setRefeedDays(d => d.includes(i) ? d.filter(x=>x!==i) : [...d, i]);
  const toggleShakeDay  = (i) => setShakeDays(d => d.includes(i) ? d.filter(x=>x!==i) : [...d, i]);

  const visible = FOODS.filter(f =>
    (catFilter==="all" || f.cat===catFilter) &&
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  // ── Plan generation ──
  const generate = async () => {
    setLoading(true); setError(""); setPlan(""); setPlanData(null); setProgress("");
    if (selFoods.length < 3) {
      setError("❌ Selecciona al menos 3 alimentos.");
      setLoading(false); return;
    }
    try {
      setProgress("Optimizando macros...");
      await new Promise(r => setTimeout(r, 250));
      setProgress("Construyendo los 7 días...");
      const data = buildPlan({
        macros, meals, mealNames, selFoods,
        refeedOn, refeedDays, refeedCarbs, refeedFat,
        shakeOn, shakeProt, shakeDays,
        priorities, postWorkoutMeal,
      });
      await new Promise(r => setTimeout(r, 200));
      setPlanData(data);
      setPlan(planToText(data));
      setStep(4);
    } catch (e) {
      setError(`❌ ${e.message || "Error generando el plan."}`);
    } finally { setLoading(false); setProgress(""); }
  };

  // Helpers
  const planToText = (data) => {
    if (!data || !data.days) return "";
    let out = "";
    data.days.forEach(d => {
      out += d.isRefeed
        ? `## Día ${d.dayIdx+1} — ${d.dayName}  💥 REFEED\n`
        : `## Día ${d.dayIdx+1} — ${d.dayName}\n`;
      if (d.hasShake) out += `🥤 Batido proteico post-entreno: ${d.shakeProt}g proteína\n`;
      d.meals.forEach(m => {
        out += `**${m.name}${m.isPostWorkout ? " 🏋️ POST-ENTRENO" : ""}:**\n`;
        m.items.forEach(it => {
          out += `• ${it.name} — ${it.grams}g → P:${Math.round(it.p)} HC:${Math.round(it.c)} G:${Math.round(it.f)}\n`;
        });
      });
      out += `📊 TOTAL: ${Math.round(d.totals.p)}g prot · ${Math.round(d.totals.c)}g HC · ${Math.round(d.totals.f)}g grasa · ${d.totals.kcal} kcal\n---\n\n`;
    });
    return out;
  };

  const buildShoppingList = (data) => {
    if (!data || !data.days) return [];
    const totals = {};
    data.days.forEach(d => d.meals.forEach(m => m.items.forEach(it => {
      if (!totals[it.id]) totals[it.id] = { id: it.id, name: it.name, cat: it.cat, grams: 0 };
      totals[it.id].grams += it.grams;
    })));
    const byCat = {};
    Object.values(totals).forEach(t => {
      if (!byCat[t.cat]) byCat[t.cat] = [];
      byCat[t.cat].push(t);
    });
    return Object.entries(byCat)
      .map(([cat, items]) => ({ cat, label: CATS[cat] || cat, items: items.sort((a,b)=>b.grams-a.grams) }))
      .sort((a,b) => (a.label||"").localeCompare(b.label||""));
  };

  // Regenerar comida
  const regenerateMeal = (di, mi) => {
    if (!planData) return;
    const day = planData.days[di];
    const w = mealNames.length;
    const baseWeights = mealNames.map((_, i) =>
      w === 1 ? 1 : (/almuerzo|cena|comida/i.test(mealNames[i]) ? 1.3 : 0.8)
    );
    const baseSum = baseWeights.reduce((a,b)=>a+b,0);
    const pwm = day.postWorkoutMeal;
    const carbWeights = (pwm !== null && pwm >= 0 && pwm < w)
      ? mealNames.map((_,i) => i === pwm ? 6.0 : 1.0)
      : baseWeights;
    const carbSum = carbWeights.reduce((a,b)=>a+b,0);

    const dProt = Math.max(40, day.target.proteina - (day.hasShake ? day.shakeProt : 0));
    const usedFoodIds = new Set();
    const usedCats = new Set();
    day.meals.forEach((m, idx) => {
      if (idx !== mi) m.items.forEach(it => { usedFoodIds.add(it.id); usedCats.add(it.cat); });
    });
    day.meals[mi].items.forEach(it => { if (!usedFoodIds.has(it.id)) usedFoodIds.add(it.id); });

    const priorityFoods = priorities[`${di}_${mi}`] || [];
    const { items, totals } = buildMeal({
      tP: dProt * baseWeights[mi] / baseSum,
      tC: day.target.carbos * carbWeights[mi] / carbSum,
      tF: day.target.grasas * baseWeights[mi] / baseSum,
      dayIdx: di, mealIdx: mi, mealNames, selFoods,
      usedFoodIds, usedCats, priorityFoods,
    });

    const newDays = planData.days.map((d, idx) => {
      if (idx !== di) return d;
      const newMeals = d.meals.map((m, j) => j === mi ? { ...m, items, totals } : m);
      const t = newMeals.reduce((a,m)=>({p:a.p+m.totals.p,c:a.c+m.totals.c,f:a.f+m.totals.f,kcal:a.kcal+m.totals.kcal}),{p:0,c:0,f:0,kcal:0});
      if (d.hasShake) { t.p += d.shakeProt; t.kcal += d.shakeProt * 4; }
      return { ...d, meals: newMeals, totals: t };
    });
    setPlanData({ ...planData, days: newDays });
  };

  // Swap alimento por otro
  const swapItem = (di, mi, ii, newFoodId) => {
    if (!planData) return;
    const newFood = FOODS.find(f => f.id === newFoodId);
    if (!newFood) return;
    const meal = planData.days[di].meals[mi];
    const oldItem = meal.items[ii];
    if (!oldItem) return;
    const oldKcal = oldItem.grams * (oldItem.p*4 + oldItem.c*4 + oldItem.f*9) / 100;
    const newK100 = newFood.p*4 + newFood.c*4 + newFood.f*9;
    let grams = newK100 > 0 ? Math.round((oldKcal / newK100) * 100 / 5) * 5 : 100;
    grams = Math.max(30, Math.min(grams, 500));
    applyItemChange(di, mi, ii, newFood, grams);
  };

  // Editar gramos manualmente
  const updateGrams = (di, mi, ii, grams) => {
    if (!planData) return;
    const it = planData.days[di].meals[mi].items[ii];
    const food = FOODS.find(f => f.id === it.id);
    if (!food) return;
    applyItemChange(di, mi, ii, food, Math.max(0, grams));
  };

  const applyItemChange = (di, mi, ii, food, grams) => {
    const ip = +(grams * food.p / 100).toFixed(1);
    const ic = +(grams * food.c / 100).toFixed(1);
    const ifa = +(grams * food.f / 100).toFixed(1);
    const newItem = { id: food.id, name: food.name, cat: food.cat, grams, p: ip, c: ic, f: ifa };
    const newDays = planData.days.map((d, dIdx) => {
      if (dIdx !== di) return d;
      const newMeals = d.meals.map((m, mIdx) => {
        if (mIdx !== mi) return m;
        const newItems = m.items.map((it, iIdx) => iIdx === ii ? newItem : it);
        const tot = newItems.reduce((a,i)=>({p:a.p+i.p,c:a.c+i.c,f:a.f+i.f}),{p:0,c:0,f:0});
        tot.kcal = Math.round(tot.p*4 + tot.c*4 + tot.f*9);
        tot.p = Math.round(tot.p); tot.c = Math.round(tot.c); tot.f = Math.round(tot.f);
        return { ...m, items: newItems, totals: tot };
      });
      const dT = newMeals.reduce((a,m)=>({p:a.p+m.totals.p,c:a.c+m.totals.c,f:a.f+m.totals.f,kcal:a.kcal+m.totals.kcal}),{p:0,c:0,f:0,kcal:0});
      if (d.hasShake) { dT.p += d.shakeProt; dT.kcal += d.shakeProt * 4; }
      return { ...d, meals: newMeals, totals: dT };
    });
    setPlanData({ ...planData, days: newDays });
  };

  // Sync plan text
  useEffect(() => {
    if (planData) setPlan(planToText(planData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData]);

  // Generate HTML for PDF export
  const generatePlanHTML = () => {
    if (!planData) return "";
    let body = "";
    planData.days.forEach((d, di) => {
      const refeedClass = d.isRefeed ? "refeed-day" : "";
      body += `<h2 class="${refeedClass}">📅 Día ${di+1} — ${d.dayName}${d.isRefeed?" 💥 REFEED":""}</h2>`;
      if (d.hasShake) body += `<p class="shake">🥤 Batido proteico: ${d.shakeProt}g proteína</p>`;
      d.meals.forEach(m => {
        const pw = m.isPostWorkout ? " 🏋️ POST-ENTRENO" : "";
        body += `<h3>${m.name}${pw}</h3><ul>`;
        m.items.forEach(it => {
          body += `<li><strong>${it.name}</strong> — ${it.grams}g <small>(P:${Math.round(it.p)} HC:${Math.round(it.c)} G:${Math.round(it.f)})</small></li>`;
        });
        body += `</ul>`;
      });
      body += `<div class="total">📊 ${Math.round(d.totals.p)}g prot · ${Math.round(d.totals.c)}g HC · ${Math.round(d.totals.f)}g grasa · ${d.totals.kcal} kcal</div><hr>`;
    });
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NutriPlan — Plan Semanal</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;max-width:820px;margin:0 auto;padding:24px;color:#111;line-height:1.5}.header{text-align:center;border-bottom:3px solid #16a34a;padding-bottom:16px;margin-bottom:20px}.header h1{color:#166534;font-size:24px;margin-bottom:6px}.meta{color:#666;font-size:13px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}.meta span{background:#f0fdf4;border:1px solid #bbf7d0;padding:3px 10px;border-radius:20px;color:#166534}h2{background:#f0fdf4;color:#166534;padding:8px 14px;border-left:4px solid #16a34a;margin:20px 0 8px;font-size:15px;border-radius:0 6px 6px 0}h2.refeed-day{background:#fef3c7;color:#92400e;border-left-color:#f59e0b}h3{color:#15803d;margin:10px 0 4px;font-size:13px;font-weight:600}.shake{background:#dbeafe;color:#1e40af;padding:5px 11px;border-radius:6px;font-size:11px;margin:4px 0}ul{margin:3px 0}li{margin:3px 0 3px 18px;font-size:13px;color:#374151;list-style:none}li:before{content:"• ";color:#16a34a}small{color:#9ca3af;font-size:11px}.total{background:#f0fdf4;border:1px solid #bbf7d0;padding:6px 12px;border-radius:6px;margin:8px 0 14px;font-weight:700;color:#166534;font-size:13px}hr{border:none;border-top:1px solid #e5e7eb;margin:6px 0}@media print{body{padding:12px}h2{break-inside:avoid}}</style></head><body>
<div class="header"><h1>🥗 NutriPlan — Plan Semanal</h1><div class="meta">
<span>📅 ${new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</span>
<span>💪 ${macros.proteina}g proteína</span>
<span>⚡ ${macros.carbos}g carbos</span>
<span>🔥 ${macros.grasas}g grasas</span>
<span>~${kcal} kcal/día</span>
<span>${meals} comidas/día</span>
</div></div>
${body}
<p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:30px">Generado con NutriPlan · ${new Date().getFullYear()}</p>
</body></html>`;
  };

  useEffect(() => {
    if (step === 4 && planData) {
      const html = generatePlanHTML();
      setExportUrl("data:text/html;charset=utf-8," + encodeURIComponent(html));
    } else {
      setExportUrl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, planData]);

  // ── Styles ──
  const C = {
    wrap:  {minHeight:"100vh",background:"#080d08",fontFamily:"'DM Sans',sans-serif",color:"#e2e8f0"},
    main:  {maxWidth:680,margin:"0 auto",padding:"22px 14px"},
    card:  {background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:16,marginBottom:12},
    btnG:  {background:"#16a34a",color:"#fff",border:"none",borderRadius:11,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%",transition:"background .2s"},
    btnS:  {background:"transparent",border:"1px solid rgba(255,255,255,0.12)",color:"#94a3b8",borderRadius:10,padding:"10px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit"},
    tag:   {border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#94a3b8",borderRadius:20,padding:"5px 13px",fontSize:12,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",transition:"all .15s"},
    tagOn: {borderColor:"#4ade80",background:"rgba(74,222,128,0.1)",color:"#4ade80"},
    inp:   {background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 13px",color:"#e2e8f0",fontSize:14,fontFamily:"inherit",width:"100%",outline:"none"},
    badge: {background:"rgba(74,222,128,0.1)",color:"#4ade80",fontSize:9,padding:"2px 7px",borderRadius:20,border:"1px solid rgba(74,222,128,0.25)",letterSpacing:1},
    lbl:   {color:"#64748b",fontSize:11,fontWeight:600,letterSpacing:.8,marginBottom:10},
  };

  const STEPS = ["Perfil","Alimentos","Objetivos","Prioridades","Plan"];

  return (
    <div style={C.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#1e3a1e;border-radius:2px}
        .fc{transition:all .14s;cursor:pointer}
        .fc:hover{border-color:#4ade80!important;background:rgba(74,222,128,0.09)!important;transform:translateY(-1px)}
        .bg:hover{background:#22c55e!important}
        .bg:disabled{opacity:.45;cursor:not-allowed}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:currentColor;cursor:pointer}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        select{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 13px;color:#e2e8f0;font-size:14px;font-family:inherit;width:100%;outline:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>

      {/* ── Header ── */}
      <div style={{borderBottom:"1px solid rgba(74,222,128,0.12)",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(74,222,128,0.025)",backdropFilter:"blur(8px)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🥗</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#4ade80",letterSpacing:2,fontWeight:500}}>NUTRIPLAN</span>
          <span style={C.badge}>PRO</span>
        </div>
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          {STEPS.map((label,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:3}}>
              <div onClick={()=>{ if (i<=step) setStep(i); }}
                style={{width:18,height:18,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,background:step>=i?"#4ade80":"rgba(255,255,255,0.06)",color:step>=i?"#080d08":"#475569",transition:"all .3s",cursor:i<=step?"pointer":"default"}}>
                {step>i ? "✓" : i+1}
              </div>
              {i<STEPS.length-1 && <div style={{width:6,height:1,background:step>i?"#4ade80":"rgba(255,255,255,0.08)"}}/>}
            </div>
          ))}
        </div>
      </div>

      <div style={C.main}>

        {/* ══════════════ STEP 0: PERFIL (opcional) ══════════════ */}
        {step===0 && <>
          <div style={{marginBottom:18}}>
            <h1 style={{fontSize:22,fontWeight:700,color:"#f1f5f9",margin:"0 0 4px"}}>Tu perfil de entrenamiento</h1>
            <p style={{color:"#64748b",fontSize:13,margin:0,lineHeight:1.5}}>
              Opcional pero recomendado. Calcula tus calorías y macros como un coach profesional.
            </p>
          </div>

          {/* Toggle perfil */}
          <div style={{...C.card,borderColor:profile.enabled?"rgba(74,222,128,0.3)":"rgba(255,255,255,0.07)",background:profile.enabled?"rgba(74,222,128,0.05)":"rgba(255,255,255,0.02)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{color:profile.enabled?"#4ade80":"#94a3b8",fontSize:12,fontWeight:700,margin:"0 0 2px",letterSpacing:.6}}>🎯 USAR PERFIL INTELIGENTE</p>
              <p style={{color:"#475569",fontSize:11,margin:0}}>Cálculo automático de kcal y macros según tus datos</p>
            </div>
            <div onClick={()=>setProfile(p=>({...p,enabled:!p.enabled}))}
              style={{width:44,height:24,borderRadius:12,background:profile.enabled?"#16a34a":"rgba(255,255,255,0.1)",position:"relative",cursor:"pointer",transition:"all .2s",flexShrink:0}}>
              <div style={{position:"absolute",top:2,left:profile.enabled?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all .2s"}}/>
            </div>
          </div>

          {profile.enabled && <>
            {/* Sexo */}
            <div style={C.card}>
              <p style={C.lbl}>SEXO</p>
              <div style={{display:"flex",gap:8}}>
                {[{v:"h",l:"Hombre"},{v:"m",l:"Mujer"}].map(x => (
                  <div key={x.v} onClick={()=>setProfile(p=>({...p,sex:x.v}))}
                    style={{flex:1,border:`1px solid ${profile.sex===x.v?"#4ade80":"rgba(255,255,255,0.08)"}`,background:profile.sex===x.v?"rgba(74,222,128,0.08)":"transparent",borderRadius:10,padding:"10px",cursor:"pointer",textAlign:"center",fontSize:13,fontWeight:600,color:profile.sex===x.v?"#4ade80":"#94a3b8"}}>
                    {x.l}
                  </div>
                ))}
              </div>
            </div>

            {/* Datos básicos */}
            <div style={{...C.card,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <p style={{...C.lbl,marginBottom:6}}>EDAD</p>
                <input type="number" value={profile.age} onChange={e=>setProfile(p=>({...p,age:+e.target.value||0}))} style={C.inp}/>
              </div>
              <div>
                <p style={{...C.lbl,marginBottom:6}}>ALTURA (cm)</p>
                <input type="number" value={profile.height} onChange={e=>setProfile(p=>({...p,height:+e.target.value||0}))} style={C.inp}/>
              </div>
              <div>
                <p style={{...C.lbl,marginBottom:6}}>PESO (kg)</p>
                <input type="number" value={profile.weight} onChange={e=>setProfile(p=>({...p,weight:+e.target.value||0}))} style={C.inp} step="0.1"/>
              </div>
              <div>
                <p style={{...C.lbl,marginBottom:6}}>% GRASA <span style={{color:"#475569",fontWeight:400,textTransform:"none",letterSpacing:0}}>(opcional)</span></p>
                <input type="number" value={profile.bodyFat || ""} placeholder="ej: 18"
                  onChange={e=>setProfile(p=>({...p,bodyFat:e.target.value?+e.target.value:null}))} style={C.inp}/>
              </div>
            </div>

            {/* Actividad */}
            <div style={C.card}>
              <p style={C.lbl}>ACTIVIDAD DIARIA</p>
              {Object.entries(ACTIVITY).map(([key,act]) => (
                <div key={key} onClick={()=>setProfile(p=>({...p,activity:key}))}
                  style={{border:`1px solid ${profile.activity===key?"#4ade80":"rgba(255,255,255,0.08)"}`,background:profile.activity===key?"rgba(74,222,128,0.08)":"transparent",borderRadius:10,padding:"10px 12px",cursor:"pointer",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:profile.activity===key?"#4ade80":"#cbd5e1"}}>{act.label}</div>
                    <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{act.desc}</div>
                  </div>
                  <span style={{fontSize:10,color:"#475569",fontFamily:"'DM Mono',monospace"}}>×{act.mult}</span>
                </div>
              ))}
            </div>

            {/* Objetivo */}
            <div style={C.card}>
              <p style={C.lbl}>OBJETIVO</p>
              {Object.entries(GOALS).map(([key,g]) => (
                <div key={key} onClick={()=>setProfile(p=>({...p,goal:key}))}
                  style={{border:`1px solid ${profile.goal===key?g.color:"rgba(255,255,255,0.08)"}`,background:profile.goal===key?g.color+"20":"transparent",borderRadius:10,padding:"10px 12px",cursor:"pointer",marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:700,color:profile.goal===key?g.color:"#cbd5e1"}}>
                      {g.emoji} {g.label}
                    </span>
                    <span style={{fontSize:10,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>
                      {g.deficit > 0 ? "+" : ""}{Math.round(g.deficit*100)}%
                    </span>
                  </div>
                  {profile.goal===key && (
                    <p style={{fontSize:10,color:"#94a3b8",margin:"5px 0 0",lineHeight:1.5}}>{g.warn}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Cálculo automático */}
            {computed && (
              <div style={{...C.card,background:"rgba(74,222,128,0.05)",borderColor:"rgba(74,222,128,0.2)"}}>
                <p style={{color:"#4ade80",fontSize:11,fontWeight:700,margin:"0 0 10px",letterSpacing:.6}}>📊 CÁLCULO AUTOMÁTICO</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12,color:"#cbd5e1"}}>
                  <div>Fórmula: <strong style={{color:"#4ade80"}}>{computed.formula}</strong></div>
                  {computed.leanMass && <div>Masa magra: <strong style={{color:"#4ade80"}}>{computed.leanMass}kg</strong></div>}
                  <div>BMR: <strong style={{color:"#4ade80"}}>{computed.bmr}</strong> kcal</div>
                  <div>TDEE: <strong style={{color:"#4ade80"}}>{computed.tdee}</strong> kcal</div>
                </div>
                <div style={{marginTop:12,padding:"10px 12px",background:"rgba(74,222,128,0.1)",borderRadius:9,border:"1px solid rgba(74,222,128,0.2)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,color:"#86efac",fontWeight:600}}>OBJETIVO DIARIO</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:"#4ade80",fontWeight:700}}>{computed.targetKcal} kcal</span>
                  </div>
                  <div style={{fontSize:11,color:"#86efac",fontFamily:"'DM Mono',monospace"}}>
                    P: <strong>{computed.macros.proteina}g</strong> · HC: <strong>{computed.macros.carbos}g</strong> · G: <strong>{computed.macros.grasas}g</strong>
                  </div>
                </div>
                <button onClick={applyProfileMacros}
                  style={{marginTop:10,width:"100%",background:"rgba(74,222,128,0.15)",color:"#4ade80",border:"1px solid rgba(74,222,128,0.3)",borderRadius:10,padding:"10px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  ✓ Aplicar a mis macros
                </button>
              </div>
            )}
          </>}

          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button className="bg" onClick={()=>setStep(1)}
              style={C.btnG}>
              {profile.enabled ? "Continuar a Alimentos →" : "Saltar al paso de alimentos →"}
            </button>
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:14}}>
            <button onClick={saveProfile} style={{...C.btnS,fontSize:11}}>💾 Guardar</button>
            {saveMsg && <span style={{color:"#4ade80",fontSize:11}}>{saveMsg}</span>}
          </div>
        </>}

        {/* ══════════════ STEP 1: FOODS ══════════════ */}
        {step===1 && <>
          <div style={{marginBottom:18}}>
            <h1 style={{fontSize:21,fontWeight:700,color:"#f1f5f9",margin:"0 0 4px"}}>Elige tus alimentos</h1>
            <p style={{color:"#475569",fontSize:13,margin:0}}>{selected.length} seleccionados de {FOODS.length} disponibles</p>
          </div>

          <input style={C.inp} placeholder="🔍  Buscar alimento..." value={query} onChange={e=>setQuery(e.target.value)}/>

          <div style={{display:"flex",gap:6,overflowX:"auto",margin:"10px 0 12px",paddingBottom:4}}>
            {Object.entries(CATS).map(([key,label])=>(
              <button key={key} onClick={()=>setCat(key)} style={{...C.tag,...(catFilter===key?C.tagOn:{}),flexShrink:0,fontSize:11}}>
                {label}
              </button>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,maxHeight:360,overflowY:"auto",marginBottom:14,paddingRight:2}}>
            {visible.map(food => {
              const on = selected.includes(food.id);
              return (
                <div key={food.id} className="fc" onClick={()=>toggle(food.id)}
                  style={{border:`1px solid ${on?"#4ade80":"rgba(255,255,255,0.07)"}`,background:on?"rgba(74,222,128,0.09)":"rgba(255,255,255,0.02)",borderRadius:10,padding:"10px 9px",textAlign:"center"}}>
                  <div style={{fontSize:11,fontWeight:600,color:on?"#4ade80":"#cbd5e1",lineHeight:1.35,marginBottom:5}}>{food.name}</div>
                  <div style={{fontSize:9,color:"#475569",lineHeight:1.6}}>
                    P <span style={{color:"#86efac"}}>{food.p}</span> · C <span style={{color:"#93c5fd"}}>{food.c}</span> · G <span style={{color:"#fcd34d"}}>{food.f}</span>
                  </div>
                  {on && <div style={{color:"#4ade80",fontSize:14,marginTop:4,fontWeight:800}}>✓</div>}
                </div>
              );
            })}
            {visible.length===0 &&
              <p style={{color:"#334155",fontSize:13,gridColumn:"1/-1",textAlign:"center",padding:"30px 0"}}>Sin resultados para "{query}"</p>
            }
          </div>

          <div style={C.card}>
            <p style={C.lbl}>RESTRICCIONES ALIMENTARIAS</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {ALLERGIES_OPT.map(a => {
                const on = allergies.includes(a.id);
                return <button key={a.id} onClick={()=>toggleA(a.id)} style={{...C.tag,...(on?C.tagOn:{})}}>{a.label}</button>;
              })}
            </div>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep(0)} style={{...C.btnS,flex:1}}>← Volver</button>
            <button className="bg" onClick={()=>setStep(2)} disabled={selected.length<3}
              style={{...C.btnG,flex:2}}>
              {selected.length<3 ? `Selecciona al menos 3 (${selected.length}/3)` : `Continuar con ${selected.length} alimentos →`}
            </button>
          </div>
        </>}

        {/* ══════════════ STEP 2: OBJECTIVES ══════════════ */}
        {step===2 && <>
          <div style={{marginBottom:18}}>
            <h1 style={{fontSize:21,fontWeight:700,color:"#f1f5f9",margin:"0 0 4px"}}>Objetivos y comidas</h1>
            <p style={{color:"#475569",fontSize:13,margin:0}}>
              {targetKcal ? `Objetivo: ${targetKcal} kcal/día (de tu perfil)` : "Personaliza tus macros diarios"}
            </p>
          </div>

          {/* Avisos coach */}
          {warnings.length > 0 && (
            <div style={{marginBottom:10}}>
              {warnings.map((w,i) => (
                <div key={i} style={{
                  background: w.type==="warn" ? "rgba(245,158,11,0.07)" : "rgba(96,165,250,0.07)",
                  border: `1px solid ${w.type==="warn" ? "rgba(245,158,11,0.2)" : "rgba(96,165,250,0.2)"}`,
                  borderRadius:10, padding:"10px 13px", marginBottom:6,
                  color: w.type==="warn" ? "#fde68a" : "#93c5fd", fontSize:11, lineHeight:1.5
                }}>{w.text}</div>
              ))}
            </div>
          )}

          {[
            {key:"proteina", label:"Proteína",      color:"#4ade80", min:60,  max:300, emoji:"💪"},
            {key:"carbos",   label:"Carbohidratos", color:"#60a5fa", min:50,  max:500, emoji:"⚡"},
            {key:"grasas",   label:"Grasas",        color:"#f59e0b", min:30,  max:200, emoji:"🔥"},
          ].map(({key,label,color,min,max,emoji}) => (
            <div key={key} style={C.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:13,color:"#94a3b8",fontWeight:500}}>{emoji} {label}</span>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:20,color,fontWeight:700}}>
                  {macros[key]}<span style={{fontSize:11,color:"#475569"}}>g</span>
                </span>
              </div>
              <input type="range" min={min} max={max} value={macros[key]}
                onChange={e=>updateMacro(key, +e.target.value)}
                style={{width:"100%",accentColor:color,color}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#334155",marginTop:3}}>
                <span>{min}g</span><span>{max}g</span>
              </div>
              {targetKcal && key !== "carbos" && (
                <p style={{fontSize:9,color:"#475569",margin:"5px 0 0",fontStyle:"italic"}}>↔ Los carbos se ajustan automáticamente para mantener {targetKcal} kcal</p>
              )}
            </div>
          ))}

          {/* Número de comidas */}
          <div style={C.card}>
            <p style={C.lbl}>NÚMERO DE COMIDAS AL DÍA</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:10}}>
              {[1,2,3,4,5,6].map(n => (
                <div key={n} onClick={()=>setMeals(n)}
                  style={{border:`1px solid ${meals===n?"#4ade80":"rgba(255,255,255,0.08)"}`,background:meals===n?"rgba(74,222,128,0.1)":"transparent",borderRadius:9,padding:"9px 4px",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                  <div style={{fontSize:18,fontWeight:800,color:meals===n?"#4ade80":"#475569"}}>{n}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:"#4ade80",textAlign:"center",letterSpacing:.3}}>
              {mealNames.join(" · ")}
            </div>
          </div>

          {/* Refeed multidía */}
          <div style={{...C.card,borderColor:refeedOn?"rgba(245,158,11,0.3)":"rgba(255,255,255,0.07)",background:refeedOn?"rgba(245,158,11,0.05)":"rgba(255,255,255,0.02)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:refeedOn?12:0}}>
              <div>
                <p style={{color:refeedOn?"#fbbf24":"#64748b",fontSize:11,fontWeight:700,margin:"0 0 2px",letterSpacing:.8}}>💥 MODO REFEED</p>
                <p style={{color:"#475569",fontSize:10,margin:0}}>Día(s) de carga de carbos (↑carbos ↓grasas)</p>
              </div>
              <div onClick={()=>setRefeedOn(v=>!v)}
                style={{width:44,height:24,borderRadius:12,background:refeedOn?"#f59e0b":"rgba(255,255,255,0.1)",position:"relative",cursor:"pointer",transition:"all .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:refeedOn?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all .2s"}}/>
              </div>
            </div>

            {refeedOn && <>
              <div style={{marginTop:8}}>
                <p style={{color:"#92400e",fontSize:10,fontWeight:600,margin:"0 0 6px",letterSpacing:.5}}>DÍAS DE CARGA ({refeedDays.length} seleccionados)</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                  {DAYS.map((d, i) => {
                    const on = refeedDays.includes(i);
                    return (
                      <div key={i} onClick={()=>toggleRefeedDay(i)}
                        style={{border:`1px solid ${on?"#f59e0b":"rgba(255,255,255,0.08)"}`,background:on?"rgba(245,158,11,0.15)":"transparent",borderRadius:8,padding:"7px 2px",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                        <div style={{fontSize:11,fontWeight:700,color:on?"#fbbf24":"#64748b"}}>{d.slice(0,3)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{marginTop:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:12,color:"#94a3b8"}}>⚡ Carbos del día de carga</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:18,color:"#fbbf24",fontWeight:700}}>
                    {refeedCarbs}<span style={{fontSize:11,color:"#475569"}}>g</span>
                  </span>
                </div>
                <input type="range" min={macros.carbos} max={500}
                  value={Math.max(macros.carbos, Math.min(500, refeedCarbs))}
                  onChange={e=>setRefeedCarbs(+e.target.value)}
                  style={{width:"100%",accentColor:"#f59e0b",color:"#f59e0b"}}/>
              </div>

              {refeedDays.length > 0 && (
                <div style={{marginTop:12,padding:"10px 12px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10}}>
                  <p style={{fontSize:10,color:"#92400e",margin:"0 0 6px",fontWeight:600,letterSpacing:.4}}>RESUMEN DÍA REFEED</p>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#fde68a",fontFamily:"'DM Mono',monospace"}}>
                    <span>P: <strong style={{color:"#fbbf24"}}>{macros.proteina}g</strong></span>
                    <span>HC: <strong style={{color:"#fbbf24"}}>{refeedCarbs}g</strong></span>
                    <span>G: <strong style={{color:"#fbbf24"}}>{refeedFat}g</strong></span>
                    <span><strong style={{color:"#fbbf24"}}>{refeedKcal}</strong> kcal</span>
                  </div>
                </div>
              )}
            </>}
          </div>

          {/* Batido proteico */}
          <div style={{...C.card,borderColor:shakeOn?"rgba(96,165,250,0.3)":"rgba(255,255,255,0.07)",background:shakeOn?"rgba(96,165,250,0.05)":"rgba(255,255,255,0.02)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:shakeOn?12:0}}>
              <div>
                <p style={{color:shakeOn?"#60a5fa":"#64748b",fontSize:11,fontWeight:700,margin:"0 0 2px",letterSpacing:.8}}>🥤 BATIDO PROTEICO</p>
                <p style={{color:"#475569",fontSize:10,margin:0}}>Se descuenta de la proteína del día</p>
              </div>
              <div onClick={()=>setShakeOn(v=>!v)}
                style={{width:44,height:24,borderRadius:12,background:shakeOn?"#3b82f6":"rgba(255,255,255,0.1)",position:"relative",cursor:"pointer",transition:"all .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:shakeOn?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all .2s"}}/>
              </div>
            </div>

            {shakeOn && <>
              <div style={{marginTop:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,color:"#94a3b8"}}>Proteína por batido</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:16,color:"#60a5fa",fontWeight:700}}>{shakeProt}<span style={{fontSize:10,color:"#475569"}}>g</span></span>
                </div>
                <input type="range" min={15} max={50} value={shakeProt}
                  onChange={e=>setShakeProt(+e.target.value)} style={{width:"100%",accentColor:"#3b82f6",color:"#3b82f6"}}/>
              </div>

              <div style={{marginTop:14}}>
                <p style={{color:"#3b82f6",fontSize:10,fontWeight:600,margin:"0 0 6px",letterSpacing:.5}}>DÍAS QUE TOMAS BATIDO</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                  {DAYS.map((d, i) => {
                    const on = shakeDays.includes(i);
                    return (
                      <div key={i} onClick={()=>toggleShakeDay(i)}
                        style={{border:`1px solid ${on?"#3b82f6":"rgba(255,255,255,0.08)"}`,background:on?"rgba(59,130,246,0.15)":"transparent",borderRadius:8,padding:"7px 2px",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                        <div style={{fontSize:11,fontWeight:700,color:on?"#60a5fa":"#64748b"}}>{d.slice(0,3)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>}
          </div>

          {/* Calorías estimadas */}
          <div style={{...C.card,display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(74,222,128,0.035)",borderColor:"rgba(74,222,128,0.12)",marginBottom:16}}>
            <span style={{fontSize:12,color:"#86efac"}}>⚡ Calorías estimadas</span>
            <span style={{fontFamily:"'DM Mono',monospace",color:"#4ade80",fontWeight:700,fontSize:18}}>{kcal} <span style={{fontSize:12,fontWeight:400,color:"#64748b"}}>kcal/día</span></span>
          </div>

          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <button onClick={()=>setStep(1)} style={{...C.btnS,flex:1}}>← Volver</button>
            <button className="bg" onClick={()=>setStep(3)}
              style={{...C.btnG,flex:2,margin:0}}>
              Continuar a Prioridades →
            </button>
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <button onClick={saveProfile} style={{...C.btnS,fontSize:11}}>💾 Guardar perfil</button>
            {saveMsg && <span style={{color:"#4ade80",fontSize:11}}>{saveMsg}</span>}
          </div>
        </>}

        {/* ══════════════ STEP 3: PRIORIDADES + POST-ENTRENO ══════════════ */}
        {step===3 && <>
          <div style={{marginBottom:18}}>
            <h1 style={{fontSize:21,fontWeight:700,color:"#f1f5f9",margin:"0 0 4px"}}>Prioridades y post-entreno</h1>
            <p style={{color:"#475569",fontSize:13,margin:0,lineHeight:1.5}}>
              Por cada día puedes marcar la comida post-entreno (50-60% carbos van ahí) y alimentos obligatorios.
            </p>
          </div>

          {DAYS.map((dayName, di) => {
            const dayHasPrios = mealNames.some((_, mi) => (priorities[`${di}_${mi}`] || []).length > 0);
            const pwm = postWorkoutMeal[di];
            const hasPW = pwm !== undefined && pwm !== null;
            return (
              <div key={di} style={{...C.card,borderColor:(dayHasPrios||hasPW)?"rgba(168,85,247,0.25)":"rgba(255,255,255,0.07)",background:(dayHasPrios||hasPW)?"rgba(168,85,247,0.04)":"rgba(255,255,255,0.02)"}}>
                <p style={{color:(dayHasPrios||hasPW)?"#c084fc":"#94a3b8",fontSize:12,fontWeight:700,margin:"0 0 10px",letterSpacing:.5}}>📅 {dayName.toUpperCase()}</p>

                {/* Post-entreno selector */}
                <div style={{marginBottom:12,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <p style={{fontSize:10,color:"#94a3b8",margin:"0 0 6px",fontWeight:600,letterSpacing:.4}}>🏋️ COMIDA POST-ENTRENO (opcional)</p>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <div onClick={()=>setPostWorkoutMeal(p=>{const n={...p};delete n[di];return n;})}
                      style={{border:`1px solid ${!hasPW?"#a855f7":"rgba(255,255,255,0.08)"}`,background:!hasPW?"rgba(168,85,247,0.1)":"transparent",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:10,color:!hasPW?"#c084fc":"#64748b"}}>
                      Sin
                    </div>
                    {mealNames.map((mn, mi) => (
                      <div key={mi} onClick={()=>setPostWorkoutMeal(p=>({...p,[di]:mi}))}
                        style={{border:`1px solid ${pwm===mi?"#a855f7":"rgba(255,255,255,0.08)"}`,background:pwm===mi?"rgba(168,85,247,0.1)":"transparent",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:10,color:pwm===mi?"#c084fc":"#64748b"}}>
                        {mn}
                      </div>
                    ))}
                  </div>
                </div>

                {mealNames.map((mealName, mi) => {
                  const key = `${di}_${mi}`;
                  const prios = priorities[key] || [];
                  return (
                    <div key={mi} style={{marginBottom:mi<mealNames.length-1?10:0,paddingBottom:mi<mealNames.length-1?10:0,borderBottom:mi<mealNames.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                      <p style={{fontSize:11,color:"#cbd5e1",margin:"0 0 6px",fontWeight:600}}>{mealName}{pwm===mi && <span style={{color:"#a855f7",fontSize:9,marginLeft:5}}>🏋️ POST-ENTRENO</span>}</p>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                        {prios.map(pid => {
                          const f = FOODS.find(x => x.id === pid);
                          if (!f) return null;
                          return (
                            <div key={pid} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:14,padding:"3px 8px 3px 10px",fontSize:11,color:"#d8b4fe"}}>
                              {f.name}
                              <span
                                onClick={()=>setPriorities(p=>({...p,[key]:(p[key]||[]).filter(x=>x!==pid)}))}
                                style={{cursor:"pointer",color:"#a855f7",fontWeight:700,fontSize:13,lineHeight:1}}>×</span>
                            </div>
                          );
                        })}
                      </div>
                      {selFoods.length > 0 ? (
                        <select value="" onChange={e=>{
                          const v = +e.target.value;
                          if (!v) return;
                          setPriorities(p=>{
                            const cur = p[key] || [];
                            if (cur.includes(v)) return p;
                            return {...p, [key]: [...cur, v]};
                          });
                        }} style={{...C.inp,fontSize:11,padding:"6px 9px"}}>
                          <option value="">+ Añadir alimento prioritario...</option>
                          {selFoods.filter(f => !prios.includes(f.id)).map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      ) : (
                        <p style={{fontSize:10,color:"#475569",margin:0,fontStyle:"italic"}}>Selecciona alimentos en el paso 1 primero</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div style={{display:"flex",gap:8,marginBottom:10,marginTop:14}}>
            <button onClick={()=>setStep(2)} style={{...C.btnS,flex:1}}>← Volver</button>
            <button onClick={()=>{setPriorities({});setPostWorkoutMeal({});}} style={{...C.btnS,flex:1,fontSize:11}}>🗑 Limpiar</button>
            <button className="bg" onClick={generate} disabled={loading}
              style={{...C.btnG,flex:2,margin:0}}>
              {loading ? (progress || "⏳ Generando...") : "✨ Generar Plan"}
            </button>
          </div>

          {error && <div style={{marginTop:12,padding:"10px 14px",background:"rgba(239,68,68,0.09)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,color:"#fca5a5",fontSize:13}}>{error}</div>}
        </>}

        {/* ══════════════ STEP 4: PLAN ══════════════ */}
        {step===4 && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <h1 style={{fontSize:20,fontWeight:700,color:"#f1f5f9",margin:"0 0 3px"}}>Tu plan semanal 🗓️</h1>
              <p style={{color:"#475569",fontSize:11,margin:0}}>
                {macros.proteina}g prot · {macros.carbos}g HC · {macros.grasas}g grasa · {meals} comidas/día
              </p>
            </div>
            <button onClick={()=>{setStep(1);setPlan("");setPlanData(null);}} style={{...C.btnS,fontSize:10,padding:"6px 11px"}}>Nueva semana</button>
          </div>

          {/* Export */}
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <a href={exportUrl || undefined} target="_blank" rel="noopener noreferrer"
              style={{...C.btnS,flex:1,fontSize:11,padding:"10px 8px",textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",opacity:exportUrl?1:.4,pointerEvents:exportUrl?"auto":"none"}}>
              📄 Abrir / PDF
            </a>
            <a href={exportUrl || undefined} download="nutriplan-semana.html"
              style={{...C.btnS,flex:1,fontSize:11,padding:"10px 8px",textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",opacity:exportUrl?1:.4,pointerEvents:exportUrl?"auto":"none"}}>
              ⬇️ HTML
            </a>
            <button className="bg" onClick={generate} disabled={loading} style={{...C.btnG,flex:1,margin:0,padding:"10px 8px",fontSize:11}}>
              {loading?"⏳...":"🔄 Nuevo"}
            </button>
          </div>

          {/* Lista de la compra */}
          <button onClick={()=>setShowShopping(s=>!s)}
            style={{...C.btnS,width:"100%",fontSize:12,padding:"10px",marginBottom:12,background:showShopping?"rgba(34,197,94,0.1)":"transparent",borderColor:showShopping?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.12)",color:showShopping?"#4ade80":"#94a3b8"}}>
            {showShopping ? "📋 Ocultar lista de la compra" : "🛒 Ver lista de la compra de la semana"}
          </button>

          {showShopping && planData && (
            <div style={{...C.card,background:"rgba(34,197,94,0.04)",borderColor:"rgba(34,197,94,0.2)",marginBottom:14}}>
              <p style={{color:"#4ade80",fontSize:13,fontWeight:700,margin:"0 0 12px",letterSpacing:.3}}>🛒 LISTA DE LA COMPRA SEMANAL</p>
              {buildShoppingList(planData).map(group => (
                <div key={group.cat} style={{marginBottom:12}}>
                  <p style={{color:"#86efac",fontSize:11,fontWeight:700,margin:"0 0 5px",letterSpacing:.4}}>{group.label}</p>
                  {group.items.map(it => (
                    <div key={it.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12,color:"#cbd5e1",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      <span>{it.name}</span>
                      <span style={{fontFamily:"'DM Mono',monospace",color:"#4ade80",fontWeight:600}}>{it.grams}g</span>
                    </div>
                  ))}
                </div>
              ))}
              <p style={{fontSize:10,color:"#475569",margin:"8px 0 0",lineHeight:1.5,fontStyle:"italic"}}>Cantidades totales para 7 días (peso en crudo). Añade 10-15% por mermas.</p>
            </div>
          )}

          {/* Plan estructurado */}
          {planData && (
            <div style={{background:"rgba(255,255,255,0.015)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px 12px"}}>
              {planData.days.map((d, di) => (
                <div key={di} style={{marginBottom:di<6?22:0}}>
                  <div style={{background:d.isRefeed?"rgba(245,158,11,0.1)":"rgba(74,222,128,0.07)",borderLeft:`3px solid ${d.isRefeed?"#f59e0b":"#4ade80"}`,borderRadius:"0 8px 8px 0",padding:"8px 12px",marginBottom:8,color:d.isRefeed?"#fbbf24":"#4ade80",fontSize:13,fontWeight:700}}>
                    📅 Día {di+1} — {d.dayName}{d.isRefeed && "  💥 REFEED"}
                  </div>

                  {d.hasShake && (
                    <div style={{background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:8,padding:"6px 11px",margin:"0 0 8px",fontSize:11,color:"#93c5fd"}}>
                      🥤 Batido proteico post-entreno: <strong style={{color:"#60a5fa"}}>{d.shakeProt}g proteína</strong>
                    </div>
                  )}

                  {d.meals.map((m, mi) => (
                    <div key={mi} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{color:m.isPostWorkout?"#c084fc":"#a3e635",fontWeight:700,fontSize:12}}>
                          {m.name}{m.isPostWorkout && " 🏋️"}
                        </span>
                        <button onClick={()=>regenerateMeal(di, mi)}
                          style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#94a3b8",cursor:"pointer",fontFamily:"inherit"}}>
                          🔄 Regenerar
                        </button>
                      </div>
                      {m.items.map((it, ii) => (
                        <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",marginLeft:8,gap:8}}>
                          <span style={{fontSize:12,color:"#cbd5e1",flex:1,minWidth:0}}>
                            • {it.name} — <strong style={{color:"#e2e8f0"}}>{it.grams}g</strong>
                            <span style={{fontSize:10,color:"#64748b",marginLeft:6}}>
                              (P:{Math.round(it.p)} HC:{Math.round(it.c)} G:{Math.round(it.f)})
                            </span>
                          </span>
                          <div style={{display:"flex",gap:2,flexShrink:0}}>
                            <button onClick={()=>setSwapping({di,mi,ii,mode:"grams"})}
                              title="Editar gramos"
                              style={{background:"transparent",border:"none",color:"#475569",fontSize:13,cursor:"pointer",padding:"2px 5px"}}>⚖️</button>
                            <button onClick={()=>setSwapping({di,mi,ii,mode:"swap"})}
                              title="Cambiar alimento"
                              style={{background:"transparent",border:"none",color:"#475569",fontSize:13,cursor:"pointer",padding:"2px 5px"}}>✏️</button>
                          </div>
                        </div>
                      ))}
                      <div style={{fontSize:10,color:"#64748b",marginLeft:8,marginTop:2}}>
                        Comida: {Math.round(m.totals.p)}g P · {Math.round(m.totals.c)}g HC · {Math.round(m.totals.f)}g G · {m.totals.kcal} kcal
                      </div>
                    </div>
                  ))}

                  <div style={{background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:8,padding:"6px 11px",marginTop:6,fontSize:11,color:"#86efac",fontWeight:600}}>
                    📊 TOTAL: {Math.round(d.totals.p)}g prot · {Math.round(d.totals.c)}g HC · {Math.round(d.totals.f)}g grasa · {d.totals.kcal} kcal
                  </div>
                </div>
              ))}

              <div style={{background:"rgba(250,204,21,0.07)",border:"1px solid rgba(250,204,21,0.2)",borderRadius:10,padding:"12px 14px",marginTop:20,color:"#fde68a",fontSize:12}}>
                💡 <strong style={{color:"#fbbf24"}}>Consejo:</strong> pesa los alimentos en crudo y permite ±10% de margen. La adherencia constante pesa más que la exactitud milimétrica.
              </div>
            </div>
          )}

          {/* Modal cambiar alimento o editar gramos */}
          {swapping && (() => {
            const it = planData.days[swapping.di].meals[swapping.mi].items[swapping.ii];
            if (swapping.mode === "grams") {
              return (
                <div onClick={()=>setSwapping(null)}
                  style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
                  <div onClick={e=>e.stopPropagation()}
                    style={{background:"#0f1a0f",border:"1px solid rgba(74,222,128,0.2)",borderRadius:16,padding:"22px 20px",width:"100%",maxWidth:380}}>
                    <p style={{color:"#e2e8f0",fontSize:14,fontWeight:700,margin:"0 0 4px"}}>Editar cantidad</p>
                    <p style={{color:"#4ade80",fontSize:12,margin:"0 0 16px"}}>{it.name}</p>
                    <input type="number" defaultValue={it.grams} autoFocus
                      onKeyDown={e=>{if(e.key==="Enter"){updateGrams(swapping.di,swapping.mi,swapping.ii,+e.target.value);setSwapping(null);}}}
                      id="grams-input" style={{...C.inp,fontSize:20,textAlign:"center",fontFamily:"'DM Mono',monospace"}}/>
                    <p style={{textAlign:"center",color:"#64748b",fontSize:11,margin:"6px 0 18px"}}>gramos</p>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setSwapping(null)} style={{...C.btnS,flex:1}}>Cancelar</button>
                      <button className="bg" onClick={()=>{
                        const v = +document.getElementById("grams-input").value;
                        updateGrams(swapping.di,swapping.mi,swapping.ii,v);
                        setSwapping(null);
                      }} style={{...C.btnG,flex:1,margin:0}}>Guardar</button>
                    </div>
                  </div>
                </div>
              );
            }
            // swap mode
            const sameCat = selFoods.filter(f => f.cat === it.cat && f.id !== it.id);
            const others  = selFoods.filter(f => f.cat !== it.cat && f.id !== it.id);
            return (
              <div onClick={()=>setSwapping(null)}
                style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px"}}>
                <div onClick={e=>e.stopPropagation()}
                  style={{background:"#0f1a0f",border:"1px solid rgba(74,222,128,0.2)",borderRadius:16,padding:"18px 16px",width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <p style={{color:"#e2e8f0",fontSize:14,fontWeight:700,margin:0}}>Cambiar <span style={{color:"#4ade80"}}>{it.name}</span></p>
                    <button onClick={()=>setSwapping(null)} style={{background:"transparent",border:"none",color:"#64748b",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
                  </div>
                  <p style={{color:"#64748b",fontSize:11,margin:"0 0 10px"}}>Los gramos se recalcularán para mantener calorías similares.</p>
                  {sameCat.length > 0 && <>
                    <p style={{color:"#86efac",fontSize:10,fontWeight:700,letterSpacing:.5,margin:"0 0 6px"}}>MISMA CATEGORÍA ({CATS[it.cat]})</p>
                    {sameCat.map(f => (
                      <div key={f.id} onClick={()=>{swapItem(swapping.di, swapping.mi, swapping.ii, f.id);setSwapping(null);}}
                        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:9,marginBottom:5,cursor:"pointer"}}>
                        <span style={{fontSize:12,color:"#cbd5e1"}}>{f.name}</span>
                        <span style={{fontSize:10,color:"#64748b"}}>P{f.p} C{f.c} G{f.f}</span>
                      </div>
                    ))}
                  </>}
                  {others.length > 0 && <>
                    <p style={{color:"#94a3b8",fontSize:10,fontWeight:700,letterSpacing:.5,margin:"14px 0 6px"}}>OTROS ALIMENTOS</p>
                    {others.map(f => (
                      <div key={f.id} onClick={()=>{swapItem(swapping.di, swapping.mi, swapping.ii, f.id);setSwapping(null);}}
                        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:9,marginBottom:5,cursor:"pointer"}}>
                        <span style={{fontSize:12,color:"#cbd5e1"}}>{f.name} <span style={{color:"#475569",fontSize:10}}>· {CATS[f.cat]}</span></span>
                        <span style={{fontSize:10,color:"#64748b"}}>P{f.p} C{f.c} G{f.f}</span>
                      </div>
                    ))}
                  </>}
                </div>
              </div>
            );
          })()}

          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:14}}>
            <button onClick={saveProfile} style={{...C.btnS,fontSize:11}}>💾 Guardar perfil</button>
            {saveMsg && <span style={{color:"#4ade80",fontSize:11}}>{saveMsg}</span>}
          </div>
        </>}

      </div>
    </div>
  );
}
