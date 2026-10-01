## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Arquitectura de este proyecto

- `src/data/spa.ts` es el único archivo de contenido. Textos, tratamientos,
  precios, cabinas, horarios y datos de contacto salen de ahí. Los componentes
  no llevan texto propio.
- `DESIGN.md` es el sistema de diseño: estrella polar, paleta con contrastes
  medidos, tipografía, familias de sección y do/don'ts. **Leerlo antes de tocar
  estilos.** Los tokens de `src/styles/global.css` son su implementación.
- `src/lib/reservas.ts` es la única puerta a los datos de citas, y el motor de
  huecos. Lee el comentario de cabecera antes de tocar duraciones o buffers: el
  sistema está armado para no dejar huecos muertos y esa propiedad depende de
  esos números.
- Sin credenciales de Supabase cae a modo demo con `localStorage`. El modo demo
  tiene que repetir las MISMAS reglas que el servidor, **incluido el mejor
  ajuste**: si acepta algo que el sistema real rechaza, está enseñando algo que
  no existe.
- El esquema vive en `supabase/schema.sql` y se pega tal cual en el SQL Editor.

## Las cuatro reglas del motor de huecos

Están explicadas largo en la cabecera de `src/lib/reservas.ts` y en
`supabase/schema.sql`. Resumen de dónde vive cada una:

| | Regla | Dónde se aplica |
|---|---|---|
| 1 | Horarios anclados al minuto en que la cabina queda libre | Cliente |
| 2 | Buffer de limpieza dentro de la franja que bloquea | **Base de datos** (columna generada + restricción de exclusión) |
| 3 | Mejor ajuste al elegir cabina | **Base de datos** (`reservar_cita`) y réplica en el modo demo |
| 4 | Aviso de horas que dejarían hueco invendible | Cliente |

Los puntos 2 y 3 van en el servidor a propósito: si vivieran solo en el front,
una llamada directa a la API se los salta.

**El punto 4 marca, no bloquea.** Esconder esas horas sería más eficiente en
ocupación y peor negocio: si solo se ofreciera la hora de apertura como primera
cita del día, la mitad de la gente se va a otro spa.

## Lo que no se le cree al navegador

El precio, la duración, el buffer y el anticipo salen de la tabla
`tratamientos`. `reservar_cita` solo acepta QUÉ tratamiento se eligió. No volver
a pasar precios por parámetro.

## Trampas de este stack

- Los iconos de Phosphor están en una **lista blanca** en `astro.config.mjs`. Un
  icono que no esté ahí rompe el build con "Unable to locate icon", aunque exista
  en el paquete. Al añadir uno, añadirlo también a esa lista.
- `src/icons/` tiene que existir aunque esté vacía: astro-icon la busca siempre y
  avisa en el build si falta.
- `:global()` **solo funciona dentro de un `<style>` de Astro.** En
  `src/styles/global.css`, que es CSS plano, no es una pseudo-clase válida y
  lightningcss lo reporta. Ahí van selectores de descendiente normales.
- Las clases que crea el JavaScript (`cita-fila`, `pago`, `hora`, `dia`,
  `insignia`) necesitan ir en un bloque `<style is:global>`; en el `<style>`
  normal Astro las descarta por no encontrarlas en el marcado.
- Nunca `window.addEventListener('scroll')`. El revelado usa
  `IntersectionObserver` y está en `src/layouts/Base.astro`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
