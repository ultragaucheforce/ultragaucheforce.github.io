// Entrées : clavier, tactile et manette, fondus en un seul état d'actions
// { left, right, up, down, jump, fire, special } que la simulation lit à chaque pas.

import { hitsSolid } from '../sim/physics.js';
import { TILE } from '../sim/world.js';

/** Touches par POSITION sur le clavier (identiques en AZERTY et QWERTY). */
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump up', KeyW: 'jump up', // haut : on saute, et le tir vise vers le haut
  ArrowDown: 'down', KeyS: 'down', // bas : le tir vise vers le bas (on creuse)
  KeyJ: 'fire', KeyX: 'fire', Enter: 'fire',
  KeyK: 'special', KeyC: 'special', ShiftLeft: 'special', ShiftRight: 'special',
};
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'special'];

/**
 * Le nom court de chaque commande, tel qu'il est à l'écran sur chaque appareil. Les panneaux s'en servent :
 * « [tirer] : lancer des tracts » devient « J : lancer des tracts » au clavier, « LANCER : … » au pouce.
 */
export const KEY_NAMES = {
  clavier: { avancer: '← →', sauter: 'ESPACE', tirer: 'J', bas: '↓', haut: '↑', speciale: 'K', pause: 'Échap' },
  manette: { avancer: 'Croix', sauter: 'A', tirer: 'X', bas: '↓', haut: '↑', speciale: 'B', pause: 'Start' },
  pouce: { avancer: 'Pouce gauche', sauter: 'SAUT', tirer: 'LANCER', bas: 'Pouce ↓', haut: 'Pouce ↑', speciale: 'SPÉ', pause: 'II' },
};

/** Au clavier, une commande seule sur un panneau ou sur le carton dit aussi son autre touche. */
export const KEY_CHOICES = {
  clavier: { avancer: '← → ou Q D', sauter: 'ESPACE ou Z', tirer: 'J ou Entrée', speciale: 'K ou Maj' },
};

/** Le tableau des commandes (écran Commandes, README) : les mêmes touches que les panneaux. */
export const CONTROLS = [
  ['Avancer', '← → ou Q D', 'croix ou stick', 'moitié gauche : glisser le pouce'],
  ['Sauter, grimper', 'ESPACE ou Z', 'A', 'SAUT, ou pouce gauche vers le haut ; penché vers un mur, tenu, on grimpe'],
  ['Lancer (maintenir)', 'J ou Entrée', 'X ou gâchette droite', 'LANCER'],
  ['Creuser, lancer en haut', '↓ ou ↑ sans avancer, puis lancer', 'bas ou haut, puis lancer', 'pouce gauche vers le bas ou le haut, puis LANCER ; ou LANCER glissé vers le haut'],
  ['Spéciale', 'K ou Maj', 'B ou gâchette gauche', 'SPÉ'],
  ['Pause', 'Échap ou P', 'Start', 'II'],
  ['Piste suivante (en pause)', 'N', 'croix jusqu’à ⏭, puis A', '⏭, à côté de « Pause »'],
];

/** Les commandes en une ligne, pour le carton d'ouverture et la pause : [touche, ce qu'elle fait]. */
export const brief = (device) => {
  const k = { ...(KEY_NAMES[device] || KEY_NAMES.clavier) };
  const full = { ...k, ...KEY_CHOICES[device] };
  return [[full.avancer, 'avancer'], [full.sauter, 'sauter'], [full.tirer, 'lancer'], [`${k.bas} + ${k.tirer}`, 'creuser'], [full.speciale, 'spéciale']];
};

const TOKEN = /\[([^\]]+)\]/g;
/** « [ Spéciale ] » → « speciale » : sans espaces, sans accents, en minuscules. */
const tokenName = (word) => word.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Le texte d'un panneau pour cet appareil. `[tirer]`, `[sauter]`, `[avancer]`, `[bas]`, `[haut]`, `[spéciale]`, `[pause]`
 * deviennent la touche de l'appareil ; un mot inconnu entre crochets reste tel quel.
 * L'ancienne forme « au clavier // au pouce » marche encore.
 */
export function withKeys(text, device = 'clavier') {
  if (!text) return '';
  const [keys, thumbs] = text.split(' // ');
  const chosen = thumbs && device === 'pouce' ? thumbs : keys;
  const names = KEY_NAMES[device] || KEY_NAMES.clavier;
  const full = KEY_CHOICES[device] || {};
  return chosen.replace(TOKEN, (all, word, at) => {
    const name = tokenName(word);
    // Seule, une commande dit toutes ses touches (« J ou Entrée ») ; combinée (« [bas] + [tirer] ») ou répétée, la touche courte.
    const combined = /\+\s*$/.test(chosen.slice(0, at)) || /^\s*\+/.test(chosen.slice(at + all.length))
      || tokens(chosen).filter((t) => t === name).length > 1;
    return (!combined && full[name]) || names[name] || all;
  });
}

/** Les commandes qu'un panneau nomme, dans l'ordre : « [bas] + [tirer] : creuser » → `['bas', 'tirer']`. */
export const tokens = (text) => [...(text || '').matchAll(TOKEN)].map(([, word]) => tokenName(word));

/** Ce panneau nomme-t-il cette commande (`speciale`, `tirer`…), sous l'une des formes que `withKeys` reconnaît ? */
export const mentions = (text, action) => tokens(text).includes(action);

/** Les boutons et les axes de la manette standard que le jeu lit (voir `gamepad()` et `pollMenu()`). */
const PAD_BUTTONS = [0, 1, 2, 4, 5, 6, 7, 9, 12, 13, 14, 15];
const PAD_AXES = [0, 1];

/** Un élément à l'écran : ni `hidden`, ni `display: none`, ni `visibility: hidden`, lui ou un parent. */
export const shown = (el) => (el.checkVisibility
  ? el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })
  : el.getClientRects().length > 0);

/**
 * Le joueur se sert-il de cette manette ? Seuls comptent les boutons et les axes que le jeu lit : une manette
 * générique posée sur la table, dont un axe inutilisé ne revient jamais à zéro, ne prend pas la main au clavier.
 */
export const padInUse = (pad) => PAD_BUTTONS.some((i) => pad.buttons[i]?.pressed) || PAD_AXES.some((i) => Math.abs(pad.axes[i] || 0) > 0.5);

/**
 * Les zones tactiles, en fractions de l'écran tenu en paysage.
 * Moitié gauche : un manche flottant, là où le pouce se pose. Moitié droite : chaque bouton ne répond que dans un
 * cercle autour de lui, à peine plus grand que son disque ; ailleurs, rien. Un doigt qui glisse garde son action
 * tant qu'il n'est pas entré dans le cercle de l'autre bouton ; posé dans le vide, il ne fait rien jusqu'à entrer
 * dans celui de TIR ou de SAUT. TIR glissé vers le haut, le tir vise en haut. SPÉ ne répond qu'à un doigt posé sur elle.
 */
export const ZONES = {
  split: 0.5, // frontière entre le manche et les actions
  dead: 10, // course morte du manche, en pixels
  reach: 44, // course utile : au-delà, le manche suit le pouce
  lift: 26, // pousser le manche vers le haut d'autant de pixels : saut (avant le bout de sa course, diagonale comprise)
  drop: 16, // … et le saut ne se relâche que redescendu sous autant de pixels : un pouce qui tremble ne sautille pas
  cone: 30, // poussé vers le haut à moins de 30° de la verticale : on ne marche pas, le tir vise en haut
  slack: 12, // … et on n'en sort qu'au-delà de 30 + 12° : un pouce qui tremble de 3 px ne fait pas clignoter la marche
  pull: 26, // tirer le manche vers le bas d'autant de pixels : le tir vise en bas (on creuse)
  both: 26, // dans les cercles de TIR et de SAUT à la fois, à peu près à égale distance (écart en pixels) : les deux
  aim: 0.11, // un doigt de TIR glissé vers le haut d'autant (en fraction du petit côté de l'écran) : le tir vise en haut
  // Le rayon des disques dessinés (`style.css` : 21vmin et 15vmin de diamètre), en fraction du petit côté de l'écran.
  disc: { fire: 0.105, jump: 0.105, special: 0.075 },
  // La marge autour d'un disque où il répond encore : 4 % du petit côté, 14 à 16 px sur un téléphone (342 à 390 px).
  // Un pouce appuie sur 45 à 57 px : posé à 15 px hors du bord, plus de la moitié de son appui est sur le bouton.
  margin: 0.04,
  stick: { x: 0.14, y: 0.72 }, // où le manche se repose quand personne n'y touche
  targets: [
    { action: 'fire', x: 0.87, y: 0.72 },
    { action: 'jump', x: 0.71, y: 0.84 },
    { action: 'special', x: 0.9, y: 0.34 },
  ],
};

/** Le rayon où un bouton répond, en fraction du petit côté de l'écran : son disque et la marge. */
export const ring = (action) => ZONES.disc[action] + ZONES.margin;

/** Le manche est-il poussé vers le haut ? Une fois en haut, il y reste tant qu'il ne redescend pas franchement. */
const lifted = (rise, was) => rise > (was ? ZONES.drop : ZONES.lift);
/** Poussé à moins de 30° de la verticale (42° pour en sortir, une fois dedans) ? */
const upright = (dx, rise, was) => rise > 0 && Math.abs(dx) <= rise * Math.tan(((ZONES.cone + (was ? ZONES.slack : 0)) * Math.PI) / 180);

/** Les centres des trois boutons, en pixels, et l'unité des boutons à l'écran (`vmin`). */
function spots(view) {
  const spot = (action) => {
    const t = ZONES.targets.find((z) => z.action === action);
    return { action, x: t.x * view.w, y: t.y * view.h };
  };
  return { unit: Math.min(view.w, view.h), fire: spot('fire'), jump: spot('jump'), special: spot('special') };
}

/** Les boutons dont le cercle contient ce point, du plus proche au plus loin. */
function under(x, y, view, actions) {
  const s = spots(view);
  return actions
    .map((action) => ({ action, d: Math.hypot(x - s[action].x, y - s[action].y) }))
    .filter((t) => t.d <= ring(t.action) * s.unit)
    .sort((m, n) => m.d - n.d);
}

/**
 * Ce que fait un doigt de droite là où il se pose : `special`, `jump`, `fire`, `jump fire` à cheval entre les deux
 * (seulement là où leurs cercles se recouvrent, ce qui n'arrive pas sur un téléphone), ou `''` : hors des cercles, rien.
 */
function landing(x, y, view) {
  const [first, second] = under(x, y, view, ['special', 'jump', 'fire']);
  if (!first) return '';
  if (second && first.action !== 'special' && second.action !== 'special' && second.d - first.d < ZONES.both) return 'jump fire';
  return first.action;
}

/**
 * Un doigt de droite qui glisse garde son action, jusqu'à entrer dans le cercle de l'autre bouton ; posé dans le vide,
 * il ne fait rien jusqu'à entrer dans celui de TIR ou de SAUT. SPÉ ne se quitte ni ne se gagne. Là où les deux
 * cercles se recouvrent (pas sur un téléphone), il garde ce qu'il faisait.
 */
function gliding(act, x, y, view) {
  if (act === 'special') return act;
  const hits = under(x, y, view, ['jump', 'fire']);
  return hits.length === 1 ? hits[0].action : act;
}

/**
 * Quelles actions sont enfoncées, étant donné les doigts posés ? Fonction pure, testée dans Node.
 * @param {{x: number, y: number, ox: number, oy: number, ay?: number, fy?: number, stick?: boolean, act?: string}[]} points
 *        position de chaque doigt, point où il s'est posé, `ay` : le point le plus haut d'où il redescend (sinon `oy`),
 *        `stick` : vrai s'il s'est posé à gauche (sinon on le déduit de `ox`), et `act` : l'action d'un doigt de droite
 *        suivi pas à pas (`trackPoint`) ; sans elle, celle de l'endroit où il s'est posé, puis du bouton où il est ;
 *        `fy` : la hauteur où il a commencé à tirer (sinon `oy`)
 * @param {{w: number, h: number}} view  taille de l'écran de jeu, en pixels
 */
export function touchActions(points, view) {
  const pressed = {};
  const { unit, fire } = spots(view);
  for (const p of points) {
    if (p.stick ?? p.ox < view.w * ZONES.split) {
      const dx = p.x - p.ox;
      const down = p.y - (p.ay ?? p.oy);
      const rise = p.oy - p.y;
      if (down > ZONES.pull && down > Math.abs(dx)) {
        pressed.down = true; // tiré vers le bas : on vise sous ses pieds, sans avancer
        continue;
      }
      // Suivi pas à pas (`trackPoint`), le doigt garde ce qu'il a déjà dit ; sinon on le lit sur sa seule position.
      if (p.lifted ?? lifted(rise, false)) {
        pressed.jump = true;
        if (p.upright ?? upright(dx, rise, false)) {
          pressed.up = true; // poussé vers le haut, de biais ou non : on ne marche pas, le tir suit vers le haut
          continue;
        }
      }
      if (dx < -ZONES.dead) pressed.left = true;
      else if (dx > ZONES.dead) pressed.right = true;
      continue;
    }
    // SPÉ part d'un doigt posé sur elle, jamais d'un pouce qui glisse depuis TIR ou SAUT ; posé dessus, il reste SPÉ.
    // Hors des cercles, le doigt ne fait rien : le coin en haut à droite ne tire pas.
    const act = p.act ?? gliding(landing(p.ox, p.oy, view), p.x, p.y, view);
    if (!act) continue;
    for (const a of act.split(' ')) pressed[a] = true;
    // Glissé vers le haut depuis là où il a commencé à tirer (posé, ou entré dans le cercle), et arrivé au-dessus du
    // centre du bouton : le tir vise en haut. Posé en haut du bouton, ou roulé dans sa moitié basse, il tire droit.
    if (act === 'fire' && (p.fy ?? p.oy) - p.y > ZONES.aim * unit && p.y < fire.y) pressed.up = true;
  }
  return pressed;
}

/**
 * Suit un doigt d'un événement à l'autre. Son côté est fixé quand il se pose : parti de la droite, il reste une
 * action même s'il glisse à gauche. Seul le manche déplace son origine pour suivre le pouce.
 * @param {object | undefined} p  l'état du doigt (absent au premier contact)
 * @param {{x: number, y: number}} at  sa position, dans le repère du jeu
 * @param {{w: number, h: number}} view
 */
export function trackPoint(p, at, view) {
  const next = { ...(p || { ox: at.x, oy: at.y, ay: at.y, stick: at.x < view.w * ZONES.split }), ...at };
  if (!next.stick) {
    // À droite, le doigt garde ce qu'il fait d'un pas à l'autre : un pouce qui roule sur SAUT ne se met pas à tirer.
    next.act = gliding(next.act ?? landing(next.ox, next.oy, view), next.x, next.y, view);
    // `fy` : la hauteur où il commence à tirer, posé sur TIR ou entré dans son cercle ; viser en haut se mesure de là.
    if (next.act !== 'fire') delete next.fy;
    else if (p?.act !== 'fire' || next.fy === undefined) next.fy = next.y;
    return next;
  }
  // Le manche suit le pouce : sorti de l'anneau, l'anneau glisse avec lui, dans la direction du pouce. On change de
  // direction tout de suite, et un pouce parti loin en haut à gauche dit toujours « en haut à gauche ».
  const dx = next.x - next.ox;
  const rise = Math.max(0, next.oy - next.y);
  const reach = Math.hypot(dx, rise);
  if (reach > ZONES.reach) {
    next.ox = next.x - (dx * ZONES.reach) / reach;
    if (rise > 0) next.oy = next.y + (rise * ZONES.reach) / reach;
  }
  if (next.y - next.oy > ZONES.dead) next.oy = next.y - ZONES.dead;
  // Pour viser en bas, on mesure la descente depuis le point le plus haut atteint, sur la course du manche.
  next.ay = Math.max(Math.min(next.ay, next.y), next.y - ZONES.reach);
  // Ce que le manche dit déjà ne bascule pas au moindre tremblement : un seuil pour entrer, un plus large pour sortir.
  next.lifted = lifted(next.oy - next.y, p?.lifted);
  next.upright = next.lifted && upright(next.x - next.ox, next.oy - next.y, p?.upright);
  return next;
}

/** Un rebond n'en appelle un autre que s'il a fait monter le héros d'au moins autant de pixels… */
const CLIMB_GAIN = 24;
/** … et au plus trois rebonds d'eux-mêmes par seconde (en pas de 1/60 s) : le rythme d'un pouce, pas une vibration. */
const CLIMB_EVERY = 20;

/** Du solide dans ce rectangle, sans compter les bords de la carte : ce ne sont pas des murs où grimper. */
function wallIn(world, x, y, w, h) {
  const x0 = Math.max(0, Math.floor(x / TILE));
  const x1 = Math.min((world.w ?? Infinity) - 1, Math.floor((x + w - 0.001) / TILE));
  for (let tx = x0; tx <= x1; tx++) if (hitsSolid(world, tx * TILE, y, TILE, h)) return true;
  return false;
}

/**
 * Grimper au pouce, d'un geste tenu. Le pouce penche vers un mur (en diagonale, pas tout droit en haut), le saut est
 * tenu (manche ou SAUT), le héros est en l'air contre ce mur : il y rebondit chaque fois qu'il redescend, et grimpe.
 * Pouce tout droit en haut, rien ne change : il saute et tire en haut, sans être tiré de côté. Au clavier et à la
 * manette, rien ne change non plus : on y grimpe en tapant le saut.
 * Lit la partie, ne la modifie pas : seul le saut tenu se relâche un instant, pour repartir du mur.
 * @param {object} touch  les actions des doigts (`touchActions`)
 * @param {{x: number, y: number, w: number, h: number, vy: number, onGround: boolean, dead?: boolean}} hero
 * @param {{solid(tx: number, ty: number): boolean, w?: number}} world
 * @param {{let?: boolean, from?: number, top?: number, since?: number, button?: boolean}} memo  d'un pas à l'autre : le
 *        saut relâché au pas d'avant, d'où part le dernier rebond, le plus haut atteint et les pas passés depuis, et
 *        SAUT enfoncé
 * @param {boolean} [button]  le pouce droit appuie sur SAUT : chaque nouvel appui contre le mur est un rebond, comme
 *        au clavier, même quand le manche tient déjà le saut
 */
export function climbAssist(touch, hero, world, memo, button = false) {
  const side = touch.left ? -1 : touch.right ? 1 : 0;
  const press = button && !memo.button;
  memo.button = button;
  if (!touch.jump || !side || !hero || hero.onGround || hero.dead) {
    memo.let = false;
    memo.from = undefined;
    memo.top = undefined;
    memo.since = undefined;
    return touch;
  }
  memo.top = Math.min(memo.top ?? hero.y, hero.y);
  memo.since = (memo.since ?? 0) + 1; // le saut qui l’a décollé du sol compte aussi
  // Un rebond par appui : quand il redescend contre le mur, le saut se relâche un pas, puis repart. Jamais contre le
  // bord de la carte, jamais sous un plafond, pas de nouveau rebond si le précédent ne l'a pas fait monter, et pas
  // plus de trois par seconde. Un appui du joueur sur SAUT, lui, rebondit toujours.
  const touching = wallIn(world, side > 0 ? hero.x + hero.w : hero.x - 1, hero.y, 1, hero.h);
  const ceiling = wallIn(world, hero.x, hero.y - TILE, hero.w, TILE);
  const gained = memo.from === undefined || memo.from - memo.top >= CLIMB_GAIN;
  const ready = hero.vy >= 0 && !ceiling && gained && memo.since >= CLIMB_EVERY;
  if (touching && !memo.let && (press || ready)) {
    memo.let = true;
    memo.from = hero.y;
    memo.top = hero.y;
    memo.since = 0;
    return { ...touch, jump: false };
  }
  memo.let = false;
  return touch;
}

/**
 * Un nouvel appui sur le saut, d'où qu'il vienne. Le manche poussé en haut tient déjà le saut ; SAUT enfoncé par-dessus
 * est pourtant un nouvel appui, et le héros doit sauter. Pareil pour ↑ tenu puis Espace au clavier. Chaque source compte
 * à part : il suffit qu'une d'elles vienne de s'enfoncer.
 * @param {string[]} sources  ce qui tient le saut à ce pas (`manche`, `SAUT`, `manette`, ou le code d'une touche)
 * @param {{from?: Set<string>}} memo  ce qui le tenait au pas d'avant
 */
export function freshJump(sources, memo) {
  const fresh = sources.some((s) => !memo.from?.has(s));
  memo.from = new Set(sources);
  return fresh;
}

export class Input {
  /** @param {HTMLElement} pad  la surface tactile : elle couvre tout l'écran de jeu */
  constructor(pad) {
    this.pad = pad;
    this.keys = {};
    this.menuKeys = new Set(); // touches enfoncées hors partie, ignorées en jeu jusqu'à leur relâchement
    this.card = false; // vrai sous le carton d'un camarade libéré : la partie reprend dès qu'il se ferme
    this.touch = {};
    this.pointers = new Map();
    this.active = false; // vrai seulement en pleine partie : ailleurs, le clavier sert aux menus
    this.onPause = () => {}; // P, Start
    this.onBack = () => {}; // Échap, et B de la manette hors partie : l'écran d'avant (en partie, Échap met en pause)
    this.onAny = () => {}; // premier geste : sert à débloquer le son
    this.onDevice = () => {}; // le joueur a changé d'appareil : les écrans ouverts redisent les touches
    this.held = new Set(); // boutons de manette tenus en quittant un menu : ils ne comptent en jeu qu'une fois relâchés
    this.climb = {}; // au pouce, le mur que le héros grimpe (voir `climbAssist`)
    this.jumps = {}; // ce qui tenait le saut au pas d'avant (voir `freshJump`)
    // L'appareil dont on montre les touches : le dernier qui a servi.
    this.device = document.body.classList.contains('tactile') ? 'pouce' : 'clavier';

    // Sous le carton d'un camarade libéré, une touche de jeu enfoncée compte dès qu'il se ferme, si elle est encore
    // tenue. Écouté à la capture, avant le carton : la touche qui le ferme, il la garde pour lui.
    addEventListener('keydown', (e) => {
      if (this.card && !e.repeat && KEYS[e.code]) this.keys[e.code] = KEYS[e.code];
    }, true);
    addEventListener('keydown', (e) => {
      this.onAny();
      this.use('clavier');
      // Échap et P basculent : une touche tenue ne bascule qu'une fois.
      if (e.code === 'Escape') return e.repeat || this.onBack();
      if (e.code === 'KeyP') return e.repeat || this.onPause();
      const action = KEYS[e.code];
      if (!action) return;
      // Enfoncée hors partie (Entrée sur « C'est parti », une flèche dans un menu, en pause) : elle ne compte pas
      // en jeu, répétitions comprises, tant qu'on ne l'a pas relâchée. Sous le carton d'un camarade, si (voir plus haut).
      if (!this.active && !this.card && !e.repeat) this.menuKeys.add(e.code);
      if (!this.active || this.menuKeys.has(e.code)) return;
      // En jeu, la répétition compte aussi : une touche tenue reprend après une perte de focus sans être réappuyée.
      this.keys[e.code] = action;
      e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      delete this.keys[e.code];
      this.menuKeys.delete(e.code);
    });
    addEventListener('blur', () => this.release());
    document.addEventListener('visibilitychange', () => document.hidden && this.release());

    // Les repères à l'écran : le manche et trois cibles, posés aux endroits que dit ZONES.
    this.stick = pad.querySelector('.manche');
    this.marks = [...pad.querySelectorAll('[data-action]')];
    for (const mark of this.marks) {
      const target = ZONES.targets.find((t) => t.action === mark.dataset.action);
      mark.style.left = `${target.x * 100}%`;
      mark.style.top = `${target.y * 100}%`;
    }

    const track = (e) => {
      this.onAny();
      const p = trackPoint(this.pointers.get(e.pointerId), this.locate(e), this.view);
      this.pointers.set(e.pointerId, p);
      this.refreshTouch();
      e.preventDefault();
    };
    const drop = (e) => {
      this.pointers.delete(e.pointerId);
      this.refreshTouch();
    };
    addEventListener('pointerdown', (e) => e.pointerType === 'touch' && this.use('pouce'), true);
    pad.addEventListener('pointerdown', (e) => {
      try {
        pad.setPointerCapture(e.pointerId); // le doigt reste suivi même s'il sort de la zone
      } catch {
        // pointeur déjà relâché ou navigateur sans capture : on suit quand même
      }
      track(e);
    });
    pad.addEventListener('pointermove', (e) => this.pointers.has(e.pointerId) && track(e));
    pad.addEventListener('pointerup', drop);
    pad.addEventListener('pointercancel', drop);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS : pas de zoom au pincement ni au double toucher pendant le jeu.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    this.refreshTouch();
  }

  /** L'écran de jeu est-il pivoté d'un quart de tour (téléphone tenu debout) ? */
  get turned() {
    return document.documentElement.classList.contains('pivote');
  }

  /** Taille de l'écran de jeu, dans son propre repère. */
  get view() {
    return this.turned ? { w: innerHeight, h: innerWidth } : { w: innerWidth, h: innerHeight };
  }

  /** Position d'un doigt dans le repère du jeu. */
  locate(e) {
    return this.turned ? { x: e.clientY, y: innerWidth - e.clientX } : { x: e.clientX, y: e.clientY };
  }

  refreshTouch() {
    const { view } = this;
    const points = [...this.pointers.values()];
    this.touch = touchActions(points, view);
    this.button = Boolean(touchActions(points.filter((p) => !p.stick), view).jump); // SAUT, sous le pouce droit
    this.lever = Boolean(touchActions(points.filter((p) => p.stick), view).jump); // le manche poussé en haut
    for (const mark of this.marks) mark.classList.toggle('appuye', Boolean(this.touch[mark.dataset.action]));
    // La flèche de TIR s'allume quand le tir part vraiment en haut : sans avancer (la règle de la simulation, partout).
    const { fire, up, left, right, down } = this.touch;
    this.marks.find((m) => m.dataset.action === 'fire')?.classList.toggle('haut', Boolean(fire && up && !left && !right && !down));
    const thumb = points.find((p) => p.stick);
    const at = thumb ? { x: thumb.ox, y: thumb.oy } : { x: ZONES.stick.x * view.w, y: ZONES.stick.y * view.h };
    this.stick.style.left = `${at.x}px`;
    this.stick.style.top = `${at.y}px`;
    this.stick.classList.toggle('appuye', Boolean(thumb));
    // La boule reste dans l'anneau, dans la direction du pouce, même quand il en sort.
    const dx = thumb ? thumb.x - thumb.ox : 0;
    const dy = !thumb ? 0 : thumb.y < thumb.oy ? thumb.y - thumb.oy : thumb.y - thumb.ay; // poussé en haut, ou tiré en bas
    const k = Math.min(1, ZONES.reach / (Math.hypot(dx, dy) || 1));
    this.stick.style.setProperty('--dx', `${dx * k}px`);
    this.stick.style.setProperty('--dy', `${dy * k}px`);
  }

  /**
   * Tout est relâché : la page a perdu la main (autre fenêtre, onglet caché), les touches levées ailleurs ne nous
   * parviendront pas. Avec `keys` faux, seuls les doigts sont relâchés : les touches tenues restent, et leur
   * relâchement nous parvient toujours (`keyup`). Un changement d'écran garde ainsi les flèches qu'on tient.
   */
  release(keys = true) {
    if (keys) {
      this.keys = {};
      this.menuKeys.clear();
    }
    this.pointers.clear();
    this.refreshTouch();
  }

  /** Note l'appareil qui vient de servir ; s'il change, les touches affichées changent avec lui. */
  use(device) {
    if (device === this.device) return;
    this.device = device;
    this.onDevice(device);
  }

  /** La manette branchée, s'il y en a une ; on la note comme appareil en cours dès qu'on y touche. */
  findPad() {
    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
    if (pad && padInUse(pad)) this.use('manette');
    return pad;
  }

  /** Les boutons de la manette tels que les menus les lisent. */
  menuButtons(pad) {
    const b = (i) => Boolean(pad.buttons[i]?.pressed);
    return {
      next: b(13) || b(15) || pad.axes[1] > 0.5 || pad.axes[0] > 0.5,
      prev: b(12) || b(14) || pad.axes[1] < -0.5 || pad.axes[0] < -0.5,
      ok: b(0),
      back: b(1),
      start: b(9),
    };
  }

  /** Manette standard : croix ou stick, A = saut, X ou gâchette droite = tir, B ou gâchette gauche = spéciale. */
  gamepad() {
    const pad = this.findPad();
    if (!pad) return {};
    const raw = (i) => Boolean(pad.buttons[i]?.pressed);
    // Le bouton qui a fermé un menu (B sur la pause, A sur « Reprendre ») ne part pas en jeu tant qu'il reste enfoncé :
    // B est aussi la spéciale, A le saut.
    for (const i of this.held) if (!raw(i)) this.held.delete(i);
    const b = (i) => raw(i) && !this.held.has(i);
    // Ce qui est tenu en jouant ne compte pas comme un appui dans le menu qui s'ouvre (A, B tenus en mettant en pause).
    this.padMenu = this.menuButtons(pad);
    if (b(9)) {
      if (!this.padPause) this.onPause();
      this.padPause = true;
    } else this.padPause = false;
    return {
      left: b(14) || pad.axes[0] < -0.4,
      right: b(15) || pad.axes[0] > 0.4,
      up: b(12) || pad.axes[1] < -0.6,
      down: b(13) || pad.axes[1] > 0.6,
      jump: b(0),
      fire: b(2) || b(7) || b(5),
      special: b(1) || b(6) || b(4),
    };
  }

  /** Manette hors partie : croix ou stick pour changer de bouton, A pour valider, B pour revenir, Start pour reprendre. */
  pollMenu() {
    const pad = this.findPad();
    if (!pad) return;
    const now = this.menuButtons(pad);
    const was = this.padMenu || {};
    this.padMenu = now;
    this.padPause = now.start; // évite un second basculement au retour en partie
    const pressed = (k) => now[k] && !was[k];
    if (pressed('start')) return this.onPause();
    // A et B servent aussi en jeu (saut, spéciale) : l'appui qui agit ici est retenu jusqu'à ce qu'on le relâche.
    if (pressed('ok')) this.held.add(0);
    if (pressed('back')) this.held.add(1);
    const card = document.querySelector('.carton');
    if (card) {
      if (pressed('ok')) card.dispatchEvent(new Event('pointerdown'));
      return;
    }
    // Une carte ouverte par-dessus l'écran : B la ferme comme Échap, et la croix ne parcourt qu'elle.
    const layer = document.querySelector('#ecran .carte-ouverte');
    if (pressed('back')) {
      if (layer) layer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      else this.onBack();
      return;
    }
    // Seulement ce qu'on voit : un panneau replié ou un bouton caché n'arrête pas la croix.
    const items = [...(layer || document).querySelectorAll(layer ? 'button:not(:disabled), a.bouton' : '#ecran button:not(:disabled), #ecran a.bouton')]
      .filter(shown);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement);
    if (pressed('ok')) (items[at] || items[0]).click();
    else if (pressed('next')) items[(at + 1) % items.length].focus();
    else if (pressed('prev')) items[(at - 1 + items.length) % items.length].focus();
  }

  /**
   * L'état lu par la simulation.
   * @param {{hero: object, world: object}} [game]  la partie en cours : au pouce, le héros grimpe d'un geste tenu
   */
  actions(game) {
    const held = {};
    for (const actions of Object.values(this.keys)) for (const action of actions.split(' ')) held[action] = true;
    const pad = this.gamepad();
    const touch = game ? climbAssist(this.touch, game.hero, game.world, this.climb, this.button) : this.touch;
    const out = {};
    for (const a of ACTIONS) out[a] = Boolean(held[a] || touch[a] || pad[a]);
    const sources = Object.keys(this.keys).filter((code) => this.keys[code].split(' ').includes('jump'));
    if (pad.jump) sources.push('manette');
    if (this.lever) sources.push('manche');
    if (this.button) sources.push('SAUT');
    out.jumpPressed = freshJump(sources, this.jumps) && out.jump;
    return out;
  }
}
