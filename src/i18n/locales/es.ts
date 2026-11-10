import type en from './en'

const es: typeof en = {
  app: {
    name: 'bloub',
    title: 'bloub — avatar SVG animado',
    description:
      'bloub recrea el avatar del bot de x.ai como un SVG animado: una forma negra que transiciona entre 14 estados, medidos píxel a píxel a partir del video. Sin librería de animación.',
    botAria: 'Avatar bloub animado'
  },

  gallery: {
    back: 'Volver al reproductor'
  },

  rail: {
    nav: 'Secciones',
    customize: 'Personalizar',
    animations: 'Animaciones',
    settings: 'Ajustes'
  },

  panel: {
    animations: 'Animación',
    shape: 'Forma',
    expression: 'Expresión',
    color: 'Color'
  },

  export: {
    action: 'Exportar como PNG',
    more: 'Otros formatos',
    png: 'Descargar PNG',
    svg: 'Descargar SVG',
    anime: 'Descargar SVG animado',
    gif: 'Descargar GIF animado',
    cycleDetail: 'El video es más liviano y fluido; el GIF se reproduce en cualquier lado.',
    cycleFormat: 'Formato',
    cycle_mp4: 'Video MP4',
    cycle_mp4_aide: 'Liviano y fluido, necesita fondo',
    cycle_gif: 'GIF animado',
    cycle_gif_aide: 'Se reproduce en cualquier lado, más pesado',
    cycleProgress: 'Exportando…',
    cycleReessayer: 'Reintentar',
    gifTitle: 'Descargar GIF animado',
    gifDetail:
      'La transparencia del GIF es todo o nada: sin fondo, el borde de la bola queda un poco duro.',
    gifBackground: 'Fondo',
    fond_blanc: 'Fondo blanco',
    fond_blanc_aide: 'Borde suave, para superficies claras',
    fond_transparent: 'Fondo transparente',
    fond_transparent_aide: 'Sirve sobre cualquier fondo, borde un poco duro',
    gifConfirm: 'Descargar',
    copie: 'Copiar imagen',
    copieSvg: 'Copiar SVG',
    done: 'Exportado',
    copied: 'Copiado',
    failed: 'Error al exportar'
  },

  preview: {
    exit: 'Salir de la vista previa',
    key: 'Esc'
  },

  timeline: {
    play: 'Reproducir',
    pause: 'Pausar',
    addAnimation: 'Agregar una animación',
    preview: 'Vista previa',
    export: 'Exportar el montaje',
    zoom: 'Zoom de la pista',
    blockAria: '{state}, {duration}',
    blockDurationAria: 'Duración de {state}, {duration}',
    blockRemoveAria: 'Quitar {state}'
  },

  dialog: {
    cancel: 'Cancelar',
    nameCreateTitle: 'Nuevo ciclo',
    nameRenameTitle: 'Renombrar ciclo',
    nameField: 'Nombre del ciclo',
    nameCreate: 'Crear',
    nameRename: 'Renombrar',
    removeTitle: '¿Borrar «{name}»?',
    removeDetail:
      'Se pierde esta secuencia, junto con su animación. | Se pierde esta secuencia, junto con sus {n} animaciones.',
    removeConfirm: 'Borrar'
  },

  cycles: {
    defaultName: 'Ciclo predeterminado',
    newName: 'Mi ciclo',
    menuNew: 'Nuevo ciclo',
    menuRenameAria: 'Renombrar {name}',
    menuRemoveAria: 'Borrar {name}'
  },

  units: {
    seconds: '{n} s',
    secondsShort: '{n}s'
  },

  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    about: 'Acerca de',
    credits: 'Hecho con ❤️ por {name}',
    creditsAria: 'Jérémy en X, en una pestaña nueva',
    github: 'Ver el proyecto en GitHub',
    githubAria: 'El repositorio del proyecto en GitHub, en una pestaña nueva'
  },

  meetup: {
    title: 'Grok Bot',
    question: 'What should I build with my Grok Bots?',
    presented: 'Presentado por',
    city: 'Meetup {place}',
    cityBare: 'Meetup',
    cityClaim: 'Meetup Mendoza',
    welcome: 'Bienvenido, {name}',
    claim: 'Canjear créditos',
    olee: 'olee',
    risa: '😂😂😂',
    emailLabel: 'Correo',
    emailHint: 'tucorreo@gmail.com',
    emailBubble: 'Usá el correo con el que te registraste en',
    emailGo: 'Canjear',
    emailSubmit: 'Registrar entrada',
    emailSending: 'Registrando…',
    emailReady: 'Ya estás adentro',
    emailOther: 'Otra persona',
    emailInvalid: 'Ese correo no es válido.',
    emailMissing: 'Falta la clave de Luma en el servidor.',
    emailSkipped: 'Luma no aceptó ese correo.',
    emailAbsent: 'Ese correo no está anotado en Luma.',
    emailWait: 'Luma todavía no terminó el alta. Probá de nuevo.',
    emailFailed: 'No pudimos registrar la entrada. Probá de nuevo.',
    start: 'Comenzar',
    started: 'Grok Bot Meetup',
    soon: 'Comenzamos en breve',
    eventAria: '{name} en Luma',
    back: 'Volver',
    tabTitle: 'Grok Bot Meetup',
    description: 'Check-in y créditos de Cursor.'
  },

  wall: {
    edit: 'Editar',
    done: 'Listo',
    title: 'Editar muro',
    language: 'Idioma',
    place: 'Ciudad',
    claimTitle: 'Título',
    morph: 'Cambiar cada',
    morphUnit: 's',
    claimUrl: 'QR de créditos',
    qrEmpty: 'Agregá una URL para generar el QR.',
    repo: 'Ver el repositorio',
    repoAria: 'Este proyecto en GitHub, en una pestaña nueva',
    overlay: 'Pantalla de comenzar',
    speed: 'Velocidad de los bots de fondo',
    scale: 'Tamaño del bot principal',
    height: 'Altura del bot principal',
    textHeight: 'Altura del texto',
    glance: 'Ojos de lado a lado',
    shapes: 'Formas distintas',
    colors: 'Colores distintos',
    eyes: 'Ojos distintos',
    count: 'Cantidad de bots de fondo',
    miniSize: 'Tamaño de los bots de fondo',
    reset: 'Restablecer valores',
    titleText: 'Texto «Grok Bot Meetup»',
    soonText: 'Texto «Comenzamos en breve»',
    textSize: 'Tamaño',
    textColor: 'Color',
    textX: 'Posición horizontal',
    textY: 'Posición vertical',
    presentedBlock: 'Presentado por SpaceX',
    presentedText: 'Texto',
    show: 'Visible',
    hidden: 'Oculto',
    black: 'Negro',
    white: 'Blanco',
    mainBot: 'Bot principal',
    thisBot: 'Este bot',
    fieldBots: 'Bots de fondo',
    pace: 'Velocidad',
    availableBots: 'Bots disponibles'
  },

  states: {
    idle: 'Reposo',
    thinking: 'Pensando',
    wink: 'Guiño',
    wide: 'Ojos abiertos',
    alert: 'Alerta',
    notify: 'Notificación',
    exclaim: 'Exclamación',
    sleep: 'Sueño',
    egg: 'Huevo',
    hexagon: 'Hexágono',
    play: 'Reproducir',
    orbit: 'Órbita',
    burst: 'Explosión',
    comet: 'Cometa',
    swirl: 'Remolino'
  },

  shapes: {
    cercle: 'Círculo',
    galet: 'Guijarro',
    squircle: 'Superelipse',
    capsule: 'Cápsula',
    triangle: 'Triángulo',
    hexagone: 'Hexágono',
    nuage: 'Nube',
    goutte: 'Gota'
  },

  colors: {
    encre: 'Tinta',
    creme: 'Crema',
    brun: 'Marrón',
    rouge: 'Rojo',
    orange: 'Naranja',
    ambre: 'Ámbar',
    vert: 'Verde',
    turquoise: 'Turquesa',
    bleu: 'Azul',
    violet: 'Violeta',
    rose: 'Rosa',
    gris: 'Gris'
  },

  expressions: {
    neutre: 'Neutro',
    attentif: 'Atento',
    surpris: 'Sorprendido',
    excite: 'Emocionado',
    heureux: 'Feliz',
    hilare: 'Riendo',
    colere: 'Enojado',
    triste: 'Triste',
    effraye: 'Asustado',
    mefiant: 'Desconfiado',
    confus: 'Confundido',
    curieux: 'Curioso',
    fier: 'Orgulloso',
    timide: 'Tímido',
    blase: 'Impasible',
    somnolent: 'Somnoliento'
  }
}

export default es
