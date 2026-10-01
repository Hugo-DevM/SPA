/* ==========================================================================
   Cuánto tiempo muerto produce una rejilla fija, y cuánto este motor
   --------------------------------------------------------------------------
   Corre con: node scripts/tiempo-muerto.mjs

   Replica la lógica de src/lib/reservas.ts con los parámetros reales de
   src/data/spa.ts y compara tres estrategias sobre la misma secuencia de
   peticiones:

     A. Rejilla fija cada 30 min + primera cabina libre   (lo habitual)
     B. Rejilla fija + mejor ajuste                        (solo punto 3)
     C. Horarios anclados + buffer + mejor ajuste          (puntos 1, 2 y 3)

   El número que importa es el tiempo MUERTO: huecos entre citas por debajo del
   bloque vendible más chico. Ese tiempo no es "todavía sin vender": es
   imposible de vender.
   ========================================================================== */

const ABRE = 11 * 60; // 11:00
const CIERRA = 21 * 60; // 21:00
const PASO = 30; // reserva.pasoMinutos
const CABINAS = ['vapor', 'arcilla', 'piedra'];

/* Mismos números que src/data/spa.ts y que la tabla `tratamientos`. */
const TRATAMIENTOS = {
  'facial-express': { dur: 30, buf: 15 },
  'masaje-descontracturante': { dur: 60, buf: 15 },
  'facial-profundo': { dur: 75, buf: 15 },
  'masaje-cuatro-manos': { dur: 90, buf: 20 },
  'ritual-vapor-arcilla': { dur: 120, buf: 20 },
};

const MINIMO_VENDIBLE = Math.min(
  ...Object.values(TRATAMIENTOS).map((t) => t.dur + t.buf)
);

const hh = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const traslapan = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

function franjas(agenda, cabina) {
  return agenda.filter((c) => c.cabina === cabina).sort((a, b) => a.ini - b.ini);
}

/* Sobrantes a los lados de una colocación, en una cabina concreta. */
function sobras(agenda, cabina, inicio, finBuffer) {
  let finAnterior = ABRE;
  let inicioSiguiente = CIERRA;
  for (const f of franjas(agenda, cabina)) {
    if (f.fin <= inicio) finAnterior = Math.max(finAnterior, f.fin);
    if (f.ini >= finBuffer) {
      inicioSiguiente = Math.min(inicioSiguiente, f.ini);
      break;
    }
  }
  const antes = Math.max(0, inicio - finAnterior);
  const despues = Math.max(0, inicioSiguiente - finBuffer);
  const muertos =
    (antes > 0 && antes < MINIMO_VENDIBLE ? antes : 0) +
    (despues > 0 && despues < MINIMO_VENDIBLE ? despues : 0);
  return { antes, despues, sobra: antes + despues, muertos };
}

function cabinasLibres(agenda, inicio, trat, conBuffer) {
  const fin = inicio + trat.dur;
  const finBloqueo = conBuffer ? fin + trat.buf : fin;
  if (inicio < ABRE || fin > CIERRA) return [];

  return CABINAS.filter(
    (cab) => !franjas(agenda, cab).some((f) => traslapan(inicio, finBloqueo, f.ini, f.fin))
  ).map((cab) => ({ cab, ...sobras(agenda, cab, inicio, finBloqueo) }));
}

function candidatos(agenda, trat, anclar, conBuffer) {
  const lista = new Set();
  for (let t = ABRE; t + trat.dur <= CIERRA; t += PASO) lista.add(t);
  if (anclar) {
    for (const cab of CABINAS) {
      for (const f of franjas(agenda, cab)) {
        if (f.fin > ABRE && f.fin + trat.dur <= CIERRA) lista.add(f.fin);
      }
    }
  }
  return [...lista].sort((a, b) => a - b);
}

function colocar(agenda, slug, { anclar, mejorAjuste, conBuffer }) {
  const trat = TRATAMIENTOS[slug];
  for (const inicio of candidatos(agenda, trat, anclar, conBuffer)) {
    const libres = cabinasLibres(agenda, inicio, trat, conBuffer);
    if (libres.length === 0) continue;

    const elegida = mejorAjuste
      ? [...libres].sort(
          (a, b) =>
            a.muertos - b.muertos ||
            a.sobra - b.sobra ||
            CABINAS.indexOf(a.cab) - CABINAS.indexOf(b.cab)
        )[0]
      : libres.sort((a, b) => CABINAS.indexOf(a.cab) - CABINAS.indexOf(b.cab))[0];

    const fin = inicio + trat.dur;
    agenda.push({
      cabina: elegida.cab,
      ini: inicio,
      fin: conBuffer ? fin + trat.buf : fin,
      finReal: fin,
      slug,
    });
    return true;
  }
  return false;
}

function medir(agenda) {
  let muertos = 0;
  let vendidos = 0;
  const detalle = [];

  for (const cab of CABINAS) {
    const fs = franjas(agenda, cab);
    if (fs.length === 0) continue;
    let cursor = ABRE;
    for (const f of fs) {
      const hueco = f.ini - cursor;
      if (hueco > 0 && hueco < MINIMO_VENDIBLE) {
        muertos += hueco;
        detalle.push(`${cab} ${hh(cursor)}-${hh(f.ini)} (${hueco}m)`);
      }
      vendidos += f.finReal - f.ini;
      cursor = Math.max(cursor, f.fin);
    }
  }

  return { muertos, vendidos, detalle };
}

/* Secuencia realista: la gente pide de todo, en el orden en que llega.
   Se repite para simular un día más o menos lleno. `DEMANDA=24 node ...` sube
   la presión; con la demanda baja el motor recupera tiempo muerto, con la
   demanda alta ese tiempo recuperado se convierte en citas de más. */
const BASE = [
  'masaje-descontracturante',
  'ritual-vapor-arcilla',
  'facial-profundo',
  'masaje-descontracturante',
  'facial-express',
  'masaje-cuatro-manos',
  'facial-profundo',
  'masaje-descontracturante',
  'facial-express',
  'ritual-vapor-arcilla',
  'facial-profundo',
  'masaje-cuatro-manos',
];

const DEMANDA = Number(process.env.DEMANDA ?? 12);
const PETICIONES = Array.from({ length: DEMANDA }, (_, i) => BASE[i % BASE.length]);

const ESTRATEGIAS = [
  {
    nombre: 'A. Rejilla fija + primera cabina libre (lo habitual)',
    opciones: { anclar: false, mejorAjuste: false, conBuffer: true },
  },
  {
    nombre: 'B. Rejilla fija + mejor ajuste (solo punto 3)',
    opciones: { anclar: false, mejorAjuste: true, conBuffer: true },
  },
  {
    nombre: 'C. Anclado + buffer + mejor ajuste (puntos 1, 2 y 3)',
    opciones: { anclar: true, mejorAjuste: true, conBuffer: true },
  },
];

const capacidad = (CIERRA - ABRE) * CABINAS.length;

console.log(`Jornada ${hh(ABRE)}-${hh(CIERRA)} · ${CABINAS.length} cabinas`);
console.log(`Capacidad total: ${capacidad} min de cabina`);
console.log(`Bloque vendible más chico: ${MINIMO_VENDIBLE} min (30 de tratamiento + 15 de limpieza)`);
console.log(`Un hueco por debajo de eso no lo puede comprar nadie.`);
console.log(`Peticiones simuladas: ${PETICIONES.length}\n`);

const filas = [];

for (const est of ESTRATEGIAS) {
  const agenda = [];
  let colocadas = 0;
  for (const slug of PETICIONES) {
    if (colocar(agenda, slug, est.opciones)) colocadas += 1;
  }
  const { muertos, vendidos, detalle } = medir(agenda);

  console.log('='.repeat(68));
  console.log(est.nombre);
  console.log('='.repeat(68));
  console.log(`Citas colocadas:   ${colocadas} de ${PETICIONES.length}`);
  console.log(`Minutos vendidos:  ${vendidos} de ${capacidad}  (${Math.round((vendidos / capacidad) * 100)}% de capacidad)`);
  console.log(`TIEMPO MUERTO:     ${muertos} min` + (detalle.length ? `  en ${detalle.length} huecos` : ''));
  if (detalle.length) console.log(`  ${detalle.join('  ')}`);
  console.log();

  filas.push({ nombre: est.nombre, colocadas, vendidos, muertos });
}

console.log('='.repeat(68));
console.log('RESUMEN');
console.log('='.repeat(68));
for (const f of filas) {
  console.log(
    `${f.nombre.slice(0, 3)} citas ${String(f.colocadas).padStart(2)}/${PETICIONES.length}  ` +
      `vendidos ${String(f.vendidos).padStart(3)} min  ` +
      `muerto ${String(f.muertos).padStart(3)} min`
  );
}

const peor = filas[0];
const mejor = filas[filas.length - 1];
console.log(
  `\nDe A a C: ${mejor.colocadas - peor.colocadas} cita(s) más, ` +
    `${mejor.vendidos - peor.vendidos} min más vendidos, ` +
    `${peor.muertos - mejor.muertos} min menos de tiempo muerto.`
);
