export const analyzeFood = async (imageBase64, mediaType, apiKey) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `Eres un nutricionista experto. Analiza esta imagen de comida y estima sus macronutrientes.

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto adicional antes ni después.

{"descripcion":"nombre del plato o alimento","porcion":"cantidad estimada ej: 1 plato, 200g, 1 unidad","proteina":0,"carbos":0,"grasas":0,"kcal":0,"confianza":"alta|media|baja","nota":"observación breve si procede"}

Si no puedes identificar comida en la imagen, responde: {"error":"No se detecta comida en la imagen"}` }
        ]
      }]
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("API key incorrecta o inválida");
    if (res.status === 429) throw new Error("Límite de uso alcanzado — espera un momento");
    throw new Error(err.error?.message || `Error ${res.status}`);
  }

  const data = await res.json();
  const text = (data.content?.[0]?.text || "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta inesperada de la IA");
  const parsed = JSON.parse(match[0]);
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
};

export const getApiKey = () => localStorage.getItem("fitpro-apikey") || "";
export const saveApiKey = (key) => localStorage.setItem("fitpro-apikey", key.trim());
