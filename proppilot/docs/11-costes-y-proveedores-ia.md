# 11 — Estimación de costes y comparativa de proveedores de IA

> Fecha de consulta: 2026-11-21. Los precios están en **USD**, como los publica cada proveedor; en euros dependerán del tipo de cambio.
> Al igual que en el doc 10, no se han podido abrir directamente las páginas de precios: las cifras salen de los fragmentos
> indexados de las URL oficiales que se citan. **Antes de contratar, cada precio debe confirmarse en la página viva.**

## 1. Supuestos de uso (3 usuarios)

| Variable | Supuesto | Comentario |
|----------|----------|------------|
| Documentos subidos | 60 por usuario y mes → **180/mes** | Escenario holgado; incluye capturas de operaciones |
| Tamaño medio por documento | ~1 MB | Las fotos de móvil se comprimen a ≤1.600 px |
| Almacenamiento acumulado | ~2,2 GB/año | Despreciable frente a los 100 GB incluidos |
| Base de datos | < 1 GB en años | 8 GB incluidos |
| Correos (verificación, reset, invitaciones) | < 50/mes | |
| Ejecuciones de CI | ~60/mes × ~8 min | |

## 2. Infraestructura

| Concepto | Proveedor / plan | Coste mensual | Fuente |
|----------|------------------|---------------|--------|
| Base de datos + Auth + Storage (producción) | Supabase **Pro** (D2 aprobada) | **25 $**. Incluye 10 $ de crédito de cómputo, que cubre una instancia Micro; 8 GB de disco; 100 GB de archivos; 250 GB de transferencia | https://supabase.com/pricing · https://supabase.com/docs/guides/platform/manage-your-usage/compute |
| Entorno *staging* | a) 2.º proyecto en la misma organización Pro · b) proyecto en organización Free | a) **~10 $** (cómputo Micro, ~0,01344 $/h) · b) **0 $**, pero se pausa tras días de inactividad | ídem |
| Restauración a un momento concreto (PITR) | Complemento de Supabase | **100 $** (7 días). **No recomendado al inicio** (ver §4) | https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery |
| Excesos | Topes de gasto de Supabase | **0 $**: el tope de gasto viene activado por defecto en Pro (el PITR queda fuera de ese tope) | https://supabase.com/docs/guides/platform/billing-on-supabase |
| Hosting web | Vercel **Hobby** · o **Pro** | Hobby **0 $** · Pro **20 $** por miembro | https://vercel.com/pricing · https://vercel.com/docs/plans/hobby |
| Correo transaccional | Resend Free | **0 $** (3.000 correos/mes, 100/día, 1 dominio) | https://resend.com/pricing |
| Dominio propio (D9 aprobada) | Cualquier registrador | **~1 $** (10–15 $/año) | estimación |
| Copia externa cifrada (§4) | Almacenamiento de objetos (Backblaze B2, Cloudflare R2…) | **< 1 $** para pocos GB | estimación; precio por confirmar |
| Repositorio + CI | GitHub (repo privado) | **0 $** mientras se esté dentro de los minutos gratuitos de Actions para repos privados | por confirmar en GitHub |
| IA / OCR | Ver §3 | **0,10 $ – 3 $** | §3 |

**Sobre Vercel Hobby:** no he podido confirmar en fuente oficial si su uso está limitado a proyectos personales no comerciales.
PropPilot es de uso privado y sin ánimo de lucro, pero **hay que comprobarlo en las condiciones de Vercel** antes de decidir (D18).

### Escenarios

| Escenario | Composición | Total mensual aprox. |
|-----------|-------------|----------------------|
| **Mínimo recomendable** | Supabase Pro + staging Free + Vercel Hobby + Resend Free + dominio + copia externa + IA económica | **≈ 27–28 $** |
| **Recomendado** | Igual, con staging de pago (sin pausas) e IA de gama media | **≈ 38–40 $** |
| **Holgado** | Recomendado + Vercel Pro | **≈ 58–60 $** |
| Con PITR | Cualquiera + 100 $ | +100 $ |

## 3. Comparativa de proveedores de IA/OCR (D3: **pendiente**, no se elige todavía)

### 3.1 Qué necesitamos del proveedor

1. Entender **capturas de pantalla** de paneles de trading, facturas y emails, no solo escaneos de documentos.
2. Devolver **JSON estructurado** con un valor, una confianza y la evidencia literal de cada campo.
3. **No usar los datos para entrenar** y retenerlos el menor tiempo posible.
4. Preferiblemente, con procesamiento o residencia de datos en la UE.
5. Coste bajo con este volumen.

### 3.2 Tabla comparativa

| Proveedor | Tipo | Precio publicado | Coste estimado por documento | Coste/mes (180 docs) | Privacidad (según fuente oficial) | Calidad esperada en capturas |
|-----------|------|------------------|------------------------------|----------------------|-----------------------------------|------------------------------|
| **Anthropic Claude Haiku 5.5** | LLM multimodal | 0,10 $ entrada / 0,50 $ salida por millón de tokens (prompts ≤ 100K) | ~0,0006 $ | **~0,11 $** | API: no entrena con los datos por defecto; borrado en ≤ 30 días; ZDR (retención cero) bajo acuerdo | Buena; conviene validarla con capturas reales |
| **Anthropic Claude Sonnet 5.5** | LLM multimodal | 2 $ / 10 $ por millón | ~0,011 $ | **~2 $** | Igual que Haiku | Muy buena comprensión del documento |
| **Google Gemini 2.5 Flash / 3 Flash** (API de pago) | LLM multimodal | 0,30 $ (2.5 Flash) – 0,50 $ (3 Flash) de entrada por millón; precio de salida no confirmado | ~0,001–0,003 $ | **~0,20–0,50 $** | El uso de datos en capa gratuita y de pago **no se ha podido confirmar**; la capa gratuita **no debe usarse** con datos financieros | Buena |
| **OpenAI (modelos GPT con visión)** | LLM multimodal | No se obtuvo un precio vigente fiable | por confirmar | por confirmar | API: no entrena con los datos; registros de abuso durante un máximo de 30 días; ZDR disponible con limitaciones | Buena |
| **Mistral OCR** | OCR especializado | 4 $ por 1.000 páginas (2 $ en lote) | 0,004 $ | **~0,72 $** | Empresa europea; condiciones por confirmar | Excelente en texto; necesita un LLM después para estructurar |
| **AWS Textract** (texto) | OCR clásico | 0,0015 $/página (formularios, más caro) | 0,0015 $ + LLM | **~0,30 $ + LLM** | Regiones UE disponibles; condiciones por confirmar | Bueno en texto; no entiende el documento |
| **Google Document AI / Azure Document Intelligence** | OCR clásico | No confirmado en fuente oficial (terceros: ~1,5 $/1.000 páginas) | ~0,0015 $ + LLM | **~0,30 $ + LLM** | Regiones UE disponibles | Bueno en texto |
| **OCR local (Tesseract)** | Software libre en servidor | 0 $ | 0 $ + LLM | 0 $ | Ningún tercero ve la imagen (salvo el LLM posterior) | Flojo con capturas de interfaces oscuras |

Cálculo del coste por documento con un LLM multimodal (estimación):
- Una imagen de ~1,15 MP equivale a ~1.600 tokens de entrada. La fórmula `ancho × alto / 750` sale de la documentación de visión de Anthropic y no la he reconfirmado hoy.
- Las instrucciones y el esquema de salida suman ~1.500 tokens de entrada.
- La salida JSON son ~500 tokens.
- Ejemplo con Sonnet 5.5: 3.100 × 2 $/M + 500 × 10 $/M ≈ **0,011 $**.

Fuentes:
- https://platform.claude.com/docs/en/about-claude/pricing · https://www.anthropic.com/claude/haiku · https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- https://ai.google.dev/gemini-api/docs/pricing
- https://developers.openai.com/api/docs/pricing · https://developers.openai.com/api/docs/guides/your-data
- https://mistral.ai/pricing/api/
- https://aws.amazon.com/textract/pricing/
- https://cloud.google.com/document-ai/pricing

### 3.3 Conclusiones (sin decidir)

- **El coste no es el factor decisivo**: cualquier opción cuesta menos de 3 $/mes con este volumen. Lo que importa es la **calidad en tus capturas reales** y la **privacidad**.
- Las **opciones de dos pasos** (OCR clásico y después un LLM) añaden un segundo proveedor que también ve los datos, y complican la evidencia por campo.
- **Propuesta de procedimiento para decidir D3:**
  1. Preparar un conjunto de evaluación de 20–30 capturas reales, **solo con tu autorización expresa**, cubriendo compras, payouts, evaluaciones superadas, cuentas quemadas e historiales.
  2. Ejecutarlo con 2–3 proveedores finalistas usando el mismo esquema de salida.
  3. Medir el % de campos correctos, el % de campos inventados (debe ser 0), el % de campos devueltos como "no encontrado" cuando no estaban en la imagen, y el coste.
  4. Revisar las condiciones de privacidad vigentes (retención, entrenamiento, región, ZDR) y el consentimiento de cada usuario (D3b).
- **La arquitectura no cambia según el proveedor:** la interfaz `DocumentExtractor` (doc 01 §5) aísla al proveedor, cada extracción guarda proveedor, modelo y versión del prompt, y cambiar de proveedor es una variable de configuración más un adaptador nuevo.

## 4. Copias de seguridad y restauración (D2)

### 4.1 Qué cubre cada mecanismo

| Mecanismo | Cubre | No cubre | Coste |
|-----------|-------|----------|-------|
| Backups diarios de Supabase Pro (7 días) | Base de datos completa (incluido Auth) | **Los archivos de Storage**: según la documentación de Supabase, los backups de BD no incluyen los objetos subidos; está por reconfirmar | Incluido |
| PITR de Supabase | Restaurar a cualquier segundo | Igual que arriba | 100 $/mes |
| **Copia lógica propia** (GitHub Action nocturna): `pg_dump` + copia del bucket `documents` → cifrado con `age` → almacenamiento de objetos externo con retención de 30 diarias + 12 mensuales | BD y archivos, en un proveedor distinto de Supabase | — | < 1 $/mes |

Recomendación: backups de Supabase + copia lógica propia; **sin PITR al inicio**. Con 3 usuarios, perder como máximo un día de datos es tolerable y la diferencia de coste es grande. Es una decisión pendiente (D17).

### 4.2 Privacidad de las copias

- Las copias contienen datos de **todos** los usuarios. Se cifran antes de salir con una clave pública, y la clave privada la custodia solo el propietario técnico. Es coherente con D4 y queda documentado como parte de la limitación aceptada.
- La credencial de escritura del almacenamiento externo solo permite añadir copias, no borrarlas. Así una credencial filtrada no puede destruirlas.

### 4.3 Procedimiento de restauración (se ensaya, no solo se escribe)

1. Crear un proyecto Supabase **temporal y aislado** (nunca el de staging compartido, porque ahí habría datos reales).
2. Descifrar la copia en el runner de CI y restaurar con `pg_restore` (esquema y datos), conservando los roles y `auth`.
3. Restaurar los objetos del bucket a sus rutas originales.
4. Ejecutar las comprobaciones automáticas:
   - recuento de filas por tabla igual al de la copia;
   - RLS forzado en todas las tablas;
   - las pruebas de aislamiento pgTAP pasan contra la copia restaurada (con usuarios sintéticos añadidos);
   - sumas de control: Σ `amount_eur` por usuario igual al valor guardado en el manifiesto de la copia;
   - cada fila de `documents` tiene su objeto en Storage.
5. Registrar el resultado (fecha, duración, incidencias) en `docs/restore-drills.md` del repo `proppilot`.
6. **Destruir el proyecto temporal.**

Frecuencia: **un ensayo antes de pasar a producción** (Fase 10) y después **trimestral**. Objetivos: RPO ≤ 24 h, RTO ≤ 4 h.
