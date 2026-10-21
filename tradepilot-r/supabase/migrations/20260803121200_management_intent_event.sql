-- BUILD 013 / B3 — Management Intent: emisión del evento
--
-- Primer consumidor del ancla de propiedad que BUILD 012B introdujo. Emite
-- **un solo evento** por Intención, con `account_id` nulo: una decisión de
-- gestión pertenece al Usuario y concierne a N Cuentas, y no existe ninguna
-- Cuenta que sea su sujeto.
--
-- Sigue exactamente el patrón de los seis emisores de BUILD 006A: trigger
-- `AFTER INSERT` sobre la tabla fuente de verdad, nunca desde una RPC. Eso
-- cierra el "path drift" por construcción —cualquier vía futura de creación
-- emite sin poder olvidarlo— y da atomicidad gratuita: el hecho y su evento
-- viven en la misma transacción, o no vive ninguno.
--
-- **Alcance de este build (B3 de BUILD 009): solo la emisión.** Sin tocar
-- `domain_events` ni sus políticas (B012B), sin la columna de `accounts`
-- (B4), sin función de creación (B5), sin caducidad (B6), sin lecturas (B7),
-- sin reclamación (B8) ni desenlace (B9).

-- ============================================================
-- Payload mínimo: la identidad y nada más.
--
-- BUILD 006A fijó que el payload lleva identidad y la forma de la transición,
-- **nunca una copia del estado de otro módulo** — el consumidor relee la
-- fuente de verdad. Aquí no hay forma que distinguir: una Intención se emite
-- de una sola manera, a diferencia de `OperacionCancelada`, que sí necesita
-- `previous_status` para separar la cancelación simple de la reversión
-- "fantasma". Luego el payload es exactamente `intent_id`.
--
-- Ni el instrumento, ni la dirección, ni el número de destinos: todo eso está
-- en `management_intents` y en sus destinos, que es donde el consumidor debe
-- leerlo. Copiarlo aquí convertiría el outbox en una segunda base de datos.
--
-- `user_id` se aporta explícitamente y `account_id` se deja nulo. El trigger
-- de derivación de BUILD 012B respeta un `user_id` ya presente y solo exige
-- coherencia cuando también hay Cuenta — que aquí no la hay.
--
-- No lleva SECURITY DEFINER, igual que los seis emisores de 006A: la política
-- de INSERT del outbox autoriza por `user_id = auth.uid()`, y toda escritura
-- que dispare este trigger ocurre sobre una Intención del propio usuario.
-- ============================================================
create or replace function public.emit_intencion_de_gestion_emitida() returns trigger
language plpgsql as $$
begin
  insert into public.domain_events (event_type, account_id, user_id, payload)
  values ('IntencionDeGestionEmitida', null, new.user_id,
          jsonb_build_object('intent_id', new.id));
  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$;

-- Solo `after insert`. Una Intención es inmutable desde su emisión (MI-2,
-- BUILD 011) y sus destinos transicionan sin que eso sea un hecho nuevo de la
-- decisión: el desenlace de un destino es candidato a evento propio, pero
-- BUILD 008 §7 lo dejó fuera hasta que exista un consumidor real, y emitirlo
-- sin consumidor es la sobreingeniería que 31 (TPOS) obliga a evitar.
create trigger on_management_intent_insert_emit_event
  after insert on public.management_intents
  for each row execute function public.emit_intencion_de_gestion_emitida();
