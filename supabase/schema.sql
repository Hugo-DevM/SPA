-- ===========================================================================
-- Casa Vapor — esquema de reservas con buffer, mejor ajuste y anticipos
-- ---------------------------------------------------------------------------
-- Cómo se usa: entra a tu proyecto de Supabase, abre el SQL Editor, pega este
-- archivo entero y ejecútalo. Es idempotente: puedes volver a correrlo.
--
-- Idea de fondo: la clienta nunca escribe en `citas` directamente. Inserta a
-- través de `reservar_cita`, que revalida todo en el servidor. Y aunque alguien
-- se saltara la función, una restricción de exclusión impide físicamente que
-- dos citas de la misma cabina se traslapen.
--
-- El dinero tampoco se le cree al navegador. El precio, la duración, el buffer
-- y el anticipo viven en `tratamientos` y la función los lee de ahí: lo único
-- que manda la clienta es QUÉ tratamiento eligió.
--
-- ===========================================================================
-- LOS CUATRO PUNTOS DEL MOTOR, Y DÓNDE VIVE CADA UNO
-- ===========================================================================
--   1. Huecos anclados al minuto en que la cabina queda libre.
--      → CLIENTE (src/lib/reservas.ts). Es presentación de horarios; el
--        servidor solo tiene que aceptar cualquier hora válida, no una rejilla.
--
--   2. Buffer de limpieza.
--      → AQUÍ. La franja que bloquea una cita es [inicio, fin + buffer), y eso
--        lo impone la columna generada `franja` más la restricción de
--        exclusión. No es una convención del front: es física de la base.
--
--   3. Mejor ajuste al elegir cabina.
--      → AQUÍ, en `reservar_cita`. Cuando no se pide cabina, NO se toma la
--        primera libre: se toma la que deja menos hueco invendible y, a igualdad,
--        la que deja menos sobrante. Si esto viviera solo en el cliente, una
--        llamada directa a la API repartiría mal las cabinas.
--
--   4. Aviso de horas que dejarían hueco muerto.
--      → CLIENTE. Es una decisión de presentación: se marcan, no se bloquean.
--        Bloquearlas sería más "eficiente" y peor negocio.
--
-- ===========================================================================
-- Datos personales: `citas` guarda nombre, teléfono, correo y las notas del
-- tratamiento, que pueden incluir información de salud. El rol anónimo NO puede
-- leer esa tabla. Para pintar el calendario se usa `disponibilidad`, que
-- devuelve solo franjas ocupadas, sin un solo dato de la clienta.
-- ===========================================================================

-- Necesaria para combinar igualdad de texto y solapamiento de rangos dentro de
-- un mismo índice GiST.
create extension if not exists btree_gist;

-- Zona horaria del negocio. Supabase corre en UTC; si no se fija, "hoy" cambia
-- de día a las 18:00 hora de Guadalajara.
-- Si la casa está en otro huso, cámbialo aquí y en src/data/spa.ts.
create or replace function public.zona_casa() returns text
language sql immutable as $$ select 'America/Mexico_City' $$;

create or replace function public.ahora_local() returns timestamp
language sql stable as $$ select (now() at time zone public.zona_casa()) $$;

-- Rejilla base de horarios. Solo la usa el cliente para generar candidatos; se
-- declara aquí para que los dos lados tengan una única fuente.
-- Debe coincidir con `reserva.pasoMinutos` de src/data/spa.ts.
create or replace function public.paso_minutos() returns integer
language sql immutable as $$ select 30 $$;

-- Cuánto tiempo se le aparta la cabina a quien todavía no manda el anticipo.
-- Tres horas alcanzan para una transferencia sin prisas y son poco suficiente
-- para que un apartado falso no bloquee la cabina toda la tarde.
-- Debe coincidir con `pago.plazoHoras` de src/data/spa.ts.
create or replace function public.plazo_anticipo() returns interval
language sql immutable as $$ select interval '3 hours' $$;


-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Horario de atención. Un renglón por día de la semana (0 = domingo).
-- Esta tabla es la que MANDA para validar. Los horarios que se muestran en la
-- página viven en src/data/spa.ts; si cambias uno, cambia el otro.
create table if not exists public.horarios (
  dia_semana smallint primary key check (dia_semana between 0 and 6),
  abre time,
  cierra time,
  cerrado boolean not null default false,
  constraint horarios_coherentes check (
    cerrado or (abre is not null and cierra is not null and cierra > abre)
  )
);

-- Catálogo de cabinas. Es el recurso que se agenda: una cabina implica a su
-- terapeuta. Modelar cabina y terapeuta por separado obliga a resolver dos
-- disponibilidades a la vez, que es otro problema.
create table if not exists public.cabinas (
  slug text primary key,
  nombre text not null,
  activa boolean not null default true,
  orden smallint not null default 0
);

-- Catálogo de tratamientos. AUTORIDAD sobre precio, duración, buffer y
-- anticipo. Los textos y fotos viven en src/data/spa.ts; si cambias un número,
-- cámbialo en los dos lados o la clienta ve uno y se le cobra otro.
--
-- `buffer_min` es el tiempo de preparación de la cabina DESPUÉS del
-- tratamiento. No es opcional ni decorativo: entra en la franja que bloquea la
-- cita, y sin él la base ofrecería la cabina mientras todavía se está limpiando.
create table if not exists public.tratamientos (
  slug text primary key,
  nombre text not null,
  precio integer not null check (precio >= 0),
  duracion_min integer not null check (duracion_min between 5 and 480),
  buffer_min integer not null default 0 check (buffer_min between 0 and 120),
  anticipo integer not null default 0 check (anticipo >= 0),
  activo boolean not null default true,
  orden smallint not null default 0,
  constraint tratamientos_anticipo_coherente check (anticipo <= precio)
);

-- Cierres puntuales: vacaciones, mantenimiento, una tarde suelta.
-- cabina_slug nulo = cierra la casa entera.
-- hora_inicio nula  = el día completo.
create table if not exists public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  cabina_slug text references public.cabinas (slug) on delete cascade,
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  motivo text,
  constraint bloqueos_coherentes check (
    (hora_inicio is null and hora_fin is null)
    or (hora_inicio is not null and hora_fin is not null and hora_fin > hora_inicio)
  )
);

create index if not exists bloqueos_por_fecha on public.bloqueos (fecha);

-- Citas. El nombre del tratamiento y el precio se guardan copiados, no por
-- referencia: si mañana sube el precio, la cita de ayer conserva lo que se le
-- cotizó a la clienta.
create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  creada_en timestamptz not null default now(),

  cliente_nombre text not null,
  cliente_telefono text not null,
  cliente_correo text,

  tratamiento_slug text not null,
  tratamiento_nombre text not null,
  precio integer not null default 0,
  duracion_min integer not null check (duracion_min between 5 and 480),
  buffer_min integer not null default 0 check (buffer_min between 0 and 120),

  cabina_slug text not null references public.cabinas (slug),
  cabina_nombre text not null,

  fecha date not null,
  hora time not null,
  notas text,

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'completada', 'cancelada')),

  anticipo integer not null default 0,
  pago_estado text not null default 'no_requiere',
  pago_comprobante text,
  pago_subido_en timestamptz,
  pago_resuelto_en timestamptz,
  pago_nota text,
  vence_en timestamptz,

  -- Referencia corta y legible para decírsela por teléfono. Es también la que
  -- la clienta pone en el concepto de la transferencia.
  folio text generated always as
    ('CV-' || upper(substr(replace(id::text, '-', ''), 1, 6))) stored,

  -- PUNTO 2. La franja que la cita OCUPA de verdad: el tratamiento más su
  -- limpieza. Es lo que usa la restricción de exclusión, así que el buffer deja
  -- de ser una buena intención del front y se vuelve imposible de violar.
  franja tsrange generated always as (
    tsrange(
      (fecha + hora),
      (fecha + hora) + make_interval(mins => duracion_min + buffer_min),
      '[)'
    )
  ) stored
);

-- Teléfono reducido a dígitos, para contar las citas de una misma persona
-- escriba "33 1234 5678" o "3312345678".
alter table public.citas
  add column if not exists telefono_digitos text
  generated always as (regexp_replace(cliente_telefono, '\D', '', 'g')) stored;

do $$
begin
  alter table public.citas
    add constraint citas_pago_estado_valido
    check (pago_estado in ('no_requiere', 'esperando', 'en_revision', 'verificado', 'rechazado'));
exception
  when duplicate_object then null;
end
$$;

create index if not exists citas_por_fecha on public.citas (fecha);
create index if not exists citas_por_estado on public.citas (estado, fecha);
create index if not exists citas_por_telefono on public.citas (telefono_digitos);
create index if not exists citas_por_vencimiento on public.citas (vence_en)
  where vence_en is not null;

-- El seguro de verdad contra la doble reserva. Dos citas de la misma cabina no
-- pueden compartir ni un minuto, INCLUIDA la limpieza. Se evalúa dentro de la
-- transacción, así que gana aunque dos personas confirmen el mismo hueco en el
-- mismo instante.
do $$
begin
  alter table public.citas
    add constraint citas_sin_traslape
    exclude using gist (
      cabina_slug with =,
      franja with &&
    ) where (estado <> 'cancelada');
exception
  when duplicate_table then null;
  when duplicate_object then null;
end
$$;


-- ---------------------------------------------------------------------------
-- El bloque vendible más chico
-- ---------------------------------------------------------------------------
-- Duración más corta del catálogo más su buffer. Un hueco por debajo de esto no
-- lo puede comprar nadie, y es la vara con la que el mejor ajuste decide.
create or replace function public.minimo_vendible()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(min(t.duracion_min + t.buffer_min), 30)
  from public.tratamientos t
  where t.activo;
$$;


-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------------

alter table public.horarios     enable row level security;
alter table public.cabinas      enable row level security;
alter table public.tratamientos enable row level security;
alter table public.bloqueos     enable row level security;
alter table public.citas        enable row level security;

drop policy if exists horarios_lectura on public.horarios;
create policy horarios_lectura on public.horarios
  for select to anon, authenticated using (true);

drop policy if exists cabinas_lectura on public.cabinas;
create policy cabinas_lectura on public.cabinas
  for select to anon, authenticated using (activa);

drop policy if exists tratamientos_lectura on public.tratamientos;
create policy tratamientos_lectura on public.tratamientos
  for select to anon, authenticated using (activo);

drop policy if exists bloqueos_lectura on public.bloqueos;
create policy bloqueos_lectura on public.bloqueos
  for select to anon, authenticated using (true);

-- Citas: el público no las ve ni las escribe. Sin política de INSERT para
-- `anon`, la única vía de entrada es `reservar_cita`; y sin política de UPDATE,
-- la única forma de adjuntar un comprobante es `registrar_comprobante`.
drop policy if exists citas_panel_lectura on public.citas;
create policy citas_panel_lectura on public.citas
  for select to authenticated using (true);

drop policy if exists citas_panel_escritura on public.citas;
create policy citas_panel_escritura on public.citas
  for update to authenticated using (true) with check (true);

drop policy if exists citas_panel_borrado on public.citas;
create policy citas_panel_borrado on public.citas
  for delete to authenticated using (true);

drop policy if exists bloqueos_panel on public.bloqueos;
create policy bloqueos_panel on public.bloqueos
  for all to authenticated using (true) with check (true);

drop policy if exists horarios_panel on public.horarios;
create policy horarios_panel on public.horarios
  for all to authenticated using (true) with check (true);

drop policy if exists cabinas_panel on public.cabinas;
create policy cabinas_panel on public.cabinas
  for all to authenticated using (true) with check (true);

drop policy if exists tratamientos_panel on public.tratamientos;
create policy tratamientos_panel on public.tratamientos
  for all to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------------
-- Comprobantes de transferencia (Supabase Storage)
-- ---------------------------------------------------------------------------
-- Bucket PRIVADO. `anon` puede subir pero no leer: si pudiera leer, cualquiera
-- vería los comprobantes bancarios de las demás clientas. El panel, que sí está
-- autenticado, los abre con una URL firmada de duración corta.
--
-- Tampoco puede sobrescribir: no hay política de UPDATE para `anon`, y cada
-- archivo va a una ruta con un UUID nuevo.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'comprobantes',
    'comprobantes',
    false,
    5242880, -- 5 MB: una captura de un banco no pesa más
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists comprobantes_subida on storage.objects;
  create policy comprobantes_subida on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'comprobantes');

  drop policy if exists comprobantes_lectura on storage.objects;
  create policy comprobantes_lectura on storage.objects
    for select to authenticated
    using (bucket_id = 'comprobantes');

  drop policy if exists comprobantes_borrado on storage.objects;
  create policy comprobantes_borrado on storage.objects
    for delete to authenticated
    using (bucket_id = 'comprobantes');
exception
  when undefined_table or invalid_schema_name then
    raise notice 'Sin esquema storage: los anticipos no podrán guardar comprobante.';
end
$$;


-- ---------------------------------------------------------------------------
-- Apartados caducados
-- ---------------------------------------------------------------------------
-- Una cita que pide anticipo aparta la cabina desde que se reserva. Si no se
-- liberara sola, quien reserva y no transfiere deja un hueco muerto para
-- siempre.
--
-- Se resuelve sin cron ni servidor: esta función cancela los apartados vencidos
-- y se llama desde `reservar_cita` y desde el panel al refrescar. La restricción
-- de exclusión solo ignora las citas canceladas, así que NO alcanza con
-- filtrarlos al leer: hay que cancelarlos de verdad o el INSERT seguiría
-- chocando con un apartado que ya no vale.
create or replace function public.liberar_vencidas()
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with liberadas as (
    update public.citas
       set estado = 'cancelada',
           pago_nota = coalesce(
             pago_nota,
             'Apartado liberado automáticamente: no llegó el anticipo dentro del plazo.'
           )
     where estado = 'pendiente'
       and pago_estado in ('esperando', 'rechazado')
       and vence_en is not null
       and vence_en < now()
    returning 1
  )
  select count(*)::integer from liberadas;
$$;

revoke all on function public.liberar_vencidas() from public;
grant execute on function public.liberar_vencidas() to authenticated;


-- ---------------------------------------------------------------------------
-- Disponibilidad pública
-- ---------------------------------------------------------------------------
-- Franjas ya tomadas en un rango de fechas. Ni nombres, ni teléfonos, ni notas:
-- solo qué cabina está ocupada, cuándo, cuánto dura y cuánto buffer lleva.
--
-- El buffer VIAJA en la respuesta a propósito: sin él el navegador no podría
-- calcular el minuto exacto en que la cabina queda libre, que es de donde
-- salen los horarios anclados del punto 1.
--
-- Los apartados con anticipo vencido se descartan aunque sigan marcados como
-- pendientes: así el calendario dice la verdad desde el primer segundo, sin
-- esperar a que alguien dispare `liberar_vencidas`.
create or replace function public.disponibilidad(p_desde date, p_hasta date)
returns table (
  cabina_slug text,
  fecha date,
  hora time,
  duracion_min integer,
  buffer_min integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.cabina_slug, c.fecha, c.hora, c.duracion_min, c.buffer_min
  from public.citas c
  where c.estado <> 'cancelada'
    and c.fecha between p_desde and p_hasta
    and p_hasta >= p_desde
    and p_hasta - p_desde <= 120
    and not (
      c.estado = 'pendiente'
      and c.pago_estado in ('esperando', 'rechazado')
      and c.vence_en is not null
      and c.vence_en < now()
    );
$$;

revoke all on function public.disponibilidad(date, date) from public;
grant execute on function public.disponibilidad(date, date) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Alta de cita
-- ---------------------------------------------------------------------------
-- Única puerta de entrada para el público. Revalida todo en el servidor: no se
-- fía de lo que diga el navegador que estaba libre ni de lo que diga que cuesta.
--
-- Si p_cabina_slug viene nulo ("la que esté libre"), aplica MEJOR AJUSTE. Ver
-- el comentario largo dentro de la función.
--
-- Errores que puede levantar, para que el front los traduzca:
--   NOMBRE_INVALIDO, TELEFONO_INVALIDO, CORREO_INVALIDO, TRATAMIENTO_INVALIDO,
--   FUERA_DE_PLAZO, DIA_CERRADO, FUERA_DE_HORARIO, HORA_OCUPADA,
--   DEMASIADAS_CITAS
create or replace function public.reservar_cita(
  p_nombre           text,
  p_telefono         text,
  p_correo           text,
  p_tratamiento_slug text,
  p_cabina_slug      text,
  p_fecha            date,
  p_hora             time,
  p_notas            text
)
returns table (
  id                 uuid,
  folio              text,
  cabina_slug        text,
  cabina_nombre      text,
  tratamiento_nombre text,
  precio             integer,
  duracion_min       integer,
  anticipo           integer,
  pago_estado        text,
  vence_en           timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Cuántas citas futuras sin atender puede tener un mismo teléfono a la vez.
  -- Tres deja pasar a quien aparta para su familia y corta a quien quiere
  -- vaciar la agenda del mes con datos inventados.
  c_tope_por_telefono constant integer := 3;

  v_inicio      timestamp;
  v_fin         timestamp;   -- fin del tratamiento, sin buffer
  v_fin_buffer  timestamp;   -- fin de la franja que ocupa, con buffer
  v_digitos     text;
  v_horario     public.horarios%rowtype;
  v_trat        public.tratamientos%rowtype;
  v_cabina      public.cabinas%rowtype;
  v_min         integer;
  v_abre_ts     timestamp;
  v_cierra_ts   timestamp;
  v_pago_estado text;
  v_vence       timestamptz;
  v_id          uuid;
  v_folio       text;
begin
  -- Antes de mirar si hay hueco se sueltan los apartados vencidos: puede que el
  -- hueco que se está pidiendo sea justo uno de ellos.
  perform public.liberar_vencidas();

  p_nombre   := btrim(coalesce(p_nombre, ''));
  p_telefono := btrim(coalesce(p_telefono, ''));
  p_correo   := nullif(btrim(coalesce(p_correo, '')), '');
  p_notas    := nullif(btrim(coalesce(p_notas, '')), '');

  if char_length(p_nombre) < 3 or char_length(p_nombre) > 80 then
    raise exception 'NOMBRE_INVALIDO';
  end if;

  v_digitos := regexp_replace(p_telefono, '\D', '', 'g');
  if char_length(v_digitos) not between 10 and 13 then
    raise exception 'TELEFONO_INVALIDO';
  end if;

  -- Tope por teléfono. Como una cita sin confirmar ya aparta la cabina, sin
  -- esto cualquiera podría bloquear la agenda entera en dos minutos.
  if (
    select count(*)
    from public.citas c
    where c.telefono_digitos = v_digitos
      and c.estado in ('pendiente', 'confirmada')
      and (c.fecha + c.hora) >= public.ahora_local()
  ) >= c_tope_por_telefono then
    raise exception 'DEMASIADAS_CITAS';
  end if;

  if p_correo is not null and p_correo !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'CORREO_INVALIDO';
  end if;

  -- El precio, la duración, el buffer y el anticipo salen de aquí, NO de la
  -- petición.
  select * into v_trat
  from public.tratamientos t
  where t.slug = p_tratamiento_slug and t.activo;

  if not found then
    raise exception 'TRATAMIENTO_INVALIDO';
  end if;

  v_inicio     := p_fecha + p_hora;
  v_fin        := v_inicio + make_interval(mins => v_trat.duracion_min);
  v_fin_buffer := v_inicio + make_interval(mins => v_trat.duracion_min + v_trat.buffer_min);

  if v_inicio < public.ahora_local() + interval '30 minutes' then
    raise exception 'FUERA_DE_PLAZO';
  end if;

  if p_fecha > (public.ahora_local()::date + 90) then
    raise exception 'FUERA_DE_PLAZO';
  end if;

  select * into v_horario
  from public.horarios
  where dia_semana = extract(dow from p_fecha)::smallint;

  if not found or v_horario.cerrado then
    raise exception 'DIA_CERRADO';
  end if;

  -- El tratamiento tiene que caber entero antes del cierre. El BUFFER no: la
  -- limpieza de la última clienta pasa con la casa cerrada, y exigir que quepa
  -- mataría la última cita del día sin ninguna razón.
  if p_hora < v_horario.abre or v_fin > (p_fecha + v_horario.cierra) then
    raise exception 'FUERA_DE_HORARIO';
  end if;

  v_min       := public.minimo_vendible();
  v_abre_ts   := p_fecha + v_horario.abre;
  v_cierra_ts := p_fecha + v_horario.cierra;

  /* ----------------------------------------------------------------------
     PUNTO 3: MEJOR AJUSTE

     De las cabinas que pueden tomar la franja, se elige la que deja menos
     tiempo invendible alrededor y, a igualdad, la que deja menos sobrante en
     total. `orden` solo desempata, para que el resultado sea estable.

     Tomar "la primera libre" es lo que rompe la ocupación: mete la cita en una
     cabina vacía, parte el día en dos y deja a las tres cabinas con huecos a la
     mitad en vez de a una llena y otra libre para un ritual de dos horas.

     `sobra_antes`  = del final de la cita anterior al inicio de esta.
     `sobra_despues`= del final de esta (con buffer) al inicio de la siguiente.
     Un sobrante mayor a cero pero por debajo de `v_min` es tiempo muerto.
     ---------------------------------------------------------------------- */
  with disponibles as (
    select
      c.slug,
      c.nombre,
      c.orden,
      greatest(
        0,
        extract(epoch from (
          v_inicio - coalesce(
            (select max(upper(x.franja))
             from public.citas x
             where x.cabina_slug = c.slug
               and x.fecha = p_fecha
               and x.estado <> 'cancelada'
               and upper(x.franja) <= v_inicio),
            v_abre_ts
          )
        )) / 60
      )::integer as sobra_antes,
      greatest(
        0,
        extract(epoch from (
          coalesce(
            (select min(lower(x.franja))
             from public.citas x
             where x.cabina_slug = c.slug
               and x.fecha = p_fecha
               and x.estado <> 'cancelada'
               and lower(x.franja) >= v_fin_buffer),
            v_cierra_ts
          ) - v_fin_buffer
        )) / 60
      )::integer as sobra_despues
    from public.cabinas c
    where c.activa
      and (p_cabina_slug is null or c.slug = p_cabina_slug)
      and not exists (
        select 1
        from public.citas x
        where x.cabina_slug = c.slug
          and x.estado <> 'cancelada'
          and x.franja && tsrange(v_inicio, v_fin_buffer, '[)')
      )
      and not exists (
        select 1
        from public.bloqueos bl
        where bl.fecha = p_fecha
          and (bl.cabina_slug is null or bl.cabina_slug = c.slug)
          and (
            bl.hora_inicio is null
            or tsrange(p_fecha + bl.hora_inicio, p_fecha + bl.hora_fin, '[)')
               && tsrange(v_inicio, v_fin_buffer, '[)')
          )
      )
  )
  select d.slug, d.nombre, d.activa, d.orden into v_cabina
  from (
    select
      dd.slug,
      dd.nombre,
      true as activa,
      dd.orden,
      (case when dd.sobra_antes > 0 and dd.sobra_antes < v_min then dd.sobra_antes else 0 end)
        + (case when dd.sobra_despues > 0 and dd.sobra_despues < v_min then dd.sobra_despues else 0 end)
        as muertos,
      dd.sobra_antes + dd.sobra_despues as sobra
    from disponibles dd
  ) d
  order by d.muertos, d.sobra, d.orden
  limit 1;

  if v_cabina.slug is null then
    raise exception 'HORA_OCUPADA';
  end if;

  -- El plazo del anticipo nunca se pasa de la hora de la cita: apartar hasta
  -- las 8 de la noche una cabina que era a las 6 no tiene sentido.
  if v_trat.anticipo > 0 then
    v_pago_estado := 'esperando';
    v_vence := least(
      now() + public.plazo_anticipo(),
      v_inicio at time zone public.zona_casa()
    );
  else
    v_pago_estado := 'no_requiere';
    v_vence := null;
  end if;

  begin
    insert into public.citas (
      cliente_nombre, cliente_telefono, cliente_correo,
      tratamiento_slug, tratamiento_nombre, precio, duracion_min, buffer_min,
      cabina_slug, cabina_nombre,
      fecha, hora, notas,
      anticipo, pago_estado, vence_en
    )
    values (
      p_nombre, p_telefono, p_correo,
      v_trat.slug, v_trat.nombre, v_trat.precio, v_trat.duracion_min, v_trat.buffer_min,
      v_cabina.slug, v_cabina.nombre,
      p_fecha, p_hora, p_notas,
      v_trat.anticipo, v_pago_estado, v_vence
    )
    returning citas.id, citas.folio into v_id, v_folio;
  exception
    -- Dos personas confirmando la misma cabina en el mismo instante: la consulta
    -- de arriba vio libre, la restricción de exclusión no.
    when exclusion_violation then
      raise exception 'HORA_OCUPADA';
  end;

  return query select
    v_id, v_folio,
    v_cabina.slug, v_cabina.nombre,
    v_trat.nombre, v_trat.precio, v_trat.duracion_min,
    v_trat.anticipo, v_pago_estado, v_vence;
end;
$$;

revoke all on function public.reservar_cita(
  text, text, text, text, text, date, time, text
) from public;
grant execute on function public.reservar_cita(
  text, text, text, text, text, date, time, text
) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Comprobante del anticipo
-- ---------------------------------------------------------------------------
-- La clienta sube la captura al bucket y después llama aquí para engancharla a
-- su cita. Como `anon` no tiene permiso de UPDATE sobre `citas`, esta función es
-- la única vía.
--
-- Pide folio Y teléfono: el folio va impreso en la pantalla y se manda por
-- WhatsApp, así que por sí solo no basta para autorizar un cambio.
--
-- Al adjuntar se detiene el reloj (`vence_en` a nulo): la clienta ya hizo su
-- parte y la cabina no debe soltarse mientras la casa revisa.
--
-- Errores: CITA_NO_ENCONTRADA, PAGO_NO_APLICA, RUTA_INVALIDA
create or replace function public.registrar_comprobante(
  p_folio    text,
  p_telefono text,
  p_ruta     text
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cita    public.citas%rowtype;
  v_digitos text;
begin
  perform public.liberar_vencidas();

  p_ruta := btrim(coalesce(p_ruta, ''));
  if char_length(p_ruta) < 3 or char_length(p_ruta) > 400 then
    raise exception 'RUTA_INVALIDA';
  end if;

  v_digitos := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');

  select * into v_cita
  from public.citas c
  where c.folio = upper(btrim(coalesce(p_folio, '')))
    and c.telefono_digitos = v_digitos;

  if not found then
    raise exception 'CITA_NO_ENCONTRADA';
  end if;

  if v_cita.estado <> 'pendiente' or v_cita.pago_estado not in ('esperando', 'rechazado') then
    raise exception 'PAGO_NO_APLICA';
  end if;

  update public.citas
     set pago_comprobante = p_ruta,
         pago_subido_en   = now(),
         pago_estado      = 'en_revision',
         pago_nota        = null,
         vence_en         = null
   where citas.id = v_cita.id;

  return 'en_revision';
end;
$$;

revoke all on function public.registrar_comprobante(text, text, text) from public;
grant execute on function public.registrar_comprobante(text, text, text) to anon, authenticated;


-- Verificación por parte de la casa. Mueve el estado del pago y el de la cita a
-- la vez: una cita con el anticipo verificado pero sin confirmar sería una
-- contradicción que tarde o temprano alguien atiende mal.
--
-- Al rechazar se vuelve a abrir el plazo, para que la clienta pueda mandar el
-- comprobante correcto en vez de perder la cabina por una captura borrosa.
create or replace function public.resolver_pago(
  p_id       uuid,
  p_aprobado boolean,
  p_nota     text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cita public.citas%rowtype;
begin
  select * into v_cita from public.citas c where c.id = p_id;

  if not found then
    raise exception 'CITA_NO_ENCONTRADA';
  end if;

  if v_cita.anticipo <= 0 then
    raise exception 'PAGO_NO_APLICA';
  end if;

  if p_aprobado then
    update public.citas
       set pago_estado      = 'verificado',
           pago_resuelto_en = now(),
           pago_nota        = nullif(btrim(coalesce(p_nota, '')), ''),
           vence_en         = null,
           estado           = 'confirmada'
     where citas.id = p_id;
  else
    update public.citas
       set pago_estado      = 'rechazado',
           pago_resuelto_en = now(),
           pago_nota        = coalesce(
             nullif(btrim(coalesce(p_nota, '')), ''),
             'No pudimos identificar la transferencia.'
           ),
           estado           = 'pendiente',
           vence_en = least(
             now() + public.plazo_anticipo(),
             (citas.fecha + citas.hora) at time zone public.zona_casa()
           )
     where citas.id = p_id;
  end if;
end;
$$;

revoke all on function public.resolver_pago(uuid, boolean, text) from public;
grant execute on function public.resolver_pago(uuid, boolean, text) to authenticated;


-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

-- Horario. Lunes (1) cerrado. Debe coincidir con `contacto.horarios` de
-- src/data/spa.ts.
insert into public.horarios (dia_semana, abre, cierra, cerrado) values
  (0, '11:00', '17:00', false),  -- domingo
  (1, null,    null,    true),   -- lunes, cerrado
  (2, '11:00', '21:00', false),
  (3, '11:00', '21:00', false),
  (4, '11:00', '21:00', false),
  (5, '11:00', '21:00', false),
  (6, '10:00', '20:00', false)   -- sábado
on conflict (dia_semana) do update
  set abre = excluded.abre,
      cierra = excluded.cierra,
      cerrado = excluded.cerrado;

-- Cabinas. Los slugs deben coincidir con `cabinas.lista` del archivo de datos.
insert into public.cabinas (slug, nombre, activa, orden) values
  ('vapor',   'Vapor',   true, 1),
  ('arcilla', 'Arcilla', true, 2),
  ('piedra',  'Piedra',  true, 3)
on conflict (slug) do update
  set nombre = excluded.nombre,
      activa = excluded.activa,
      orden = excluded.orden;

-- Tratamientos. Precio, duración, buffer y anticipo TIENEN que coincidir con
-- `tratamientos` de src/data/spa.ts: ese archivo es el que se pinta, este es el
-- que valida. Si no cuadran, la clienta ve un número y se le cobra otro.
--
-- Las duraciones son 30, 60, 75, 90 y 120 a propósito: con una rejilla de 30
-- minutos, cuatro de las cinco dejarían un hueco de 15 minutos invendible si
-- los horarios no se anclaran al final de la cita anterior.
insert into public.tratamientos
  (slug, nombre, precio, duracion_min, buffer_min, anticipo, activo, orden)
values
  ('facial-express',            'Facial express',             450,  30, 15,   0, true, 1),
  ('masaje-descontracturante',  'Masaje descontracturante',   890,  60, 15,   0, true, 2),
  ('facial-profundo',           'Facial profundo',           1100,  75, 15, 300, true, 3),
  ('masaje-cuatro-manos',       'Masaje a cuatro manos',     1750,  90, 20, 500, true, 4),
  ('ritual-vapor-arcilla',      'Ritual de vapor y arcilla', 2400, 120, 20, 700, true, 5)
on conflict (slug) do update
  set nombre = excluded.nombre,
      precio = excluded.precio,
      duracion_min = excluded.duracion_min,
      buffer_min = excluded.buffer_min,
      anticipo = excluded.anticipo,
      activo = excluded.activo,
      orden = excluded.orden;


-- La API de Supabase guarda en caché la forma del esquema. Sin esto, las
-- funciones nuevas pueden tardar en aparecer y el sitio respondería "no pudimos
-- guardar la cita" sin motivo aparente.
notify pgrst, 'reload schema';
