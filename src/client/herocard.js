// Le carton de déblocage d'un héros : volontairement démesuré.
// Tricolore qui claque, drapeaux des luttes, portrait géant, nom énorme, sa citation,
// tambours et cuivres. Se ferme tout seul ou au premier toucher.

import { spriteElement } from './sprites.js';
import { frenchDate, quoted } from './dom.js';
import { gameFlags } from '../sim/manif.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

/**
 * Vrai si le cri d'un héros est sa citation, signe pour signe, à la casse près. Une citation plus longue,
 * ou ponctuée autrement, reste écrite : le cri ne se tient jamais seul au-dessus d'une signature qu'il ne cite pas exactement.
 */
export const cryInQuote = (bundle, hero) => {
  const quote = bundle.citations[hero.citation];
  return Boolean(hero.cri && quote && quote.texte.trim().toLowerCase() === hero.cri.trim().toLowerCase());
};

const CONFETTI = ['#3b5dc9', '#f4f4f4', '#e43b44', '#f6c21c'];
const TILT = 16; // marge en haut et en bas, en pixels : le tampon et le nom sont penchés, ils dépassent de leur boîte

/**
 * Tout doit tenir à l'écran : le nom sans qu'un mot déborde, puis le tampon, le cri, la citation et le bonus
 * dans la hauteur. On réduit d'abord le nom, puis le cri, puis les petites lignes, jusqu'à ce que tout tienne.
 */
function fit(card, scene, words) {
  const size = (el) => parseFloat(getComputedStyle(el).fontSize);
  const tall = () => scene.offsetHeight > card.clientHeight - 2 * TILT;
  const name = words.querySelector('.nom');
  for (let s = size(name); name.scrollWidth > words.clientWidth && s > 18; s -= 3) name.style.fontSize = `${s}px`;
  for (let s = size(name); tall() && s > 26; s -= 3) name.style.fontSize = `${s}px`;
  const cri = words.querySelector('.cri');
  for (let s = cri && size(cri); cri && tall() && s > 14; s -= 2) cri.style.fontSize = `${s}px`;
  const small = [...words.querySelectorAll('.source, .bonus')];
  for (let s = small[0] && size(small[0]); small.length && tall() && s > 9; s -= 1) small.forEach((el) => (el.style.fontSize = `${s}px`));
}

/**
 * @param {object} bundle  le contenu du jeu
 * @param {object} hero    une fiche de `bundle.heros`
 * @param {{audio?: object, reduced?: boolean, rescued?: boolean, first?: boolean, seed?: number, onClose?: () => void}} options
 *        `first` : le héros vient d'être débloqué pour la première fois ; le carton reste deux fois plus longtemps
 *        `seed` : la graine de la partie ; les drapeaux s'y rangent comme dans son cortège, le tricolore en tête
 *        `onClose` : appelé quand le carton commence à s'effacer, juste avant de laisser revoir le jeu
 * @returns {Promise<void>} résolue quand le carton est fermé
 */
export function showHeroCard(bundle, hero, { audio = null, reduced = false, rescued = true, first = false, seed = Math.floor(Math.random() * 1e9), onClose = null } = {}) {
  return new Promise((resolve) => {
    const card = el('div', `carton${reduced ? ' sobre' : ''}`);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', hero.nom);

    const bands = el('div', 'bandes');
    bands.append(el('i'), el('i'), el('i'));
    card.append(bands, el('div', 'rayons'));

    const flags = gameFlags(bundle, seed).map((id) => bundle.drapeaux[id]);
    const half = Math.ceil(flags.length / 2);
    [['haut', flags.slice(0, half)], ['bas', flags.slice(half)]].forEach(([side, list]) => {
      const row = el('div', `drapeaux ${side}`);
      row.style.setProperty('--n', String(Math.max(1, list.length)));
      list.forEach((f) => {
        const flag = spriteElement(f.sprites.image, bundle.palette, 4);
        flag.title = f.nom;
        row.append(flag);
      });
      card.append(row);
    });

    const scene = el('div', 'scene');
    const portrait = el('div', 'portrait');
    const art = hero.sprites.portrait || hero.sprites.repos;
    // La taille de l'écran de jeu : téléphone tenu debout, la page est pivotée d'un quart de tour.
    const turned = document.documentElement.classList.contains('pivote');
    const [vw, vh] = turned ? [innerHeight, innerWidth] : [innerWidth, innerHeight];
    const scale = Math.max(3, Math.floor(Math.min(vh * 0.44, vw * 0.36) / art.length));
    portrait.append(spriteElement(art, bundle.palette, scale));
    if (rescued) portrait.append(el('b', 'plus-un', '+1')); // une vie de plus

    const words = el('div', 'mots');
    words.append(el('div', 'tampon', rescued ? 'Camarade libéré·e !' : 'Entre en scène'));
    words.append(el('h1', 'nom', hero.nom));
    if (hero.cri) words.append(el('p', 'cri', quoted(hero.cri)));
    const quote = bundle.citations[hero.citation];
    if (quote) {
      // Un cri qui est la citation, à la casse près, n'est pas écrit deux fois : la ligne ne garde que la signature.
      words.append(el('p', 'source', `${cryInQuote(bundle, hero) ? '' : `${quoted(quote.texte)} `}— ${quote.auteur}, ${frenchDate(quote.date)}`));
    }
    const perks = [rescued && '+1 vie', hero.speciale?.nom && `Spéciale : ${hero.speciale.nom}`].filter(Boolean);
    if (perks.length) {
      words.append(el('br'), el('p', 'bonus', perks.join(' · ')));
    }
    scene.append(portrait, words);
    card.append(scene);

    if (!reduced) {
      const confetti = el('div', 'confettis');
      for (let i = 0; i < 44; i++) {
        const bit = el('i');
        bit.style.left = `${(i * 37) % 100}%`;
        bit.style.background = CONFETTI[i % CONFETTI.length];
        bit.style.animationDuration = `${1.5 + ((i * 13) % 10) / 8}s`;
        bit.style.animationDelay = `${-((i * 7) % 20) / 10}s`;
        confetti.append(bit);
      }
      card.append(confetti);
    }

    document.body.append(card);
    fit(card, scene, words);
    audio?.play('tambour');
    const timers = [
      setTimeout(() => audio?.play('cuivres'), 480),
      setTimeout(() => audio?.speak(hero.id), 560),
      setTimeout(() => audio?.play('cymbale'), 600),
      setTimeout(close, (reduced ? 1700 : 3200) * (first ? 2 : 1)),
    ];

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      onClose?.();
      timers.forEach(clearTimeout);
      removeEventListener('keydown', onKey, true);
      card.classList.add('sort');
      setTimeout(() => {
        card.remove();
        resolve();
      }, 190);
    }
    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) close();
    }
    // Un court délai avant d'accepter la fermeture : on ne zappe pas le carton par accident.
    setTimeout(() => {
      card.addEventListener('pointerdown', close);
      addEventListener('keydown', onKey, true);
    }, 450);
  });
}
