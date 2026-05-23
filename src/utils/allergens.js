const inc = (str, words) => words.some(w => str.toLowerCase().includes(w));

// Returns definitive allergens present in a food
export const getFoodAllergens = (food) => {
  const n = food.name.toLowerCase();
  const cat = food.cat;
  const r = [];

  // Category-based
  if (cat === "marisco") r.push("marisco");
  if (cat === "pescado") r.push("pescado");
  if (["lacteos", "quesos"].includes(cat)) r.push("lactosa");
  if (cat === "huevos" || inc(n, ["huevo", "clara de huevo", "yema de huevo"])) r.push("huevo");
  if (cat === "pasta") r.push("gluten");

  // Gluten by name
  if (inc(n, ["pan ", "panes ", "galleta", "bizcocho", "muffin", "croissant", "brioche", "tosta", "cracker", "oblea"])) r.push("gluten");
  if (inc(n, ["harina de trigo", " trigo", "espelta", "cebada", "centeno", "malta", "sémola", "semola"])) r.push("gluten");
  if (inc(n, ["cerveza"])) r.push("gluten");

  // Individual nuts
  if (inc(n, ["cacahuete", "cacahuetes", "maní", "mani ", "peanut"])) r.push("cacahuete");
  if (inc(n, ["almendra", "almendras"])) r.push("almendra");
  if (inc(n, ["avellana", "avellanas"])) r.push("avellana");
  if (inc(n, ["nuez", "nueces", "nogal"])) r.push("nuez");
  if (inc(n, ["pistacho", "pistachos"])) r.push("pistacho");
  if (inc(n, ["anacardo", "anacardos", "cashew"])) r.push("anacardo");
  if (inc(n, ["macadamia"])) r.push("macadamia");
  if (inc(n, ["piñon", "piñones", "pinon", "pinones"])) r.push("piñon");

  // Soja
  if (inc(n, ["soja", "tofu", "edamame", "tempeh"])) r.push("soja");

  // Sésamo
  if (inc(n, ["sésamo", "sesamo", "tahini", "tahina"])) r.push("sesamo");

  // Lactosa by name (beyond dairy cat)
  if (inc(n, ["leche", "nata ", "mantequilla", "queso", "requesón", "requeson", "mascarpone", "mozzarella", "parmesano", "brie", "camembert"])) {
    if (!r.includes("lactosa")) r.push("lactosa");
  }
  if (inc(n, ["batido de proteína", "batido proteico", "whey"])) {
    if (!r.includes("lactosa")) r.push("lactosa");
  }

  // Huevo by name (beyond eggs cat)
  if (inc(n, ["mayonesa", "mayonaise", "mahonesa"])) {
    if (!r.includes("huevo")) r.push("huevo");
  }

  return [...new Set(r)];
};

// Returns probable trace allergens (cross-contamination risk)
export const getFoodTraces = (food) => {
  const n = food.name.toLowerCase();
  const cat = food.cat;
  const direct = getFoodAllergens(food);
  const traces = [];

  const add = (a) => { if (!direct.includes(a) && !traces.includes(a)) traces.push(a); };

  // Chocolate and cacao products
  if (inc(n, ["chocolate", "cacao"])) {
    add("lactosa"); add("frutos secos"); add("gluten");
  }

  // Processed snacks and bars
  if (cat === "snacks" || inc(n, ["barrita", "energy bar", "proteín bar", "protein bar"])) {
    add("lactosa"); add("gluten"); add("frutos secos"); add("huevo");
  }

  // Sauces and dressings
  if (cat === "salsas") {
    add("gluten"); add("soja"); add("huevo");
  }

  // Cereals — cross-contamination with gluten common
  if (cat === "cereales" && inc(n, ["avena", "arroz inflado", "corn flakes", "copos"])) {
    add("gluten");
  }

  // Cold cuts / fiambres — may contain gluten/soja
  if (cat === "fiambres") {
    add("gluten"); add("soja");
  }

  return traces;
};

// Check if a food triggers ANY of the user's allergens (direct or trace)
export const foodAllergenMatch = (food, userAllergens) => {
  if (!userAllergens.length) return { direct: [], traces: [] };

  // Map nut group to individual nuts
  const expanded = new Set(userAllergens);
  if (userAllergens.includes("frutos secos")) {
    ["cacahuete","almendra","avellana","nuez","pistacho","anacardo","macadamia","piñon"].forEach(n => expanded.add(n));
  }

  const direct = getFoodAllergens(food).filter(a => expanded.has(a));
  const traces = getFoodTraces(food).filter(a => {
    if (expanded.has(a)) return true;
    if (a === "frutos secos" && ["cacahuete","almendra","avellana","nuez","pistacho","anacardo"].some(n => expanded.has(n))) return true;
    return false;
  });

  return { direct, traces };
};
