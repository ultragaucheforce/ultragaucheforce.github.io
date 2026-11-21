// Les écrans du jeu, en HTML : texte net à toute taille, liens cliquables vers les sources.
// Chaque fonction remplit `#ecran` ; `close()` le vide et rend la main au jeu.

import { h, link, quoted, signature } from './dom.js';
import { spriteElement } from './sprites.js';
import { REPO, REFERENCES } from './config.js';
import { measuring } from './mesure.js';
import { storeSave, eraseProgress, isFound, isReadOnly } from './save.js';
import { SHELVES, TUTORIAL, VOTE_FICHES, nextLevel, allCards, collectionCount, isFresh, levelOrder, markSeen, openCard, progress, rarityCounts, shelfGrid, wonCards } from './collection.js';
import { livesStack } from './lives.js';
import { KEY_NAMES, CONTROLS, brief, mentions } from './input.js';
import { injuryReport } from './blesses.js';
import { PANIC_STEPS } from '../sim/game.js';
import { makeRng } from '../sim/rng.js';
import { SIGN_LINGER } from './render.js';

const MENTION = 'Satire citoyenne, libre et collaborative.';

/**
 * Les mentions légales (LCEN) : un éditeur particulier, identifié auprès de l'hébergeur, sans nom ici.
 * Valentin, 17 novembre 2026 : « anonyme + hébergeur, pas de pseudonyme visible à cet endroit ».
 * Le même texte, sans JavaScript : `mentions-legales.html`.
 */
const legalNotice = () => [
  h('p', {}, h('b', {}, 'Éditeur : '), 'un particulier, à titre non professionnel. Son identité a été communiquée à l’hébergeur (loi pour la confiance dans l’économie numérique).'),
  h('p', {}, h('b', {}, 'Hébergeur : '), 'GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.'),
  h('p', {}, h('b', {}, 'Contact : '), link(`${REPO}/issues`, 'les issues du dépôt'), ' (il faut un compte GitHub).'),
];
const PANIC_NAMES = ['calme', 'alerte', 'hystérie']; // les trois crans de la chaîne
const SCROLL = 3; // vitesse du fil, en hauteurs de lettre par seconde : il défile en continu, comme à la télé
const SCROLL_SLOW = 1.5; // en effets réduits : il défile quand même, deux fois moins vite (il ne passe jamais à la ligne)
const SCROLL_AFTER = 2.4; // secondes, au moins, pendant lesquelles le dernier mot d'une alerte reste à l'écran
const REDUCED = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? { matches: false };
const HYSTERIA = 2; // le cran où la chaîne ne lâche plus sa citation : plus de rotation
// Une rafale de notes du même genre se replie en une seule : « 3 pancartes débloquées ».
const FOLDS = { pancartes: 'pancartes débloquées', cartes: 'cartes débloquées' };
const LINE_BAR_X = 260; // la barre de vie d'une ligne s'affiche quand le héros arrive à cette distance d'elle…
const LINE_BAR_Y = 112; // …et à peu près à sa hauteur (distances fixes : la même sur tous les écrans)
const LINE_BAR_EMPTY = 0.8; // secondes de jeu pendant lesquelles la barre d'une ligne qui vient de céder reste, vide

/** La ligne qui tient (`ligne.vie`) la plus proche du héros, s'il arrive devant elle. */
export function lineAhead(game) {
  const { hero } = game;
  if (!hero || hero.dead) return null;
  const hx = hero.x + hero.w / 2;
  const near = (e) => Math.abs(e.x + e.w / 2 - hx) < LINE_BAR_X && Math.abs(e.y + e.h - (hero.y + hero.h)) < LINE_BAR_Y;
  return game.enemies
    .filter((e) => e.def.ligne?.vie > 0 && e.blocking && e.state !== 'done' && near(e))
    .sort((a, b) => Math.abs(a.x + a.w / 2 - hx) - Math.abs(b.x + b.w / 2 - hx))[0] ?? null;
}

/**
 * La barre de vie d'une ligne, à la place de celle du boss : `{ nom, part }` (part entre 0 et 1), ou null.
 * Une ligne qui vient de céder garde sa barre, vide, LINE_BAR_EMPTY secondes. `memo` retient la dernière montrée.
 */
export function lineBar(game, memo) {
  if (memo.game !== game) Object.assign(memo, { game, line: null, gone: null }); // une autre partie : on oublie l'ancienne
  const line = lineAhead(game);
  if (line) {
    Object.assign(memo, { line, gone: null });
    return { nom: line.def.nom, part: Math.max(0, line.hp / line.def.ligne.vie) };
  }
  if (memo.line?.state === 'done') {
    memo.gone ??= game.time;
    if (game.time - memo.gone < LINE_BAR_EMPTY) return { nom: memo.line.def.nom, part: 0 };
  }
  memo.line = null;
  return null;
}

/**
 * Combien de secondes une alerte tient l'antenne : `seconds` au moins, et assez pour que son dernier mot ait défilé à
 * l'écran, puis y reste SCROLL_AFTER secondes. `over` : ses pixels de trop pour le fil, en lettres de `em` pixels ;
 * `slow` : effets réduits, le fil va deux fois moins vite. Une alerte qui tient (`over` ≤ 0) garde ses `seconds`.
 */
export function alertTime(over, em, seconds, slow = false) {
  if (!(over > 0)) return seconds;
  return Math.max(seconds, over / (em * (slow ? SCROLL_SLOW : SCROLL)) + SCROLL_AFTER);
}

/**
 * Le fil de PANIQUE TV, sans le DOM : des morceaux de texte posés bout à bout sur une piste qui avance à vitesse
 * constante, de droite à gauche. Chaque morceau garde sa place (`x`, en pixels sur la piste) : rien ne saute quand un
 * morceau sort à gauche ou qu'un autre arrive à droite. `offset` : de combien la piste a avancé.
 */
export class Crawl {
  constructor() {
    this.items = [];
    this.offset = 0;
  }

  reset() {
    this.items = [];
    this.offset = 0;
  }

  /** Où finit la piste : le prochain morceau se pose là. */
  end() {
    const last = this.items.at(-1);
    return last ? last.x + last.w : 0;
  }

  /** Pose un morceau de `w` pixels au bout de la piste. */
  push(w, data = {}) {
    const item = { x: this.end(), w, ...data };
    this.items.push(item);
    return item;
  }

  /** La piste avance de `px` pixels. */
  advance(px) {
    this.offset += px;
  }

  /** Il manque du texte : le bout de la piste entre dans les `room` pixels visibles. */
  hungry(room) {
    return this.end() - this.offset < room;
  }

  /**
   * Retire les morceaux sortis à gauche (au-delà de `margin` pixels), et ramène la piste à zéro d'autant :
   * les morceaux restants ne bougent pas à l'écran. Rend les morceaux retirés.
   */
  drop(margin = 0) {
    const gone = [];
    while (this.items.length > 1 && this.items[0].x + this.items[0].w < this.offset - margin) gone.push(this.items.shift());
    const shift = this.items[0]?.x ?? 0;
    if (shift) {
      for (const item of this.items) item.x -= shift;
      this.offset -= shift;
    }
    return gone;
  }

  /** Le morceau qui passe au bord gauche du fil : c'est lui que l'étiquette annonce. */
  lead() {
    return this.items.find((item) => item.x + item.w > this.offset) ?? this.items.at(-1) ?? null;
  }
}

/**
 * Secondes de jeu à l'écran pour une note : le temps de la lire, et un peu plus, d'autant plus long que le texte :
 * de 3,75 à 8 secondes. Une note de 71 signes au plus (« Débloqué : … ») reste sous 6 secondes ; celle d'une pancarte,
 * écrite en entier, peut aller jusqu'à 8.
 */
export const readTime = (text) => Math.min(8, Math.max(3.75, 2.25 + text.length * 0.0525));

/**
 * Range une note dans la file d'attente. Si une note du même genre (`group`) attend déjà, elles se replient
 * en une seule, « 2 pancartes débloquées », quelle que soit leur rareté ; le bord prend la couleur de la plus rare.
 */
export function queueNote(notes, { text, tone = '', group = '' }) {
  const waiting = group && notes.find((n) => n.group === group);
  if (!waiting) {
    notes.push({ text, tone, group, count: 1 });
    return notes;
  }
  waiting.count++;
  waiting.text = `${waiting.count} ${FOLDS[group]}`;
  const rank = (t) => Number(/rarete-(\d)/.exec(t)?.[1] ?? -1);
  if (rank(tone) > rank(waiting.tone)) waiting.tone = tone;
  return notes;
}

/** « CC-BY-SA-3.0 » → « CC BY-SA 3.0 » : à l'écran, toutes les licences s'écrivent de la même façon. */
export const licenceName = (id) => id.replace(/^CC-/, 'CC ').replace(/-(\d+(?:\.\d+)*)$/, ' $1');

export class Screens {
  /**
   * @param {HTMLElement} root
   * @param {{bundle: object, save: object, audio: object, go: Record<string, Function>}} ctx
   *        `go` : les actions que les écrans déclenchent (play, resume, restart, checkpoint, quit, atelier, options…)
   */
  constructor(root, ctx) {
    this.root = root;
    Object.assign(this, ctx);
    this.open = false;
    this.escape = null; // ce que fait Échap sur l'écran ouvert : revenir à l'écran d'avant (null : rien)
  }

  /** Ouvre un écran. Échap n'y fait rien, sauf si l'écran le dit juste après (`this.escape`). */
  show(className, ...children) {
    this.root.replaceChildren(h('section', { className: `panneau ${className}` }, ...children));
    document.body.dataset.ecran = className.split(' ')[0]; // la feuille de style sait quel écran est ouvert
    this.root.hidden = false;
    this.open = true;
    this.escape = null;
    // Le bouton principal prend la main (Entrée, manette) ; sinon le premier.
    (this.root.querySelector('button.gros') || this.root.querySelector('button, a'))?.focus({ preventScroll: true });
  }

  close() {
    this.root.replaceChildren();
    delete document.body.dataset.ecran;
    this.root.hidden = true;
    this.open = false;
    this.escape = null;
  }

  button(label, action, className = '') {
    return h('button', { type: 'button', className, onclick: () => { this.audio.play('clic'); action(); } }, label);
  }

  back(action = () => this.menu()) {
    return this.button('← Retour', action, 'discret');
  }

  /** En essai depuis l'Atelier : revenir à l'édition du même niveau. Hors essai : rien. */
  editButton(className = '') {
    return this.go.testing?.() ? this.button('← Retour à l’édition', () => this.go.edit(), className) : null;
  }

  /** L'Atelier est en bêta : le bouton qui l'ouvre le dit. */
  /** Le bouton qui ouvre l'Atelier, avec son étiquette « bêta » ; il dit, sur lui, que l'Atelier se charge. */
  atelierButton(label) {
    const button = this.button([label, ' ', h('small', { className: 'beta' }, 'bêta')], () => this.go.atelier(button));
    return button;
  }

  /** L'appareil dont on montre les touches : clavier, manette ou pouce. */
  get device() {
    return this.go.device?.() || 'clavier';
  }

  /** Les commandes de l'appareil en cours, en une ligne. */
  keys() {
    return h('p', { className: 'touches' }, brief(this.device).map(([key, verb]) => h('span', {}, h('kbd', {}, key), ` ${verb}`)));
  }

  /** Le joueur a changé d'appareil : les lignes de commandes à l'écran suivent. */
  refreshKeys() {
    for (const line of this.root.querySelectorAll('.touches')) line.replaceWith(this.keys());
    if (this.root.querySelector('.commandes')) this.controls();
  }

  // ------------------------------------------------------------------ menu

  menu() {
    // Cinq héros tirés au hasard à chaque affichage de l'accueil (tous s'il y en a moins de cinq).
    const heroes = Object.values(this.bundle.heros).filter((x) => x.statut === 'jouable')
      .map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).slice(0, 5).map(([, x]) => x);
    this.show('menu',
      h('div', { className: 'logo' }, h('span', {}, 'UltraGauche'), h('span', {}, 'Force')),
      h('p', { className: 'devise' }, 'Taxez les riches. Abattez la Citadelle.'),
      h('div', { className: 'troupe' }, heroes.map((x) => spriteElement(x.sprites.repos, this.bundle.palette, 4))),
      h('nav', {},
        this.button('Jouer', () => this.go.play(this.nextLevel()), 'gros'),
        this.button('Campagne', () => this.levels()),
        this.button(`Collection ${collectionCount(this.bundle, this.save).found}/${collectionCount(this.bundle).total}`, () => this.collection()),
        this.atelierButton('Atelier'),
        this.button('Commandes', () => this.controls()),
        this.bundle.niveaux[TUTORIAL] && this.button('Tuto', () => this.go.play(TUTORIAL)),
        this.button('Options', () => this.options()),
        this.button('À propos', () => this.about()),
        this.update && this.button('Mettre à jour', this.update)),
      isReadOnly(this.save) && h('p', { className: 'mention' }, 'Cette sauvegarde vient d’une version plus récente du jeu. Mets le jeu à jour. En attendant, rien n’est enregistré.'),
      h('p', { className: 'mention' }, MENTION, ' ', link(REPO, 'Open source.')));
  }

  /** La prochaine étape ; tant que le tuto n'a été ni joué ni passé, le tuto, même avec une progression. */
  nextLevel() {
    return nextLevel(this.bundle, this.save);
  }

  /**
   * Le plan de campagne : toutes les étapes, l'une après l'autre. Le clavier attend sur la prochaine à jouer.
   * Une étape terminée porte sa coche verte et, à côté de « Jouer », son record : la plus grande manif à l'arrivée.
   */
  levels() {
    const { niveaux } = this.bundle;
    const next = this.nextLevel();
    let ahead = null;
    const stop = (id, i) => {
      const lv = niveaux[id];
      const best = this.save.records[id];
      const done = this.save.termines[id];
      // L'accroche dit le lieu ; sans elle (un niveau dessiné dans l'Atelier), l'étape crédite son auteur.
      const line = lv.accroche || (lv.auteur && `par ${lv.auteur}`);
      const play = this.button('Jouer', () => this.go.play(id));
      if (id === next) ahead = play;
      return h('li', { className: done ? 'faite' : '' },
        h('span', { className: 'numero' }, String(i + 1)),
        h('div', {}, h('h3', {}, lv.titre, done && [' ', h('span', { className: 'coche' }, '✔︎')]), line && h('p', {}, line)),
        best ? h('div', { className: 'record' }, h('small', {}, 'Record'), h('b', {}, `✊ ${best.toLocaleString('fr-FR')}`)) : null,
        play);
    };
    this.show('liste plan',
      h('h2', {}, 'Plan de campagne'),
      h('ol', { className: 'etapes' }, levelOrder(this.bundle).map(stop)),
      h('div', { className: 'pied' }, this.back(), this.atelierButton('Dessiner une étape')));
    this.escape = () => this.menu();
    ahead?.focus({ preventScroll: true });
    ahead?.closest('li').scrollIntoView({ block: 'center' }); // un écran bas défile jusqu'à elle
  }

  // ------------------------------------------------------------------ Collection

  /**
   * L'album : un rayon par onglet, des cartes compactes qu'on ouvre d'un toucher.
   * Ce qui n'a pas encore été croisé en jouant reste en silhouette.
   * @param {{rarity?: number | null, keep?: number | null, back?: (() => void) | null}} o
   *        `rarity` : le filtre ; `keep` : le filtre qui garde le clavier ; `back` : l'écran d'où l'on vient
   *        (par défaut le menu, ou la pause en pleine partie)
   */
  collection(tab = SHELVES[0].id, { rarity = null, keep = null, back = null } = {}) {
    const { bundle, save } = this;
    const leave = back || (() => this.go.back());
    const all = collectionCount(bundle, save);
    const fresh = new Set(allCards(bundle).filter((c) => isFound(save, c.kind, c.item.id) && isFresh(save, c)).map((c) => c.shelf));
    // Un héros déjà rencontré se joue depuis sa carte ; pas en pleine partie, où ce serait l'abandonner.
    const actionsFor = (card) => (card.kind === 'heros' && !this.go.playing() ? [this.button('Jouer avec', () => this.playAs(card.item.id), 'gros')] : []);
    let shown = null;
    // Valentin, 17 novembre 2026 : « passe le bouton retour à droite du titre "Collection: finalement ." » (après « à gauche du titre », même jour).
    this.show('biblio',
      h('h2', {}, 'Collection ', h('small', {}, `${all.found} / ${all.total}`)),
      this.button('← Retour', leave, 'retour'),
      progress(all.found, all.total),
      h('div', { className: 'onglets' }, SHELVES.map((shelf) => {
        const { found, total } = collectionCount(bundle, save, shelf.id);
        if (!total) return null;
        const label = [shelf.titre, ' ', h('small', {}, `${found}/${total}`), fresh.has(shelf.id) && shelf.id !== tab && h('i', { className: 'pastille' }), progress(found, total)];
        const button = this.button(label, () => this.collection(shelf.id, { back }), shelf.id === tab ? '' : 'discret');
        if (shelf.id === tab) shown = button;
        return button;
      })),
      // La rangée des filtres garde sa hauteur sur les rayons sans rareté : la grille ne saute pas (style.css).
      h('div', { className: 'barre' },
        h('div', { className: 'raretes' }, rarityCounts(bundle, save, tab).reverse().map((r) => Object.assign(this.button(
          [`${r.name}s `, h('small', {}, `${r.found}/${r.total}`)],
          () => this.collection(tab, { rarity: rarity === r.rarity ? null : r.rarity, keep: r.rarity, back }), `rarete-${r.rarity}${rarity === r.rarity ? '' : ' discret'}`),
        { ariaPressed: String(rarity === r.rarity) })))),
      h('div', { className: 'contenu album' }, shelfGrid(bundle, tab, save, actionsFor, rarity)));
    this.escape = leave;
    this.fitShelf();
    // Le clavier reste où il était : sur le filtre qu'on vient de toucher, sinon sur le rayon ouvert.
    const keyboard = keep === null ? shown : this.root.querySelector(`.raretes .rarete-${keep}`);
    keyboard?.focus({ preventScroll: true });
    markSeen(save, tab); // affichées avec leur badge « Nouveau » cette fois-ci, plus la prochaine
    storeSave(save);
  }

  /**
   * Une rangée entière de cartes doit rester en vue sous les rayons. Sur un écran trop bas pour cela (téléphone en
   * paysage, barre du navigateur visible), le titre se replie ; plus bas encore, tout le panneau défile et les rayons
   * restent collés en haut. La mesure ne dépend pas du rayon ouvert : d'un rayon à l'autre, rien ne bouge.
   * Refaite quand la fenêtre change de taille.
   */
  fitShelf() {
    const panel = this.root.querySelector('.panneau.biblio');
    if (!panel) return;
    panel.classList.remove('serre', 'tout-defile');
    panel.style.scrollPaddingTop = '';
    const grid = panel.querySelector('.contenu');
    // La hauteur d'une carte : mesurée, gardée pour un filtre de rareté sans aucune carte (128 : `button.carte-mini`).
    this.cardHeight = grid.querySelector('.carte-mini')?.offsetHeight || this.cardHeight || 128;
    const fits = () => grid.clientHeight >= this.cardHeight + parseFloat(getComputedStyle(grid).paddingTop);
    if (fits()) return;
    panel.classList.add('serre');
    if (fits()) return;
    panel.classList.replace('serre', 'tout-defile');
    // Une carte atteinte au clavier ou à la manette ne passe pas sous les rayons collés.
    const tabs = panel.querySelector('.onglets');
    panel.style.scrollPaddingTop = `${tabs.offsetHeight + 8}px`;
  }

  /** Lance le prochain niveau avec ce héros au départ. */
  playAs(hero) {
    this.save.heros = hero;
    storeSave(this.save);
    this.go.play(this.nextLevel());
  }

  // ------------------------------------------------------------------ commandes, options, à propos

  /** Toutes les commandes, depuis le menu ou la pause. La colonne de l'appareil en cours ressort. */
  controls() {
    const here = ['clavier', 'manette', 'pouce'].indexOf(this.device) + 1;
    const cell = (tag, text, i) => h(tag, { className: i === here ? 'ici' : '' }, text);
    this.show('liste commandes',
      h('h2', {}, 'Commandes'),
      h('table', {},
        h('tr', {}, ['', 'Clavier', 'Manette', 'Tactile'].map((c, i) => cell('th', c, i))),
        CONTROLS.map((row) => h('tr', {}, row.map((c, i) => cell('td', c, i))))),
      h('div', { className: 'pied' }, this.back(() => this.go.back())));
    this.escape = () => this.go.back();
  }

  /** Les réglages. Effacer sa progression ne se fait que depuis le menu, jamais en pleine partie. */
  options(note = '') {
    const toggle = (key, label) => {
      const box = h('input', { type: 'checkbox', checked: this.save.options[key] });
      box.onchange = () => {
        this.save.options[key] = box.checked;
        if (key === 'musique') this.save.options.musiqueChoisie = true;
        if (key === 'sobre') this.save.options.sobreChoisi = true; // le réglage du système ne décide plus
        storeSave(this.save);
        this.go.options();
      };
      return h('label', { className: 'case' }, box, ' ', label);
    };
    const inGame = this.go.playing();
    this.show('liste',
      h('h2', {}, 'Options'),
      toggle('son', 'Bruitages'),
      toggle('musique', 'Radio Manif (musique, par SoundCloud)'),
      toggle('sobre', 'Effets réduits'),
      note && h('p', { className: 'mention' }, note),
      h('div', { className: 'pied' }, this.back(() => this.go.back()),
        !inGame && this.button('Effacer ma progression', () => this.confirmErase(), 'discret effacer')));
    this.escape = () => this.go.back();
  }

  /** Effacer demande confirmation, et dit ce qui sera perdu. « Annuler » a la main. */
  confirmErase() {
    this.show('liste etroit',
      h('h2', {}, 'Effacer ma progression ?'),
      h('p', {}, 'Tu perdras tout ce que tu as débloqué et tes records. La campagne repartira du premier niveau.'),
      this.button('Annuler', () => this.options(), 'gros'),
      this.button('Effacer', () => {
        eraseProgress(this.save, [`niveaux:${TUTORIAL}`]); // le tuto déjà vu ou passé ne revient pas
        this.options('Progression effacée.');
      }, 'discret effacer'));
    this.escape = () => this.options(); // Échap, c'est Annuler
  }

  about() {
    const fold = (title, ...body) => h('details', {}, h('summary', {}, title), ...body);
    this.show('liste apropos',
      h('h2', {}, 'À propos'),
      h('p', {}, MENTION),
      h('p', {}, link(REPO, 'Le dépôt'), ' · ', link(`${REPO}/blob/main/CONTRIBUTING.md`, 'Contribuer'), ' · ',
        link(`${REPO}/blob/main/CHARTE.md`, 'La charte'), ' · ', h('a', { href: 'galerie.html' }, 'La Galerie')),
      measuring() && fold('Mesure d’audience anonyme (PostHog) : ni cookie, ni profil.',
        h('p', {}, 'Le jeu compte les visites et les parties, par niveau et par héros : gagnée, perdue ou abandonnée, leur durée, la taille de la manif. Il compte aussi les pistes de Radio Manif écoutées, passées ou mises en pause, et ce qui empêche de jouer : un contenu ou une musique injoignable, une erreur. Les visiteurs sont comptés par jour, sur les serveurs de PostHog, avec une empreinte qui change chaque jour. Rien n’est écrit sur ton appareil pour ça. Ce que tu écris dans l’Atelier n’est pas envoyé.')),
      fold('Radio Manif : le lecteur et les cookies de SoundCloud',
        h('p', {}, 'La musique passe par le lecteur de SoundCloud, chargé dès l’ouverture du jeu. SoundCloud y dépose ses propres cookies et traceurs, par exemple le cookie ', h('code', {}, 'sc_anonymous_id'), ' et le script de mesure de ', h('code', {}, 'dwt.soundcloud.com'), '. Le jeu ne les lit pas et n’en reçoit rien.'),
        h('p', {}, 'Couper Radio Manif dans les Options arrête la musique, pas le lecteur. Il reste chargé, sans le son, pour repartir d’un toucher. Pour ne pas charger SoundCloud du tout, bloque ', h('code', {}, 'w.soundcloud.com'), ' dans ton navigateur (un bloqueur de contenu suffit). Le jeu marche sans musique.')),
      fold('Mentions légales', ...legalNotice()),
      fold('Références', h('ul', {}, REFERENCES.map((r) => h('li', {}, link(r.url, r.titre), ` — ${r.note}`)))),
      fold('Crédits et licences',
        h('p', {}, 'Code : MIT. Contenus : CC BY-SA 4.0, sauf mention contraire. Bruitages synthétisés avec ZzFX de Frank Force (MIT).'),
        h('ul', {}, Object.values(this.bundle.sons).filter((x) => x.fichier).map((x) =>
          h('li', {}, link(x.source, x.nom), ` — ${x.auteur}, ${licenceName(x.licence)}`))),
        h('p', {}, h('b', {}, 'Radio Manif : '), Object.values(this.bundle.musiques).map((m, i) => [i ? ' · ' : '', link(m.url, m.titre), ` — ${m.artiste}`,
          /^CC-/.test(m.licence || '') ? `, ${licenceName(m.licence)}` : '']))),
      h('div', { className: 'pied' }, this.back()));
    this.escape = () => this.menu();
  }

  // ------------------------------------------------------------------ en partie

  pause() {
    this.show('liste etroit pause',
      // À droite du titre, la piste de Radio Manif et ⏭ (masquée si la musique est coupée ou refusée).
      h('div', { className: 'entete' }, h('h2', {}, 'Pause'), this.go.radio?.()),
      this.keys(),
      this.button('Reprendre', () => this.go.resume(), 'gros'),
      this.go.tutorial?.() && this.button('Passer le tuto', () => this.go.skip()),
      this.editButton(),
      this.button('Retour au piquet', () => this.go.checkpoint()),
      this.button('Recommencer', () => this.go.restart()),
      this.button('Commandes', () => this.controls()),
      this.button('Collection', () => this.collection()),
      this.button('Options', () => this.options()),
      this.button('Quitter', () => this.go.quit(), 'discret'));
    this.escape = () => this.go.resume(); // Échap met en pause, et en sort
  }

  /**
   * Carton d'ouverture : PANIQUE TV ouvre sur une vraie déclaration, signée, datée et sourcée.
   * On y choisit aussi son héros de départ, parmi ceux déjà rencontrés.
   * @param {string} hero  identifiant du héros avec lequel la partie démarre
   * @param {boolean} choose  faux dans l'Atelier : on essaie le niveau avec le héros de sa fiche
   */
  intro(level, done, hero = '', choose = true) {
    const quote = this.bundle.citations[level.citation];
    const go = this.button('C’est parti', done, 'gros');
    const heroes = Object.values(this.bundle.heros).filter((x) => x.statut !== 'test');
    const mine = heroes.filter((x) => x.id === hero || isFound(this.save, 'heros', x.id)).map((x) => x.id);
    const pick = (id) => {
      if (id === hero) return;
      this.audio.play('clic');
      this.save.heros = id;
      storeSave(this.save);
      this.go.restart(); // la partie repart avec ce héros, et ce carton se réaffiche
    };
    // « ← Retour », comme Échap, ne lance pas le niveau : il ramène là d'où l'on vient, le plan ou le menu ;
    // en essai depuis l'Atelier, à l'édition (le bouton dit alors « ← Retour à l'édition »).
    // Un changement de héros réaffiche ce carton : l'écran d'avant reste le même.
    const before = this.root.firstElementChild?.classList;
    if (!before?.contains('intro')) {
      const from = before?.contains('plan') ? 'plan' : '';
      this.introBack = () => {
        if (this.go.testing?.()) return this.go.edit();
        this.go.quit();
        if (from === 'plan') this.levels();
        return undefined;
      };
    }
    this.show('intro',
      h('div', { className: 'tv' }, h('strong', {}, 'PANIQUE TV'), h('em', {}, quote ? 'ILS L’ONT DIT' : 'ÉDITION SPÉCIALE')),
      quote ? h('p', { className: 'manchette' }, quoted(quote.texte)) : level.intro && h('p', { className: 'manchette' }, level.intro),
      quote && h('p', { className: 'signature' }, signature(quote)),
      h('h2', {}, level.titre),
      level.accroche && h('p', { className: 'accroche' }, level.accroche),
      choose && heroes.length > 1 && this.heroRow(heroes, mine, hero, pick),
      // Écran bas : les commandes à côté des boutons, pas au-dessus. « C'est parti » reste le bouton principal.
      // En essai, un seul retour : celui qui ramène à l'édition.
      h('div', { className: 'depart' }, this.keys(), h('div', { className: 'boutons' }, this.editButton() || this.back(() => this.introBack()),
        level.id === TUTORIAL && this.button('Passer le tuto', () => this.go.skip(), 'discret'), go)));
    this.escape = this.introBack;
    // Le carton tient sans défiler : la rangée des héros défile dans sa case ; si cela ne suffit pas, le carton se
    // resserre (`.serre`), puis une longue déclaration rapetisse.
    const panel = this.root.firstChild;
    const headline = panel.querySelector('.manchette');
    if (panel.scrollHeight > panel.clientHeight) panel.classList.add('serre');
    this.fitHeroNames();
    for (let size = headline && parseFloat(getComputedStyle(headline).fontSize); headline && panel.scrollHeight > panel.clientHeight && size > 12; size -= 1) {
      headline.style.fontSize = `${size - 1}px`;
    }
    this.heroScroll(); // le carton a sa taille : le héros choisi vient au milieu de sa rangée
    go.focus({ preventScroll: true }); // Entrée lance le niveau…
    this.root.firstChild.onkeydown = (e) => { // … ← et → changent de héros
      const turn = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (!turn || mine.length < 2) return;
      e.preventDefault();
      pick(mine[(mine.indexOf(hero) + turn + mine.length) % mine.length]);
    };
  }

  /** La rangée des héros : ceux de la Collection se choisissent, les autres restent en silhouette. */
  heroRow(heroes, mine, current, pick) {
    const face = (x) => spriteElement(x.sprites.portrait || x.sprites.repos, this.bundle.palette, 2);
    return h('div', { className: 'choix-heros' }, heroes.map((x) => (mine.includes(x.id)
      ? h('button', { type: 'button', className: x.id === current ? 'choisi' : 'discret', onclick: () => pick(x.id) }, face(x), h('span', { className: 'nom' }, x.nom))
      : h('span', { className: 'inconnu' }, face(x), h('span', {}, '???')))));
  }

  /**
   * La rangée des héros défile dans sa case : le héros choisi y est au milieu à l'ouverture, une case qui prend la main
   * (Tab, manette) vient au milieu, et le fondu d'un bord ne reste que s'il y a d'autres héros de ce côté.
   * Les positions se lisent dans la mise en page (`offsetLeft`), justes aussi quand tout pivote.
   */
  heroScroll() {
    const row = this.root.querySelector('.choix-heros');
    if (!row) return;
    const edges = () => {
      const across = row.scrollWidth > row.clientWidth + 1;
      const [at, room, size] = across ? [row.scrollLeft, row.clientWidth, row.scrollWidth] : [row.scrollTop, row.clientHeight, row.scrollHeight];
      row.classList.toggle('avant', at > 1);
      row.classList.toggle('apres', at + room < size - 1);
    };
    const center = (box, smooth) => {
      if (!box) return;
      const still = !smooth || document.body.classList.contains('sobre') || matchMedia('(prefers-reduced-motion: reduce)').matches;
      row.scrollTo({
        left: box.offsetLeft + box.offsetWidth / 2 - row.clientWidth / 2,
        top: box.offsetTop + box.offsetHeight / 2 - row.clientHeight / 2,
        behavior: still ? 'instant' : 'smooth',
      });
    };
    row.addEventListener('scroll', edges, { passive: true });
    row.addEventListener('focusin', (e) => center(e.target.closest('.choix-heros > *'), true));
    new ResizeObserver(edges).observe(row);
    center(row.querySelector('.choisi'), false);
    edges();
  }

  /** Un nom de héros tient dans sa case : un mot trop long (« TYRANNOGAUCHISTE ») fait réduire la lettre. */
  fitHeroNames() {
    for (const name of this.root.querySelectorAll('.choix-heros .nom')) {
      const box = name.parentElement;
      const room = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
      for (let size = parseFloat(getComputedStyle(name).fontSize); name.scrollWidth > room && size > 7; size -= 0.5) name.style.fontSize = `${size - 0.5}px`;
    }
  }

  lost() {
    this.show('liste etroit',
      h('h2', {}, 'Game over'),
      h('p', {}, 'La lutte continue : on recommence.'),
      h('p', { className: 'convaincre' }, 'Qui sont les 3 personnes que tu vas convaincre d’ici avril 2027\u00a0?'),
      this.button('Recommencer', () => this.go.restart(), 'gros'),
      this.editButton(),
      this.button('Menu', () => this.go.quit(), 'discret'));
  }

  /**
   * Fin de niveau, en un écran : la manif, les automates désactivés et leur décompte, réparti comme le fichier
   * interne d'octobre 2026, avec une ou deux blessures citées entre guillemets, des faits réels à ouvrir
   * (« Et en vrai ? »), ce qui a été débloqué.
   * @param {number} hurt      les automates désactivés pendant la partie
   * @param {number} seed      la graine de la partie : ce que l'écran dit du décompte s'en tire
   * @param {string[]} facts   les fiches de « Et en vrai ? »
   */
  end({ level, hurt = 0, seed = 1, facts = [], time, crowd, next, last, won = [], best = 0, share = null }) {
    const cards = allCards(this.bundle).filter((c) => c.kind === 'fiches');
    const truths = facts.map((id) => cards.find((c) => c.item.id === id)).filter(Boolean);
    const minutes = `${Math.floor(time / 60)} min ${String(Math.floor(time % 60)).padStart(2, '0')} s`;
    const n = (x) => x.toLocaleString('fr-FR');
    const { parts, file } = injuryReport(hurt, makeRng(seed));
    this.show('fin',
      h('h2', {}, 'Niveau terminé ', h('small', {}, `${level.titre} · ${minutes}`)),
      h('div', { className: 'bilans' },
        h('article', { className: 'manif' },
          h('p', { className: 'chiffre' }, `✊ ${n(crowd)}`),
          h('p', {}, 'dans la manif'),
          best === null ? null : h('p', { className: 'dont' }, crowd > best ? (best ? `Record battu (${n(best)})` : 'Premier record') : `Record : ${n(best)}`)),
        h('article', { className: 'annonce' },
          h('p', { className: 'chiffre' }, n(hurt)),
          h('p', {}, hurt > 1 ? 'automates désactivés' : 'automate désactivé'),
          parts.length ? h('p', { className: 'dont' }, `${parts.join(', ')}.`) : null,
          // Espaces insécables : « ne reste pas seul en fin de ligne, » et ; ne commencent pas la suivante.
          file.length ? h('p', { className: 'fichier' },
            `${file.join('\u00a0; ').replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»')}.`) : null)),
      // « Et en vrai ? » sur toute la largeur : les titres entiers, chacun ouvre sa carte.
      truths.length ? h('div', { className: 'vrai' }, h('span', {}, 'Et en vrai ?'),
        truths.map((card) => h('button', { type: 'button', onclick: () => openCard(this.bundle, card) }, card.item.titre))) : null,
      won.length ? wonCards(this.bundle, won) : null,
      h('div', { className: 'pied' },
        this.editButton('gros'), // en essai, la suite, c'est l'édition
        next && this.button('Niveau suivant', () => this.go.play(next), 'gros'),
        last && this.button('La suite', () => this.final(), 'gros'),
        share && this.button('Partager', share, 'discret'),
        this.button('Rejouer', () => this.go.restart(), 'discret'),
        this.button('Menu', () => this.go.quit(), 'discret')));
  }

  /**
   * Dernier écran : un appel au vote citoyen, les dates et deux démarches, rien d'autre. Le programme est ailleurs
   * (Collection) : Valentin, 17 novembre 2026, « Séparer les deux ».
   */
  final() {
    const f = this.bundle.fiches;
    const [dates, ...steps] = VOTE_FICHES.map((id) => f[id]).filter(Boolean);
    this.go.learn([dates, ...steps].filter(Boolean).map((x) => x.id)); // ce qu'on lit ici entre dans la Collection
    this.show('vote',
      h('h2', { className: 'appel' }, 'Allez voter.'),
      h('p', { className: 'dates' }, dates ? link(dates.source.url, 'Dimanche 18 avril et dimanche 2 mai 2027') : 'Dimanche 18 avril et dimanche 2 mai 2027'),
      h('nav', {},
        steps.map((x) => h('a', { className: 'bouton', href: x.source.url, target: '_blank', rel: 'noopener' }, x.titre))),
      h('div', { className: 'pied' },
        this.button('Menu', () => this.go.quit(), 'gros'),
        h('a', { className: 'bouton discret', href: REPO, target: '_blank', rel: 'noopener' }, 'Contribuer au jeu')));
  }
}

// ---------------------------------------------------------------------- HUD et bandeau

const ASK_TIME = 8; // secondes de jeu, au plus, pendant lesquelles la spéciale clignote

/**
 * Un panneau qui dit `[spéciale]` fait clignoter la spéciale. La demande s'arme une fois par partie, au premier
 * panneau qui la nomme ; elle tombe au premier usage (une charge de moins), au changement de personnage, ou au bout
 * de huit secondes de jeu ; elle ne clignote jamais quand la partie est arrêtée (`live` faux : pause, carton).
 * @param {{hero: string, charges: number, until: number} | null} ask  la demande en cours (null : pas encore armée)
 * @returns {{ask: object | null, on: boolean}} la demande, et si elle clignote à cette image
 */
export function askSpecial(ask, game, live) {
  const { hero } = game;
  const next = ask || (hero.def.speciale && hero.charges > 0 && mentions(game.sign, 'speciale')
    ? { hero: hero.def.id, charges: hero.charges, until: game.time + ASK_TIME } : null);
  const on = Boolean(live && next && next.hero === hero.def.id && next.charges === hero.charges && game.time < next.until);
  return { ask: next, on };
}

/**
 * Ce qui clignote à cette image : `special` quand un panneau la demande (`askSpecial`), et ce que la consigne de la
 * première partie allume pour son prochain geste (`guideView`).
 * @returns {Set<string>} des `data-action` de bouton, ou un sens du pouce gauche (`cote`, `bas`, `haut`)
 */
export function askedFor(asking, guide) {
  const pulse = new Set(guide?.hints || []);
  if (asking) pulse.add('special');
  return pulse;
}

export class Hud {
  constructor(bundle) {
    this.bundle = bundle;
    this.el = document.getElementById('hud');
    this.q = (id) => document.getElementById(id);
    this.last = '';
    this.bannerTimer = 0;
    this.crawl = new Crawl(); // le fil, qui défile en continu (voir `tick`)
    this.frame = 0; // l'image demandée du fil, tant qu'il est à l'écran
    this.em = 16; // la hauteur de lettre du fil, en pixels, et sa marge à gauche (mesurées par `relayout`)
    this.pad = 0;
    this.room = 0; // la largeur du fil, en pixels : suivie sans la relire à chaque image (voir `relayout`)
    this.alerting = null; // l'alerte en cours : elle repasse en boucle jusqu'à la fin de son temps d'antenne
    this.quote = null; // la dernière citation passée : en hystérie, la chaîne ne lâche plus qu'elle
    this.turn = 0;
    this.level = 0; // le cran de panique de la chaîne
    this.dark = false; // la régie cassée : écran noir, la chaîne se tait (voir `offAir`)
    this.notes = []; // notes en attente : une seule à l'écran à la fois
    this.note = null; // { el, until } : la note affichée, et jusqu'à quand (temps de jeu)
    this.onQuote = () => {}; // une vraie citation passe à l'antenne : la Collection la note
    this.device = 'clavier'; // l'appareil dont la puce de la spéciale montre la touche
    this.ask = null; // un panneau a demandé la spéciale (voir `askSpecial`)
    this.guide = null; // la consigne de la première partie : ce qu'elle allume au pouce (voir `guideView`)
    this.live = false; // la partie tourne : hors pause et hors carton, rien ne clignote
    // Le fil permanent de PANIQUE TV : de vraies déclarations, datées et signées.
    this.quotes = Object.values(bundle.citations).filter((c) => c.categorie !== 'gauche');
  }

  /** Nouvelle partie : le fil repart, sans alerte ni notification de la précédente. */
  reset() {
    this.last = '';
    this.shape = '';
    this.pile = '';
    this.crowd = 0;
    this.ask = null;
    this.level = 0;
    this.dark = false;
    clearTimeout(this.bannerTimer);
    this.alerting = null; // une alerte interrompue ne fige pas le fil de la partie suivante
    this.quote = null;
    delete this.q('bandeau').dataset.alerte;
    delete this.q('bandeau').dataset.ecran;
    this.notes = [];
    this.note = null;
    this.now = undefined;
    this.signUntil = -1;
    this.q('toasts').replaceChildren();
    this.restart();
  }

  /** Le bandeau reste à l'antenne pendant toute la partie ; le fil défile tant qu'il est à l'écran. */
  setVisible(on) {
    const el = this.q('bandeau');
    this.marks = null; // affiché ou masqué : à remesurer
    this.el.hidden = !on;
    el.hidden = !on;
    if (!on) {
      this.room = 0; // masqué : un seul morceau sur la piste, mesuré quand il revient
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.then = undefined;
      return;
    }
    if (this.frame) return;
    this.relayout(); // on ne mesure le fil que lorsqu'il est à l'écran
    this.frame = requestAnimationFrame((now) => this.tick(now));
  }

  /** Le fil repart de zéro : le prochain morceau s'affiche tout de suite, au bord gauche. */
  restart() {
    this.crawl.reset();
    this.leader = null;
    this.q('bandeau').querySelector('.fil').replaceChildren(h('span', { className: 'piste' }));
    this.feed();
  }

  /**
   * Le prochain morceau du fil : l'écran noir quand la régie est cassée, l'alerte tant qu'elle dure, la même
   * citation en hystérie, sinon la citation suivante.
   */
  piece() {
    if (this.dark) return { text: 'ÉCRAN NOIR', label: 'Antenne coupée' };
    if (this.alerting) return this.alerting;
    if (this.level >= HYSTERIA && this.quote) return this.quote;
    const quote = this.quotes[this.turn++ % Math.max(1, this.quotes.length)];
    if (!quote) return null;
    this.onQuote(quote.id);
    return (this.quote = { text: `« ${quote.texte} » — ${quote.auteur}, ${quote.date.slice(0, 4)}`, label: 'Ils l’ont dit' });
  }

  /** Pose des morceaux au bout de la piste tant qu'il manque du texte à droite : le fil n'a jamais de trou. */
  feed() {
    const track = this.q('bandeau').querySelector('.piste');
    const { room } = this; // 0 tant que le bandeau est masqué : un seul morceau, mesuré à l'affichage
    for (let n = 0; n < 50; n++) {
      if (this.crawl.items.length && (this.dark || room <= 0 || !this.crawl.hungry(room))) return;
      const piece = this.piece();
      if (!piece) return;
      const el = h('i', {}, piece.text);
      track.append(el);
      const item = this.crawl.push(el.offsetWidth, { ...piece, el });
      el.style.left = `${item.x}px`;
    }
  }

  /** Remesure le fil (à l'affichage, à chaque changement de taille) : sa hauteur de lettre, et chaque morceau. */
  relayout() {
    const line = this.q('bandeau').querySelector('.fil');
    const style = getComputedStyle(line);
    this.em = parseFloat(style.fontSize) || this.em;
    this.pad = parseFloat(style.paddingLeft) || 0;
    this.room = line.clientWidth;
    // L'étiquette ou les crans de panique changent de largeur : le fil aussi.
    this.watch ??= globalThis.ResizeObserver && new ResizeObserver(() => (this.room = line.clientWidth));
    this.watch?.observe(line);
    let x = this.crawl.items[0]?.x ?? 0;
    for (const item of this.crawl.items) {
      Object.assign(item, { x, w: item.el.offsetWidth });
      item.el.style.left = `${x}px`;
      x += item.w;
    }
    this.feed();
  }

  /**
   * Une image du fil : il avance à vitesse constante, de droite à gauche, deux fois moins vite en effets réduits,
   * et pas du tout sur l'écran noir. L'étiquette annonce le morceau qui passe au bord gauche.
   */
  tick(now) {
    this.frame = requestAnimationFrame((t) => this.tick(t));
    const dt = Math.min(0.1, Math.max(0, (now - (this.then ?? now)) / 1000)); // un onglet en arrière-plan ne fait pas sauter le fil
    this.then = now;
    const slow = document.body.classList.contains('sobre') || REDUCED.matches;
    if (!this.dark) this.crawl.advance(dt * this.em * (slow ? SCROLL_SLOW : SCROLL));
    const gone = this.crawl.drop(this.pad);
    if (gone.length) {
      for (const item of gone) item.el.remove();
      for (const item of this.crawl.items) item.el.style.left = `${item.x}px`;
    }
    this.feed();
    const el = this.q('bandeau');
    el.querySelector('.piste').style.transform = `translateX(${-this.crawl.offset.toFixed(2)}px)`;
    const lead = this.crawl.lead();
    if (lead && lead !== this.leader) {
      this.leader = lead;
      el.querySelector('em').textContent = lead.label;
      if (lead.alert) el.dataset.alerte = 'oui';
      else delete el.dataset.alerte;
    }
  }

  /**
   * La régie cassée : le bandeau passe au noir, « ÉCRAN NOIR », immobile, tant que dure la coupure (temps de jeu :
   * la pause l'arrête aussi). Quand l'antenne revient, le fil reprend.
   */
  offAir(dark) {
    if (dark === this.dark) return;
    this.dark = dark;
    const el = this.q('bandeau');
    clearTimeout(this.bannerTimer);
    this.alerting = null;
    if (dark) el.dataset.ecran = 'noir';
    else delete el.dataset.ecran;
    this.restart();
  }

  update(game) {
    this.pump(game.time, Boolean(game.sign)); // une consigne qui attend ne retient pas les notes : le panneau passe dessous
    this.offAir(game.offAir > 0);
    const { hero, boss } = game;
    const special = hero.def.speciale;
    // Ce qu'on demande au joueur clignote : la spéciale qu'un panneau nomme, jusqu'à ce qu'elle serve, et en première
    // partie le prochain geste de la consigne (un bouton, ou le sens où glisser le pouce gauche).
    const { ask, on: asking } = askSpecial(this.ask, game, this.live);
    this.ask = ask;
    const pulse = askedFor(asking, this.live ? this.guide : null);
    const fighting = Boolean(boss?.active && boss.state !== 'gone');
    const line = fighting ? null : lineBar(game, (this.lineMemo ??= {})); // la ligne devant laquelle on arrive
    const state = [hero.def.id, hero.hp, game.stack.join(), hero.charges, game.panicLevel, Math.round(game.panic), game.crowd,
      fighting ? boss.hp : -1, line ? `${line.nom}:${Math.round(line.part * 1000)}` : '', this.device, [...pulse].join()].join('|');
    if (state === this.last) return; // on ne touche au DOM que si quelque chose a changé
    this.last = state;
    this.q('hud-heros').textContent = hero.def.nom;
    // La pile ne se redessine que si elle change : un coup reçu la fait sursauter, sans qu'une autre mise à jour l'interrompe.
    const pile = [hero.def.id, hero.hp, game.stack.join()].join('|');
    if (pile !== this.pile) {
      const hurt = this.pile && hero.def.id === this.hero && (hero.hp < this.hp || game.stack.length < this.height);
      const stack = livesStack(this.bundle, game);
      if (hurt) stack.classList.add('touche');
      this.q('hud-vies').replaceChildren(stack);
      Object.assign(this, { pile, hero: hero.def.id, hp: hero.hp, height: game.stack.length });
    }
    // L'attaque spéciale : sa touche sur cet appareil, son nom, et combien il en reste.
    const charges = this.q('hud-charges');
    if (special) charges.replaceChildren(h('kbd', {}, KEY_NAMES[this.device].speciale), ` ${(special.nom || 'Spéciale').replace(/\s*!$/, '')} × ${hero.charges}`);
    else charges.replaceChildren();
    charges.classList.toggle('vide', Boolean(special) && hero.charges === 0);
    charges.classList.toggle('demande', pulse.has('special'));
    // Au pouce, le bouton SPÉ porte le même nombre, et clignote avec la puce.
    const button = document.querySelector('#tactile [data-action="special"]');
    if (button) {
      button.dataset.nombre = special ? `× ${hero.charges}` : '';
      button.classList.toggle('vide', Boolean(special) && hero.charges === 0);
    }
    for (const mark of document.querySelectorAll('#tactile [data-action]')) mark.classList.toggle('demande', pulse.has(mark.dataset.action));
    const stick = document.querySelector('#tactile .manche');
    const slide = ['cote', 'bas', 'haut'].find((d) => pulse.has(d));
    if (stick && slide) stick.dataset.demande = slide;
    else if (stick) delete stick.dataset.demande;
    // La manif : combien on est. Le compteur sursaute quand elle grossit.
    const march = this.q('hud-manif');
    march.hidden = !game.crowd;
    if (game.crowd !== this.crowd) {
      march.textContent = `✊ ${game.crowd.toLocaleString('fr-FR')}`;
      // Il sursaute quand elle grossit, il rougit quand elle perd du monde.
      const move = game.crowd > this.crowd ? 'grossit' : 'baisse';
      march.classList.remove('grossit', 'baisse');
      void march.offsetWidth; // relance l'animation
      march.classList.add(move);
      this.crowd = game.crowd;
    }
    // La panique est celle de la chaîne : trois crans dans le bandeau, celui en cours se remplit,
    // et tout le bandeau change de couleur avec lui.
    const level = game.panicLevel;
    this.level = level; // en hystérie, la citation en cours repasse en boucle (`piece`)
    const gauge = this.q('hud-panique');
    const [from, to] = [[0, ...PANIC_STEPS][level], [...PANIC_STEPS, 100][level]];
    this.q('bandeau').dataset.niveau = level;
    gauge.dataset.niveau = level;
    gauge.style.setProperty('--part', `${Math.round(((Math.min(100, game.panic) - from) / (to - from)) * 100)}%`);
    gauge.setAttribute('aria-label', `Panique de la chaîne : ${PANIC_NAMES[level]}`);
    // La barre de vie du haut : celle du boss pendant le combat, sinon celle de la ligne devant laquelle on arrive.
    const bar = this.q('hud-boss');
    bar.hidden = !fighting && !line;
    if (fighting) {
      bar.querySelector('b').textContent = boss.def.nom;
      bar.querySelector('i').style.width = `${Math.max(0, (boss.hp / boss.hpMax) * 100)}%`;
    } else if (line) {
      bar.querySelector('b').textContent = line.nom;
      bar.querySelector('i').style.width = `${line.part * 100}%`;
    }
    // Ce qui change la hauteur du HUD (la pile, la puce et son nom, le compteur affiché ou non et sa longueur, la barre de vie du boss
    // ou d'une ligne, et son nom) : ses mesures sont à refaire (`measures`).
    const shape = [pile, charges.textContent, march.hidden || march.textContent.length, bar.hidden || bar.querySelector('b').textContent].join('|');
    if (shape !== this.shape) {
      this.shape = shape;
      this.marks = null;
    }
  }

  /**
   * Alerte info : elle interrompt le fil, s'affiche tout de suite et défile en boucle `seconds` secondes au moins,
   * le temps de la lire jusqu'au bout ; puis les citations reprennent à sa suite. `credit` : la chaîne et la date
   * d'un vrai bandeau.
   */
  banner(text, credit = '', seconds = 7) {
    const el = this.q('bandeau');
    const origin = credit.split(' — ')[0];
    this.alerting = { text: origin ? `« ${text} » — ${origin}` : text, label: origin ? 'Vu à la télé' : 'Alerte info', alert: true };
    clearTimeout(this.bannerTimer);
    this.restart();
    el.classList.remove('entre');
    void el.offsetWidth; // relance l'animation
    el.classList.add('entre');
    const over = (this.crawl.items[0]?.w ?? 0) - (this.room - 2 * this.pad);
    const slow = document.body.classList.contains('sobre') || REDUCED.matches;
    this.bannerTimer = setTimeout(() => (this.alerting = null), alertTime(over, this.em, seconds, slow) * 1000);
  }

  /**
   * Jusqu'où descend le HUD, en pixels CSS depuis le haut de la scène : `row`, sa première ligne (nom, pile, puce de la
   * spéciale, pause) ; `band`, tout le HUD (la puce passée à la ligne, le compteur de la manif, la barre du boss).
   * 0 tant qu'il est masqué. Mesuré dans la mise en page, pas à l'écran (juste aussi quand tout pivote), une seule fois :
   * remesuré seulement quand sa forme change (voir `update`, `setVisible`, et `main.js` au redimensionnement).
   */
  measures() {
    if (this.marks) return this.marks;
    const scene = this.el.offsetParent;
    if (!scene) return (this.marks = { row: 0, bar: 0, band: 0 }); // masqué : rien à laisser, ni à remesurer avant qu'il revienne
    const bottom = (el) => {
      if (!el?.offsetHeight) return 0;
      let y = el.offsetHeight;
      for (let e = el; e && e !== scene; e = e.offsetParent) y += e.offsetTop;
      return y;
    };
    const ids = (list) => Math.max(...list.map((id) => bottom(this.q(id))));
    // La barre de vie du milieu passe sous la ligne de gauche, qui prend toute la largeur.
    const left = this.el.querySelector('.gauche');
    this.el.style.setProperty('--bas-ligne', `${left.offsetTop + left.offsetHeight}px`);
    // Le texte lui-même peut dépasser sa boîte (le ✊ du compteur, en emoji, est plus haut que sa ligne) : on le mesure
    // à l'écran, ramené dans le repère du jeu (au pivot, son haut est à droite de l'écran).
    const turned = document.documentElement.classList.contains('pivote');
    const frame = scene.getBoundingClientRect();
    const ink = (el) => {
      if (!el?.offsetHeight) return 0;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return turned ? frame.right - r.left : r.bottom - frame.top;
    };
    const row = ids(['hud-heros', 'hud-vies', 'hud-charges', 'edition', 'pause']);
    const bar = bottom(this.q('hud-boss')); // la barre de vie du boss ou d'une ligne, en haut au milieu (0 si elle est masquée)
    const band = Math.max(row, bar, bottom(this.q('hud-manif')), ink(this.q('hud-manif')), ink(this.q('hud-heros')),
      ...[...this.el.querySelectorAll('.bloc')].map(bottom));
    this.marks = { row, bar, band };
    return this.marks;
  }

  /**
   * Une note : elles passent une à une, le temps d'être lues. `tone` : une classe (la rareté d'une pancarte).
   * `group` (une clé de FOLDS) : si une note du même genre attend déjà, les deux se replient en « 2 pancartes débloquées ».
   */
  toast(text, tone = '', group = '') {
    queueNote(this.notes, { text, tone, group });
  }

  /**
   * Fait passer les notes, au temps de jeu `now` : rien ne défile pendant une pause ou un carton.
   * Au pouce, un panneau d'aide (`sign`) s'affiche en haut, au même endroit : les notes l'attendent, et le temps
   * de lecture de celle qui était là ne court pas.
   */
  pump(now, sign = false) {
    const dt = Math.max(0, now - (this.now ?? now));
    this.now = now;
    if (sign) this.signUntil = now + SIGN_LINGER;
    const wait = document.body.classList.contains('tactile') && now < (this.signUntil ?? -1);
    this.q('toasts').classList.toggle('attend', wait);
    if (wait) {
      if (this.note) this.note.until += dt;
      return;
    }
    if (this.note && now >= this.note.until) {
      this.note.el.remove();
      this.note = null;
    }
    if (this.note || !this.notes.length) return;
    const next = this.notes.shift();
    const el = h('p', { className: next.tone }, next.text);
    // Une pancarte s'écrit en entier : sa note a sa place à elle, plus large, sous tout le HUD (voir style.css).
    this.q('toasts').classList.toggle('pancarte', /\bpancarte\b/.test(next.tone));
    this.q('toasts').append(el);
    this.note = { el, until: now + readTime(next.text) };
  }
}
