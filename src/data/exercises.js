export const EX = [
  {id:'sentadilla',n:'Sentadilla Trasera con Barra',m:['Cuádriceps','Glúteo'],eq:['Barra olímpica','Disco'],loc:'gym',type:'comp',key:['Rodillas no hacia adentro','Peso en los talones','Pecho erguido'],how:'Con la barra en los hombros, baja retrasando la cadera y adelantando el pecho. Mínimo 90° de rodilla.',err:['Levantar talones','Lumbar redondeada']},
  {id:'prensa',n:'Prensa de Piernas Inclinada',m:['Cuádriceps','Glúteo'],eq:['Prensa inclinada'],loc:'gym',type:'mach',key:['No bloquees rodillas','Baja controlado'],how:'Pies a la anchura de hombros. Baja a ~90° y empuja sin bloquear.',err:['Despegar la cadera']},
  {id:'extcuad',n:'Extensión de Cuádriceps en Máquina',m:['Cuádriceps'],eq:['Máquina extensión'],loc:'gym',type:'mach',key:['Pausa arriba','Sin balanceo'],how:'Extiende las piernas, aprieta 1s y baja despacio.',err:['Usar impulso']},
  {id:'zancada',n:'Zancada con Mancuernas',m:['Cuádriceps','Glúteo'],eq:['Mancuernas'],loc:'casa',type:'comp',key:['Rodilla no pasa la punta','Torso erguido'],how:'Paso al frente, baja la rodilla trasera y vuelve empujando con el talón delantero.',err:['Pasos cortos']},
  {id:'stepup',n:'Step Up con Mancuernas',m:['Cuádriceps','Glúteo'],eq:['Cajón','Mancuernas'],loc:'casa',type:'comp',key:['Espalda recta','Empuja con el talón'],how:'Sube al cajón con todo el pie, controla la bajada, alterna pierna.',err:['Impulsarte abajo']},
  {id:'sentcopa',n:'Sentadilla Goblet',m:['Cuádriceps','Glúteo'],eq:['Mancuerna'],loc:'casa',type:'comp',key:['Codos dentro de las rodillas','Talones en el suelo'],how:'Sujeta una mancuerna al pecho y haz sentadilla profunda controlada.',err:['Inclinarte mucho adelante']},
  {id:'pmuerto',n:'Peso Muerto con Mancuernas',m:['Isquiotibiales','Glúteo'],eq:['Mancuernas'],loc:'casa',type:'comp',key:['Espalda recta','Cadera atrás'],how:'Lleva la cadera atrás bajando el peso pegado a las piernas; sube apretando glúteo.',err:['Encorvar la espalda']},
  {id:'femoral',n:'Curl Femoral en Máquina',m:['Isquiotibiales'],eq:['Máquina femoral'],loc:'gym',type:'mach',key:['Sin despegar la cadera','Controla la vuelta'],how:'Flexiona la rodilla llevando el talón al glúteo y vuelve despacio.',err:['Rebotar']},
  {id:'hipthrust',n:'Hip Thrust',m:['Glúteo','Isquiotibiales'],eq:['Banco'],loc:'casa',type:'comp',key:['Mentón metido','Aprieta arriba'],how:'Espalda alta en un banco, empuja con talones elevando la cadera. Pausa arriba.',err:['Hiperextender lumbar']},
  {id:'puenteglu',n:'Puente de Glúteo en Suelo',m:['Glúteo'],eq:[],loc:'casa',type:'body',key:['Pausa arriba','Empuja con talones'],how:'Tumbado, eleva la cadera apretando el glúteo y baja sin tocar del todo.',err:['Empujar con la lumbar']},
  {id:'patadagluteo',n:'Patada de Glúteo',m:['Glúteo'],eq:[],loc:'casa',type:'iso',key:['Control','No arquees la lumbar'],how:'A cuatro apoyos, eleva una pierna flexionada apretando glúteo arriba.',err:['Compensar con la espalda']},
  {id:'gemelo',n:'Elevación de Gemelo de Pie',m:['Gemelos'],eq:[],loc:'casa',type:'iso',key:['Rango completo','Pausa arriba'],how:'Eleva los talones al máximo, pausa y baja buscando estiramiento.',err:['Rebotar abajo']},
  {id:'gemelosent',n:'Elevación de Gemelo Sentado',m:['Gemelos'],eq:['Mancuerna'],loc:'casa',type:'iso',key:['Rango completo','Tempo lento'],how:'Sentado con peso sobre las rodillas, eleva los talones al máximo y baja despacio.',err:['Acortar el recorrido']},
  {id:'pressbanca',n:'Press de Banca con Barra',m:['Pecho','Tríceps'],eq:['Barra olímpica','Banco'],loc:'gym',type:'comp',key:['Escápulas retraídas','Codos a ~45°'],how:'Baja la barra al pecho controlando y empuja sin bloquear de golpe.',err:['Rebotar en el pecho']},
  {id:'pressmanc',n:'Press de Pecho con Mancuernas',m:['Pecho','Tríceps'],eq:['Mancuernas','Banco'],loc:'casa',type:'comp',key:['Baja hasta estirar','No choques arriba'],how:'Baja controlando y empuja juntando ligeramente.',err:['Arquear la lumbar']},
  {id:'pressincl',n:'Press Inclinado con Mancuernas',m:['Pecho','Hombro'],eq:['Mancuernas','Banco'],loc:'casa',type:'comp',key:['Banco a 30°','Recorrido completo'],how:'En banco inclinado, baja a los lados del pecho alto y empuja.',err:['Inclinar demasiado el banco']},
  {id:'aperturas',n:'Aperturas con Mancuernas',m:['Pecho'],eq:['Mancuernas','Banco'],loc:'casa',type:'iso',key:['Codos algo flexionados','Movimiento amplio'],how:'Abre en arco hasta estirar pectoral y cierra contrayendo.',err:['Convertirlo en press']},
  {id:'jalon',n:'Jalón al Pecho en Polea',m:['Espalda','Bíceps'],eq:['Polea alta'],loc:'gym',type:'mach',key:['Codos al costado','Pecho arriba'],how:'Tira de la barra al pecho llevando los codos abajo y atrás.',err:['Mecer el torso']},
  {id:'remomanc',n:'Remo con Mancuerna',m:['Espalda','Bíceps'],eq:['Mancuerna','Banco'],loc:'casa',type:'comp',key:['Espalda neutra','Tira con el codo'],how:'Apoyado en un banco, tira de la mancuerna a la cadera.',err:['Girar el torso']},
  {id:'remopolea',n:'Remo en Polea Baja',m:['Espalda','Bíceps'],eq:['Polea'],loc:'gym',type:'mach',key:['Pecho fuera','No tires con la lumbar'],how:'Sentado, tira del agarre al abdomen juntando escápulas.',err:['Balancear el tronco']},
  {id:'dominada',n:'Dominada Asistida',m:['Espalda','Bíceps'],eq:['Barra'],loc:'gym',type:'comp',key:['Inicia desde escápulas','Rango completo'],how:'Agarre prono, tira llevando el pecho a la barra y baja con control.',err:['Balanceo no buscado']},
  {id:'pressmil',n:'Press Militar con Mancuernas',m:['Hombro','Tríceps'],eq:['Mancuernas'],loc:'casa',type:'comp',key:['No arquees la lumbar','Recorrido completo'],how:'Empuja por encima de la cabeza sin bloquear de golpe.',err:['Empujar hacia delante']},
  {id:'elevlat',n:'Elevaciones Laterales',m:['Hombro'],eq:['Mancuernas'],loc:'casa',type:'iso',key:['El codo guía','Sin impulso'],how:'Eleva los brazos a los lados a la altura del hombro y baja despacio.',err:['Subir con balanceo']},
  {id:'elevfrontal',n:'Elevación Frontal con Mancuerna',m:['Hombro'],eq:['Mancuernas'],loc:'casa',type:'iso',key:['Sin impulso','Hasta la horizontal'],how:'Eleva el peso al frente hasta la altura del hombro y baja controlado.',err:['Mecer la cadera']},
  {id:'pajaro',n:'Pájaro con Mancuernas',m:['Hombro'],eq:['Mancuernas'],loc:'casa',type:'iso',key:['Tronco inclinado','Aprieta omóplatos'],how:'Inclinado, abre los brazos a los lados trabajando el deltoides posterior.',err:['Subir con la espalda']},
  {id:'curlbarra',n:'Curl de Bíceps con Barra',m:['Bíceps'],eq:['Barra'],loc:'gym',type:'iso',key:['Codos pegados','Sin balanceo'],how:'Flexiona los codos subiendo la barra y baja controlando.',err:['Mecer la cadera']},
  {id:'curlmanc',n:'Curl Alterno con Mancuernas',m:['Bíceps'],eq:['Mancuernas'],loc:'casa',type:'iso',key:['Supina al subir','Bajada controlada'],how:'Sube girando la muñeca, aprieta y baja. Alterna.',err:['Impulso del hombro']},
  {id:'curlpolea',n:'Curl de Bíceps en Polea',m:['Bíceps'],eq:['Polea'],loc:'gym',type:'mach',key:['Tensión constante','Codos fijos'],how:'Con la polea baja, flexiona manteniendo tensión todo el recorrido.',err:['Adelantar los codos']},
  {id:'curlmartillo',n:'Curl Martillo',m:['Bíceps'],eq:['Mancuernas'],loc:'casa',type:'iso',key:['Agarre neutro','Sin balanceo'],how:'Sube con las palmas enfrentadas, trabaja braquial y antebrazo.',err:['Usar impulso']},
  {id:'curlpredic',n:'Curl Predicador',m:['Bíceps'],eq:['Banco scott','Barra'],loc:'gym',type:'iso',key:['Brazo pegado al banco','Sin rebote abajo'],how:'Sobre el banco scott, sube y baja con control sin extender de golpe.',err:['Soltar de golpe abajo']},
  {id:'extricep',n:'Extensión de Tríceps en Polea',m:['Tríceps'],eq:['Polea'],loc:'gym',type:'mach',key:['Codos fijos','Extiende del todo'],how:'Empuja la cuerda abajo extendiendo el codo y vuelve controlado.',err:['Mover los codos']},
  {id:'fondos',n:'Fondos entre Bancos',m:['Tríceps','Pecho'],eq:[],loc:'casa',type:'body',key:['Codos atrás','Hombros lejos de las orejas'],how:'Baja flexionando los codos atrás y empuja hasta extender.',err:['Hombros encogidos']},
  {id:'pressfrances',n:'Press Francés',m:['Tríceps'],eq:['Mancuernas'],loc:'casa',type:'iso',key:['Codos quietos','No abras los codos'],how:'Tumbado, baja el peso hacia la frente flexionando solo el codo.',err:['Abrir los codos']},
  {id:'patadatricep',n:'Patada de Tríceps',m:['Tríceps'],eq:['Mancuernas'],loc:'casa',type:'iso',key:['Brazo paralelo al suelo','Extiende del todo'],how:'Tronco inclinado, extiende el antebrazo atrás manteniendo el codo fijo.',err:['Bajar el codo']},
  {id:'plancha',n:'Plancha Abdominal',m:['Core'],eq:[],loc:'casa',type:'body',key:['Glúteo y abdomen activos','Cadera neutra'],how:'Antebrazos y pies, cuerpo en línea. Mantén el tiempo objetivo.',err:['Hundir la cadera']},
  {id:'crunch',n:'Crunch en el Suelo',m:['Core'],eq:[],loc:'casa',type:'body',key:['Mira al techo','Exhala al subir'],how:'Eleva los hombros contrayendo el abdomen y baja sin soltar tensión.',err:['Tirar del cuello']},
  {id:'elevpiernas',n:'Elevación de Piernas',m:['Core'],eq:[],loc:'casa',type:'body',key:['Lumbar pegada al suelo','Control en la bajada'],how:'Tumbado, sube las piernas rectas y baja sin tocar el suelo.',err:['Arquear la lumbar']},
  {id:'mountain',n:'Mountain Climbers',m:['Core'],eq:[],loc:'casa',type:'body',key:['Cadera baja','Ritmo sostenido'],how:'En plancha alta, lleva las rodillas al pecho alternando rápido.',err:['Subir la cadera']},
];

export const TECH = {
  comp:{code:'fallo',label:'Última serie al fallo',short:'al fallo',
    steps:['Haz las repeticiones objetivo con tu peso normal.','En la ÚLTIMA serie, no pares al llegar al número: sigue hasta que la siguiente repetición sería con mala técnica.','Ese punto es el fallo técnico. Para ahí.','Si entrenas solo con barra pesada, usa 1-2 reps de margen de seguridad.'],
    tip:'Fallo técnico ≠ fallo absoluto. La forma manda siempre.'},
  mach:{code:'restpause',label:'Rest-pause',short:'rest-pause',
    steps:['Haz tu serie normal hasta el fallo o casi (deja 0-1 reps).','Suelta / descansa 15 segundos exactos respirando hondo.','Vuelve y saca todas las repeticiones que puedas (3-5).','Descansa otros 15 segundos.','Última mini-tanda: saca lo que puedas (2-4 reps).'],
    tip:'Son 3 esfuerzos con 15s entre ellos, NO 3 series con descanso completo.'},
  iso:{code:'drop',label:'Serie descendente (drop set)',short:'descendente',
    steps:['Haz la serie con tu peso hasta el fallo técnico.','SIN descanso, baja la carga un 25-30%.','Sigue inmediatamente hasta el fallo otra vez.','Opcional: baja otro 25% y un tercer tramo al fallo.','Cuenta como UNA serie.'],
    tip:'La clave es CERO descanso entre bajadas. Ten el peso menor preparado antes.'},
  body:{code:'maxreps',label:'Al fallo (máximas repeticiones)',short:'al fallo',
    steps:['Olvida el número objetivo en la última serie.','Haz repeticiones con técnica perfecta hasta que no puedas mantenerla.','En isométricos (plancha): aguanta hasta que la cadera empiece a caer.','Anota cuántas hiciste para superarlo la próxima vez.'],
    tip:'Progresas intentando batir tu número anterior cada semana.'},
};

export const CARDIO = [
  {id:'andar',n:'Caminar en cinta',ic:'🚶',desc:'Ritmo cómodo, puedes hablar. Inclina la cinta 3-6% para que cuente.',zona:'Z2 suave'},
  {id:'paseo',n:'Paseo al aire libre',ic:'🌳',desc:'Andar en la calle a buen paso. Cardio de recuperación.',zona:'Z1-Z2'},
  {id:'correr',n:'Correr en cinta',ic:'🏃',desc:'Trote continuo a ritmo que mantengas todo el tiempo sin parar.',zona:'Z2-Z3'},
  {id:'corrercalle',n:'Correr al aire libre',ic:'🏃‍♂️',desc:'Carrera continua en exterior. Empieza y termina con 3 min suaves.',zona:'Z2-Z3'},
  {id:'bici',n:'Bicicleta estática',ic:'🚴',desc:'Resistencia media, cadencia 80-90 rpm constante.',zona:'Z2'},
  {id:'escalera',n:'Escalera / Stepper',ic:'🪜',desc:'Paso constante sin apoyar todo el peso en las barras.',zona:'Z2-Z3'},
  {id:'eliptica',n:'Elíptica',ic:'⭕',desc:'Bajo impacto, usa también los brazos. Resistencia media-alta.',zona:'Z2'},
  {id:'hiit',n:'HIIT (intervalos)',ic:'⚡',desc:'30s fuerte / 60-90s suave, repitiendo. Solo si vas con energía.',zona:'Z4-Z5 picos'},
  {id:'remoergo',n:'Remo ergómetro',ic:'🚣',desc:'Cuerpo completo. Secuencia piernas → tronco → brazos.',zona:'Z2-Z3'},
];

export const SPLITS = {
  3:[['Empuje','pressbanca,pressincl,pressmil,elevlat,extricep,fondos'],['Tirón','jalon,remomanc,dominada,remopolea,curlbarra,curlmanc'],['Pierna','sentadilla,prensa,zancada,hipthrust,femoral,gemelo']],
  4:[['Pecho y Tríceps','pressbanca,pressincl,aperturas,extricep,fondos,pressfrances'],['Espalda y Bíceps','jalon,remomanc,dominada,remopolea,curlbarra,curlmanc'],['Pierna','sentadilla,prensa,zancada,femoral,hipthrust,gemelo'],['Hombro y Core','pressmil,elevlat,pajaro,elevfrontal,plancha,crunch']],
  5:[['Pecho','pressbanca,pressincl,pressmanc,aperturas,fondos'],['Espalda','jalon,remomanc,dominada,remopolea,curlbarra'],['Pierna','sentadilla,prensa,zancada,femoral,gemelo'],['Hombro','pressmil,elevlat,pajaro,elevfrontal,plancha'],['Brazo','curlbarra,curlmanc,curlmartillo,extricep,pressfrances,fondos']],
  6:[['Pecho','pressbanca,pressincl,pressmanc,aperturas,fondos'],['Espalda','jalon,remomanc,dominada,remopolea,curlbarra'],['Pierna','sentadilla,prensa,zancada,femoral,gemelo'],['Hombro','pressmil,elevlat,pajaro,elevfrontal,crunch'],['Brazo','curlbarra,curlmanc,curlmartillo,extricep,pressfrances,fondos'],['Glúteo y Core','hipthrust,zancada,puenteglu,plancha,crunch']],
};

export const FOCUS = {
  Pecho:'pressbanca,pressincl,pressmanc,aperturas,fondos',
  Espalda:'jalon,remomanc,dominada,remopolea',
  Pierna:'sentadilla,prensa,zancada,femoral,gemelo',
  Hombro:'pressmil,elevlat,pajaro,elevfrontal',
  Bíceps:'curlbarra,curlmanc,curlmartillo,curlpolea',
  Tríceps:'extricep,pressfrances,patadatricep,fondos',
  Glúteo:'hipthrust,puenteglu,zancada,patadagluteo',
  Core:'plancha,crunch,elevpiernas,mountain',
};

export const byId = (id) => EX.find(e => e.id === id);
export const cById = (id) => CARDIO.find(c => c.id === id);
export const primary = (e) => e.m[0];
