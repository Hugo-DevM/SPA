# Casa Vapor

Landing de spa con **sistema de reservas que no deja tiempo muerto** y **anticipo
por transferencia (SPEI)**. Sitio estático en Astro, sin framework de interfaz;
la persistencia va contra Supabase desde el navegador.

> **Casa Vapor es una marca ficticia.** Nombres, precios, dirección, teléfonos,
> testimonios y **datos bancarios** son de muestra. Las imágenes son fotos de
> Unsplash de licencia libre y hay que reemplazarlas por las del local. Lee
> [Antes de publicar](#antes-de-publicar) antes de subir esto a un dominio real.

## Arrancar

```bash
npm install
npm run dev      # servidor local
npm run build    # genera dist/
npm run preview  # sirve dist/ para revisarlo
```

Requiere Node 22.12 o superior.

**Funciona sin configurar nada.** Sin credenciales de Supabase el sitio arranca
en *modo demo*: las citas se guardan en `localStorage` y solo existen en ese
navegador. Sirve para enseñar el flujo completo —reservar, ver el hueco
desaparecer, entrar al panel, verificar un anticipo— sin crear cuenta en ningún
lado.

---

## El problema que resuelve

Una agenda que ofrece horarios sobre una **rejilla fija** (cada 30 minutos desde
la apertura) **crea** tiempo muerto. Con tratamientos de duración variable, la
mayoría no termina en un múltiplo de la rejilla:

```
Masaje de 60 min + 15 de limpieza, empezando 11:00
  → la cabina queda libre 12:15
  → la rejilla ofrece 12:30
  → 15 minutos que nacen muertos

Y como el tratamiento más corto son 30 min + 15 de buffer = 45,
nadie puede comprar esos 15 minutos.
```

**Cuatro de los cinco tratamientos de Casa Vapor producen ese hueco.** Sobre una
jornada llena son unas dos horas de cabina perdidas al día.

### Medido, no estimado

Simulación de una jornada de 11:00 a 21:00, tres cabinas, con una secuencia
realista de tratamientos. Reproducible:

```bash
node scripts/tiempo-muerto.mjs            # día tranquilo, 12 peticiones
DEMANDA=24 node scripts/tiempo-muerto.mjs # día lleno
```

**Día tranquilo (12 peticiones, sobra capacidad):**

| | Rejilla fija | Con este motor |
| --- | --- | --- |
| Citas colocadas | 12 de 12 | 12 de 12 |
| Minutos vendidos | 885 de 1800 | 885 de 1800 |
| Tiempo muerto | 7 huecos = **95 min** | **0 min** |

**Día lleno (24 peticiones, la demanda satura):**

| | Rejilla fija | Con este motor |
| --- | --- | --- |
| Citas colocadas | 19 de 24 | **20 de 24** |
| Minutos vendidos | 1320 (73%) | **1455 (81%)** |
| Tiempo muerto | **155 min** | **0 min** |

### Qué dicen de verdad estos números

Dos cosas que conviene no exagerar al venderlo:

**Con capacidad de sobra, el motor no te da más citas: te quita tiempo muerto.**
El día tranquilo coloca las mismas 12 citas. Lo que cambia es que la agenda queda
en bloques limpios en vez de picada con siete huecos de 10 y 15 minutos. El
beneficio aparece cuando la demanda sube, y ahí sí se convierte en citas.

**El mejor ajuste por sí solo casi no mueve la aguja.** En la simulación, la
estrategia B (rejilla fija + mejor ajuste) da exactamente lo mismo que la A. El
trabajo lo hace el **anclado**: si los horarios siguen cayendo en una rejilla de
30 minutos, repartir mejor las cabinas no evita el hueco de 15 minutos, solo lo
mueve de cabina. El mejor ajuste paga cuando ya hay anclado.

---

## Las cuatro reglas del motor

### 1. Horarios anclados al final de la cita anterior

Además de la rejilla, se ofrece como hora de inicio **el minuto exacto en que la
cabina queda libre**: fin del tratamiento más su buffer. Esto es lo que elimina
el hueco de 15 minutos.

En la página esas horas llevan un punto y la leyenda "justo cuando queda libre la
cabina".

**Vive en el cliente** (`src/lib/reservas.ts`, `huecosDelDia`). Es presentación
de horarios: el servidor solo tiene que aceptar cualquier hora válida, no una
rejilla.

### 2. Buffer de limpieza

Cada tratamiento declara su tiempo de preparación de cabina (15 o 20 min). La
franja que **bloquea** es `[inicio, fin + buffer)`, no `[inicio, fin)`.

**Vive en la base de datos.** Es una columna generada más la restricción de
exclusión:

```sql
franja tsrange generated always as (
  tsrange((fecha + hora),
          (fecha + hora) + make_interval(mins => duracion_min + buffer_min),
          '[)')
) stored
```

Así el buffer deja de ser una buena intención del front y se vuelve imposible de
violar, incluso llamando a la API a mano.

El buffer **no** tiene que caber antes del cierre: limpiar después de la última
clienta pasa con la casa cerrada, y exigirlo mataría la última cita del día.

### 3. Mejor ajuste al elegir cabina

Cuando la clienta no pide cabina, el sistema **no toma la primera libre**: toma
la que deja menos tiempo invendible alrededor y, a igualdad, la que deja menos
sobrante en total.

Tomar la primera libre es lo que rompe la ocupación: mete la cita en una cabina
vacía, parte el día en dos y deja a las tres cabinas con huecos a la mitad en vez
de a una llena y otra libre para un ritual de dos horas.

**Vive en la base de datos** (`reservar_cita`), con réplica en el modo demo. Si
viviera solo en el cliente, una llamada directa repartiría mal las cabinas.

### 4. Aviso de horas que dejarían hueco invendible

Si una hora dejaría un espacio mayor a cero pero menor al bloque vendible más
chico, el motor lo marca y la página la manda a **"otros horarios"**, un acordeón
aparte.

**Se marca, no se bloquea.** Bloquearlas sería más eficiente en ocupación y peor
negocio: si solo se ofreciera la hora de apertura como primera cita del día, la
mitad de la gente se va a otro spa. La ocupación no se optimiza a costa de la
conversión.

### Dónde vive cada regla

| | Regla | Cliente | Base de datos |
| --- | --- | --- | --- |
| 1 | Horarios anclados | ✅ | |
| 2 | Buffer en la franja | | ✅ |
| 3 | Mejor ajuste | réplica demo | ✅ |
| 4 | Aviso de hueco muerto | ✅ | |

---

## Cómo funcionan las reservas

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Reserva de la clienta | `#reservar` en la portada | Tratamiento, cabina, día, hora y datos |
| Anticipo | pantalla de confirmación | Datos de transferencia y subida del comprobante |
| Agenda de la casa | `/panel` | Citas, anticipos y **tiempo muerto del día** |

### Cuándo se bloquea y cuándo se libera una cabina

| Estado de la cita | ¿Bloquea la cabina? |
| --- | --- |
| Sin confirmar (`pendiente`) | **Sí**, desde que se reserva |
| Sin confirmar, esperando anticipo | Sí, hasta que se agota el plazo |
| Confirmada | Sí |
| Atendida (`completada`) | Sí |
| Cancelada | **No**, la cabina vuelve a ofrecerse |

En todos los casos el bloqueo incluye el buffer de limpieza.

### Por qué no se puede reservar dos veces la misma cabina

Tres capas, de fuera hacia dentro:

1. **El calendario** no ofrece horas donde la cabina está tomada.
2. **`reservar_cita`** revalida todo en el servidor: horario, cierres, antelación
   mínima, tope por teléfono y que la cabina siga libre con buffer incluido.
3. **Una restricción de exclusión de PostgreSQL** (`citas_sin_traslape`) impide
   físicamente que dos citas de la misma cabina compartan un minuto. Se evalúa
   dentro de la transacción, así que gana incluso si dos personas confirman en el
   mismo instante. Cuando eso pasa, la función devuelve `HORA_OCUPADA` y el sitio
   recarga la agenda.

### Tope de citas por teléfono

Un mismo teléfono no puede tener más de **tres citas futuras vivas**. El tope
está en `reservar_cita`, no en el navegador. Para cambiarlo,
`c_tope_por_telefono` en el esquema y `TOPE_POR_TELEFONO` en
`src/lib/reservas.ts`, que es el que aplica el modo demo.

---

## Anticipo por transferencia (SPEI)

Tres de los cinco tratamientos piden anticipo: el facial profundo ($300 de
$1,100), el de cuatro manos ($500 de $1,750) y el ritual ($700 de $2,400). Los
cortos se pagan completos en la casa.

Se cobra por **transferencia, no con tarjeta**, y es una decisión: una pasarela
cobra comisión por cada cobro (≈3.6% + $3 MXN en México); con SPEI el anticipo
llega completo a la cuenta del negocio. Lo que sí cuesta es tiempo: alguien tiene
que mirar el comprobante y darle "verificar". Son unos segundos por cita.

**Nunca se piden datos de tarjeta.** El sitio no tiene forma de cobrar con
tarjeta y por lo tanto no entra en las obligaciones de PCI-DSS.

### Estados del pago

| `pago_estado` | Qué significa |
| --- | --- |
| `no_requiere` | Se paga completo en la casa |
| `esperando` | Falta la transferencia; el reloj corre |
| `en_revision` | Hay comprobante y la casa no lo ha visto |
| `verificado` | Dado por bueno; la cita queda confirmada |
| `rechazado` | No cuadró; la clienta puede mandar otro |

### El plazo

`liberar_vencidas()` cancela los apartados vencidos. Se llama desde
`reservar_cita` y desde el panel al refrescar, así que **no hace falta cron ni
servidor**. No alcanza con filtrarlos al leer: la restricción de exclusión solo
ignora las canceladas, así que hay que cancelarlos de verdad o el `INSERT`
seguiría chocando con un apartado que ya no vale.

El plazo son **3 horas** y nunca se pasa de la hora de la cita. Para cambiarlo,
`plazo_anticipo()` en el esquema **y** `pago.plazoHoras` en `src/data/spa.ts`.

### Los comprobantes

Bucket **privado** `comprobantes` en Supabase Storage:

- `anon` puede **subir pero no leer**. Si pudiera leer, cualquiera vería los
  comprobantes bancarios de las demás clientas.
- Tampoco puede sobrescribir: no hay política de `UPDATE` para `anon`, y cada
  archivo va a una ruta con UUID nuevo.
- El panel los abre con **URL firmada de 5 minutos**.
- Tope de 5 MB, solo imágenes o PDF, impuesto en el bucket además del navegador.

`registrar_comprobante` pide **folio y teléfono**: el folio va en la pantalla y se
manda por WhatsApp, así que por sí solo no basta para autorizar un cambio.

En modo demo no hay Storage: la captura se guarda como data URL en
`localStorage` si pesa menos de 400 KB; por encima solo el nombre, porque meter
una foto de 4 MB en base64 revienta la cuota y se perdería la cita entera.

---

## El precio no se le cree al navegador

La tabla **`tratamientos`** es la autoridad sobre precio, duración, buffer y
anticipo. Lo único que manda la clienta es **qué** tratamiento eligió; lo que
vuelve es lo que quedó guardado.

Sin esto, cualquiera abre la consola y reserva el ritual con un anticipo de un
peso.

---

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratuito
   sobra para un spa de tres cabinas).
2. Abre **SQL Editor**, pega entero `supabase/schema.sql` y ejecútalo. Crea
   tablas, políticas, funciones, el bucket privado `comprobantes` y siembra
   horarios, cabinas y tratamientos. Es idempotente.
3. Copia `.env.example` a `.env` y rellena las dos variables con lo que aparece
   en **Settings → API**.
4. Da de alta al personal en **Authentication → Users**. Esas son las cuentas que
   entran a `/panel`.
5. `npm run build`. El sitio deja de usar el modo demo.

### Qué ve cada quien

| Tabla | Anónimo | Personal autenticado |
| --- | --- | --- |
| `horarios`, `bloqueos` | Lectura | Todo |
| `cabinas`, `tratamientos` | Lectura (solo activos) | Todo |
| `citas` | **Nada** | Todo |
| Bucket `comprobantes` | **Solo subir** | Leer y borrar |

Los datos de la clienta —nombre, teléfono, correo y las **notas del
tratamiento**, que pueden incluir información de salud— no son legibles por el
rol anónimo. Para pintar el calendario se usa `disponibilidad`, que devuelve solo
franjas ocupadas.

La clave `anon` viaja al navegador y eso es correcto: es pública. Lo que protege
la agenda son las políticas de fila. **Nunca pongas la clave `service_role` en
este proyecto.**

### El panel

`/panel` está marcado `noindex`.

- Filtros por rango y casilla para ver solo los anticipos por revisar.
- Cada cita trae teléfono como enlace de llamada y WhatsApp con el mensaje ya
  escrito.
- **Ficha de "tiempo muerto hoy"**: cuántos minutos de cabina quedaron partidos
  en huecos invendibles. Se enciende en rojo si hay alguno y en verde si está en
  cero. Es el número que el motor existe para mantener en cero, y es lo que
  ningún sistema de agenda comercial enseña.
- La ficha de anticipos por revisar se enciende cuando hay trabajo pendiente.
- En las citas con anticipo sin resolver **no se ofrece el botón de confirmar a
  mano**: se confirman verificando el pago.

En modo demo la contraseña es `vapor2019` y está a la vista a propósito: no hay
nada que proteger cuando las citas viven en el navegador de quien mira.

---

## Dónde se edita cada cosa

| Qué quieres cambiar | Archivo |
| --- | --- |
| Textos, precios, tratamientos, cabinas, horarios, contacto | `src/data/spa.ts` |
| Paleta, tipografía, radios, espaciado | `src/styles/global.css` (bloque `:root`) |
| Reglas de diseño y por qué | `DESIGN.md` |
| Título, descripción, datos estructurados | `src/layouts/Base.astro` |
| Orden de las secciones | `src/pages/index.astro` |
| Tablas, políticas y reglas de reserva | `supabase/schema.sql` |
| Motor de huecos | `src/lib/reservas.ts` |

### Los cuatro sitios donde hay que cambiar lo mismo

Cuatro duplicaciones a propósito:

1. **Horarios.** `contacto.horarios` es lo que se *muestra*; la tabla `horarios`
   es lo que se *valida*.
2. **Cabinas.** `cabinas.lista` lleva foto y detalle; la tabla `cabinas` lleva
   solo lo que el motor necesita. Los `slug` tienen que coincidir.
3. **Tratamientos.** El archivo de datos es lo que se *pinta*; la tabla
   `tratamientos` es lo que se *cobra*: precio, duración, buffer y anticipo. **Si
   no cuadran, la clienta ve un número y se le cobra otro.**
4. **Constantes gemelas**: `paso_minutos()` ↔ `reserva.pasoMinutos`,
   `plazo_anticipo()` ↔ `pago.plazoHoras`, `c_tope_por_telefono` ↔
   `TOPE_POR_TELEFONO`.

En los cuatro casos la base de datos es la que manda.

---

## Diseño

El sistema completo está en [DESIGN.md](DESIGN.md): estrella polar, paleta con
los catorce pares de contraste medidos, tipografía, familias de sección y
do/don'ts.

Resumen de las decisiones que más se notan:

- **Estrella polar: la mesa de tratamiento vista desde arriba.** Lino, cerámica,
  aceite y hoja sobre superficie clara.
- **Cuatro lienzos, todos cálidos y claros**: hueso, blanco, blush y taupe.
  **No hay un solo bloque oscuro en la página**, y es una regla del sistema.
- **La jerarquía la marca el bloque de color**, no el tamaño de letra. La página
  avanza cambiando de bloque, no cambiando de layout.
- **Dos voces tipográficas**: Cormorant Garamond en versalitas muy espaciadas
  para display y títulos, Outfit para todo lo demás. La serif nunca aparece en
  texto corrido.
- **Restricción dura del taupe**: solo admite `tinta` y `tinta-2`. El acento ahí
  da 2.99 y falla AA. Lo resuelve la clase del lienzo reasignando tokens, no una
  excepción a mano en cada componente.
- **El arco y el lomo girado** son los dos recursos de forma: se usan poco a
  propósito, para que sigan señalando jerarquía.
- **Ocho secciones, siete familias de composición.** Ninguna se repite.
- **Movimiento 3 de 10**: transiciones CSS y revelado con
  `IntersectionObserver`. Una página de papel no se mueve mucho.
- **Grano**: una capa fija de ruido al 32%. Un crema perfectamente plano se ve
  barato.

Esta dirección viene de una **referencia visual que aportó el cliente**. La
versión anterior era oscura (pizarra fría y arcilla) y está en el historial de
git.

## Accesibilidad

- Todos los pares de color del sistema pasan **WCAG AA**, medidos y
  documentados en `DESIGN.md`.
- Un solo anillo de foco en arcilla, visible en todo el sitio.
- Etiqueta arriba del campo, error debajo. Nunca placeholder como etiqueta.
- Las horas ocupadas se enseñan tachadas con `aria-label` que dice el motivo, en
  vez de desaparecer.
- `prefers-reduced-motion: reduce` colapsa todo a estático.
- Sin JavaScript el contenido revelado queda visible: la animación no es
  requisito para que exista el contenido.
- Enlace de salto al contenido, y el acordeón de preguntas es `details` nativo.

---

## Antes de publicar

- [ ] Sustituir **todo** el contenido de `src/data/spa.ts` por los datos reales.
- [ ] **Poner la CLABE y el titular reales en `pago`, y revisarlos dos veces.**
      Los de la plantilla son inventados; un dígito mal escrito manda el dinero
      de las clientas a la cuenta de un desconocido.
- [ ] **Sustituir las imágenes.** Hoy son fotos de Unsplash, servidas desde su
      CDN y recortadas en la URL: ambientan, pero no son este local. Hacen falta
      fotos reales de la casa, las cabinas y los tratamientos, en los mismos
      tamaños (héroe 1920x900, tratamiento 900x1200, cabina 800x600, casa
      1600x900) para que `width` y `height` del `<img>` sigan cuadrando y la
      página no salte al cargar. Los créditos están en la cabecera de
      `src/data/spa.ts`.
- [ ] Decidir qué tratamientos piden anticipo y cuánto, en el archivo de datos
      **y** en la tabla `tratamientos`.
- [ ] Revisar las duraciones y los buffers con el spa. El buffer real lo sabe
      quien limpia la cabina, no quien programa.
- [ ] Cambiar `site` en `astro.config.mjs` al dominio real.
- [ ] Revisar `src/pages/aviso-de-privacidad.astro`: es una plantilla, no
      asesoría legal. Ojo con la sección de notas del tratamiento, que trata
      datos de salud.
- [ ] Comprobar que el bucket `comprobantes` quedó en **privado**.
- [ ] Reservar una cita de prueba de punta a punta y confirmarla desde el panel.
- [ ] Hacer una transferencia real de prueba, subir el comprobante y verificarlo.
- [ ] Comprobar los datos estructurados con la
      [prueba de resultados enriquecidos](https://search.google.com/test/rich-results).

---

## Estructura

```
src/
  components/    Secciones de la portada
  data/
    spa.ts       Todo el contenido editable
  icons/         SVG propios (astro-icon la busca aunque esté vacía)
  layouts/
    Base.astro   <head>, datos estructurados, revelado al hacer scroll
  lib/
    supabase.ts  Cliente, o null si no hay credenciales
    reservas.ts  Motor de huecos y única puerta a los datos de citas
  pages/
    index.astro               Portada
    panel.astro               Agenda de la casa
    aviso-de-privacidad.astro Plantilla legal
  styles/
    global.css   Tokens, utilidades, componentes base
supabase/
  schema.sql     Tablas, políticas y funciones. Se pega en el SQL Editor
scripts/
  tiempo-muerto.mjs  Simulación que mide el hueco muerto de las dos estrategias
DESIGN.md        Sistema de diseño
```
