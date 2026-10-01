---
name: Casa Vapor
description: Papel cálido con tarjetas blandas, un acento terracota que se ve, serif en versalitas muy espaciadas y un héroe fotográfico con el texto encima.
designRead: "Landing de negocio local para un spa urbano, público que reserva tratamientos desde el celular, con lenguaje calmo y editorial, resuelto con Astro y CSS nativo sobre una paleta clara de hueso, blush y taupe."
modo: "Segundo rediseño sobre referencia visual aportada por el cliente. Se conserva la IA, el contenido, la firma tipográfica y toda la lógica de reservas; cambian el acento, las formas, el héroe y el ritmo de secciones."
dials:
  designVariance: 6
  motionIntensity: 3
  visualDensity: 5
colors:
  hueso: "#faf8f5"
  blanco: "#ffffff"
  blush: "#f9ece3"
  taupe: "#d8c7b6"
  tinta: "#1f1b18"
  tinta-2: "#514a44"
  tinta-3: "#6b6259"
  terracota: "#c2693a"
  terracota-honda: "#a85427"
  terracota-brasa: "#8f4319"
  alerta: "#a3352a"
  ok: "#2f6a4f"
typography:
  display:
    fontFamily: "Cormorant Garamond, ui-serif, Georgia, serif"
    fontSize: "clamp(1.75rem, 5.6vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "0.085em"
    transform: "uppercase"
  titulo:
    fontFamily: "Cormorant Garamond"
    fontSize: "clamp(1.7rem, 3.4vw, 2.7rem)"
    fontWeight: 400
    letterSpacing: "0.1em"
    transform: "uppercase"
  sobreTitulo:
    fontFamily: "Outfit"
    fontSize: "clamp(0.938rem, 1.2vw, 1.05rem)"
    fontWeight: 400
    transform: "none"
  cuerpo:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.938rem"
    lineHeight: 1.75
    maxWidth: "56ch"
  lomo:
    fontFamily: "Cormorant Garamond"
    fontSize: "clamp(1.3rem, 2.2vw, 1.9rem)"
    letterSpacing: "0.3em"
    transform: "uppercase"
    orientation: "vertical-rl, rotado 180deg"
rounded:
  superficie: "20px"
  interno: "12px"
  pastilla: "999px"
  arco: "50% 50% 20px 20px / 32% 32% 20px 20px"
spacing:
  ancho: "1200px"
  padX: "clamp(20px, 5vw, 56px)"
  padY: "clamp(68px, 8vw, 128px)"
  altoCabecera: "76px"
---

# Casa Vapor

## Overview

**Estrella polar: la mesa de tratamiento vista desde arriba.**

Lino, cerámica, aceite y hoja verde sobre una superficie clara. Todo el sitio
vive en una sola familia cálida: hueso, blanco, blush y taupe. **Ningún lienzo
es oscuro**, y eso es una regla, no una casualidad.

**La excepción y su límite.** El héroe es una fotografía a sangre con el texto
encima y un velo cálido que garantiza el contraste. Eso es una foto, no un
bloque de color, y pasa **una sola vez**. Una banda oscura en cualquier otro
sitio sigue leyéndose como un error de copiar y pegar.

La jerarquía se marca por **bloque de color**, no por peso tipográfico. Una
sección en blush pesa más que una en hueso; una en taupe pesa más que las dos.
Dentro de cada bloque, el display serif en versalitas muy espaciadas hace el
resto. La página avanza **cambiando de bloque**, no cambiando de layout.

Sobre esos bloques van **tarjetas blandas**. Son el recurso que sostiene la
densidad: sin ellas el contenido flotaba suelto sobre el crema y media página
se leía vacía.

## Sobre esta dirección

Este sistema viene de **dos rediseños sobre referencias que aportó el cliente**.

El primero fijó lo que sigue en pie: paleta cálida clara, display serif en caps
espaciadas, bloques de color, arcos y botones de pastilla.

El segundo ajustó lo que no funcionaba y trajo de la nueva referencia tres
cosas concretas: **el acento terracota**, que antes era un café desaturado que
no se notaba que existiera; **las tarjetas blandas**, que es lo que convierte
un catálogo en algo comparable; y **el héroe fotográfico**, que resolvió una
banda oscura que cruzaba la página sin pertenecer a nada.

Lo que **no** se trajo de esa referencia, porque este sitio no lo necesita: el
blog, la tienda de productos con carrito y el carrusel de testimonios. Casa
Vapor no publica artículos ni vende producto, y un carrusel escondería unos
testimonios que hoy se leen los tres de una vez.

La paleta cálida clara con serif de display es el reflejo por defecto en
cualquier brief de bienestar y normalmente hay que resistirlo. Aquí no es un
reflejo: es una dirección pedida dos veces y verificada contra referencias
concretas. Lo que sí se evita es la versión de catálogo del giro, que lleva
salvia, lavanda y dorado; esta no lleva ninguno de los tres.

La versión original del proyecto era oscura (pizarra fría y arcilla). Si alguna
vez hay que volver a ella, el historial de git la tiene.

## Colors

Estrategia: **cuatro lienzos, todos en la misma familia cálida y clara**.

| Token | Valor | Papel |
|---|---|---|
| `hueso` | `#faf8f5` | Suelo por defecto. El lienzo más usado. |
| `blanco` | `#ffffff` | Secciones que necesitan respirar y superficies elevadas. |
| `blush` | `#f9ece3` | Bloque de color. Marca la sección de reserva y la del anticipo. |
| `taupe` | `#d8c7b6` | El bloque más oscuro: la casa y el pie. |
| `tinta` | `#1f1b18` | Texto principal. |
| `tinta-2` | `#514a44` | Texto secundario. |
| `tinta-3` | `#6b6259` | Micro etiquetas y placeholders. |
| `terracota` | `#c2693a` | **Solo rellenos y trazos.** Discos de icono, fondos tenues. |
| `terracota-honda` | `#a85427` | Botón primario, texto de acento, precios. |
| `terracota-brasa` | `#8f4319` | Hover del botón y texto de acento sobre lienzo claro. |

### Por qué el acento son tres valores y no uno

Porque hacen trabajos distintos y **no necesitan el mismo contraste**. Un
relleno tiene que pasar 3:1; un texto, 4.5:1. Un único terracota que sirviera
para las dos cosas sería o demasiado apagado para el botón o demasiado oscuro
para el disco de un icono.

La regla práctica: **`terracota` nunca lleva letra encima ni es letra.** Sobre
hueso da 3.69, que pasa de sobra como elemento no textual y falla como texto.

### Contraste medido

| Par | Ratio | |
|---|---|---|
| `tinta` sobre `hueso` | 16.13 | AA |
| `tinta-2` sobre `hueso` | 8.21 | AA |
| `tinta-3` sobre `hueso` | 5.63 | AA |
| `terracota-honda` sobre `hueso` | 5.00 | AA |
| `terracota-brasa` sobre `hueso` | 6.64 | AA |
| `tinta` sobre `blanco` | 17.10 | AA |
| `tinta-3` sobre `blanco` | 5.97 | AA |
| `terracota-honda` sobre `blanco` | 5.30 | AA |
| `tinta` sobre `blush` | 14.77 | AA |
| `tinta-3` sobre `blush` | 5.16 | AA |
| `terracota-honda` sobre `blush` | 4.58 | AA |
| `tinta` sobre `taupe` | 10.39 | AA |
| `tinta-2` sobre `taupe` | 5.29 | AA |
| `hueso` sobre `terracota-honda` (botón) | 5.00 | AA |
| `hueso` sobre el velo del héroe (peor caso) | 7.63 | AA |
| `alerta` sobre `hueso` | 5.82 | AA |
| `ok` sobre `hueso` | 5.48 | AA |

El velo del héroe está medido **contra el peor caso posible**: una foto blanca
debajo. A `0.78` de opacidad el texto hueso queda en 7.63 aunque la imagen sea
la más clara imaginable. Importa porque esa foto se va a cambiar por la del spa
real y el velo tiene que aguantar la que venga.

### La restricción del taupe

**Sobre taupe solo entran `tinta` y `tinta-2`.** Medido: `tinta-3` da 3.63 y
`terracota-honda` da **3.22**, que falla AA.

Esto no se resuelve recordándolo en cada componente: la clase `.lienzo--taupe`
**reasigna los tokens**, de modo que `--ink-3` y `--acento-texto` apuntan a
colores que sí pasan. Un componente escribe `var(--ink-3)` y acierta en los
cuatro lienzos sin saber sobre cuál está.

La excepción: un **botón** terracota sobre taupe sí vale. Ahí el terracota es
el fondo, no la letra, y el borde del botón contra el lienzo da 3.22, que es lo
que pide un elemento no textual.

**Un solo acento.** El terracota marca la acción principal, el precio, la
insignia de anticipo, el enlace, el estado activo y el foco. Nunca decora. Si
un elemento en acento no dice "esto se puede pulsar", "esto cuesta" o "esto
está activo", es un error.

**Grises teñidos, nunca neutros.** Cada gris lleva el marrón de la tinta dentro.
No existe un `#888` en el proyecto.

## Typography

**Dos voces y ninguna más.**

- **Cormorant Garamond** (serif de alto contraste) para display y títulos de
  sección. **Siempre en versalitas y con tracking abierto** (0.085em a 0.1em).
  Es la firma del sistema.
- **Outfit** (sans geométrica) para absolutamente todo lo demás.

**La serif nunca aparece en texto corrido.** Una serif de alto contraste a 16px
se deshace: los remates finos desaparecen y se lee peor que una sans. Su sitio
son los títulos, el lomo, los montos grandes y los nombres de los testimonios.

De `h3` para abajo manda la sans: son etiquetas de cosas, no declaraciones.

La **entradilla** va sobre el título, en sans y minúsculas. Dos voces en
versalitas seguidas se anulan.

Ninguna de las otras tres páginas del taller usa estas familias (Archivo,
Fraunces, Plus Jakarta Sans).

## Layout

`DESIGN_VARIANCE: 6`. Composición editorial ordenada, no asimetría agresiva: el
carácter lo pone el color y la tipografía.

- Contenedor a `1200px` con `padding-inline` fluido.
- **Nueve secciones, nueve familias de composición. Ninguna se repite:**

  | | Sección | Familia |
  |---|---|---|
  | 1 | Hero | Foto a sangre con el texto encima, en diagonal |
  | 2 | Cifras | Franja de cuatro datos en panel blanco |
  | 3 | Tratamientos | Riel horizontal con scroll-snap |
  | 4 | Ventajas | Rejilla 2x2 de tarjetas con icono |
  | 5 | Reserva | Bloque de color con panel dentro |
  | 6 | Cabinas | Una grande en arco y dos apiladas |
  | 7 | Casa | Bloque partido con la foto al borde |
  | 8 | Testimonios | Tres columnas con regla, sin cajas |
  | 9 | Preguntas | Acordeón |

- **El orden de las dos nuevas no es relleno.** Cifras cose el héroe con el
  catálogo, que antes se tocaban en seco. Ventajas va **pegada a la reserva**
  porque el formulario pide nombre, teléfono y a veces una transferencia, y
  llegaba sin haber dado todavía un motivo para confiar.
- **Máximo dos secciones seguidas** con el patrón imagen más texto.
- **El panel de cifras es el único solape** de la página. Sube sobre el héroe
  para coser las dos secciones; repetir el recurso lo convertiría en un tic.
- El **lomo girado** aparece una sola vez, en la reserva. Repetirlo lo
  convertiría en decoración.
- El **arco** marca jerarquía, no se reparte: lo llevan las fotos del riel y la
  cabina principal. Si lo llevaran todas, dejaría de señalar cuál manda.
- **Colapso móvil explícito por sección.** Debajo de 860px todo va a una
  columna; el riel se queda horizontal, que es su gracia.
- La primera pantalla se mide contra el **alto** además del ancho: la banda del
  hero lleva `max-height: 56svh`, porque un bodegón de 1920×900 sin tope empuja
  los datos fuera de la vista en un portátil de 768px.

## Elevation & Depth

Tres elevaciones y ni una más:

1. **Lienzo** — el bloque de color. No se eleva: *es* el suelo de esa sección.
2. **Tarjeta** — superficie blanda sobre el lienzo, con `sombra-sm`. Es el
   recurso de densidad del sistema: tratamientos, ventajas y cifras.
3. **Panel** — tarjeta grande con `sombra-md`. El formulario de reserva y la
   franja de cifras, que son los dos sitios donde algo manda.

Las sombras van teñidas con la tinta y a opacidad muy baja: sobre crema, una
sombra marcada se ve sucia.

**Borde tenue y sombra tenue juntos, sí.** La versión anterior lo prohibía y
estaba equivocada para este fondo: sobre crema una sombra sola no despega la
tarjeta (son dos cremas), y un borde solo la deja plana. Lo que sigue
prohibido es que **cualquiera de los dos se note**. En cuanto se ve el borde,
ensucia.

El **grano** es lo que salva el sistema de verse digital: una capa fija de ruido
SVG al 32%, sin eventos de puntero. Un crema perfectamente plano se ve barato.

## Shapes

**Una sola escala, y tira hacia blando.**

- **Botones, chips e insignias**: pastilla completa.
- **Tarjetas y fotos**: 20px.
- **Controles dentro de una tarjeta**: 12px.
- **Imágenes destacadas**: el **arco**, media luna arriba y recto abajo.
- **Flechas, discos de icono y avatares**: círculo completo.

El sistema anterior iba casi recto (4px) y mezclaba eso con botones de pastilla
completa. Convive mal: cuadrado y redondo en la misma fila se lee como dos
sistemas pegados con cinta.

**Cuidado con el arco.** `.arco` vive en `global.css`, así que cualquier
`border-radius` declarado en el `<style>` de un componente le gana: Astro le
añade un atributo de ámbito y con él sube de peso. Pasó de verdad: la cabina
principal llevaba la clase desde el primer día y el arco no se vio nunca. Si
una foto tiene que llevar arco, **no declares `border-radius` para ella**.

## Components

**Botón primario.** Terracota honda con texto hueso, pastilla. Al pasar el
cursor sube 1px y vira a brasa; al presionar baja y escala a 0.985. Etiqueta de
máximo 3 palabras, nunca en dos líneas. Es **el único elemento de la página que
grita**, y por eso no puede haber dos compitiendo en la misma pantalla.

**Tarjeta.** Fondo de superficie, 20px, borde tenue y `sombra-sm`. La variante
`--alzable` sube 3px al pasar el cursor y solo se le pone a lo que se puede
pulsar. Sobre lienzo blanco la tarjeta usa `--sup-2`, no `--sup`: contra el
blanco, `--sup` es hueso y la diferencia es de un 1%, o sea que la tarjeta
existe y no se ve.

**Insignia.** Pastilla de dato suelto: duración, anticipo, estado. Dos tonos y
el tono significa algo. El tratamiento que **pide** anticipo lleva la insignia
en acento, porque es una condición; el que no lo pide la lleva neutra, porque
es la ausencia de una. Con las dos en acento el color deja de querer decir
nada.

**Monto.** Serif, figuras de caja alta y de ancho fijo (`.cifra-serif`).
Cormorant trae elzevirianas por defecto y `$1,100` se leía `$I,IOO`; las de
caja alta se fuerzan desde `body`, que es heredable y así alcanza también al
calendario y a los totales que viven dentro de `Reserva.astro`.

**Botón de contorno.** Transparente con borde, hereda el color del lienzo. Igual
de válido sobre los cuatro fondos.

**Flecha circular.** Círculo de contorno con una flecha dentro. Es el recurso de
avance de la referencia.

**Campo.** Línea inferior, no caja. Una caja con borde completo sobre crema se ve
como un formulario de banco. Etiqueta arriba en versalitas pequeñas, error
debajo. Nunca placeholder como etiqueta. Al enfocar, la línea engorda a 2px y
vira a acento, compensando el padding para que el campo no salte.

**Chip de hora.** Pastilla con tres estados visibles: disponible, elegido
(tinta sólida) y ocupado (tachado, no oculto). Las ocupadas se enseñan a
propósito: una lista con tres horas sueltas no dice si la casa abre poco o está
llena.

**Lomo.** Etiqueta girada al margen, como el lomo de un libro. Se esconde por
debajo de 1100px, donde no hay margen en el que vivir.

## Motion

`MOTION_INTENSITY: 3`. Más bajo que la versión anterior, a propósito: una página
de papel no se mueve mucho. Transiciones CSS y nada más.

Lo que se mueve, y por qué:

- **Revelado al entrar en viewport**: jerarquía. Con `IntersectionObserver`,
  nunca con un listener de scroll.
- **Hover y active de botones**: retroalimentación.
- **Zoom lento en las fotos al pasar el cursor**: señala que la tarjeta es
  pulsable.
- **Giro del botón al enviar**: espera.

No hay parallax, ni marquesina, ni loops infinitos.
`prefers-reduced-motion: reduce` colapsa todo a estático, y sin JavaScript el
contenido revelado queda visible.

## Do's and Don'ts

**Do**

- Cambia de bloque de color para marcar jerarquía, no de tamaño de letra.
- Deja que los tokens del lienzo trabajen: `var(--ink-3)` acierta en los cuatro.
- Usa la serif solo en display, títulos, lomo, montos y nombres.
- Pon la entradilla en sans y minúsculas sobre el título en versalitas.
- Reserva el arco para la imagen que manda en cada sección.
- Enseña las horas ocupadas tachadas en vez de esconderlas.
- Mantén el grano: es lo que separa esto de una plantilla.
- Mide la primera pantalla contra el alto con `svh`.
- Mide el velo del héroe contra una foto blanca, no contra la que hay hoy.
- Dale a cada insignia un tono que signifique algo.
- Dimensiona el titular del héroe contra su columna, no contra la escala
  global: a 4.5rem compartiendo renglón con la tarjeta se partía en siete.

**Don't**

- No metas un lienzo oscuro. Ni uno. El héroe es una foto velada y es la única
  excepción; una banda oscura en cualquier otro sitio se lee como un error de
  copiar y pegar.
- No pongas letra en `terracota`: da 3.69 y falla. Para texto, `terracota-honda`.
- No uses terracota como TEXTO sobre taupe: da 3.22 y falla AA. Un botón sí.
- No pongas la serif en texto corrido ni por debajo de 20px.
- No dejes la serif con figuras elzevirianas en un precio ni en una fecha.
- No uses salvia, lavanda ni dorado. Es la paleta de catálogo de todo el giro.
- No dejes que se note el borde ni la sombra de una tarjeta.
- No le declares `border-radius` a una foto que lleva `.arco`: se lo pisa.
- No repartas el arco entre todas las imágenes.
- No repitas el lomo girado: una vez por página.
- No repitas una familia de sección.
- No animes nada que provoque relayout: solo `transform` y `opacity`.
- No uses `window.addEventListener('scroll')`.
