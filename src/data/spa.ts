/* ==========================================================================
   CONTENIDO DE CASA VAPOR
   --------------------------------------------------------------------------
   AVISO: "Casa Vapor" es una marca ficticia creada como demostración. Nombres,
   precios, dirección, teléfonos, testimonios y datos bancarios son de muestra
   y hay que reemplazarlos por los reales antes de publicar.

   Este es el único archivo que hay que tocar para cambiar textos, precios,
   tratamientos, cabinas, horarios y contacto. Los componentes leen de aquí y
   no llevan texto propio.

   OJO, tres duplicaciones a propósito:

   1. Los HORARIOS de este archivo son los que se MUESTRAN. Los que VALIDAN una
      reserva viven en la tabla `horarios` de supabase/schema.sql.
   2. Los TRATAMIENTOS de aquí son los que se PINTAN. El precio, la duración,
      el buffer y el anticipo que se COBRAN salen de la tabla `tratamientos`.
      Si no cuadran, la clienta ve un número y se le cobra otro.
   3. `reserva.pasoMinutos` y `pago.plazoHoras` tienen gemelos en el esquema.

   El motor de huecos vive en src/lib/reservas.ts. Lee el comentario de arriba
   de ese archivo antes de tocar duraciones o buffers: el sistema está armado
   para NO dejar huecos muertos, y esa propiedad depende de estos números.

   LAS FOTOS también son de muestra. Son de Unsplash, licencia libre, servidas
   desde su CDN ya recortadas al tamaño que pide cada hueco (`w`, `h` y
   `fit=crop` en la propia URL; `auto=format` entrega webp o avif al navegador
   que lo soporte). Al cambiarlas por las del spa real, respetar esos tamaños:
   héroe 1920x900, tratamiento 900x1200, cabina 800x600, casa 1600x900. Son los
   mismos números que van en los atributos `width` y `height` del `<img>` y lo
   que evita que la página salte al cargar. Créditos: HUUM (héroe, ritual,
   cabina de piedra), Dominique Rivas (facial express), Jakub Klucký
   (descontracturante), kimia kazemi (facial profundo), Rosalie Gdy (cuatro
   manos), Dominik Neuner (cabina de vapor), Tim Wing (cabina de arcilla),
   Sung Jin Cho (la casa).
   ========================================================================== */

/* Zona horaria del negocio. Decide qué día es "hoy" y qué huecos ya pasaron,
   sin importar dónde esté la visitante. Tiene que coincidir con la que
   devuelve `zona_casa()` en supabase/schema.sql. */
export const ZONA_HORARIA = 'America/Mexico_City';

export const marca = {
  nombre: 'Casa Vapor',
  nombreCorto: 'Casa Vapor',
  descriptor: 'Spa urbano',
  dominio: 'casavapor.mx',
  fundada: 2019,
  claim: 'Spa de tarde en la Colonia Americana, Guadalajara.',
} as const;

export const contacto = {
  telefono: '+52 33 2841 6073',
  telefonoHref: '+523328416073',
  whatsapp: '523328416073',
  correo: 'hola@casavapor.mx',
  calle: 'Av. La Paz 1874, interior 4',
  colonia: 'Colonia Americana',
  cp: '44160 Guadalajara, Jalisco',
  mapa: 'https://maps.google.com/?q=Av.+La+Paz+1874,+Colonia+Americana,+Guadalajara',
  horarios: [
    { dias: 'Martes a viernes', horas: '11:00 - 21:00' },
    { dias: 'Sábado', horas: '10:00 - 20:00' },
    { dias: 'Domingo', horas: '11:00 - 17:00' },
    { dias: 'Lunes', horas: 'Cerrado' },
  ],
  redes: [
    { nombre: 'Instagram', icono: 'ph:instagram-logo', url: 'https://instagram.com/' },
  ],
} as const;

/* Etiqueta única para la acción principal. No usar sinónimos en otras
   secciones: una sola intención, una sola etiqueta en toda la página. */
export const CTA_PRINCIPAL = 'Reservar';

export const navegacion = [
  { etiqueta: 'Tratamientos', href: '#tratamientos' },
  { etiqueta: 'La casa', href: '#casa' },
  { etiqueta: 'Preguntas', href: '#preguntas' },
] as const;

/* --------------------------------------------------------------------------
   Hero
   --------------------------------------------------------------------------
   Cuatro elementos de texto como máximo: título, entrada, dos botones. Sin
   rótulo arriba, sin tira decorativa abajo, sin micro-tagline bajo los
   botones. La entrada va por debajo de 20 palabras. */
export const hero = {
  /* Línea pequeña sobre el display. Lleva la propuesta completa porque el
     display va en versalitas y no admite una frase larga. */
  sobreTitulo: 'Vapor, arcilla y manos que saben',
  titulo: 'Dos horas que no',
  tituloAcento: 'le debes a nadie',
  /* Banda a sangre bajo el titular: bodegón en plano cenital, horizontal. Es la
     imagen que carga el peso de la primera pantalla. */
  imagen: {
    src: 'https://images.unsplash.com/photo-1779956510692-11aece5fc288?auto=format&fit=crop&crop=entropy&w=1920&h=1100&q=72',
    alt: 'Estufa de piedras y cucharón de madera vistos desde arriba en una cabina de vapor',
    w: 1920,
    h: 1100,
  },
  /* Tarjeta flotante sobre la foto. DOS datos, no tres: en el héroe cada
     renglón de más compite con el botón. El tercero que había aquí ("reservas
     en línea, sin llamadas") decía lo mismo que el botón de al lado y lo mismo
     que la última cifra de la franja. */
  datos: [
    { etiqueta: 'Hoy', valor: contacto.horarios[0].horas },
    { etiqueta: 'Dónde', valor: `${contacto.colonia}, Guadalajara` },
  ],
} as const;

/* --------------------------------------------------------------------------
   Cifras
   --------------------------------------------------------------------------
   Franja bajo el héroe. Cuatro datos y ninguno inventado: los cuatro salen de
   otro sitio de este mismo archivo, y por eso hay que moverlos si aquello
   cambia.

     desde    -> `marca.fundada`
     cabinas  -> cuántas hay en `cabinas.lista`
     minutos  -> el `duracionMin` más corto y el más largo de `tratamientos`
     días     -> los `contacto.horarios` que no dicen "Cerrado"

   NO poner aquí métricas que no se puedan sostener. "1.200 clientas" o "96%
   de satisfacción" quedan bien en una maqueta y son una mentira en un sitio
   publicado. Si el spa real las tiene medidas, entonces sí: se sustituyen. */
export const cifras = [
  { valor: '2019', etiqueta: 'Abrimos en la Americana' },
  { valor: '3', etiqueta: 'Cabinas con terapeuta de planta' },
  { valor: '30 a 120', etiqueta: 'Minutos, según el tratamiento' },
  { valor: '6 días', etiqueta: 'A la semana, y se reserva en línea' },
] as const;

/* --------------------------------------------------------------------------
   Tratamientos
   --------------------------------------------------------------------------
   `duracionMin` y `bufferMin` viajan al motor de huecos. El buffer es el
   tiempo de preparación de la cabina DESPUÉS del tratamiento: si no está aquí,
   el personal lo inventa y la tarde se atrasa.

   `anticipo` en 0 = se paga todo en la casa. Mayor que 0 = hay que transferir
   esa cantidad para que la cabina quede apartada.

   Las duraciones son 30, 60, 75, 90 y 120 a propósito: con una rejilla de 30
   minutos, cuatro de las cinco dejarían un hueco de 15 minutos invendible si
   los horarios no se anclaran al final de la cita anterior. Ese es justo el
   problema que resuelve src/lib/reservas.ts. */
export const tratamientos = [
  {
    slug: 'facial-express',
    nombre: 'Facial express',
    precio: 450,
    duracionMin: 30,
    bufferMin: 15,
    anticipo: 0,
    texto:
      'Limpieza, exfoliación suave y hidratación. Es el que cabe en una hora de comida y el que usamos para rellenar los huecos cortos de la tarde.',
    incluye: ['Diagnóstico de piel', 'Exfoliación enzimática', 'Hidratación sellada'],
    imagen: 'https://images.unsplash.com/photo-1643684391140-c5056cfd3436?auto=format&fit=crop&crop=entropy&w=900&h=1200&q=72',
    alt: 'Manos trabajando el rostro de una persona recostada con los ojos cerrados',
  },
  {
    slug: 'masaje-descontracturante',
    nombre: 'Masaje descontracturante',
    precio: 890,
    duracionMin: 60,
    bufferMin: 15,
    anticipo: 0,
    texto:
      'Trabajo profundo en espalda, cuello y hombros. Si llegas con la mandíbula apretada de un día de pantalla, es este.',
    incluye: ['Presión ajustada contigo', 'Aceite tibio de almendra', 'Estiramientos al cierre'],
    imagen: 'https://images.unsplash.com/photo-1745327883508-b6cd32e5dde5?auto=format&fit=crop&crop=entropy&w=900&h=1200&q=72',
    alt: 'Terapeuta trabajando la espalda de una persona sobre una camilla',
  },
  {
    slug: 'facial-profundo',
    nombre: 'Facial profundo',
    precio: 1100,
    duracionMin: 75,
    bufferMin: 15,
    anticipo: 300,
    texto:
      'Extracción, alta frecuencia y mascarilla de arcilla verde. Son setenta y cinco minutos de cabina, por eso pedimos anticipo.',
    incluye: ['Vapor y extracción', 'Alta frecuencia', 'Mascarilla de arcilla'],
    imagen: 'https://images.unsplash.com/photo-1761718210089-ba3bb5ccb54f?auto=format&fit=crop&crop=entropy&w=900&h=1200&q=72',
    alt: 'Esteticista extendiendo mascarilla sobre el rostro de una persona, con el cuenco en la mano',
  },
  {
    slug: 'masaje-cuatro-manos',
    nombre: 'Masaje a cuatro manos',
    precio: 1750,
    duracionMin: 90,
    bufferMin: 20,
    anticipo: 500,
    texto:
      'Dos terapeutas al mismo tiempo, en espejo. Pierdes la cuenta de dónde viene cada movimiento y ahí es donde el cuerpo suelta.',
    incluye: ['Dos terapeutas', 'Aceite caliente', 'Cierre en silencio'],
    imagen: 'https://images.unsplash.com/photo-1790244145889-d5994927847b?auto=format&fit=crop&crop=entropy&w=900&h=1200&q=72',
    alt: 'Mano presionando la espalda baja de una persona recostada en camilla, a media luz',
  },
  {
    slug: 'ritual-vapor-arcilla',
    nombre: 'Ritual de vapor y arcilla',
    precio: 2400,
    duracionMin: 120,
    bufferMin: 20,
    anticipo: 700,
    texto:
      'Vapor, envoltura de arcilla, enjuague en piedra tibia y masaje de cierre. Dos horas completas. Es la cita que se agenda antes de una boda o después de un trimestre imposible.',
    incluye: ['Cámara de vapor', 'Envoltura de arcilla', 'Masaje de cierre', 'Té de la casa'],
    imagen: 'https://images.unsplash.com/photo-1749561532023-a4e73c1e6c6a?auto=format&fit=crop&crop=entropy&w=900&h=1200&q=72',
    alt: 'Vapor subiendo de un canasto de piedras calientes dentro de una cabina de madera',
  },
] as const;

/* --------------------------------------------------------------------------
   Cabinas
   --------------------------------------------------------------------------
   El recurso que se agenda. Una cabina implica a su terapeuta: el sistema
   agenda UN recurso, no dos. Modelar cabina y terapeuta por separado obliga a
   resolver dos disponibilidades a la vez, que es otro problema y no hace falta
   para un spa de tres cabinas.

   Los `slug` tienen que coincidir con la tabla `cabinas` del esquema, o la
   página ofrecerá una cabina que la base no conoce. */
export const cabinas = {
  titulo: 'Tres cabinas y',
  tituloAcento: 'ningún reloj a la vista',
  texto:
    'Puedes pedir cabina o dejar que te toque la que esté libre. Las tres tienen regadera propia y la misma camilla; cambia la luz y cambia el vapor.',
  lista: [
    {
      slug: 'vapor',
      nombre: 'Vapor',
      detalle: 'Cámara de vapor propia. La más cálida de las tres.',
      imagen: 'https://images.unsplash.com/photo-1761470575018-135c213340eb?auto=format&fit=crop&crop=entropy&w=800&h=600&q=72',
      alt: 'Cabina de vapor forrada en piedra, con bancas corridas y luz baja al fondo',
    },
    {
      slug: 'arcilla',
      nombre: 'Arcilla',
      detalle: 'Para envolturas y faciales. Muro de barro sin sellar.',
      imagen: 'https://images.unsplash.com/photo-1772378452022-94ee7971fe80?auto=format&fit=crop&crop=entropy&w=800&h=600&q=72',
      alt: 'Cabina de spa con muro de barro y camilla de madera preparada junto a la ventana',
    },
    {
      slug: 'piedra',
      nombre: 'Piedra',
      detalle: 'Suelo de piedra volcánica. La más silenciosa.',
      imagen: 'https://images.unsplash.com/photo-1770625467915-eeaebc88f719?auto=format&fit=crop&crop=entropy&w=800&h=600&q=72',
      alt: 'Cabina oscura con piedra volcánica en primer plano y bancas de madera al fondo',
    },
  ],
} as const;

/* Opción que aparece primero en el selector de cabina. Cuando se elige, el
   servidor aplica MEJOR AJUSTE: no toma la primera libre, toma la que deja
   menos hueco sobrante. Ver src/lib/reservas.ts. */
export const CABINA_INDIFERENTE = {
  slug: 'sin-preferencia',
  nombre: 'La que esté libre',
} as const;

/* --------------------------------------------------------------------------
   Ventajas
   --------------------------------------------------------------------------
   Va JUSTO ANTES del formulario, y ese orden es la razón de que exista: la
   reserva pedía nombre, teléfono y tarjeta sin haber dado todavía un motivo
   para confiar.

   Las cuatro repiten algo que ya se promete en otro lado del sitio: la
   segunda es el buffer de limpieza de `src/lib/reservas.ts`, la tercera es la
   nota del riel de tratamientos y la cuarta es la pregunta del anticipo. Si
   alguna deja de ser verdad allá, aquí se cae sola. */
export const ventajas = {
  titulo: 'Antes de que dejes',
  tituloAcento: 'tus datos',
  texto:
    'Cuatro cosas que ya están decididas antes de que reserves, para que no tengas que preguntarlas por WhatsApp.',
  lista: [
    {
      icono: 'ph:hand-heart',
      titulo: 'Terapeutas de planta',
      texto: 'Cada cabina tiene la suya. No rota a media semana ni te toca quien haya quedado libre.',
    },
    {
      icono: 'ph:drop',
      titulo: 'La cabina ya está lista',
      texto: 'El tiempo de limpieza va dentro de la reserva, no después. Por eso tu hora empieza a tu hora.',
    },
    {
      icono: 'ph:receipt',
      titulo: 'Precio cerrado',
      texto: 'Incluye regadera, vestidor y bata. Nadie te suma nada al salir.',
    },
    {
      icono: 'ph:arrows-clockwise',
      titulo: 'Cancelar no cuesta',
      texto: 'Hasta veinticuatro horas antes el anticipo se queda a cuenta de la siguiente cita.',
    },
  ],
} as const;

/* --------------------------------------------------------------------------
   Configuración de la reserva
   -------------------------------------------------------------------------- */
export const reserva = {
  rotulo: 'Agenda en línea',
  titulo: 'Elige tratamiento,',
  tituloAcento: 'día y hora',
  texto:
    'Los horarios que ves son los que quedan de verdad. Se apartan en cuanto reservas y tarda menos de un minuto.',
  /* Cuántos días hacia adelante se puede reservar. */
  diasDeAntelacion: 45,
  /* El calendario no ofrece horarios que empiecen antes de este margen. */
  margenMinutos: 90,
  /* Rejilla base de horarios. A esto se le SUMAN los horarios anclados al
     final de cada cita existente, que es lo que evita el hueco muerto.
     Tiene que coincidir con `paso_minutos()` de supabase/schema.sql. */
  pasoMinutos: 30,
} as const;

/* --------------------------------------------------------------------------
   Anticipo por transferencia
   --------------------------------------------------------------------------
   ⚠️ DATOS BANCARIOS DE MUESTRA. La CLABE y el titular son inventados y no
   corresponden a ninguna cuenta real. Antes de publicar hay que poner los del
   negocio y revisarlos dos veces: un dígito mal escrito manda el dinero de las
   clientas a la cuenta de un desconocido.

   Por qué transferencia y no tarjeta: una pasarela cobra comisión por cada
   cobro (≈3.6% + $3 MXN en México). Con SPEI el anticipo llega completo a la
   cuenta del negocio. El costo que sí existe es de tiempo: alguien tiene que
   mirar el comprobante y darle "verificar" en el panel. */
export const pago = {
  /* Horas que se aparta la cabina sin transferencia. Tiene que coincidir con
     `plazo_anticipo()` de supabase/schema.sql. */
  plazoHoras: 3,

  banco: 'BBVA México',
  titular: 'Casa Vapor SA de CV',
  clabe: '012 320 00987654321 7',
  clabePlana: '012320009876543217',

  titulo: 'Falta el anticipo para apartar la cabina',
  texto:
    'Los tratamientos largos ocupan la cabina completa, así que pedimos anticipo. Se descuenta del total: el día de tu cita pagas la diferencia.',
  aviso:
    'Si el anticipo no llega en las próximas horas, la cabina se libera sola y vuelve a quedar disponible.',
  instrucciones: [
    'Transfiere el anticipo a la CLABE de arriba desde tu app del banco.',
    'Pon el folio de tu cita en el concepto o referencia.',
    'Sube la captura del comprobante aquí abajo.',
  ],
  /* Formatos que acepta la subida. Tiene que coincidir con
     `allowed_mime_types` del bucket en supabase/schema.sql. */
  formatos: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
  pesoMaximoMb: 5,
} as const;

/* --------------------------------------------------------------------------
   La casa
   -------------------------------------------------------------------------- */
export const casa = {
  titulo: 'Una casona de 1940 con',
  tituloAcento: 'las tuberías a la vista',
  texto:
    'Abrimos en 2019 en una casona de la Americana que antes fue imprenta. Dejamos el muro de ladrillo y el piso de pasta original; lo único nuevo son las regaderas y la caldera. Hay té de canela y un gato que se llama Tinta.',
  puntos: [
    'A cuatro cuadras del Parque Revolución',
    'Estacionamiento con valet los fines de semana',
    'Pago con tarjeta y transferencia',
  ],
  imagen: {
    src: 'https://images.unsplash.com/photo-1677413211006-4ea96695cf01?auto=format&fit=crop&crop=entropy&w=1600&h=900&q=72',
    alt: 'Interior de una casona antigua con arcos de ladrillo, mesas de madera y luz baja',
    w: 1600,
    h: 900,
  },
} as const;

/* --------------------------------------------------------------------------
   Testimonios
   --------------------------------------------------------------------------
   Máximo tres líneas de cuerpo cada uno. Nombre y detalle siempre: un
   testimonio sin apellido no lo firma nadie. */
export const testimonios = [
  {
    texto:
      'Reservé el ritual un jueves a las once de la noche desde la cama. No tuve que esperar a que alguien contestara el mensaje al día siguiente.',
    nombre: 'Renata Vilchis',
    detalle: 'Clienta desde 2022',
    tratamiento: 'Ritual de vapor y arcilla',
  },
  {
    texto:
      'Llegué a la hora exacta que aparté y ya estaba lista la cabina. En esta ciudad eso no pasa nunca.',
    nombre: 'Alondra Zepeda',
    detalle: 'Facial profundo, tercera visita',
    tratamiento: 'Facial profundo',
  },
  {
    texto:
      'Pedí el de cuatro manos sin saber muy bien qué era. Salí sin acordarme de por qué había tenido una semana difícil.',
    nombre: 'Mauricio Beltrán',
    detalle: 'Primera visita',
    tratamiento: 'Masaje a cuatro manos',
  },
] as const;

/* --------------------------------------------------------------------------
   Preguntas
   -------------------------------------------------------------------------- */
export const preguntas = {
  titulo: 'Lo que siempre',
  tituloAcento: 'nos preguntan',
  lista: [
    {
      q: '¿Qué pasa si llego tarde?',
      a: 'El tratamiento termina a la hora que estaba previsto, porque después de ti entra alguien más. Si llegas con más de quince minutos de retraso te llamamos para ver si alcanza a caber o lo movemos.',
    },
    {
      q: '¿Por qué algunos tratamientos piden anticipo y otros no?',
      a: 'Porque no cuestan lo mismo en tiempo de cabina. Un facial express son treinta minutos y se rellena fácil si no llegas. El ritual son dos horas: si se cae, esa cabina se queda vacía toda la tarde y no hay manera de venderla.',
    },
    {
      q: '¿El anticipo se pierde si cancelo?',
      a: 'No, si cancelas con más de veinticuatro horas. Te lo dejamos a cuenta para la siguiente cita o te lo devolvemos, como prefieras. Si cancelas el mismo día, el anticipo cubre la cabina que ya no pudimos vender.',
    },
    {
      q: '¿Puedo pedir terapeuta?',
      a: 'Puedes pedir cabina y cada cabina tiene su terapeuta de planta. Si quieres a alguien en particular, escríbenos por WhatsApp y lo agendamos a mano.',
    },
    {
      q: '¿Tengo que traer algo?',
      a: 'Nada. Hay bata, sandalias, regadera y todo lo demás. Ven con la piel limpia si es facial, y si es masaje, sin crema.',
    },
  ],
} as const;

/* --------------------------------------------------------------------------
   Pie
   -------------------------------------------------------------------------- */
export const pieEnlaces = [
  {
    titulo: 'La casa',
    enlaces: [
      { etiqueta: 'Tratamientos', href: '#tratamientos' },
      { etiqueta: 'Las cabinas', href: '#cabinas' },
      { etiqueta: 'El espacio', href: '#casa' },
      { etiqueta: 'Preguntas', href: '#preguntas' },
    ],
  },
  {
    titulo: 'Tratamientos',
    enlaces: [
      { etiqueta: 'Facial express', href: '#tratamientos' },
      { etiqueta: 'Masaje descontracturante', href: '#tratamientos' },
      { etiqueta: 'Facial profundo', href: '#tratamientos' },
      { etiqueta: 'Ritual de vapor y arcilla', href: '#tratamientos' },
    ],
  },
  {
    titulo: 'Legal',
    enlaces: [
      { etiqueta: 'Aviso de privacidad', href: '/aviso-de-privacidad' },
      { etiqueta: 'Panel de la casa', href: '/panel' },
    ],
  },
] as const;

export type Tratamiento = (typeof tratamientos)[number];
export type Cabina = (typeof cabinas.lista)[number];
