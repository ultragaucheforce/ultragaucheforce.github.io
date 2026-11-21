// Démarrage du jeu dans le navigateur : charge le contenu, branche les entrées, fait tourner
// la simulation à pas fixe (60 pas par seconde) et passe d'un écran à l'autre.

import { Game, DT } from '../sim/game.js';
import { botActions } from '../sim/bot.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Radio } from './music.js';
import { Screens, Hud } from './ui.js';
import { coach, guideView } from './consigne.js';
import { showHeroCard } from './herocard.js';
import { showTaxScene, draw } from './tax.js';
import { INJURY_FILE } from './blesses.js';
import { shareImage, openShare } from './share.js';
import { measure, runStarted, runEnded, heroRescued } from './mesure.js';
import { loadSave, storeSave, discover, isFound, followSystemMotion, tutorialDone } from './save.js';
import { TUTORIAL, nextStep, startingHero, cardName, citationOfWord, levelOrder, signNote, taxShocks, trait } from './collection.js';
import { registerServiceWorker } from './sw-register.js';

// Le contenu, parti dès index.html. S'il n'arrive pas, la mesure le compte (l'erreur, elle, suit son cours).
const bundle = await (async () => (await (window.contentRequest ?? fetch('content.json'))).json())().catch((error) => {
  measure('content_failed', { online: navigator.onLine !== false });
  throw error;
});
const save = loadSave();
// Le système demande moins de mouvement : « Effets réduits » est coché d'office, tant que le joueur n'a rien choisi.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
followSystemMotion(save.options, reducedMotion.matches);
const screenRoot = document.getElementById('ecran');
const audio = new Audio(bundle);
const radio = new Radio(bundle, document.getElementById('radio'));
const renderer = new Renderer(document.getElementById('monde'), document.getElementById('textes'), bundle);
const input = new Input(document.getElementById('tactile'));
const hud = new Hud(bundle);
let floorMarks = undefined; // les mesures du HUD avec lesquelles le bandeau du bas a été mesuré
const editButton = document.getElementById('edition'); // en essai depuis l'Atelier : retour à l'édition, à côté de la pause
const toasts = document.getElementById('toasts');
let noteShown = null; // la note dont la boîte a été donnée au rendu
let noteMarks = null; // les mesures du HUD d'alors
let hudBand = -1; // le bas du HUD déjà donné aux notes (`--bas-hud`) : on ne le réécrit que s'il change

/** @type {Game | null} */
let game = null;
let mode = 'menu'; // menu (démo en fond) | playing | paused | card | over
let current = null; // { id, level } du niveau en cours
let custom = null; // niveau de l'Atelier en cours de test
let begin = null; // le carton d'ouverture attend : fonction qui lance vraiment le niveau
let bot = {};
let won = []; // clés de ce qui a été débloqué depuis le début du niveau : la rangée de l'écran de fin
let visited = null; // le niveau lancé, tant qu'il n'est ni gagné ni quitté : « Recommencer » y garde sa musique
let run = null; // la partie en cours, pour la mesure : { level, mode, hero, playing } (`mesure.js`)
let guiding = false; // dans le tuto, les panneaux attendent le geste (`consigne.js`)
let guide = null; // la consigne en cours
// Le temps d'écran pas encore joué. Il repart d'un quart de pas, jamais de zéro : à 60 Hz, une image dure un pas,
// et un reste nul laisserait le moindre écart d'horloge jouer tantôt zéro pas, tantôt deux (le décor saute).
const PHASE = DT / 4;
let acc = PHASE;
let last = performance.now();

/**
 * Une image d'écran qui dure un demi-pas, un pas ou deux, à une milliseconde près (120, 60 ou 30 Hz, mais aussi 59,94 Hz,
 * ou une horloge arrondie à la milliseconde), compte pour ce qu'elle doit durer. Sinon l'écart s'accumule dans le reste
 * du pas, et toutes les quelques secondes une rafale d'images joue zéro pas puis deux. La partie suit alors l'écran :
 * à 59,94 Hz, elle va moins vite d'un millième.
 */
function frameTime(dt) {
  const k = Math.round(dt / (DT / 2));
  return k >= 1 && k <= 4 && Math.abs(dt - (k * DT) / 2) < 0.001 ? (k * DT) / 2 : dt;
}

// Radio Manif injoignable (réseau coupé, SoundCloud bloqué) : compté une fois par visite.
radio.onUnreachable = () => {
  if (radio.reported) return;
  radio.reported = true;
  measure('music_unreachable', { online: navigator.onLine !== false });
};

radio.onAsk = () => { // « ▶ Radio Manif » : la musique demandée (`applyOptions` le compte)
  save.options.musique = true;
  save.options.musiqueChoisie = true;
  storeSave(save);
  applyOptions();
};

let musicOn = null; // la musique demandée, à la dernière application des options : un changement se compte

function applyOptions() {
  const music = save.options.musique;
  if (musicOn !== null && music !== musicOn) {
    const track = radio.current;
    measure(music ? 'music_unmuted' : 'music_muted', { track: track?.id ?? null, slot: radio.moment(), ...(music || !track ? {} : radio.heardOf(track)) });
  }
  musicOn = music;
  audio.enabled = save.options.son;
  renderer.reduced = save.options.sobre;
  document.body.classList.toggle('sobre', save.options.sobre); // la feuille de style coupe ses animations
  radio.setEnabled(save.options.musique); // la Radio sait où en est le jeu : elle reprend la musique du moment
}

const screens = new Screens(screenRoot, {
  bundle, save, audio,
  go: {
    play: (id) => start(id),
    resume: () => setMode('playing'),
    restart: () => (custom ? start(null, custom) : start(current.id)),
    checkpoint: () => {
      game.respawn();
      renderer.snap(game);
      setMode('playing');
    },
    quit: () => toMenu(),
    skip: () => {
      tutorialDone(save); // passé : « Jouer » mène désormais à la campagne
      endRun('abandoned', 'passer');
      won = []; // ce que le tuto a débloqué ne passe pas dans l'écran de fin de l'étape suivante
      start(nextStep(bundle, save));
    },
    tutorial: () => current?.id === TUTORIAL,
    atelier: (button) => openAtelier(button),
    edit: () => backToEdit(),
    testing: () => Boolean(custom),
    options: () => applyOptions(),
    radio: () => radio.controls(),
    learn: (ids) => ids.forEach((id) => collect('fiches', id, true)),
    back: () => (mode === 'paused' ? screens.pause() : screens.menu()),
    playing: () => mode === 'paused',
    device: () => input.device,
  },
});

function setMode(next) {
  mode = next;
  if (next === 'playing') screens.close();
  hud.setVisible(next === 'playing' || next === 'paused' || next === 'card');
  hud.live = next === 'playing'; // en pause ou sous un carton, la spéciale ne clignote pas
  document.body.classList.toggle('en-jeu', next === 'playing');
  radio.setVisible(next !== 'playing' && next !== 'card', next === 'playing' || next === 'paused' || next === 'card');
  renderer.demo = next === 'menu';
  input.release(false); // les touches tenues restent : sous un carton ou en pause, on ne lâche pas les flèches
  input.active = next === 'playing';
  input.card = next === 'card';
  acc = PHASE;
}

/** Fond du menu : une vraie partie, jouée par le robot de test. */
function attract() {
  const id = levelOrder(bundle)[0];
  if (!id) return (game = null);
  game = new Game(bundle, id, { seed: Math.floor(Math.random() * 1e9), invincible: true });
  bot = {};
  renderer.snap(game);
}

/** Une partie mesurée se termine : gagnée, perdue, ou abandonnée (`via` : menu, « Recommencer », autre niveau, page fermée). */
function endRun(outcome, via = null, options = undefined) {
  if (!run) return;
  runEnded(run, game, outcome, via, options);
  run = null;
}

function toMenu() {
  endRun('abandoned', 'menu');
  begin = null;
  custom = null;
  current = null;
  visited = null;
  showEditButton(false);
  setMode('menu');
  attract();
  screens.menu();
  radio.play('menu');
}

/**
 * Une rencontre : la carte entre dans la Collection, avec la citation et le fait qui l'expliquent.
 * La première fois, on l'annonce (sauf `quiet`).
 */
function collect(kind, id, quiet = false) {
  const lines = kind === 'pancartes' || kind === 'manchettes'; // sans fiche : identifiées par leur texte
  const item = lines ? bundle[kind].find((p) => p.texte === id) : bundle[kind]?.[id];
  if (!item || !discover(save, kind, item.id)) return;
  won.push(`${kind}:${item.id}`);
  if (kind === 'pancartes') hud.toast(signNote(item), `rarete-${item.rarete} pancarte`, 'pancartes');
  else if (!quiet) {
    const what = trait(kind, item); // ce que fait un ennemi ou une recrue, dit dès la rencontre
    hud.toast(`Débloqué : ${cardName(item)}${what ? ` · ${what}` : ''}`, '', 'cartes');
  }
  collect('citations', item.citation, true);
  for (const fiche of [item.fiche].flat()) collect('fiches', fiche, true);
}

/** Les drapeaux des luttes que porte le cortège se débloquent en les voyant. (Les pancartes, elles, se tirent au hasard.) */
function collectCortege() {
  for (const m of game.cortege) if (m.kind === 'drapeau') collect('drapeaux', m.label, true);
}

function start(id, level = null) {
  const again = current?.id === (id ?? 'atelier'); // « Recommencer » : ce qui a déjà été débloqué dans ce niveau reste
  endRun('abandoned', again ? 'recommencer' : 'autre_niveau');
  custom = level;
  current = { id: id ?? 'atelier', level: level ?? bundle.niveaux[id] };
  // Dans l'Atelier, on essaie le niveau avec le héros que dit sa fiche, pas celui de la sauvegarde ; le tuto part
  // toujours avec le sien, pour que le camarade libéré lance autre chose.
  const tutorial = !level && id === TUTORIAL;
  const hero = level ? { id: '', source: 'atelier' } : tutorial ? { id: current.level.heros, source: 'tuto' } : startingHero(bundle, save);
  game = new Game(bundle, id, { seed: Math.floor(Math.random() * 1e9), level, hero: hero.id });
  guiding = tutorial;
  guide = null;
  renderer.snap(game);
  hud.reset();
  if (!begin && !again) won = []; // un changement de héros sur le carton d'ouverture garde ce qui a déjà été débloqué
  if (id && !tutorial) collect('niveaux', id, true); // le tuto est noté vu à « C'est parti » : un « ← Retour » le garde
  collect('citations', current.level.citation, true);
  collect('heros', game.hero.def.id, true);
  collectCortege();
  showEditButton(Boolean(level));
  setMode('paused');
  fitRight();
  begin = () => {
    begin = null;
    if (tutorial) {
      collect('niveaux', id, true);
      tutorialDone(save); // le tuto joué : le prochain « Jouer » mène à la campagne
    }
    // Chaque vraie partie, rejouée ou non ; pas un changement de héros sur le carton. Un niveau de l'Atelier
    // compte sous le seul nom « atelier » : rien de ce qu'on y écrit ne part.
    run = runStarted({
      level: id ?? 'atelier', mode: id ? (bundle.campagne.includes(id) ? 'campagne' : 'hors_campagne') : 'atelier',
      hero: game.hero.def.id, heroSource: hero.source, input: input.device, again: visited === current.id, // « Recommencer »
    });
    setMode('playing');
    // « Recommencer » (pause, « Game over ») : la même visite, sa piste continue ou revient après le boss.
    radio.play(current.id, current.level.musique, { restart: visited === current.id });
    visited = current.id;
  };
  screens.intro(current.level, () => begin?.(), game.hero.def.id, !level && !tutorial);
}

let atelier = null; // le module de l'Atelier, chargé à sa première ouverture : le menu n'en a pas besoin

/**
 * Ouvre l'Atelier. La première fois, il se charge : le bouton qui l'ouvre le dit, et dit s'il manque le réseau.
 * @param {boolean} resume  retour d'un essai : l'Atelier reprend l'édition là où on l'avait laissée
 */
async function openAtelier(button = null, resume = false) {
  if (!atelier) {
    const label = button?.innerHTML; // le libellé et son étiquette « bêta »
    const slow = button && setTimeout(() => (button.textContent = 'Chargement…'), 150);
    atelier = await import('./atelier.js').catch(() => null);
    clearTimeout(slow);
    if (button && atelier) button.innerHTML = label;
    else if (button) button.textContent = 'Atelier : pas de réseau';
    if (!atelier || (button && !button.isConnected)) return; // pas de réseau, ou le joueur est passé à un autre écran
  }
  setMode('menu');
  document.body.dataset.ecran = 'atelier';
  screens.escape = atelier.showAtelier(screenRoot, { bundle, save, resume, test: (level) => start(null, level), back: () => toMenu() });
}

/** Quitter un essai, à tout moment : l'édition du même brouillon. */
function backToEdit() {
  toMenu();
  openAtelier(null, true);
}

/** En essai, le bouton de retour à l'édition s'affiche à côté de la pause ; les notes se rangent à sa gauche. */
function showEditButton(on) {
  editButton.hidden = !on;
  document.body.classList.toggle('essai', on);
  hud.marks = null; // la première ligne du HUD a changé : à remesurer
}

/** La largeur des boutons du HUD à droite : au pouce, les notes s'arrêtent avant eux. */
function fitRight() {
  const width = document.querySelector('#hud .droite').offsetWidth;
  if (width) document.getElementById('scene').style.setProperty('--hud-droite', `${width}px`);
}

function togglePause() {
  if (mode === 'playing') {
    setMode('paused');
    screens.pause();
  } else if (begin) begin();
  else if (mode === 'paused' && screens.open) setMode('playing');
}

/** Échap : en pleine partie, la pause ; ailleurs, l'écran d'avant (une carte ouverte se ferme d'abord, d'elle-même). */
function back() {
  if (mode === 'playing') togglePause();
  else screens.escape?.();
}

async function win() {
  endRun('won'); // tout de suite : la scène de taxe qui suit fait partie de la victoire
  begin = null;
  visited = null; // « Rejouer » après une victoire : une nouvelle entrée dans le niveau
  setMode('over');
  audio.play('victoire');
  const { level, id } = current;
  const boss = game.boss?.def; // celui qu'on vient d'affronter : il est tiré au hasard
  let said = null; // ce que l'écran de taxe a dit des 2 % : l'image à partager le reprend
  let shock = null; // après la taxe, un fait sur les inégalités : l'écran de fin le donne dans « Et en vrai ? »
  if (boss?.fortune.montant) {
    const tax = await showTaxScene(screenRoot, bundle, boss, { audio, hero: game.hero.def });
    tax.learned.forEach((f) => collect('fiches', f, true));
    collect('boss', boss.id, true);
    said = tax.said;
    shock = draw('choc', taxShocks(bundle)) ?? null;
  }
  // « Et en vrai ? » : le fait du niveau, d'où vient le décompte des automates désactivés, le fait tiré après la taxe.
  const hurt = game.stats.breakdownsBySelf + game.stats.breakdownsByPlayer + game.stats.overrunOrder;
  const facts = [[level.fiche].flat()[0], hurt > 0 && INJURY_FILE.fiche, shock?.id].filter((id) => id && bundle.fiches[id]);
  for (const fiche of [...[level.fiche].flat(), ...facts]) collect('fiches', fiche, true);
  const order = levelOrder(bundle);
  const index = order.indexOf(id);
  // Le score d'un niveau, c'est la taille de la manif à l'arrivée ; on garde le record.
  const best = save.records[id] || 0;
  if (!custom && game.crowd > best) save.records[id] = game.crowd;
  if (index >= 0) save.termines[id] = true;
  storeSave(save);
  // La pancarte de l'image : la plus rare de celles qui sont arrivées dans la manif pendant cette partie.
  const sign = game.signs.map((t) => bundle.pancartes.find((p) => p.texte === t)).filter(Boolean)
    .reduce((top, p) => (!top || p.rarete >= top.rarete ? p : top), null);
  const crowd = game.crowd;
  const share = () => {
    openShare(shareImage({
      frames: [document.getElementById('monde'), document.getElementById('textes')],
      level: level.titre, crowd, tax: said, sign: sign?.texte, where: (location.host + location.pathname).replace(/(index\.html)?\/?$/, ''),
    }), {
      text: `✊ ${crowd.toLocaleString('fr-FR')} dans la manif. À toi.`, url: location.origin + location.pathname,
      button: (label, action, className) => screens.button(label, action, className),
    });
  };
  screens.end({
    level, hurt, seed: game.seed, facts, time: game.time, crowd, won, best: custom ? null : best, share,
    next: id === TUTORIAL ? nextStep(bundle, save) : index >= 0 ? order[index + 1] : null,
    last: index === order.length - 1,
  });
  won = []; // rejouer ce niveau repart d'une rangée vide
}

/** Réagit aux événements émis par la simulation pendant un pas. */
function handle(events) {
  renderer.absorb(events);
  for (const e of events) {
    if (e.type === 'sfx') audio.play(e.id);
    else if (e.type === 'headline') {
      hud.banner(e.text, e.credit);
      collect('manchettes', e.text, true);
      audio.play('papier', { volume: 0.6 });
    } else if (e.type === 'panic') audio.play(e.level >= 2 ? 'casseroles' : 'sifflet');
    else if (e.type === 'boss' && e.state === 'enter') {
      audio.speak(game.boss.def.id);
      radio.play('boss', current?.level?.['musique-boss'] || null); // la première piste du boss, si le niveau la nomme
    }
    else if (e.type === 'card') collect('fiches', e.id);
    else if (e.type === 'discover') {
      // Un mot crié, par eux ou par nous : la vraie citation dont il vient entre dans la Collection.
      if (e.kind === 'mot') collect('citations', citationOfWord(bundle, e.id)?.id, true);
      else collect({ ennemi: 'ennemis', recrue: 'recrues' }[e.kind] || e.kind, e.id);
    } else if (e.type === 'recruit') collectCortege();
    else if (e.type === 'sign') collect('pancartes', e.text);
    else if (e.type === 'respawn' && run) run.playing = e.hero; // après une mort, le héros d'avant dans la pile
    else if (e.type === 'heroCard') {
      heroRescued(run, e.hero);
      const hero = bundle.heros[e.hero];
      const first = !isFound(save, 'heros', hero.id); // débloqué pour la première fois : le carton dure deux fois plus
      collect('heros', hero.id, true);
      collectCortege(); // les soutiens venus avec le camarade libéré
      // Le grand carton joue à chaque libération. Il est opaque : le monde n'est pas redessiné dessous,
      // sauf une fois quand il s'efface, tel que le joueur va le retrouver (caméra arrivée, panneau passé).
      setMode('card');
      const opened = performance.now();
      const onClose = () => {
        Object.assign(renderer.cam, renderer.target(game)); // la caméra arrivée
        renderer.draw(game, (performance.now() - opened) / 1000);
      };
      showHeroCard(bundle, hero, { audio, reduced: save.options.sobre, first, seed: game.seed, onClose }).then(() => {
        if (mode !== 'card') return;
        setMode('playing');
        if (game.level.cortege) audio.play('slogan'); // le cortège salue le camarade libéré
      });
    } else if (e.type === 'won') win();
    else if (e.type === 'lost') {
      endRun('lost');
      begin = null;
      setMode('over');
      screens.lost();
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = frameTime(Math.min(0.1, (now - last) / 1000));
  last = now;
  if (mode !== 'playing') input.pollMenu();
  if (!game) return;
  const demo = mode === 'menu';
  if (mode === 'playing' || demo) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 6 && (mode === 'playing' || mode === 'menu')) {
      acc -= DT;
      steps++;
      const actions = demo ? botActions(game, bot) : input.actions(game);
      game.step(actions);
      if (!demo) coachStep(actions);
      renderer.follow(game); // la caméra avance avec le monde, pas à pas
      const events = game.events.splice(0);
      if (demo) renderer.absorb(events);
      else handle(events);
    }
    if (steps === 6) acc = PHASE; // onglet ralenti : on ne rattrape pas le retard
    renderer.tick(dt);
    if (demo && game.status !== 'playing') attract();
  }
  renderer.device = input.device;
  hud.device = input.device;
  showGuide(demo);
  if (!demo) hud.update(game); // d'abord le HUD : le dessin se place sous lui tel qu'il est à cette image
  placeOverHud(demo);
  if (mode !== 'card') renderer.draw(game, dt); // sous le carton de héros, opaque, rien à redessiner (voir `handle`)
}

/** La consigne suit le pas qui vient d'être joué : le panneau lu, les actions envoyées. */
function coachStep(actions) {
  if (guiding) guide = coach(guide, { sign: game.sign, actions, time: game.time, hero: game.hero });
}

/** Le rendu et le HUD montrent la consigne en cours : le panneau tenu, le ✓, ce qui clignote au pouce. */
function showGuide(demo) {
  renderer.guide = hud.guide = guiding && !demo ? guideView(guide) : null;
  renderer.tutorial = guiding && !demo; // dans le tuto, le panneau lu est mis en avant (`Renderer.signBoard`)
}

/**
 * Ce que le dessin doit laisser au HUD, d'après sa mesure (faite une fois, refaite quand sa forme change) : au pouce,
 * le panneau d'aide se pose sous sa première ligne, puce SPÉ comprise, et sous la barre de vie du boss ou d'une ligne
 * quand elle est là ; textes flottants, étiquettes et bulle du boss restent sous tout le HUD, compteur de la manif
 * compris, même quand la puce passe à la ligne.
 */
/** La boîte d'un élément du HUD, en pixels du jeu, dans le repère de l'image (null s'il n'est pas affiché). */
function sceneBox(el) {
  if (!el.offsetParent) return null;
  const scene = hud.el.offsetParent; // le repère du HUD, comme `Hud.measures`
  let x = 0;
  let y = 0;
  for (let e = el; e && e !== scene; e = e.offsetParent) {
    x += e.offsetLeft;
    y += e.offsetTop;
  }
  const r = renderer.ratio;
  return { x0: x / r - 2, x1: (x + el.offsetWidth) / r + 2, y0: y / r - 2, y1: (y + el.offsetHeight) / r + 2 };
}

function placeOverHud(demo) {
  const { row, bar, band } = demo ? { row: 0, bar: 0, band: 0 } : hud.measures();
  renderer.hudBottom = band;
  // Le bandeau en bas de l'image (hors du pouce) : rien ne s'écrit dessous. Remesuré seulement avec le HUD.
  const marks = demo ? null : hud.marks;
  if (marks !== floorMarks) {
    floorMarks = marks;
    const ticker = document.getElementById('bandeau');
    renderer.floorBand = !demo && !document.body.classList.contains('tactile') && !ticker.hidden ? ticker.offsetHeight : 0;
  }
  // La note d'une pancarte, sur deux ou trois lignes, se pose sous tout le HUD, barre de vie comprise (voir style.css).
  if (band !== hudBand) toasts.style.setProperty('--bas-hud', `${(hudBand = band)}px`);
  // La note à l'écran : le jeu écrit autour d'elle (bulle du boss, étiquettes, voix, gains, pancartes, panneau lu).
  // Mesurée dans la mise en page (juste aussi quand tout pivote), seulement quand elle change ou que le HUD bouge.
  const shown = !demo && !toasts.classList.contains('attend') ? hud.note?.el ?? null : null;
  if (shown !== noteShown || hud.marks !== noteMarks) {
    noteShown = shown;
    noteMarks = hud.marks;
    renderer.noteBox = shown ? sceneBox(shown) : null;
  }
  if (!demo && document.body.classList.contains('tactile')) renderer.signTop = Math.max(30, Math.ceil((Math.max(row, bar) + 6) / renderer.ratio));
}

// ---------------------------------------------------------------- branchements

hud.onQuote = (id) => mode === 'playing' && collect('citations', id, true);
input.onPause = togglePause;
input.onBack = back;
input.onAny = () => audio.unlock();
input.onDevice = () => screens.open && screens.refreshKeys(); // un carton ou une pause ouverts redisent les touches
document.getElementById('pause').onclick = togglePause;
editButton.onclick = () => backToEdit();
addEventListener('pointerdown', () => audio.unlock(), true);
// Une musique que le navigateur a refusé de lancer sans geste repart au prochain toucher, clic ou touche.
// Juste après le geste, pas pendant : si ce geste lance un niveau, la piste du niveau passe d'abord.
// (Un dixième de seconde : le geste compte encore pour le navigateur.)
// Un geste sur ⏸/▶ ou ⏭ est le leur : ils décident eux-mêmes (▶ lance, ⏸ coupe).
const onRadio = (e) => Boolean(e.target?.closest?.('.radio-bouton'));
const unblockRadio = (e) => onRadio(e) || setTimeout(() => radio.unblock(), 100);
addEventListener('pointerup', unblockRadio, true);
addEventListener('touchend', (e) => onRadio(e) || radio.unblock(), true); // Safari sur iPhone : la fin du toucher, aussitôt
addEventListener('keydown', unblockRadio, true);
// N, dans le menu de pause : la piste suivante de Radio Manif, comme son bouton ⏭.
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyN' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (mode === 'paused' && screenRoot.querySelector(':scope > .pause')) radio.next();
});
// Le réseau revient (métro, train) : Radio Manif aussi, même si le jeu a été lancé hors ligne.
addEventListener('online', () => {
  radio.reconnected();
  applyOptions();
});
const PHONE = 950; // plus grand côté d'un téléphone, en pixels : au-delà (tablette, ordinateur tactile), on ne pivote pas

function layout() {
  const root = document.documentElement;
  const thumbs = document.body.classList.contains('tactile');
  // Au pouce, sur téléphone, le jeu se joue en paysage : tenu debout, tout pivote d'un quart de tour.
  // Pas en pleine saisie : le clavier virtuel rétrécit la fenêtre et ferait basculer l'écran.
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (!typing) root.classList.toggle('pivote', thumbs && innerHeight > innerWidth && innerHeight < PHONE);
  // La hauteur visible de l'écran de jeu : les styles s'en servent à la place de `vh`, qui ignore le pivot.
  const height = root.classList.contains('pivote') ? innerWidth : innerHeight;
  root.style.setProperty('--vh', `${height / 100}px`);
  root.style.setProperty('--vw', `${(root.classList.contains('pivote') ? innerHeight : innerWidth) / 100}px`);
  root.classList.toggle('bas', height <= 480);
  renderer.resize();
  renderer.anchor = thumbs ? 0.58 : 0.62; // les pouces occupent les coins du bas : on remonte un peu l'action
  // Au clavier, le panneau se pose à 140 pixels environ ; une note du coin gauche plus longue (une pancarte, sur trois
  // lignes) le fait descendre sous elle, tant qu'il est à l'écran (`Renderer.signBoard`).
  // Au pouce, le HUD est sous le bandeau : le panneau se pose sous sa première ligne (`placeOverHud`).
  renderer.signTop = thumbs ? 30 : Math.max(30, Math.ceil((140 * (window.devicePixelRatio || 1)) / renderer.scale));
  hud.marks = null; // à remesurer
  if (!hud.el.hidden) hud.relayout(); // le fil change de largeur, ses lettres de taille
  fitRight();
  input.refreshTouch();
  screens.fitShelf(); // la Collection ouverte : une rangée de cartes tient-elle encore sous ses rayons ?
}
addEventListener('resize', layout);
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  acc = PHASE;
  if (document.hidden && mode === 'playing' && !window.__ugf) togglePause(); // pas en débogage : on pilote onglet caché
  radio.setHidden(document.hidden); // coupée par le système pendant ce temps (téléphone verrouillé), la musique reprend au retour
});
if (matchMedia('(pointer: coarse)').matches) {
  document.body.classList.add('tactile');
  input.device = 'pouce'; // un écran tactile : on montre les commandes du pouce, jusqu'à ce qu'un clavier ou une manette serve
}
addEventListener('touchstart', () => {
  document.body.classList.add('tactile');
  input.use('pouce');
  layout();
}, { once: true, passive: true });
// Au premier toucher, on demande le plein écran, puis le paysage : là où le navigateur le permet.
addEventListener('pointerup', function ask(e) {
  if (e.pointerType !== 'touch') return; // un clic de souris d'abord ne doit pas user la demande
  removeEventListener('pointerup', ask);
  if (document.fullscreenElement) return;
  // L'appli installée s'ouvre déjà en plein écran : redemander le plein écran laisse, sur Android, une bande blanche
  // à la place de la barre d'état quand elle se cache.
  if (matchMedia('(display-mode: fullscreen)').matches) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
    ?.then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {}); // refusé (iPhone, réglage du navigateur) : le pivot de la page fait le travail
});

// Crochet de débogage (`?debug`) : piloter et inspecter la partie sans jouer en temps réel.
if (new URLSearchParams(location.search).has('debug')) {
  window.__ugf = {
    get game() { return game; },
    get mode() { return mode; },
    get guide() { return guiding ? guide : undefined; },
    bundle, start, toMenu, setMode, screens, input, radio, audio,
    /** Redessine tout de suite (utile quand l'onglet est en arrière-plan). */
    draw(snap = false) {
      if (snap) renderer.snap(game);
      renderer.tick(1 / 60);
      showGuide(false);
      hud.update(game);
      placeOverHud(false);
      renderer.draw(game, 1 / 60);
    },
    /** Avance de n pas avec des actions fixes, ou avec le robot si `actions` vaut 'bot'. */
    step(n = 1, actions = {}) {
      for (let i = 0; i < n && game.status === 'playing'; i++) {
        const sent = actions === 'bot' ? botActions(game, bot) : actions;
        game.step(sent);
        coachStep(sent);
        renderer.follow(game);
        handle(game.events.splice(0));
      }
      return { x: Math.round(game.hero.x), y: Math.round(game.hero.y), status: game.status, lives: game.lives, panic: Math.round(game.panic) };
    },
  };
}

layout();
applyOptions();
reducedMotion.addEventListener?.('change', (e) => followSystemMotion(save.options, e.matches) && applyOptions());
registerServiceWorker((apply) => {
  screens.update = apply; // une nouvelle version attend : le menu la propose, jamais en pleine partie
  if (mode === 'menu' && screens.open) screens.menu();
});
// Fermer la page en pleine partie, c'est l'abandonner ; l'envoi part avec la page.
addEventListener('pagehide', () => endRun('abandoned', 'fermeture', { transport: 'sendBeacon' }));
toMenu();
// Le menu est là : la page a chargé. Une page vue sans cet événement est un jeu qui n'a pas démarré.
measure('game_ready', { touch: document.body.classList.contains('tactile') });
requestAnimationFrame(frame);
