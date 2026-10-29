// End-to-end test of the cleanup flow against a mocked Gmail connector (no real Gmail is touched).
const { chromium } = require("playwright");
const fs = require("fs");
const PAGE = fs.readFileSync(process.argv[2], "utf8");

const init = () => {
  const DAY = 86400000, now = Date.now();
  const mails = []; let n = 0;
  const add = (sender, subject, count) => { for (let i = 0; i < count; i++) mails.push({ id: "t" + (n++), sender, subject: count > 1 ? subject + " " + i : subject, date: now - (n % 280) * DAY - 3600000 }); };
  ["ae-fresh-item15@newarrival.aliexpress.com", "ae-daily-picks28@deals.aliexpress.com", "ae-ai-notify04@selections.aliexpress.com", "ae-brief-note01@mail.aliexpress.com"].forEach(s => add(s, "Superventas de la semana", 45));
  add("promotion@aliexpress.com", "Una entrega especial", 1);
  add("promotion@aliexpress.com", "Your refund has been processed", 1);
  add("noreply@r.grouponmail.es", "Ofertas Groupon", 30);
  add("ventas@nl-es.privalia.com", "Privalia rebajas", 10);
  add("comunicacion@sugerencias.coches.net", "Ideas para tu coche", 4);
  add("email@news.traderepublic.com", "Novedades del mercado", 5);
  add("noreply-accounts@google.com", "Alerta de seguridad", 8);
  add("account-security-noreply@accountprotection.microsoft.com", "Microsoft account security code", 8);
  add("comunicaciones@myinvestor.es", "Tu resumen mensual", 6);
  add("support@mail.xtb.com", "XTB market update", 4);
  add("noreply@myfxbook.com", "Myfxbook weekly", 5);
  add("no-reply@email.claude.com", "Claude Code updates", 3);
  add("vehiculosocasion@coches.net", "Nuevos coches para tu alerta", 3);
  add("noreply@github.com", "GitHub notification", 4);
  add("no-reply@notify.docker.com", "Docker news", 3);
  add("welcome@supabase.com", "Supabase update", 3);
  add("invoice@mail.anthropic.com", "Your receipt from Anthropic", 2);
  add("billing@zoom.us", "Zoom invoice", 1);
  add("nominas@gestoria.example", "Envío Hojas de Salario", 1);
  add("weird@unknown-sender.xyz", "hola", 2);
  window.__mails = mails;
  window.__calls = [];
  window.__fail = new Set();
  const labels = [{ labelId: "INBOX", name: "INBOX", labelType: "SYSTEM" }, { labelId: "SENT", name: "SENT", labelType: "SYSTEM", messagesTotal: 0 }, { labelId: "Label_1", name: "Trabajo", labelType: "USER" }];
  window.__labels = labels;
  const parseDay = s => new Date(s.replace(/\//g, "-") + "T00:00").getTime();
  const thread = m => ({ id: m.id, messageCount: 1, viewUrl: "https://mail.google.com/mail/?authuser=yo@example.com#all/" + m.id, messages: [{ id: m.id, sender: m.sender, subject: m.subject, snippet: "", date: new Date(m.date).toISOString(), toRecipients: ["yo@example.com"], labelIds: ["INBOX"], viewUrl: "https://mail.google.com/mail/#" + m.id }] });
  const WRITE = new Set(["create_label", "label_thread", "unlabel_thread", "trash_thread", "untrash_thread", "mark_thread_spam", "unmark_thread_spam", "create_draft", "update_draft", "send_message"]);
  const mcp = {
    listTools: async () => ({ servers: [{ server: "Gmail", authStatus: "connected", tools: [] }] }),
    callTool: async (server, tool, input) => {
      window.__calls.push({ tool, input, write: WRITE.has(tool) });
      await new Promise(r => setTimeout(r, 2));
      if (tool === "search_threads") {
        const q = input.query; const a = /after:(\S+)/.exec(q), b = /before:(\S+)/.exec(q);
        let res = mails;
        if (a && b) res = mails.filter(m => m.date >= parseDay(a[1]) && m.date < parseDay(b[1]));
        else if (/in:sent/.test(q)) res = [];
        else res = mails.filter(m => /factura|invoice|receipt/i.test(m.subject));
        return { payload: { threads: res.slice(0, input.pageSize || 20).map(thread) } };
      }
      if (tool === "get_thread") return { payload: thread(mails.find(m => m.id === input.threadId)) };
      if (tool === "list_labels") return { payload: { labels } };
      if (tool === "create_label") { const l = { labelId: "Label_" + labels.length, name: input.displayName, labelType: "USER" }; labels.push(l); return { payload: l }; }
      if (tool === "label_thread" || tool === "unlabel_thread") {
        if (window.__fail.has(input.threadId) && tool === "label_thread") throw { code: "tool_error", message: "simulated failure" };
        const m = mails.find(x => x.id === input.threadId); m.labels = m.labels || new Set(["INBOX"]);
        for (const l of input.labelIds) tool === "label_thread" ? m.labels.add(l) : m.labels.delete(l);
        return { payload: { id: input.threadId } };
      }
      throw { code: "tool_error", message: "unexpected tool " + tool };
    },
  };
  const CLS = {
    "ae-fresh-item15@newarrival.aliexpress.com": "publicidad_no_deseada", "ae-daily-picks28@deals.aliexpress.com": "publicidad_no_deseada", "ae-ai-notify04@selections.aliexpress.com": "publicidad_no_deseada", "ae-brief-note01@mail.aliexpress.com": "publicidad_no_deseada",
    "promotion@aliexpress.com": "publicidad_no_deseada", "noreply@r.grouponmail.es": "publicidad_no_deseada", "ventas@nl-es.privalia.com": "publicidad_no_deseada", "comunicacion@sugerencias.coches.net": "publicidad_no_deseada",
    "email@news.traderepublic.com": "publicidad_no_deseada", "noreply@myfxbook.com": "publicidad_no_deseada",
    "noreply-accounts@google.com": "seguridad_cuenta", "account-security-noreply@accountprotection.microsoft.com": "seguridad_cuenta",
    "comunicaciones@myinvestor.es": "banco_finanzas", "support@mail.xtb.com": "banco_finanzas",
    "no-reply@email.claude.com": "publicidad_conservar", "vehiculosocasion@coches.net": "publicidad_conservar",
    "noreply@github.com": "servicio_cuenta", "no-reply@notify.docker.com": "servicio_cuenta", "welcome@supabase.com": "servicio_cuenta",
    "invoice@mail.anthropic.com": "facturas_pagos", "billing@zoom.us": "facturas_pagos", "nominas@gestoria.example": "trabajo_oficial",
  };
  const sample = Object.assign(async () => ({ text: "ok" }), {
    json: async prompt => {
      if (prompt.includes("Clasifica remitentes")) return Object.entries(CLS).map(([key, categoria]) => ({ key, categoria, motivo: "prueba" }));
      if (prompt.includes("planificador")) return { mode: "search", queries: [{ query: "factura OR invoice", why: "prueba" }] };
      if (prompt.includes("encontrar correos")) return { respuesta: "Resultado de prueba", hilos: [] };
      return {};
    },
  });
  window.claude = { use: async name => ({ mcp, sample })[name] || null };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.addInitScript(init);
  await page.route("http://despacho.test/**", r => r.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${PAGE}</body></html>` }));
  await page.goto("http://despacho.test/");
  const results = []; const check = (name, ok, info = "") => { results.push({ name, ok }); console.log((ok ? "PASS " : "FAIL ") + name + (info ? " — " + info : "")); };
  const writes = () => page.evaluate(() => window.__calls.filter(c => c.write).map(c => ({ tool: c.tool, ...c.input })));
  const count = () => page.$eval("#sel-count", el => Number(el.dataset.count));
  const cats = () => page.$$eval("details.cat input[type=checkbox][id^=cat-]", els => els.map(e => [e.id, e.checked]));
  const nav = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(50); };

  await nav("#limpieza");
  await page.click("#scan-btn");
  await page.waitForSelector("#sel-count", { timeout: 20000 });
  const total = await page.evaluate(() => window.__mails.length);
  check("Analizar no modifica Gmail", (await writes()).length === 0, `${total} conversaciones simuladas`);
  check("Tras analizar no hay nada seleccionado", (await count()) === 0 && (await cats()).every(([, c]) => !c));
  check("Botón aplicar desactivado sin selección", await page.$eval("#apply-btn", b => b.disabled));

  await page.click("#sel-all");
  const all = await count();
  check("Seleccionar todo selecciona acciones", all > 0, `${all} seleccionadas`);
  const allCats = await cats();
  check("Seleccionar todo no marca categorías no seleccionables", !allCats.some(([id, c]) => c && /cat-(sin_clasificar|personal|spam_fraude)/.test(id)));
  await page.click("#preview-btn");
  const prevAll = await page.textContent("#preview");
  check("Con todo seleccionado, la nómina queda retenida", /nominas@gestoria\.example: «Envío Hojas de Salario»/.test(prevAll));
  const lis = await page.$$eval("#preview ul.senders li", els => els.map(e => e.textContent));
  const bad = lis.filter(x => /(google|microsoft|myinvestor|xtb|traderepublic|github|docker|supabase|anthropic|zoom|gestoria|myfxbook|claude|vehiculosocasion)/.test(x) && /y archivar/.test(x));
  check("Con todo seleccionado, ningún protegido se archiva", lis.length > 0 && bad.length === 0, bad.join(" | ") || `${lis.length} remitentes revisados`);
  await page.click("#sel-none");
  check("Desmarcar todo deja 0 acciones", (await count()) === 0 && (await cats()).every(([, c]) => !c));
  check("Desmarcar todo no toca Gmail", (await writes()).length === 0);

  await page.check("#cat-publicidad_no_deseada");
  const onlyPub = await cats();
  check("Seleccionar una categoría no selecciona otras", onlyPub.filter(([, c]) => c).map(([id]) => id).join() === "cat-publicidad_no_deseada");
  const pubCount = await count();
  await page.click("#preview-btn");
  const prev = await page.textContent("#preview");
  check("Vista previa marcada como calculada", prev.includes("Gmail no se ha modificado"));
  check("Reembolso de AliExpress retenido", prev.includes("Your refund has been processed") && prev.includes("retenidas"));
  check("Trade Republic (protegido) solo se etiqueta", /email@news\.traderepublic\.com \(5: etiquetar «Publicidad»\)/.test(prev));
  check("Myfxbook no se mezcla con publicidad no deseada", !prev.includes("myfxbook"));
  check("Sin scroll horizontal en Limpieza (420px)", !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), String(await page.evaluate(() => document.documentElement.scrollWidth)));
  const statsTxt = await page.$$eval("#preview .stat", els => els.map(e => e.textContent));
  check("Vista previa con cifras", statsTxt.length === 4, statsTxt.join(" | "));

  await page.uncheck("#inc-noreply_r_grouponmail_es");
  const afterExcl = await count();
  const prev2 = await page.textContent("#preview");
  check("Excluir remitente resta sus conversaciones", afterExcl === pubCount - 30, `${pubCount} → ${afterExcl}`);
  check("Remitente excluido aparece como excluido", /Remitentes excluidos.*noreply@r\.grouponmail\.es/s.test(prev2) && !prev2.includes("noreply@r.grouponmail.es (30"));
  check("Excluir no deselecciona la categoría", await page.isChecked("#cat-publicidad_no_deseada"));

  await page.click("#apply-btn");
  await page.waitForSelector("#confirm-go");
  check("Confirmar exige casilla", await page.$eval("#confirm-go", b => b.disabled));
  await page.click("#confirm-cancel");
  check("Cancelar no ejecuta nada", (await writes()).length === 0 && await page.$eval("#sheet-back", e => e.hidden));

  // Test mode: one sender, 2 conversations.
  await page.selectOption("#test-sender", "ae-fresh-item15@newarrival.aliexpress.com");
  await page.fill("#test-limit", "2");
  await page.click("#test-btn");
  await page.waitForSelector("#confirm-go");
  await page.check("#confirm-ok");
  await page.click("#confirm-go");
  await page.waitForSelector("#sheet .notice", { timeout: 20000 });
  let w = await writes();
  const lt = w.filter(x => x.tool === "label_thread"), ut = w.filter(x => x.tool === "unlabel_thread"), cl = w.filter(x => x.tool === "create_label");
  check("Prueba limitada: 2 etiquetadas, 2 archivadas, 1 etiqueta creada", lt.length === 2 && ut.length === 2 && cl.length === 1, JSON.stringify({ lt: lt.length, ut: ut.length, cl: cl.length }));
  const ok1 = await page.textContent("#sheet .notice");
  check("Resultado de prueba real distinguido", ok1.startsWith("Hecho en Gmail"), ok1);
  await page.click("#sheet button:has-text('Cerrar')");

  // Full run with an injected failure.
  const failId = await page.evaluate(() => { const m = window.__mails.find(x => x.sender === "ventas@nl-es.privalia.com"); window.__fail.add(m.id); return m.id; });
  const before = (await writes()).length;
  const expected = await count();
  await page.click("#apply-btn"); await page.waitForSelector("#confirm-go"); await page.check("#confirm-ok"); await page.click("#confirm-go");
  await page.waitForSelector("#sheet .notice", { timeout: 30000 });
  const msg = await page.textContent("#sheet .notice");
  check("Fallo parcial no se muestra como éxito total", msg.startsWith("Completado parcialmente") && msg.includes("1 con error"), msg);
  w = await writes();
  const run2 = w.slice(before);
  check("Conversación con fallo de etiqueta no se archiva", !run2.some(x => x.tool === "unlabel_thread" && x.threadId === failId));
  check("No se repiten las 2 conversaciones de la prueba", !run2.some(x => lt.some(y => y.threadId === x.threadId)));
  const mails = await page.evaluate(() => window.__mails.map(m => ({ id: m.id, sender: m.sender, subject: m.subject, labels: m.labels ? [...m.labels] : ["INBOX"] })));
  const archived = mails.filter(m => !m.labels.includes("INBOX"));
  check("Nómina de remitente no listado sigue en la bandeja", mails.find(m => m.subject.includes("Salario")).labels.includes("INBOX"));
  check("Reembolso sigue en la bandeja", mails.find(m => m.subject.includes("refund")).labels.includes("INBOX"));
  const PROT = /google|microsoft|myinvestor|xtb|traderepublic|github|docker|supabase|anthropic|zoom|gestoria|myfxbook|claude|vehiculosocasion/;
  check("Ningún remitente protegido o que interesa archivado", !archived.some(m => PROT.test(m.sender)), `${archived.length} archivadas`);
  check("Groupon excluido no se tocó", !run2.some(x => mails.find(m => m.id === x.threadId)?.sender.includes("groupon")));
  check("Solo categoría seleccionada afectada", archived.every(m => /aliexpress|privalia|sugerencias\.coches/.test(m.sender)));
  check("Número de operaciones coherente", run2.filter(x => x.tool === "label_thread").length === expected, `${expected} esperadas`);
  await page.click("#sheet button:has-text('Cerrar')");
  const afterCount = await count();
  check("Tras aplicar solo queda pendiente el fallido", afterCount === 1, `${afterCount}`);
  await page.evaluate(id => window.__fail.delete(id), failId);
  const before3 = (await writes()).length;
  await page.click("#apply-btn"); await page.waitForSelector("#confirm-go"); await page.check("#confirm-ok"); await page.click("#confirm-go");
  await page.waitForSelector("#sheet .notice", { timeout: 20000 });
  const run3 = (await writes()).slice(before3);
  check("Reintento solo repite el pendiente", run3.length === 2 && run3.every(x => x.threadId === failId), JSON.stringify(run3.map(x => x.tool)));
  await page.click("#sheet button:has-text('Cerrar')");

  // Undo the test-mode entry from history.
  await nav("#historial");
  const undoBtns = await page.$$("#log-out button");
  check("Historial con entradas deshacibles", undoBtns.length > 0, `${undoBtns.length} botones`);
  const before4 = (await writes()).length;
  await undoBtns[undoBtns.length - 1].click();
  await page.waitForFunction(() => [...document.querySelectorAll("#log-out .pill")].some(p => p.textContent === "Deshecho"), null, { timeout: 10000 });
  const run4 = (await writes()).slice(before4);
  check("Deshacer devuelve a la bandeja y quita la etiqueta", run4.filter(x => x.tool === "label_thread" && x.labelIds[0] === "INBOX").length === 2 && run4.filter(x => x.tool === "unlabel_thread").length === 2, JSON.stringify(run4.map(x => x.tool)));

  // Existing search still works.
  await nav("#buscar");
  check("Navegación muestra Buscar", await page.isVisible("#v-buscar") && !(await page.isVisible("#v-limpieza")));
  await page.fill("#q", "busca una factura");
  await page.click("#search-btn");
  await page.waitForSelector("#search-out .card", { timeout: 10000 });
  check("Búsqueda devuelve tarjetas", (await page.$$("#search-out .card")).length > 0);
  check("Sin errores de JavaScript", errors.length === 0, errors.join(" | "));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("Sin scroll horizontal en móvil (420px)", !overflow);

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} pruebas superadas`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
