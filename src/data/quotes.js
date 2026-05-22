export const QUOTES = [
  { text: "El cuerpo logra lo que la mente cree.", author: "Napoleon Hill" },
  { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
  { text: "El éxito no es final, el fracaso no es fatal. Es el coraje de continuar lo que cuenta.", author: "Winston Churchill" },
  { text: "Tu cuerpo puede soportar casi cualquier cosa. Es tu mente la que tienes que convencer.", author: "" },
  { text: "La abundancia no es algo que adquirimos. Es algo en lo que nos sintonizamos.", author: "Wayne Dyer" },
  { text: "Los campeones no se hacen en el gimnasio. Se hacen de algo que llevan dentro.", author: "Muhammad Ali" },
  { text: "Cuídate a ti mismo. La salud es la mayor riqueza.", author: "Virgilio" },
  { text: "Cada entrenamiento es un depósito en el banco del futuro que quieres ser.", author: "" },
  { text: "El hábito de un año supera al talento de un día.", author: "" },
  { text: "La prosperidad no es solo dinero. Es energía, salud y claridad mental.", author: "" },
  { text: "Hoy puedo y hoy elijo hacerlo.", author: "" },
  { text: "No es cuestión de tiempo. Es cuestión de prioridades.", author: "" },
  { text: "La constancia hace maestros. La excusa hace mediocres.", author: "" },
  { text: "Quien controla su energía, controla su vida.", author: "" },
  { text: "El dolor de hoy es la fuerza de mañana.", author: "" },
  { text: "Soy el arquitecto de mi cuerpo y de mi destino.", author: "" },
  { text: "Cada repetición es un voto por la versión de ti que quieres ser.", author: "James Clear" },
  { text: "La riqueza real es despertar con energía y ambición.", author: "" },
  { text: "No esperes a sentirte listo. Nunca lo estarás. Empieza ahora.", author: "" },
  { text: "Tu cuerpo es tu negocio más rentable. Invierte en él.", author: "" },
  { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
  { text: "Disciplina es elegir lo que quieres a largo plazo sobre lo que quieres ahora mismo.", author: "" },
  { text: "La mentalidad lo es todo. Elige ganar antes de empezar.", author: "" },
  { text: "La abundancia fluye hacia quien actúa, no hacia quien espera.", author: "" },
  { text: "Gana la mañana, gana el día.", author: "" },
  { text: "La versión más fuerte de ti ya existe. Estás en camino de encontrarla.", author: "" },
  { text: "No seas el mismo que ayer. Sé 1% mejor.", author: "James Clear" },
  { text: "El éxito no está en los resultados sino en los hábitos.", author: "" },
  { text: "Quien come bien, piensa bien. Quien piensa bien, vive bien.", author: "" },
  { text: "Tus límites son negociables. Tu disciplina, no.", author: "" },
];

export function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
