/* ==========================================================================
   Capa de reservas — motor de huecos sin tiempo muerto
   --------------------------------------------------------------------------
   Único punto por el que pasan los datos de citas. Dos implementaciones detrás
   de la misma interfaz:

     - Supabase, cuando hay credenciales. Es el modo real.
     - localStorage, cuando no las hay. Es el modo demo: el sitio se enseña de
       punta a punta sin crear cuenta en ningún lado, pero las citas solo
       existen en ese navegador.

   El modo demo repite las MISMAS reglas que el servidor. Si aceptara algo que
   el sistema real rechaza, estaría enseñando algo que no existe.

   ==========================================================================
   POR QUÉ ESTE MOTOR EXISTE
   ==========================================================================
   Una agenda que ofrece horarios sobre una rejilla fija (cada 30 minutos desde
   la apertura) CREA tiempo muerto. Con tratamientos de duración variable, la
   mayoría no termina en un múltiplo de la rejilla:

     Masaje de 60 min + 15 de preparación, empezando 11:00
       → la cabina queda libre 12:15
       → la rejilla ofrece 12:30
       → 15 minutos que nacen muertos, y como el tratamiento más corto son 30,
         NADIE los puede comprar.

   Cuatro de los cinco tratamientos de Casa Vapor producen ese hueco. Sobre una
   jornada llena son unas dos horas de cabina perdidas al día.

   Lo que hace este motor, en orden:

   1. ANCLA. Además de la rejilla, ofrece como hora de inicio el minuto exacto
      en que la cabina queda libre: fin del tratamiento anterior + su buffer.
      Esto es lo que elimina el hueco de 15 minutos.

   2. BUFFER. Cada tratamiento declara su tiempo de preparación de cabina. La
      franja que bloquea es [inicio, fin + buffer), no [inicio, fin). Si el
      buffer no está en el sistema, el personal lo inventa y la tarde se
      atrasa; con él la agenda dice la verdad.

   3. MEJOR AJUSTE. Cuando la clienta no pide cabina, el sistema NO toma la
      primera libre: toma la que deja menos hueco sobrante. Así una cabina se
      llena en bloque y otra queda libre para un tratamiento largo.

   4. AVISA DE LOS HUECOS INVENDIBLES. Si una hora dejaría un espacio menor al
      tratamiento más corto, el motor lo marca. La página lo separa en "otros
      horarios" en vez de esconderlo: la clienta puede elegirlo si de verdad le
      queda a esa hora, pero el camino por defecto llena apretado.

      Ojo con esto último: bloquear esas horas en vez de marcarlas sería más
      "eficiente" y peor negocio. Si solo se ofreciera la hora de apertura como
      primera cita del día, la mitad de la gente se iría a otro spa. La
      ocupación no se optimiza a costa de la conversión.

   ==========================================================================
   Sobre el tiempo: toda la aritmética se hace con enteros de minutos desde
   medianoche y fechas en texto 'AAAA-MM-DD'. Los objetos Date solo aparecen
   para preguntar qué día y qué hora es AHORA en la zona del spa. Mezclar husos
   horarios en el cálculo de huecos es la forma más rápida de ofrecer una hora
   que ya pasó.

   Sobre el dinero: el precio, la duración, el buffer y el anticipo NO se
   mandan al servidor. `reservar()` manda el slug del tratamiento y la base
   decide, leyendo su propia tabla. Lo que se devuelve es lo que quedó
   guardado, no lo que el navegador creía.
   ========================================================================== */

import { obtenerSupabase, HAY_SUPABASE } from './supabase';
import { ZONA_HORARIA, cabinas, reserva, pago, tratamientos as catalogo } from '../data/spa';

export { HAY_SUPABASE };

/* Rejilla base. A esto se le SUMAN los horarios anclados. Tiene que coincidir
   con `paso_minutos()` de supabase/schema.sql. */
export const PASO_MINUTOS = reserva.pasoMinutos;

const CLAVE_DEMO = 'casa-vapor:citas-demo';
const BUCKET_COMPROBANTES = 'comprobantes';

const NOTA_LIBERADA =
  'Apartado liberado automáticamente: no llegó el anticipo dentro del plazo.';

export type EstadoCita = 'pendiente' | 'confirmada' | 'completada' | 'cancelada';

export type EstadoPago =
  | 'no_requiere'
  | 'esperando'
  | 'en_revision'
  | 'verificado'
  | 'rechazado';

export type DiaHorario = {
  dia_semana: number;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
};

export type CabinaAgenda = {
  slug: string;
  nombre: string;
  activa: boolean;
  orden: number;
};

/* Una franja tomada. `buffer_min` viaja con ella porque el bloqueo real es
   duración + buffer: sin el buffer, el motor ofrecería la cabina mientras
   todavía se está limpiando. */
export type Ocupado = {
  cabina_slug: string;
  fecha: string;
  hora: string;
  duracion_min: number;
  buffer_min: number;
};

export type Bloqueo = {
  cabina_slug: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
};

export type Agenda = {
  horarios: DiaHorario[];
  cabinas: CabinaAgenda[];
  ocupados: Ocupado[];
  bloqueos: Bloqueo[];
};

export type Cita = {
  id: string;
  folio: string;
  creada_en: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_correo: string | null;
  tratamiento_slug: string;
  tratamiento_nombre: string;
  precio: number;
  duracion_min: number;
  buffer_min: number;
  cabina_slug: string;
  cabina_nombre: string;
  fecha: string;
  hora: string;
  notas: string | null;
  estado: EstadoCita;
  anticipo: number;
  pago_estado: EstadoPago;
  pago_comprobante: string | null;
  pago_subido_en: string | null;
  pago_resuelto_en: string | null;
  pago_nota: string | null;
  vence_en: string | null;
};

/* Lo único que viaja al servidor. */
export type SolicitudReserva = {
  nombre: string;
  telefono: string;
  correo?: string | null;
  tratamientoSlug: string;
  /* null = "la que esté libre". El servidor aplica mejor ajuste. */
  cabinaSlug: string | null;
  fecha: string;
  hora: string;
  notas?: string | null;
};

export type ReservaHecha = {
  id: string;
  folio: string;
  cabinaSlug: string;
  cabinaNombre: string;
  tratamientoNombre: string;
  precio: number;
  duracionMin: number;
  anticipo: number;
  pagoEstado: EstadoPago;
  venceEn: string | null;
};

/* --------------------------------------------------------------------------
   Utilidades de fecha y hora
   -------------------------------------------------------------------------- */

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* '2026-03-08' -> { anio, mes (1-12), dia } sin pasar por Date, que
   interpretaría la cadena como UTC y podría restar un día. */
export function partesFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return { anio, mes, dia };
}

export function aFecha(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/* Día de la semana (0 = domingo) por el algoritmo de Sakamoto, para no
   construir un Date y arriesgar un desfase de zona horaria. */
export function diaSemana(fecha: string): number {
  const { anio, mes, dia } = partesFecha(fecha);
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const a = mes < 3 ? anio - 1 : anio;
  return (a + Math.floor(a / 4) - Math.floor(a / 100) + Math.floor(a / 400) + t[mes - 1] + dia) % 7;
}

export function diasEnMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function sumarDias(fecha: string, dias: number): string {
  const { anio, mes, dia } = partesFecha(fecha);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
  return aFecha(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/* Qué día y qué hora es ahora mismo en el spa, sin importar dónde esté la
   visitante ni cómo tenga configurado el reloj. */
export function ahoraEnCasa(): { fecha: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const leer = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '00';
  // Algunos motores devuelven "24" para la medianoche en hourCycle h23.
  const hora = leer('hour') === '24' ? '00' : leer('hour');

  return {
    fecha: `${leer('year')}-${leer('month')}-${leer('day')}`,
    minutos: Number(hora) * 60 + Number(leer('minute')),
  };
}

/* Convierte fecha y hora del spa al instante exacto en UTC.

   Lo necesita el archivo de calendario: con la hora "suelta" (sin zona), el
   calendario de quien reserva desde otro huso la pondría a esa hora de SU
   zona. Con el instante en UTC, cada quien la ve en su hora local y todas
   hablan del mismo momento. */
export function instanteUtc(fecha: string, hora: string, minutosExtra = 0): Date {
  const { anio, mes, dia } = partesFecha(fecha);
  const supuesto = Date.UTC(anio, mes - 1, dia, 0, aMinutos(hora) + minutosExtra);

  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const desfase = (marca: number) => {
    const partes = formato.formatToParts(new Date(marca));
    const leer = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
    const h = leer('hour') === 24 ? 0 : leer('hour');
    return Date.UTC(leer('year'), leer('month') - 1, leer('day'), h, leer('minute')) - marca;
  };

  // Dos pasadas: la primera basta salvo en los saltos de horario de verano.
  let instante = supuesto - desfase(supuesto);
  instante = supuesto - desfase(instante);
  return new Date(instante);
}

const FORMATO_DIA_LARGO = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export function fechaLegible(fecha: string): string {
  const { anio, mes, dia } = partesFecha(fecha);
  return FORMATO_DIA_LARGO.format(new Date(Date.UTC(anio, mes - 1, dia)));
}

export function horaLegible(hora: string): string {
  const minutos = aMinutos(hora);
  const h24 = Math.floor(minutos / 60);
  const m = minutos % 60;
  const sufijo = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/* Cuánto falta para que se suelte un apartado, en palabras. "Te quedan 2
   horas" se entiende sin hacer la resta; "vence a las 20:14" no. */
export function tiempoRestante(venceEn: string | null): string | null {
  if (!venceEn) return null;
  const faltan = Date.parse(venceEn) - Date.now();
  if (Number.isNaN(faltan) || faltan <= 0) return null;

  const minutos = Math.floor(faltan / 60000);
  if (minutos < 60) return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  return `${horas} h ${resto} min`;
}

/* --------------------------------------------------------------------------
   Catálogo de tratamientos
   --------------------------------------------------------------------------
   Para PINTAR se usa el archivo de datos; para VALIDAR manda la tabla
   `tratamientos` de Supabase. Ver el comentario en src/data/spa.ts. */

export type TratamientoLocal = {
  slug: string;
  nombre: string;
  precio: number;
  duracionMin: number;
  bufferMin: number;
  anticipo: number;
};

export function tratamientoPorSlug(slug: string): TratamientoLocal | null {
  const t = catalogo.find((x) => x.slug === slug);
  return t
    ? {
        slug: t.slug,
        nombre: t.nombre,
        precio: t.precio,
        duracionMin: t.duracionMin,
        bufferMin: t.bufferMin,
        anticipo: t.anticipo,
      }
    : null;
}

/* El bloque vendible más chico del catálogo: duración más corta más su buffer.
   Un hueco por debajo de esto no lo puede comprar nadie, y es la vara con la
   que el punto 4 decide si una hora dejaría espacio muerto. */
export const MINIMO_VENDIBLE = Math.min(
  ...catalogo.map((t) => t.duracionMin + t.bufferMin)
);

/* --------------------------------------------------------------------------
   Horario y cabinas por defecto del modo demo
   --------------------------------------------------------------------------
   Copia de lo que se siembra en las tablas. Solo se usa sin Supabase. */
const HORARIOS_DEMO: DiaHorario[] = [
  { dia_semana: 0, abre: '11:00', cierra: '17:00', cerrado: false },
  { dia_semana: 1, abre: null, cierra: null, cerrado: true },
  { dia_semana: 2, abre: '11:00', cierra: '21:00', cerrado: false },
  { dia_semana: 3, abre: '11:00', cierra: '21:00', cerrado: false },
  { dia_semana: 4, abre: '11:00', cierra: '21:00', cerrado: false },
  { dia_semana: 5, abre: '11:00', cierra: '21:00', cerrado: false },
  { dia_semana: 6, abre: '10:00', cierra: '20:00', cerrado: false },
];

const CABINAS_DEMO: CabinaAgenda[] = cabinas.lista.map((c, i) => ({
  slug: c.slug,
  nombre: c.nombre,
  activa: true,
  orden: i + 1,
}));

/* --------------------------------------------------------------------------
   Motor de huecos
   -------------------------------------------------------------------------- */

function seTraslapan(aIni: number, aFin: number, bIni: number, bFin: number): boolean {
  return aIni < bFin && bIni < aFin;
}

/* Las franjas que una cabina tiene tomadas ese día, YA con el buffer sumado y
   ordenadas. Es la lista contra la que se mide todo lo demás. */
function franjasTomadas(agenda: Agenda, cabinaSlug: string, fecha: string) {
  const franjas: { ini: number; fin: number }[] = [];

  for (const o of agenda.ocupados) {
    if (o.fecha !== fecha || o.cabina_slug !== cabinaSlug) continue;
    const ini = aMinutos(o.hora);
    franjas.push({ ini, fin: ini + o.duracion_min + o.buffer_min });
  }

  for (const bl of agenda.bloqueos) {
    if (bl.fecha !== fecha) continue;
    if (bl.cabina_slug !== null && bl.cabina_slug !== cabinaSlug) continue;
    if (!bl.hora_inicio || !bl.hora_fin) {
      // Día completo cerrado para esa cabina.
      franjas.push({ ini: 0, fin: 24 * 60 });
      continue;
    }
    franjas.push({ ini: aMinutos(bl.hora_inicio), fin: aMinutos(bl.hora_fin) });
  }

  return franjas.sort((a, b) => a.ini - b.ini);
}

export type AjusteCabina = {
  slug: string;
  nombre: string;
  /* Minutos que quedarían sin vender alrededor de esta cita. Menos es mejor. */
  sobra: number;
  /* Minutos que quedarían muertos: sobrante mayor a cero pero menor al bloque
     vendible más chico. */
  muertos: number;
};

/* PUNTOS 2 y 3. Para una hora concreta, qué cabinas pueden tomarla y cuánto
   hueco dejaría cada una.

   El bloqueo que genera la cita es [inicio, fin + buffer). El buffer NO tiene
   que caber antes del cierre: limpiar después de la última clienta pasa con el
   spa cerrado, y exigirlo mataría la última cita del día. */
export function cabinasParaHora(
  agenda: Agenda,
  fecha: string,
  inicio: number,
  tratamiento: { duracionMin: number; bufferMin: number },
  cabinaSlug: string | null
): AjusteCabina[] {
  const horario = agenda.horarios.find((h) => h.dia_semana === diaSemana(fecha));
  if (!horario || horario.cerrado || !horario.abre || !horario.cierra) return [];

  const abre = aMinutos(horario.abre);
  const cierra = aMinutos(horario.cierra);
  const fin = inicio + tratamiento.duracionMin;
  const finConBuffer = fin + tratamiento.bufferMin;

  if (inicio < abre || fin > cierra) return [];

  const viables: AjusteCabina[] = [];

  for (const cab of agenda.cabinas) {
    if (!cab.activa) continue;
    if (cabinaSlug && cab.slug !== cabinaSlug) continue;

    const franjas = franjasTomadas(agenda, cab.slug, fecha);
    if (franjas.some((f) => seTraslapan(inicio, finConBuffer, f.ini, f.fin))) continue;

    // Vecinos inmediatos, para medir el sobrante de los dos lados.
    let finAnterior = abre;
    let inicioSiguiente = cierra;
    for (const f of franjas) {
      if (f.fin <= inicio) finAnterior = Math.max(finAnterior, f.fin);
      if (f.ini >= finConBuffer) {
        inicioSiguiente = Math.min(inicioSiguiente, f.ini);
        break;
      }
    }

    const sobraAntes = Math.max(0, inicio - finAnterior);
    const sobraDespues = Math.max(0, inicioSiguiente - finConBuffer);

    // Un sobrante mayor a cero pero por debajo del bloque vendible más chico
    // es tiempo que nadie va a comprar.
    const muertosAntes = sobraAntes > 0 && sobraAntes < MINIMO_VENDIBLE ? sobraAntes : 0;
    const muertosDespues =
      sobraDespues > 0 && sobraDespues < MINIMO_VENDIBLE ? sobraDespues : 0;

    viables.push({
      slug: cab.slug,
      nombre: cab.nombre,
      sobra: sobraAntes + sobraDespues,
      muertos: muertosAntes + muertosDespues,
    });
  }

  /* PUNTO 3, mejor ajuste. Primero la que deja menos tiempo muerto, después la
     que deja menos sobrante en total, y al final el orden de la cabina para
     que el resultado sea estable. Tomar "la primera libre" es lo que rompe la
     ocupación: mete la cita en una cabina vacía y parte el día en dos. */
  return viables.sort(
    (a, b) => a.muertos - b.muertos || a.sobra - b.sobra || 0
  );
}

export type Hueco = {
  hora: string;
  minutos: number;
  /* Cuántas cabinas pueden tomarlo. Cero = ocupado. */
  libres: number;
  /* La de mejor ajuste, o null si no hay ninguna. */
  cabinaSugerida: string | null;
  /* Si la mejor opción dejaría tiempo invendible, y cuánto. */
  dejaHueco: boolean;
  minutosMuertos: number;
  /* Si esta hora salió de anclar al final de una cita, no de la rejilla. Sirve
     para enseñarla como "justo cuando queda libre". */
  anclado: boolean;
};

/* PUNTO 1. Todas las horas de un día para un tratamiento y una cabina, libres
   y ocupadas por igual.

   Los candidatos son la rejilla MÁS el minuto exacto en que cada cabina queda
   libre. Ese segundo conjunto es el que elimina el hueco muerto: sin él, un
   masaje que termina 12:15 solo podría continuar a las 12:30.

   Las horas ocupadas se devuelven a propósito: la página las pinta tachadas en
   vez de esconderlas. Una lista con tres horas sueltas no dice si el spa abre
   poco o está lleno; la rejilla completa con la mitad tachada sí. */
export function huecosDelDia(
  agenda: Agenda,
  fecha: string,
  tratamiento: { duracionMin: number; bufferMin: number },
  cabinaSlug: string | null
): Hueco[] {
  const horario = agenda.horarios.find((h) => h.dia_semana === diaSemana(fecha));
  if (!horario || horario.cerrado || !horario.abre || !horario.cierra) return [];

  const abre = aMinutos(horario.abre);
  const cierra = aMinutos(horario.cierra);
  const ahora = ahoraEnCasa();
  const esHoy = fecha === ahora.fecha;
  const minimoHoy = ahora.minutos + reserva.margenMinutos;

  /* Candidatos de la rejilla. */
  const rejilla = new Set<number>();
  for (let t = abre; t + tratamiento.duracionMin <= cierra; t += PASO_MINUTOS) {
    rejilla.add(t);
  }

  /* Candidatos anclados: el minuto en que cada cabina queda libre. Se miran
     todas las cabinas relevantes, no solo la elegida, porque cada una puede
     liberarse a una hora distinta. */
  const anclados = new Set<number>();
  for (const cab of agenda.cabinas) {
    if (!cab.activa) continue;
    if (cabinaSlug && cab.slug !== cabinaSlug) continue;
    for (const f of franjasTomadas(agenda, cab.slug, fecha)) {
      if (f.fin > abre && f.fin + tratamiento.duracionMin <= cierra) anclados.add(f.fin);
    }
  }

  const candidatos = [...new Set([...rejilla, ...anclados])].sort((a, b) => a - b);

  const huecos: Hueco[] = [];

  for (const inicio of candidatos) {
    if (esHoy && inicio < minimoHoy) continue;

    const opciones = cabinasParaHora(agenda, fecha, inicio, tratamiento, cabinaSlug);
    const mejor = opciones[0] ?? null;

    huecos.push({
      hora: aHora(inicio),
      minutos: inicio,
      libres: opciones.length,
      cabinaSugerida: mejor?.slug ?? null,
      dejaHueco: mejor ? mejor.muertos > 0 : false,
      minutosMuertos: mejor?.muertos ?? 0,
      anclado: anclados.has(inicio) && !rejilla.has(inicio),
    });
  }

  return huecos;
}

/* Si a un día le queda al menos una hora libre. Lo usa el calendario para
   apagar los días llenos en vez de dejar que se descubran tocándolos. */
export function diaTieneHuecos(
  agenda: Agenda,
  fecha: string,
  tratamiento: { duracionMin: number; bufferMin: number },
  cabinaSlug: string | null
): boolean {
  return huecosDelDia(agenda, fecha, tratamiento, cabinaSlug).some((h) => h.libres > 0);
}

/* Cuántos minutos de cabina quedarían sin vender ese día con las citas que ya
   hay. Es el número que el panel enseña al spa: no es una estimación, sale de
   sumar los sobrantes reales por debajo del bloque vendible más chico. */
export function tiempoMuertoDelDia(agenda: Agenda, fecha: string): number {
  const horario = agenda.horarios.find((h) => h.dia_semana === diaSemana(fecha));
  if (!horario || horario.cerrado || !horario.abre || !horario.cierra) return 0;

  const abre = aMinutos(horario.abre);
  const cierra = aMinutos(horario.cierra);
  let muertos = 0;

  for (const cab of agenda.cabinas) {
    if (!cab.activa) continue;
    const franjas = franjasTomadas(agenda, cab.slug, fecha).filter(
      (f) => f.fin > abre && f.ini < cierra
    );
    if (franjas.length === 0) continue;

    let cursor = abre;
    for (const f of franjas) {
      const hueco = f.ini - cursor;
      if (hueco > 0 && hueco < MINIMO_VENDIBLE) muertos += hueco;
      cursor = Math.max(cursor, f.fin);
    }
    // El resto del día después de la última cita no cuenta como muerto: es
    // tiempo sin vender todavía, no tiempo imposible de vender.
  }

  return muertos;
}

/* --------------------------------------------------------------------------
   Modo demo: las citas viven en este navegador
   -------------------------------------------------------------------------- */

function leerDemo(): Cita[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const crudo = localStorage.getItem(CLAVE_DEMO);
    return crudo ? (JSON.parse(crudo) as Cita[]) : [];
  } catch {
    return [];
  }
}

function escribirDemo(citas: Cita[]): boolean {
  try {
    localStorage.setItem(CLAVE_DEMO, JSON.stringify(citas));
    return true;
  } catch {
    return false;
  }
}

function folioDemo(id: string): string {
  return `CV-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/* Réplica de `liberar_vencidas()`. Si el demo no soltara los apartados
   vencidos, enseñaría cabinas bloqueadas para siempre por alguien que nunca
   transfirió. */
function liberarVencidasDemo(): void {
  const ahora = Date.now();
  const citas = leerDemo();
  let cambio = false;

  const siguientes = citas.map((c) => {
    const vencida =
      c.estado === 'pendiente' &&
      (c.pago_estado === 'esperando' || c.pago_estado === 'rechazado') &&
      c.vence_en !== null &&
      Date.parse(c.vence_en) < ahora;

    if (!vencida) return c;
    cambio = true;
    return { ...c, estado: 'cancelada' as EstadoCita, pago_nota: c.pago_nota ?? NOTA_LIBERADA };
  });

  if (cambio) escribirDemo(siguientes);
}

/* --------------------------------------------------------------------------
   Interfaz pública
   -------------------------------------------------------------------------- */

export async function cargarAgenda(desde: string, hasta: string): Promise<Agenda> {
  const sb = obtenerSupabase();

  if (!sb) {
    liberarVencidasDemo();
    const citas = leerDemo().filter(
      (c) => c.estado !== 'cancelada' && c.fecha >= desde && c.fecha <= hasta
    );
    return {
      horarios: HORARIOS_DEMO,
      cabinas: CABINAS_DEMO,
      bloqueos: [],
      ocupados: citas.map((c) => ({
        cabina_slug: c.cabina_slug,
        fecha: c.fecha,
        hora: c.hora,
        duracion_min: c.duracion_min,
        buffer_min: c.buffer_min,
      })),
    };
  }

  const [horarios, cabs, bloqueos, ocupados] = await Promise.all([
    sb.from('horarios').select('dia_semana, abre, cierra, cerrado'),
    sb.from('cabinas').select('slug, nombre, activa, orden').order('orden'),
    sb
      .from('bloqueos')
      .select('cabina_slug, fecha, hora_inicio, hora_fin')
      .gte('fecha', desde)
      .lte('fecha', hasta),
    sb.rpc('disponibilidad', { p_desde: desde, p_hasta: hasta }),
  ]);

  const fallo = horarios.error ?? cabs.error ?? bloqueos.error ?? ocupados.error;
  if (fallo) throw new Error(fallo.message);

  return {
    horarios: (horarios.data ?? []) as DiaHorario[],
    cabinas: (cabs.data ?? []) as CabinaAgenda[],
    bloqueos: (bloqueos.data ?? []) as Bloqueo[],
    ocupados: (ocupados.data ?? []) as Ocupado[],
  };
}

const MENSAJES: Record<string, string> = {
  NOMBRE_INVALIDO: 'Revisa el nombre: hacen falta al menos tres letras.',
  TELEFONO_INVALIDO: 'Revisa el teléfono: tienen que ser diez dígitos.',
  CORREO_INVALIDO: 'Revisa el correo, algo no cuadra.',
  TRATAMIENTO_INVALIDO: 'Ese tratamiento ya no está disponible. Vuelve a elegirlo.',
  FUERA_DE_PLAZO: 'Esa hora ya pasó o queda demasiado lejos. Elige otra.',
  DIA_CERRADO: 'Ese día la casa no abre.',
  FUERA_DE_HORARIO: 'A esa hora ya estamos cerrando. Elige una más temprano.',
  HORA_OCUPADA: 'Alguien apartó esa cabina hace un momento. Elige otra hora, por favor.',
  DEMASIADAS_CITAS:
    'Ya tienes tres citas apartadas con este teléfono. Cancela alguna o llámanos y te ayudamos.',
};

const MENSAJES_PAGO: Record<string, string> = {
  CITA_NO_ENCONTRADA:
    'No encontramos esa cita. Revisa que el folio y el teléfono sean los de tu reserva.',
  PAGO_NO_APLICA: 'Esa cita ya no está esperando el anticipo. Si crees que es un error, llámanos.',
  RUTA_INVALIDA: 'No pudimos guardar el archivo. Vuelve a intentarlo.',
  ARCHIVO_GRANDE: `El archivo pesa más de ${pago.pesoMaximoMb} MB. Manda una captura más ligera.`,
  ARCHIVO_INVALIDO: 'Sube una imagen (JPG, PNG, WEBP o HEIC) o un PDF.',
  SUBIDA_FALLIDA: 'No pudimos subir el comprobante. Revisa tu conexión y vuelve a intentarlo.',
};

/* Tiene que coincidir con `c_tope_por_telefono` de supabase/schema.sql. */
export const TOPE_POR_TELEFONO = 3;

export class ErrorReserva extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
    this.name = 'ErrorReserva';
  }
}

function traducirError(bruto: string): ErrorReserva {
  const codigo = Object.keys(MENSAJES).find((c) => bruto.includes(c));
  if (codigo) return new ErrorReserva(codigo, MENSAJES[codigo]);
  return new ErrorReserva(
    'DESCONOCIDO',
    'No pudimos guardar la cita. Vuelve a intentarlo en un momento.'
  );
}

function traducirErrorPago(bruto: string): ErrorReserva {
  const codigo = Object.keys(MENSAJES_PAGO).find((c) => bruto.includes(c));
  if (codigo) return new ErrorReserva(codigo, MENSAJES_PAGO[codigo]);
  return new ErrorReserva('DESCONOCIDO', MENSAJES_PAGO.SUBIDA_FALLIDA);
}

export async function reservar(solicitud: SolicitudReserva): Promise<ReservaHecha> {
  const sb = obtenerSupabase();

  if (!sb) return reservarDemo(solicitud);

  const { data, error } = await sb.rpc('reservar_cita', {
    p_nombre: solicitud.nombre,
    p_telefono: solicitud.telefono,
    p_correo: solicitud.correo ?? null,
    p_tratamiento_slug: solicitud.tratamientoSlug,
    p_cabina_slug: solicitud.cabinaSlug,
    p_fecha: solicitud.fecha,
    p_hora: solicitud.hora,
    p_notas: solicitud.notas ?? null,
  });

  if (error) throw traducirError(error.message);

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) throw traducirError('DESCONOCIDO');

  return {
    id: fila.id,
    folio: fila.folio,
    cabinaSlug: fila.cabina_slug,
    cabinaNombre: fila.cabina_nombre,
    tratamientoNombre: fila.tratamiento_nombre,
    precio: fila.precio,
    duracionMin: fila.duracion_min,
    anticipo: fila.anticipo,
    pagoEstado: fila.pago_estado as EstadoPago,
    venceEn: fila.vence_en,
  };
}

/* El modo demo repite las mismas reglas que el servidor, incluido el mejor
   ajuste al elegir cabina. Si eligiera la primera libre, la demo enseñaría una
   ocupación peor que la del sistema real. */
async function reservarDemo(solicitud: SolicitudReserva): Promise<ReservaHecha> {
  liberarVencidasDemo();

  const trat = tratamientoPorSlug(solicitud.tratamientoSlug);
  if (!trat) throw new ErrorReserva('TRATAMIENTO_INVALIDO', MENSAJES.TRATAMIENTO_INVALIDO);

  const agenda = await cargarAgenda(solicitud.fecha, solicitud.fecha);
  const inicio = aMinutos(solicitud.hora);

  const horario = agenda.horarios.find((h) => h.dia_semana === diaSemana(solicitud.fecha));
  if (!horario || horario.cerrado || !horario.abre || !horario.cierra) {
    throw new ErrorReserva('DIA_CERRADO', MENSAJES.DIA_CERRADO);
  }
  if (inicio < aMinutos(horario.abre) || inicio + trat.duracionMin > aMinutos(horario.cierra)) {
    throw new ErrorReserva('FUERA_DE_HORARIO', MENSAJES.FUERA_DE_HORARIO);
  }

  const ahora = ahoraEnCasa();
  if (
    solicitud.fecha < ahora.fecha ||
    (solicitud.fecha === ahora.fecha && inicio < ahora.minutos + 30)
  ) {
    throw new ErrorReserva('FUERA_DE_PLAZO', MENSAJES.FUERA_DE_PLAZO);
  }

  const digitos = solicitud.telefono.replace(/\D/g, '');
  const activas = leerDemo().filter(
    (c) =>
      c.cliente_telefono.replace(/\D/g, '') === digitos &&
      (c.estado === 'pendiente' || c.estado === 'confirmada') &&
      (c.fecha > ahora.fecha || (c.fecha === ahora.fecha && aMinutos(c.hora) >= ahora.minutos))
  );
  if (activas.length >= TOPE_POR_TELEFONO) {
    throw new ErrorReserva('DEMASIADAS_CITAS', MENSAJES.DEMASIADAS_CITAS);
  }

  const opciones = cabinasParaHora(agenda, solicitud.fecha, inicio, trat, solicitud.cabinaSlug);
  if (opciones.length === 0) throw new ErrorReserva('HORA_OCUPADA', MENSAJES.HORA_OCUPADA);

  const elegida = opciones[0];
  const id = crypto.randomUUID();

  const pagoEstado: EstadoPago = trat.anticipo > 0 ? 'esperando' : 'no_requiere';
  let venceEn: string | null = null;
  if (trat.anticipo > 0) {
    const limite = Date.now() + pago.plazoHoras * 3600_000;
    const arranque = instanteUtc(solicitud.fecha, solicitud.hora).getTime();
    venceEn = new Date(Math.min(limite, arranque)).toISOString();
  }

  const cita: Cita = {
    id,
    folio: folioDemo(id),
    creada_en: new Date().toISOString(),
    cliente_nombre: solicitud.nombre.trim(),
    cliente_telefono: solicitud.telefono.trim(),
    cliente_correo: solicitud.correo?.trim() || null,
    tratamiento_slug: trat.slug,
    tratamiento_nombre: trat.nombre,
    precio: trat.precio,
    duracion_min: trat.duracionMin,
    buffer_min: trat.bufferMin,
    cabina_slug: elegida.slug,
    cabina_nombre: elegida.nombre,
    fecha: solicitud.fecha,
    hora: solicitud.hora,
    notas: solicitud.notas?.trim() || null,
    estado: 'pendiente',
    anticipo: trat.anticipo,
    pago_estado: pagoEstado,
    pago_comprobante: null,
    pago_subido_en: null,
    pago_resuelto_en: null,
    pago_nota: null,
    vence_en: venceEn,
  };

  escribirDemo([...leerDemo(), cita]);

  return {
    id: cita.id,
    folio: cita.folio,
    cabinaSlug: elegida.slug,
    cabinaNombre: elegida.nombre,
    tratamientoNombre: trat.nombre,
    precio: trat.precio,
    duracionMin: trat.duracionMin,
    anticipo: trat.anticipo,
    pagoEstado,
    venceEn,
  };
}

/* --------------------------------------------------------------------------
   Comprobante del anticipo
   -------------------------------------------------------------------------- */

/* Por debajo de esto el modo demo guarda la imagen completa en localStorage
   para poder enseñarla en el panel. Por encima solo el nombre: una foto de 4 MB
   en base64 revienta la cuota y se perdería la cita entera. */
const TOPE_DEMO_BYTES = 400 * 1024;

function extensionDe(archivo: File): string {
  const delNombre = archivo.name.includes('.') ? archivo.name.split('.').pop() : null;
  if (delNombre && /^[a-zA-Z0-9]{1,5}$/.test(delNombre)) return delNombre.toLowerCase();
  const delTipo = archivo.type.split('/')[1];
  return delTipo && /^[a-zA-Z0-9]{1,5}$/.test(delTipo) ? delTipo.toLowerCase() : 'bin';
}

function validarArchivo(archivo: File): void {
  if (archivo.size > pago.pesoMaximoMb * 1024 * 1024) {
    throw new ErrorReserva('ARCHIVO_GRANDE', MENSAJES_PAGO.ARCHIVO_GRANDE);
  }
  // El tipo puede venir vacío en algunos navegadores móviles; ahí se deja pasar
  // y que decida el bucket, en vez de rechazar una captura buena.
  if (archivo.type && !(pago.formatos as readonly string[]).includes(archivo.type)) {
    throw new ErrorReserva('ARCHIVO_INVALIDO', MENSAJES_PAGO.ARCHIVO_INVALIDO);
  }
}

function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('lectura'));
    lector.readAsDataURL(archivo);
  });
}

/* Sube la captura de la transferencia y la engancha a la cita.

   Van dos pasos porque son dos sistemas: el archivo entra al bucket y después
   `registrar_comprobante` lo apunta en la cita. El orden importa: si se
   registrara primero, una subida fallida dejaría la cita apuntando a un
   archivo que no existe. */
export async function subirComprobante(datos: {
  folio: string;
  telefono: string;
  archivo: File;
}): Promise<EstadoPago> {
  validarArchivo(datos.archivo);

  const sb = obtenerSupabase();

  if (!sb) {
    liberarVencidasDemo();
    const citas = leerDemo();
    const cita = citas.find(
      (c) =>
        c.folio === datos.folio.trim().toUpperCase() &&
        c.cliente_telefono.replace(/\D/g, '') === datos.telefono.replace(/\D/g, '')
    );

    if (!cita) throw new ErrorReserva('CITA_NO_ENCONTRADA', MENSAJES_PAGO.CITA_NO_ENCONTRADA);
    if (cita.estado !== 'pendiente' || !['esperando', 'rechazado'].includes(cita.pago_estado)) {
      throw new ErrorReserva('PAGO_NO_APLICA', MENSAJES_PAGO.PAGO_NO_APLICA);
    }

    let guardado = `demo:${datos.archivo.name}`;
    if (datos.archivo.size <= TOPE_DEMO_BYTES) {
      try {
        guardado = await leerComoDataUrl(datos.archivo);
      } catch {
        /* Si no se puede leer, queda el nombre: la demo sigue de pie. */
      }
    }

    const siguientes = citas.map((c) =>
      c.id === cita.id
        ? {
            ...c,
            pago_comprobante: guardado,
            pago_subido_en: new Date().toISOString(),
            pago_estado: 'en_revision' as EstadoPago,
            pago_nota: null,
            vence_en: null,
          }
        : c
    );

    if (!escribirDemo(siguientes)) {
      const sinImagen = siguientes.map((c) =>
        c.id === cita.id ? { ...c, pago_comprobante: `demo:${datos.archivo.name}` } : c
      );
      if (!escribirDemo(sinImagen)) {
        throw new ErrorReserva('SUBIDA_FALLIDA', MENSAJES_PAGO.SUBIDA_FALLIDA);
      }
    }

    return 'en_revision';
  }

  // Ruta con UUID propio: nadie puede sobrescribir el comprobante de otra
  // persona, ni siquiera adivinando el folio.
  const ruta = `${datos.folio.trim().toUpperCase()}/${crypto.randomUUID()}.${extensionDe(datos.archivo)}`;

  const subida = await sb.storage.from(BUCKET_COMPROBANTES).upload(ruta, datos.archivo, {
    contentType: datos.archivo.type || undefined,
    upsert: false,
  });

  if (subida.error) throw new ErrorReserva('SUBIDA_FALLIDA', MENSAJES_PAGO.SUBIDA_FALLIDA);

  const { data, error } = await sb.rpc('registrar_comprobante', {
    p_folio: datos.folio,
    p_telefono: datos.telefono,
    p_ruta: ruta,
  });

  if (error) {
    // El archivo ya no le sirve a nadie y dejarlo suelto solo acumula basura.
    await sb.storage.from(BUCKET_COMPROBANTES).remove([ruta]);
    throw traducirErrorPago(error.message);
  }

  return (data as EstadoPago) ?? 'en_revision';
}

/* URL para que el panel vea un comprobante. El bucket es privado, así que en
   el modo real hace falta una URL firmada; cinco minutos alcanzan para mirarla
   y decidir, y no deja un enlace vivo circulando. */
export async function urlComprobante(ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  if (ruta.startsWith('data:')) return ruta;
  if (ruta.startsWith('demo:')) return null;

  const sb = obtenerSupabase();
  if (!sb) return null;

  const { data, error } = await sb.storage.from(BUCKET_COMPROBANTES).createSignedUrl(ruta, 300);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function nombreComprobante(ruta: string | null): string | null {
  if (!ruta) return null;
  if (ruta.startsWith('demo:')) return ruta.slice(5);
  if (ruta.startsWith('data:')) return 'Comprobante subido';
  return ruta.split('/').pop() ?? ruta;
}

/* La casa da por bueno o rechaza el anticipo. Aprobar mueve la cita a
   confirmada; rechazar le abre otro plazo. Las dos cosas pasan dentro de
   `resolver_pago` para que el estado del pago y el de la cita no queden en
   desacuerdo. */
export async function verificarPago(
  id: string,
  aprobado: boolean,
  nota?: string | null
): Promise<void> {
  const sb = obtenerSupabase();

  if (!sb) {
    const citas = leerDemo();
    const siguientes = citas.map((c) => {
      if (c.id !== id) return c;
      if (aprobado) {
        return {
          ...c,
          pago_estado: 'verificado' as EstadoPago,
          pago_resuelto_en: new Date().toISOString(),
          pago_nota: nota?.trim() || null,
          vence_en: null,
          estado: 'confirmada' as EstadoCita,
        };
      }
      const limite = Date.now() + pago.plazoHoras * 3600_000;
      const arranque = instanteUtc(c.fecha, c.hora).getTime();
      return {
        ...c,
        pago_estado: 'rechazado' as EstadoPago,
        pago_resuelto_en: new Date().toISOString(),
        pago_nota: nota?.trim() || 'No pudimos identificar la transferencia.',
        estado: 'pendiente' as EstadoCita,
        vence_en: new Date(Math.min(limite, arranque)).toISOString(),
      };
    });
    escribirDemo(siguientes);
    return;
  }

  const { error } = await sb.rpc('resolver_pago', {
    p_id: id,
    p_aprobado: aprobado,
    p_nota: nota ?? null,
  });

  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------------------
   Panel de la casa
   -------------------------------------------------------------------------- */

export async function listarCitas(desde: string, hasta: string): Promise<Cita[]> {
  const sb = obtenerSupabase();

  if (!sb) {
    liberarVencidasDemo();
    return leerDemo()
      .filter((c) => c.fecha >= desde && c.fecha <= hasta)
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }

  // Antes de leer se sueltan los apartados vencidos, para que el panel no
  // muestre como vivo un hueco que el calendario público ya está ofreciendo.
  await sb.rpc('liberar_vencidas').then(
    () => undefined,
    () => undefined
  );

  const { data, error } = await sb
    .from('citas')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Cita[];
}

export async function cambiarEstado(id: string, estado: EstadoCita): Promise<void> {
  const sb = obtenerSupabase();

  if (!sb) {
    escribirDemo(leerDemo().map((c) => (c.id === id ? { ...c, estado } : c)));
    return;
  }

  const { error } = await sb.from('citas').update({ estado }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* Contraseña del panel en modo demo. Solo sirve cuando NO hay Supabase: en
   cuanto existen credenciales, la única forma de entrar es con un usuario real
   de Supabase Auth. Está a la vista a propósito, porque en modo demo no hay
   nada que proteger: las citas viven en este navegador. */
export const CLAVE_DEMO_PANEL = 'vapor2019';
const SESION_DEMO = 'casa-vapor:panel-demo';

export type Sesion = { correo: string } | null;

export async function sesionActual(): Promise<Sesion> {
  const sb = obtenerSupabase();

  if (!sb) {
    const activa = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESION_DEMO);
    return activa ? { correo: 'demo@casavapor.mx' } : null;
  }

  const { data } = await sb.auth.getSession();
  const correo = data.session?.user?.email;
  return correo ? { correo } : null;
}

export async function entrar(correo: string, clave: string): Promise<void> {
  const sb = obtenerSupabase();

  if (!sb) {
    if (clave !== CLAVE_DEMO_PANEL) {
      throw new Error('Contraseña incorrecta. En modo demo es: ' + CLAVE_DEMO_PANEL);
    }
    sessionStorage.setItem(SESION_DEMO, '1');
    return;
  }

  const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw new Error('No pudimos entrar. Revisa el correo y la contraseña.');
}

export async function salir(): Promise<void> {
  const sb = obtenerSupabase();
  if (!sb) {
    sessionStorage.removeItem(SESION_DEMO);
    return;
  }
  await sb.auth.signOut();
}
