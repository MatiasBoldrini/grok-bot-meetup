/**
 * Locale de reference du mur. `es.ts` est type `typeof en`, donc une cle
 * oubliee est une erreur de compilation.
 */
const en = {
  app: {
    name: 'bloub',
    title: 'bloub — animated SVG avatar',
    description:
      'bloub recreates the x.ai bot avatar as an animated SVG: a black shape that morphs through 14 states, measured pixel by pixel from the video. No animation library.',
    botAria: 'Animated bloub avatar'
  },

  gallery: {
    back: 'Back to the player'
  },

  rail: {
    nav: 'Sections',
    customize: 'Customise',
    animations: 'Animations',
    settings: 'Settings'
  },

  panel: {
    animations: 'Animation',
    shape: 'Shape',
    expression: 'Expression',
    color: 'Colour'
  },

  export: {
    action: 'Export as PNG',
    more: 'Other formats',
    png: 'Download PNG',
    svg: 'Download SVG',
    anime: 'Download animated SVG',
    gif: 'Download animated GIF',
    cycleDetail: 'The video is lighter and smoother; the GIF plays anywhere.',
    cycleFormat: 'Format',
    cycle_mp4: 'MP4 video',
    cycle_mp4_aide: 'Light and smooth, needs a background',
    cycle_gif: 'Animated GIF',
    cycle_gif_aide: 'Plays anywhere, heavier',
    cycleProgress: 'Exporting…',
    cycleReessayer: 'Try again',
    gifTitle: 'Download animated GIF',
    gifDetail:
      'GIF transparency is all-or-nothing: with no background, the ball\u2019s edge comes out a little hard.',
    gifBackground: 'Background',
    fond_blanc: 'White background',
    fond_blanc_aide: 'Smooth edge, for light surfaces',
    fond_transparent: 'Transparent background',
    fond_transparent_aide: 'Fits any background, edge a little hard',
    gifConfirm: 'Download',
    copie: 'Copy image',
    copieSvg: 'Copy SVG',
    done: 'Exported',
    copied: 'Copied',
    failed: 'Export failed'
  },

  preview: {
    exit: 'Exit preview',
    key: 'Esc'
  },

  timeline: {
    play: 'Start playback',
    pause: 'Stop playback',
    addAnimation: 'Add an animation',
    preview: 'Preview',
    export: 'Export the montage',
    zoom: 'Track zoom',
    blockAria: '{state}, {duration}',
    blockDurationAria: 'Duration of {state}, {duration}',
    blockRemoveAria: 'Remove {state}'
  },

  dialog: {
    cancel: 'Cancel',
    nameCreateTitle: 'New cycle',
    nameRenameTitle: 'Rename cycle',
    nameField: 'Cycle name',
    nameCreate: 'Create',
    nameRename: 'Rename',
    removeTitle: 'Delete "{name}"?',
    removeDetail:
      'This sequence will be lost, along with its animation. | This sequence will be lost, along with its {n} animations.',
    removeConfirm: 'Delete'
  },

  cycles: {
    defaultName: 'Default cycle',
    newName: 'My cycle',
    menuNew: 'New cycle',
    menuRenameAria: 'Rename {name}',
    menuRemoveAria: 'Delete {name}'
  },

  units: {
    seconds: '{n} s',
    secondsShort: '{n}s'
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    about: 'About',
    credits: 'Made with ❤️ by {name}',
    creditsAria: 'Jérémy on X, in a new tab',
    github: 'View the project on GitHub',
    githubAria: 'The project repository on GitHub, in a new tab'
  },

  meetup: {
    title: 'Grok Bot',
    question: 'What should I build with my Grok Bots?',
    presented: 'Presented by',
    city: 'Meetup {place}',
    cityBare: 'Meetup',
    cityClaim: 'Meetup Mendoza',
    welcome: 'Welcome, {name}',
    claim: 'Claim credits',
    olee: 'olee',
    risa: '😂😂😂',
    emailLabel: 'Email',
    emailHint: 'youremail@gmail.com',
    emailBubble: 'Use the email you registered with on',
    emailGo: 'Redeem',
    emailSubmit: 'Check in',
    emailSending: 'Checking in…',
    emailReady: "You're in",
    emailOther: 'Someone else',
    emailInvalid: 'That email is not valid.',
    emailMissing: 'The Luma key is missing on the server.',
    emailSkipped: 'Luma did not accept that email.',
    emailAbsent: 'That email is not registered on Luma.',
    emailWait: 'Luma has not finished the registration. Try again.',
    emailFailed: 'Could not check you in. Try again.',
    start: 'Start',
    started: 'Grok Bot Meetup',
    soon: 'Starting shortly',
    eventAria: '{name} on Luma',
    back: 'Back',
    tabTitle: 'Grok Bot Meetup',
    description: 'Check in and claim Cursor credits.'
  },

  wall: {
    edit: 'Edit',
    done: 'Done',
    title: 'Edit wall',
    language: 'Language',
    place: 'City',
    claimTitle: 'Title',
    morph: 'Change every',
    morphUnit: 's',
    claimUrl: 'Credits QR',
    qrEmpty: 'Add a URL to generate the QR.',
    repo: 'View repository',
    repoAria: 'This project on GitHub, in a new tab',
    overlay: 'Start screen',
    speed: 'Background speed',
    scale: 'Main bot size',
    height: 'Main bot height',
    textHeight: 'Text height',
    glance: 'Eyes glance side to side',
    shapes: 'Distinct shapes',
    colors: 'Distinct colours',
    eyes: 'Distinct eyes',
    count: 'Background bots',
    miniSize: 'Background bot size',
    reset: 'Reset to defaults',
    titleText: '“Grok Bot Meetup” text',
    soonText: '“Starting shortly” text',
    textSize: 'Size',
    textColor: 'Colour',
    textX: 'Horizontal position',
    textY: 'Vertical position',
    presentedBlock: 'Presented by SpaceX',
    presentedText: 'Text',
    show: 'Visible',
    hidden: 'Hidden',
    black: 'Black',
    white: 'White',
    mainBot: 'Main bot',
    thisBot: 'This bot',
    fieldBots: 'Background bots',
    pace: 'Speed',
    availableBots: 'Available bots'
  },

  states: {
    idle: 'Idle',
    thinking: 'Thinking',
    wink: 'Wink',
    wide: 'Wide eyes',
    alert: 'Alert',
    notify: 'Notification',
    exclaim: 'Exclamation',
    sleep: 'Sleep',
    egg: 'Egg',
    hexagon: 'Hexagon',
    play: 'Play',
    orbit: 'Orbit',
    burst: 'Burst',
    comet: 'Comet',
    swirl: 'Swirl'
  },

  shapes: {
    cercle: 'Circle',
    galet: 'Pebble',
    squircle: 'Squircle',
    capsule: 'Capsule',
    triangle: 'Triangle',
    hexagone: 'Hexagon',
    nuage: 'Cloud',
    goutte: 'Droplet'
  },

  colors: {
    encre: 'Ink',
    creme: 'Cream',
    brun: 'Brown',
    rouge: 'Red',
    orange: 'Orange',
    ambre: 'Amber',
    vert: 'Green',
    turquoise: 'Turquoise',
    bleu: 'Blue',
    violet: 'Purple',
    rose: 'Pink',
    gris: 'Grey'
  },

  expressions: {
    neutre: 'Neutral',
    attentif: 'Attentive',
    surpris: 'Surprised',
    excite: 'Excited',
    heureux: 'Happy',
    hilare: 'Laughing',
    colere: 'Angry',
    triste: 'Sad',
    effraye: 'Scared',
    mefiant: 'Suspicious',
    confus: 'Confused',
    curieux: 'Curious',
    fier: 'Proud',
    timide: 'Shy',
    blase: 'Unimpressed',
    somnolent: 'Sleepy'
  }
}

export default en
