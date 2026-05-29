/**
 * Muscle subgroup coverage system — competition-prep level
 * Based on RP Strength hypertrophy science (Israetel et al.)
 *
 * SUBGROUPS      : fine-grained anatomical subgroups per muscle category
 * EX_SUBGROUPS   : maps exercise IDs → subgroup IDs they train
 * VOLUME_LANDMARKS: MEV / MAV / MRV (sets/week) per muscle category
 */

// ── Subgroup definitions ────────────────────────────────────────────
export const SUBGROUPS = {
  pecho: [
    { id:'chest_upper',   label:'Haz clavicular', desc:'Press inclinado · fibras superiores (30-45°)',    icon:'↗️' },
    { id:'chest_mid',     label:'Haz esternal',   desc:'Press plano · mayor volumen de fibras',           icon:'➡️' },
    { id:'chest_lower',   label:'Haz inferior',   desc:'Fondos · decline · fibras costales',              icon:'↘️' },
    { id:'chest_stretch', label:'Apertura/Stretch', desc:'Aperturas · cable fly · pec deck · estiramiento máximo', icon:'🔀' },
  ],
  espalda: [
    { id:'back_vertical',    label:'Tirón vertical',   desc:'Jalón · dominada · ancho dorsal (fibras superiores)',  icon:'⬇️' },
    { id:'back_horizontal',  label:'Tirón horizontal', desc:'Remo · grosor y espesor · fibras medias/inferiores',   icon:'🔙' },
    { id:'back_pullover',    label:'Pullover/Stretch', desc:'Estiramiento costal · inserción inferior del dorsal',  icon:'🔄' },
    { id:'back_rear_delt',   label:'Deltoides post.',  desc:'Face pull · pájaros · manguito rotador externo',       icon:'🎯' },
  ],
  hombro: [
    { id:'shoulder_press',     label:'Press overhead',     desc:'Deltoides ant. y lateral · fuerza compuesta',   icon:'⬆️' },
    { id:'shoulder_lateral',   label:'Elevación lateral',  desc:'Deltoides lateral · anchura de hombros',        icon:'↔️' },
    { id:'shoulder_posterior', label:'Deltoides posterior',desc:'Face pull · pájaros · rotación externa',        icon:'🔙' },
  ],
  biceps: [
    { id:'bicep_longhead',   label:'Cabeza larga',  desc:'Curl inclinado · polea baja · estiramiento máximo en origen', icon:'📏' },
    { id:'bicep_shorthead',  label:'Cabeza corta',  desc:'Predicador · concentrado · peak contraction',               icon:'💪' },
    { id:'bicep_brachialis', label:'Braquial',       desc:'Curl martillo · neutro · aumenta grosor y volumen del brazo', icon:'🔩' },
  ],
  triceps: [
    { id:'tricep_longhead', label:'Cabeza larga',   desc:'Overhead extension · skull crusher · mayor masa del tríceps', icon:'📐' },
    { id:'tricep_pushdown', label:'Polea/Pushdown', desc:'Cable pushdown · cabezas medial y lateral',                   icon:'⬇️' },
    { id:'tricep_compound', label:'Compuesto',      desc:'Press cerrado · fondos · dips · máxima carga compuesta',      icon:'💥' },
  ],
  cuadriceps: [
    { id:'quad_recto',       label:'Recto femoral', desc:'Extensión · único músculo biarticular · activado con rodilla extendida+cadera flexionada', icon:'🦵' },
    { id:'quad_vasto',       label:'Vastos',        desc:'Squat · prensa · sentadilla profunda · mayor volumen muscular', icon:'⬆️' },
    { id:'quad_unilateral',  label:'Unilateral',    desc:'Búlgara · zancada · step up · simetría y estabilidad',        icon:'🎯' },
  ],
  isquios: [
    { id:'ham_knee',  label:'Flexión rodilla', desc:'Leg curl · nordic · activación de bíceps femoral en acortamiento', icon:'🔄' },
    { id:'ham_hinge', label:'Bisagra cadera',  desc:'RDL · peso muerto · activación de isquios en elongación',          icon:'🔩' },
  ],
  gluteos: [
    { id:'glute_extension', label:'Extensión cadera', desc:'Hip thrust · glute bridge · activación en posición acortada', icon:'🍑' },
    { id:'glute_abduction', label:'Abducción',         desc:'Abductor · clamshell · glúteo medio · anchura',             icon:'↔️' },
  ],
  gemelos: [
    { id:'calf_standing', label:'De pie',    desc:'Elevación de talones bipodal · cabeza lateral (gastrocnemio)',  icon:'🦶' },
    { id:'calf_seated',   label:'Sentado',   desc:'Elevación sentado · sóleo (rodilla flexionada)',                icon:'🪑' },
  ],
};

// ── Exercise → Subgroup mapping ─────────────────────────────────────
export const EX_SUBGROUPS = {
  // PECHO
  press_banca_barra:          ['chest_mid',    'tricep_compound'],
  press_banca_mancuernas:     ['chest_mid',    'tricep_compound', 'chest_stretch'],
  press_inclinado_mancuernas: ['chest_upper',  'tricep_compound'],
  press_inclinado_barra:      ['chest_upper',  'tricep_compound'],
  press_pecho_maquina:        ['chest_mid'],
  aperturas_mancuernas:       ['chest_stretch','chest_mid'],
  aperturas_polea:            ['chest_stretch'],
  peck_deck:                  ['chest_stretch','chest_mid'],
  flexiones:                  ['chest_mid',    'tricep_compound'],
  flexiones_diamante:         ['tricep_compound','chest_mid'],
  fondos_paralelas:           ['chest_lower',  'tricep_compound'],
  fondos_bancos:              ['chest_upper',  'tricep_compound'],

  // ESPALDA
  dominadas:          ['back_vertical'],
  dominada_asistida:  ['back_vertical'],
  jalon_polea:        ['back_vertical'],
  remo_barra:         ['back_horizontal'],
  remo_mancuerna:     ['back_horizontal'],
  remo_polea:         ['back_horizontal'],
  remo_maquina:       ['back_horizontal'],
  peso_muerto_barra:  ['back_horizontal', 'ham_hinge'],
  hiperextensiones:   ['back_horizontal', 'ham_hinge', 'glute_extension'],
  pullover_polea:     ['back_pullover',   'back_vertical'],
  face_pull:          ['back_rear_delt',  'shoulder_posterior'],
  pajaro_mancuernas:  ['back_rear_delt',  'shoulder_posterior'],

  // HOMBROS
  press_militar_barra:      ['shoulder_press',    'tricep_compound'],
  press_militar_mancuernas: ['shoulder_press',    'tricep_compound'],
  press_arnold:             ['shoulder_press',    'shoulder_lateral'],
  press_hombro_maquina:     ['shoulder_press'],
  elevaciones_laterales:    ['shoulder_lateral'],
  elevaciones_polea:        ['shoulder_lateral'],
  elevacion_frontal:        ['shoulder_press'],
  encogimientos_barra:      ['back_rear_delt'],
  encogimientos_mancuernas: ['back_rear_delt'],
  remo_alto_barra:          ['shoulder_lateral',  'back_rear_delt'],

  // BÍCEPS
  curl_barra:       ['bicep_longhead', 'bicep_shorthead'],
  curl_mancuernas:  ['bicep_longhead', 'bicep_shorthead'],
  curl_martillo:    ['bicep_brachialis','bicep_longhead'],
  curl_predicador:  ['bicep_shorthead'],
  curl_polea:       ['bicep_longhead'],
  curl_concentrado: ['bicep_shorthead'],

  // TRÍCEPS
  extension_triceps_polea:    ['tricep_pushdown'],
  press_frances:              ['tricep_longhead'],
  patada_triceps:             ['tricep_pushdown'],
  extension_triceps_overhead: ['tricep_longhead'],
  press_cerrado:              ['tricep_compound', 'chest_mid'],

  // CUÁDRICEPS
  sentadilla_barra:      ['quad_vasto',      'glute_extension'],
  sentadilla_frontal:    ['quad_vasto',      'quad_recto'],
  sentadilla_goblet:     ['quad_vasto',      'glute_extension'],
  hack_squat:            ['quad_vasto',      'quad_recto'],
  prensa_inclinada:      ['quad_vasto',      'glute_extension'],
  extension_cuadriceps:  ['quad_recto'],
  zancada_mancuernas:    ['quad_unilateral', 'glute_extension'],
  sentadilla_bulgara:    ['quad_unilateral', 'glute_extension'],
  step_up:               ['quad_unilateral', 'glute_extension'],
  sentadilla_smith:      ['quad_vasto'],

  // ISQUIOS
  peso_muerto_rumano:    ['ham_hinge', 'glute_extension'],
  peso_muerto_mancuernas:['ham_hinge', 'glute_extension'],
  curl_femoral_maquina:  ['ham_knee'],
  curl_femoral_sentado:  ['ham_knee',  'ham_hinge'],
  nordic_curl:           ['ham_knee'],

  // GLÚTEOS
  hip_thrust:       ['glute_extension'],
  glute_bridge:     ['glute_extension'],
  patada_gluteo:    ['glute_extension', 'glute_abduction'],
  abductor_maquina: ['glute_abduction'],
  aductor_maquina:  [],

  // GEMELOS
  elevacion_gemelo_pie:     ['calf_standing'],
  elevacion_gemelo_sentado: ['calf_seated'],
};

// ── Volume landmarks (sets/week) — RP Strength science ─────────────
// MEV = Minimum Effective Volume, MAV = Maximum Adaptive Volume, MRV = Maximum Recoverable Volume
export const VOLUME_LANDMARKS = {
  pecho:      { mev:8,  mav:16, mrv:22, freq:2 },
  espalda:    { mev:10, mav:18, mrv:25, freq:2 },
  hombro:     { mev:8,  mav:16, mrv:20, freq:2 },
  biceps:     { mev:8,  mav:14, mrv:20, freq:2 },
  triceps:    { mev:6,  mav:12, mrv:18, freq:2 },
  cuadriceps: { mev:8,  mav:16, mrv:20, freq:2 },
  isquios:    { mev:6,  mav:12, mrv:16, freq:2 },
  gluteos:    { mev:4,  mav:12, mrv:20, freq:2 },
  gemelos:    { mev:8,  mav:16, mrv:20, freq:3 },
};
