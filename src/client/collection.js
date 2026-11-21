// La Collection : chaque personnage, chaque lieu, chaque parole, chaque fait rencontrés en
// jouant devient une carte, avec la référence exacte qui l'explique. Ce qu'on n'a pas encore
// croisé reste en silhouette : jouer, c'est compléter l'album.
//
// Dans l'album, les cartes sont compactes et toutes de la même taille (`miniCard`) ; on en
// touche une, elle s'ouvre en grand avec ses références (`openCard`, `collectionCard`).

import { h, link, frenchDate, quoted, signature, sourceName, billions } from './dom.js';
import { RARITIES } from '../content/rarities.js';
import { sprite, spriteElement } from './sprites.js';
import { isFound, firstVisit } from './save.js';

/**
 * Les rayons de l'album, dans l'ordre d'affichage : onglets, clavier, manette, numéros des cartes.
 * Les pancartes viennent juste après les camarades. `keep` trie les fiches entre deux rayons.
 */
/**
 * Le tuto, « Get ready with me » : joué au tout premier « Jouer », rejouable depuis le menu. Il n'est pas une étape
 * de la campagne, ni un lieu de la Collection ; ses panneaux attendent le geste (`consigne.js`).
 */
export const TUTORIAL = 'get-ready-with-me';

export const SHELVES = [
  { id: 'camarades', titre: 'Camarades', kinds: ['heros', 'recrues'] },
  { id: 'pancartes', titre: 'Pancartes', kinds: ['pancartes'] },
  { id: 'en-face', titre: 'Le capital et ses automates', kinds: ['ennemis', 'boss'] },
  { id: 'lieux', titre: 'Lieux', kinds: ['niveaux'], keep: (n) => n.id !== TUTORIAL },
  { id: 'paroles', titre: 'Paroles', kinds: ['citations'] },
  { id: 'tele', titre: 'Vu à la télé', kinds: ['manchettes'] },
  { id: 'faits', titre: 'Faits', kinds: ['fiches'], keep: (f) => f.theme !== 'programme' },
  { id: 'propositions', titre: 'Propositions', kinds: ['fiches'], keep: (f) => f.theme === 'programme' },
  { id: 'luttes', titre: 'Luttes', kinds: ['drapeaux'] },
];

const BADGES = { heros: 'Camarade', recrues: 'Manif', ennemis: 'En face', boss: 'Fortune', niveaux: 'Lieu', citations: 'Parole', pancartes: 'Vu en manif', manchettes: 'Bandeau', fiches: 'Fait', drapeaux: 'Lutte' };

/** Toutes les cartes de l'album, numérotées. */
export function allCards(bundle) {
  const cards = [];
  for (const shelf of SHELVES) {
    for (const kind of shelf.kinds) {
      for (const item of Object.values(bundle[kind] || {})) {
        if (item.statut === 'test' || (shelf.keep && !shelf.keep(item))) continue;
        cards.push({ shelf: shelf.id, kind, badge: shelf.id === 'propositions' ? 'Proposition' : BADGES[kind], item, number: cards.length + 1 });
      }
    }
  }
  return cards;
}

/** Le nom affiché d'une carte, quel que soit son rayon. */
export const cardName = (item) => item.nom || item.titre || item.auteur || item.texte;

/** L'identifiant d'une carte : celui de sa fiche ; pour une pancarte ou un bandeau, son premier texte. */
export const cardId = (item) => item.id;

/** La clé d'une carte dans la sauvegarde : « rayon:identifiant ». */
export const cardKey = (card) => `${card.kind}:${cardId(card.item)}`;

/** Les cartes qui correspondent à des clés de sauvegarde, dans l'ordre de l'album. */
export function cardsByKeys(bundle, keys) {
  const wanted = new Set(keys);
  return allCards(bundle).filter((c) => wanted.has(cardKey(c)));
}

/**
 * Trouvée depuis la dernière visite de son rayon ?
 * `save.vues[rayon]` = nombre de découvertes au moment de cette visite.
 */
export function isFresh(save, card) {
  return save.decouvertes.indexOf(cardKey(card)) >= (save.vues?.[card.shelf] ?? 0);
}

/** Le rayon vient d'être regardé : ses cartes ne sont plus nouvelles. */
export function markSeen(save, shelf) {
  save.vues = { ...save.vues, [shelf]: save.decouvertes.length };
}

/** Une pancarte ou un bandeau a une rareté ; les autres cartes n'en ont pas. */
export const rarityName = (item) => (item.rarete === undefined ? '' : RARITIES[item.rarete]);

/** La note d'une pancarte débloquée : son texte entier, jamais coupé ; la note prend une ligne de plus s'il le faut. */
export const signNote = (item) => `Pancarte ${rarityName(item)} débloquée : « ${item.texte} »`;

/**
 * Le plan de campagne : tous les niveaux sauf le tuto, dans l'ordre des étapes. `content/campagne.txt` fixe les premières ;
 * les autres suivent, par ordre de titre. Une seule catégorie : un niveau déposé est une étape comme une autre.
 */
export function levelOrder(bundle) {
  const rest = Object.keys(bundle.niveaux).filter((id) => !bundle.campagne.includes(id) && id !== TUTORIAL)
    .sort((a, b) => bundle.niveaux[a].titre.localeCompare(bundle.niveaux[b].titre, 'fr'));
  return [...bundle.campagne, ...rest];
}

/** La prochaine étape de la campagne : la première pas encore terminée, sinon la première. Jamais le tuto. */
export function nextStep(bundle, save) {
  const order = levelOrder(bundle);
  return order.find((id) => !save.termines[id]) || order[0];
}

/** Ce que lance « Jouer » : le tuto tant qu'il n'a été ni joué ni passé (`save.tuto`), puis la prochaine étape. */
export function nextLevel(bundle, save) {
  if (!save.tuto && bundle.niveaux[TUTORIAL]) return TUTORIAL;
  return nextStep(bundle, save);
}

/**
 * Le personnage de départ : celui que le joueur a choisi ; sinon un de ceux qu'il a débloqués, au hasard ; et la toute
 * première partie (aucun niveau commencé, tuto à part : ses deux héros ne comptent pas), n'importe lequel, au hasard.
 * @param {() => number} random
 * @returns {{id: string, source: 'choisi' | 'aleatoire' | 'premier'}}
 */
export function startingHero(bundle, save, random = Math.random) {
  const playable = Object.values(bundle.heros).filter((x) => x.statut === 'jouable').map((x) => x.id);
  const mine = playable.filter((x) => isFound(save, 'heros', x));
  if (mine.includes(save.heros)) return { id: save.heros, source: 'choisi' };
  const first = !mine.length || firstVisit(save, [TUTORIAL]);
  const pool = first ? playable : mine;
  return { id: pool[Math.floor(random() * pool.length)] ?? '', source: first ? 'premier' : 'aleatoire' };
}

/** Les trois démarches que rappelle l'appel au vote. */
export const VOTE_FICHES = ['presidentielle-dates', 'inscription-listes', 'procuration'];

/**
 * Le dictionnaire de la scène de taxe : à qui comparer une fortune, ce que la taxe paierait. Les faits chocs, eux,
 * passent à l'écran de fin d'un niveau où l'on a taxé, dans « Et en vrai ? ».
 */
export const taxScales = (bundle) => Object.values(bundle.fiches).filter((f) => f.compare && f.valeur > 0);
export const taxUses = (bundle) => Object.values(bundle.fiches).filter((f) => f.finance && f.valeur > 0);
export const taxShocks = (bundle) => Object.values(bundle.fiches).filter((f) => f.choc);
/** Ce que chacun paie déjà, tous impôts compris : les deux taux, toujours montrés ensemble (jamais 27 % sans 52 %). */
export const TAX_RATES = ['prelevements-52', 'prelevements-27'];

/**
 * Les fiches que la scène de taxe débloque : celles qu'elle a montrées. `shown` : ce qu'elle a tiré cette fois-ci
 * (sans lui : tout le dictionnaire, faits chocs compris, pour savoir où une fiche se débloque).
 */
export const taxFiches = (bundle, boss, shown = [...taxScales(bundle), ...taxUses(bundle), ...taxShocks(bundle)]) =>
  [boss.fortune.fiche, ...boss.fortune.rente, 'impot-plancher', ...TAX_RATES, ...shown.map((f) => f.id)].filter((id) => bundle.fiches[id]);

/** La citation dont vient un mot crié en jeu (« ÉCOTERRORISME ! ») : son mot-clé, sinon ses propres mots. */
export function citationOfWord(bundle, word) {
  const bare = word.replace(/\s*!$/, '');
  const all = Object.values(bundle.citations);
  return all.find((c) => c.mot && bare.startsWith(c.mot)) || all.find((c) => c.texte.toUpperCase().includes(bare));
}

/** Les boss qu'on peut croiser dans un niveau : aucun sans repère « Y » ; celui que la fiche impose ; sinon tous. */
export function bossesOf(bundle, level) {
  if (!level.carte.some((row) => row.includes('Y'))) return [];
  return Object.hasOwn(bundle.boss, level.boss || '') ? [bundle.boss[level.boss]] : Object.values(bundle.boss);
}

/** Les unités qu'on croise dans un niveau : sa légende, sa nasse, les renforts qu'elles appellent, ceux du boss. */
function unitsOf(bundle, level) {
  const ids = new Set(Object.values(level.legende).filter((l) => l.type === 'ennemi').map((l) => l.id));
  if (level.nasse?.ennemi) ids.add(level.nasse.ennemi);
  for (const boss of bossesOf(bundle, level)) if (boss.attaques?.invocation?.ennemi) ids.add(boss.attaques.invocation.ennemi);
  for (const id of [...ids]) if (bundle.ennemis[id]?.renfort?.ennemi) ids.add(bundle.ennemis[id].renfort.ennemi);
  return ids;
}

/**
 * Où débloque-t-on cette carte ? L'indice affiché sous une silhouette, puis « Vu dans » sur la carte trouvée.
 * Les niveaux viennent dans l'ordre de la campagne : le premier nommé est le premier qu'on croise.
 * Un lieu se dit par son titre ; une circonstance, avec sa préposition (« dans la manif », « en taxant une fortune »).
 * Une liste vide voudrait dire qu'aucun chemin n'y mène : un test l'interdit.
 */
export function whereToFind(bundle, kind, item) {
  const levels = levelOrder(bundle).map((id) => bundle.niveaux[id]);
  const titles = (keep) => levels.filter(keep).map((lv) => lv.titre);
  const inLegend = (lv) => Object.values(lv.legende).some((l) => l.id === item.id);
  const characters = ['heros', 'recrues', 'ennemis', 'boss'].flatMap((k) => Object.values(bundle[k] || {}));
  const speakers = [...Object.values(bundle.heros), ...Object.values(bundle.ennemis)];
  switch (kind) {
    case 'niveaux': return [item.titre];
    // Un personnage jouable peut ouvrir un niveau (au hasard la première fois) ou se libérer en chemin, dans n'importe lequel.
    case 'heros': return item.statut === 'jouable' ? ['dans n’importe quel niveau'] : titles((lv) => lv.heros === item.id || lv.camarades.includes(item.id));
    case 'boss': {
      // Tiré au hasard au bout de chaque niveau qui a un boss : aucun niveau n'est à nommer plus qu'un autre.
      const fights = levels.filter((lv) => bossesOf(bundle, lv).length);
      const mine = fights.filter((lv) => bossesOf(bundle, lv).includes(item));
      return mine.length > 1 && mine.length === fights.length ? ['au bout de n’importe quel niveau'] : mine.map((lv) => lv.titre);
    }
    case 'recrues': return titles(inLegend);
    case 'ennemis': return titles((lv) => unitsOf(bundle, lv).has(item.id));
    case 'drapeaux': return levels.some((lv) => lv.cortege) ? ['dans le cortège'] : [];
    case 'manchettes': return ['sur PANIQUE TV'];
    case 'pancartes': return ['dans la manif']; // tirée au hasard quand des gens rejoignent le cortège
    case 'citations': {
      if (item.categorie !== 'gauche') return ['sur PANIQUE TV'];
      const quoting = [...characters, ...levels].filter((x) => x.citation === item.id).map(cardName);
      const saying = speakers.filter((x) => (x.arme?.mots || []).some((w) => citationOfWord(bundle, w) === item)).map(cardName);
      return [...quoting, ...saying];
    }
    case 'fiches': {
      const holders = [...characters, ...levels].filter((x) => [x.fiche].flat().includes(item.id)).map(cardName);
      if (holders.length) return holders;
      if (Object.values(bundle.boss).some((b) => taxFiches(bundle, b).includes(item.id))) return ['en taxant une fortune'];
      if (item.theme === 'droits') return ['en libérant un camarade'];
      if (VOTE_FICHES.includes(item.id)) return ['à la fin de la campagne'];
      return [];
    }
    default: return [];
  }
}

/** Une circonstance commence par sa préposition : elle se lit d'un trait, sans deux-points. */
const CIRCUMSTANCE = /^(dans|au|aux|en|à|sur) /;

/**
 * La ligne d'indice d'une carte. Cachée : « À découvrir dans la manif », « À découvrir : Le rond-point ».
 * Trouvée (un personnage) : « Vu au bout de n’importe quel niveau », « Vu dans : Le rond-point, La raffinerie bloquée ».
 * Un héros jouable se libère en chemin : « À libérer dans n’importe quel niveau », qu'on l'ait déjà ou non.
 */
export function hintLine(where, found, kind = '') {
  if (!where.length) return found ? '' : 'À découvrir';
  if (kind === 'heros' && CIRCUMSTANCE.test(where[0])) return `À libérer ${where[0]}`;
  if (CIRCUMSTANCE.test(where[0])) return `${found ? 'Vu' : 'À découvrir'} ${where[0]}`;
  return found ? `Vu dans : ${where.join(', ')}` : `À découvrir : ${where[0]}`;
}

/** Une miniature de niveau : un pixel par case, de la couleur dominante de sa tuile. */
function levelThumb(bundle, level) {
  const symbols = Object.fromEntries(Object.values(bundle.tuiles).map((t) => [t.symbole, t]));
  const rows = level.carte;
  const cvs = h('canvas', { className: 'pixel', width: rows[0].length, height: rows.length });
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = { campagne: '#6fc4ee', ville: '#8ea2c0', citadelle: '#2b1741' }[level.fond] || '#6fc4ee';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const tile = symbols[row[x]] || symbols[level.murs?.[y]?.[x]];
      if (!tile) continue;
      const art = sprite(tile.sprites.image, bundle.palette, false, false, !symbols[row[x]]);
      ctx.drawImage(art, 7, 7, 1, 1, x, y, 1, 1);
    }
  });
  cvs.style.width = '100%';
  return cvs;
}

const hearts = (n) => h('span', { className: 'coeurs' }, '♥'.repeat(n));
const bar = (value, max) => '▮'.repeat(Math.max(1, Math.round((value / max) * 5))).padEnd(5, '▯');

/** L'image d'une carte, dans un carré de `size` pixels ; les paroles et les faits n'en ont pas. */
function artOf(bundle, kind, item, size = 120) {
  if (kind === 'niveaux') return levelThumb(bundle, item);
  if (!item.sprites) return null;
  const rows = item.sprites.portrait || item.sprites.repos || item.sprites.image;
  const scale = Math.max(size < 120 ? 1 : 2, Math.floor(size / Math.max(rows.length, rows[0].length)));
  return spriteElement(rows, bundle.palette, scale);
}

const SIGNS = { richesses: '€', droits: '§', capital: '!', democratie: '✓', programme: '★', luttes: '✊' };

/** Sur une carte compacte sans dessin : le mot d'une parole, la pancarte, le bandeau, ou le signe d'un thème. */
function emblem(kind, item) {
  if (kind === 'citations') return h('span', { className: 'mot' }, item.mot || '« »');
  if (kind === 'pancartes' || kind === 'manchettes') return h('span', { className: 'ecrit' }, item.texte);
  return h('span', { className: 'signe' }, SIGNS[item.theme] || '?');
}

/** Sous une carte compacte : son nom ; pour une pancarte ou un bandeau, où et quand on l'a vu. */
const shortName = (kind, item) => (kind === 'pancartes' || kind === 'manchettes' ? item.credit.split(' — ')[0] : cardName(item));

/** Sur une carte, la source tient en une ligne : le média, cliquable. */
const shortSource = (item) => h('p', { className: 'source' }, 'Source : ', link(item.source.url, sourceName(item)));

const quoteBlock = (quote) => h('blockquote', {}, quoted(quote.texte), h('cite', {}, signature(quote)));

/** Les lignes « d'où ça vient » : la citation exacte et la fiche sourcée attachées à la carte. */
function references(bundle, item) {
  const out = [];
  const quote = bundle.citations[item.citation];
  if (quote) out.push(quoteBlock(quote));
  for (const id of [item.fiche].flat()) {
    const fact = bundle.fiches[id];
    if (fact) out.push(h('p', { className: 'fait' }, fact.texte, ' ', link(fact.source.url, 'source')));
  }
  for (const r of item.ressources || []) out.push(h('p', { className: 'fait' }, link(r.url, r.titre)));
  return out;
}

/** Ce que fait un ennemi, en quelques mots : « bouclier », « lacrymogènes », « vole »… */
function enemyTraits(item) {
  const w = item.arme;
  return [item.ligne?.vie > 0 && 'cède aux tracts et à la manif', item.bouclier && 'bouclier', w?.gaz > 0 && 'lacrymogènes', w?.vise > 0 && 'lance vers toi',
    w?.type === 'jet' && 'canon à eau', w?.mots?.length && 'lance des mots',
    // Une caméra qui cadre, un projecteur qui éclaire : la panique monte tant que le héros est dans le champ.
    (item.reaction === 'cadre' || item.reaction === 'projecteur') && 'fait monter la panique',
    item.reaction === 'charge' && 'charge le cortège', (item.reaction === 'fonce' || item.deplacement === 'moto') && 'fonce',
    item.deplacement === 'vol' && 'vole'].filter(Boolean);
}

/** Ce que fait une recrue : multiplier la manif, soigner le héros, ou y ajouter du monde. */
function recruitTrait(item) {
  if (item.multiplie > 1) return `manif × ${item.multiplie}`;
  if (item.soin > 0) return 'soigne le héros';
  return `+ ${item.apport} dans la manif`;
}

/**
 * Ce que fait un ennemi ou une recrue, pour la note de sa première rencontre (« Débloqué : AG · manif × 2 ») ;
 * '' pour les autres cartes, ou un ennemi sans trait. Les mêmes faits que sur sa carte, deux au plus pour un ennemi.
 */
export function trait(kind, item) {
  if (kind === 'ennemis') return enemyTraits(item).slice(0, 2).join(' · ');
  if (kind === 'recrues') return recruitTrait(item);
  return '';
}

/** Les lignes de chiffres et de traits sous une carte de la Collection. */
export function facts(kind, item) {
  if (kind === 'heros') {
    return [`encaisse ${item.pv} coups  vitesse ${bar(item.vitesse, 200)}  saut ${bar(item.saut, 4.5)}`,
      item.speciale?.nom && `Spéciale : ${item.speciale.nom}`];
  }
  if (kind === 'ennemis') {
    const pv = item.ligne?.vie > 0 ? item.ligne.vie : item.pv; // une ligne : sa vie de ligne
    return [[hearts(Math.min(pv, 10)), pv > 10 ? ` ×${pv}` : ''], enemyTraits(item).join(' · ')];
  }
  if (kind === 'boss') return [`Fortune : ${billions(item.fortune.montant)} d’euros`];
  if (kind === 'recrues') {
    // Ce que dit la note de sa rencontre ; une street medic amène aussi du monde, la carte le dit en plus.
    const what = [recruitTrait(item), item.soin > 0 && item.apport > 0 && `+ ${item.apport} dans la manif`].filter(Boolean).join(' · ');
    return [what[0].toUpperCase() + what.slice(1)];
  }
  if (kind === 'drapeaux') return [item.description];
  return [];
}

/** Le corps d'une carte « Parole » ou « Fait » : le texte exact, son contexte, sa source. */
function textBody(kind, item) {
  if (kind === 'pancartes' || kind === 'manchettes') {
    const [where, url] = item.credit.split(' — ');
    return [where && h('p', { className: 'dapres' }, where), url && h('p', { className: 'source' }, link(url, 'source'))];
  }
  if (kind === 'citations') {
    return [h('blockquote', {}, quoted(item.texte)),
      h('p', { className: 'dapres' }, link(item.source.url, [item.fonction, frenchDate(item.date)].filter(Boolean).join(', '))),
      item.contexte && h('details', { className: 'portee' }, h('summary', {}, 'Le contexte'), h('p', {}, item.contexte))];
  }
  // Un fait tient en une phrase ; ce qu'il couvre exactement se déplie.
  return [h('p', {}, item.texte), shortSource(item),
    item.portee && h('details', { className: 'portee' }, h('summary', {}, 'Ce que ça couvre'), h('p', {}, item.portee))];
}

/**
 * Une carte de l'album.
 * @param {{kind: string, badge: string, item: object, number: number}} card
 * @param {boolean} found  faux : silhouette et indice seulement
 */
export function collectionCard(bundle, card, found = true) {
  const { kind, badge, item, number } = card;
  const where = whereToFind(bundle, kind, item);
  const art = artOf(bundle, kind, item);
  const rarity = found && rarityName(item);
  const head = h('header', {}, h('span', {}, `N° ${String(number).padStart(3, '0')}`),
    h('span', { className: `genre${rarity ? ` rarete-${item.rarete}` : ''}` }, rarity ? `${badge} · ${rarity}` : badge));
  const picture = art ? h('div', { className: 'vignette' }, art) : h('div', { className: 'vignette vide' }, found ? '' : '?');
  if (!found) {
    return h('article', { className: `carte ${kind} cachee` }, head, picture,
      h('h3', {}, '???'),
      h('p', { className: 'indice' }, hintLine(where, false, kind)));
  }
  return h('article', { className: `carte ${kind}` }, head, art && picture,
    h('h3', {}, kind === 'pancartes' || kind === 'manchettes' ? quoted(item.texte) : cardName(item)),
    item.inspiration && h('p', { className: 'dapres' }, `d’après ${item.inspiration}`),
    kind === 'niveaux' && item.accroche && h('p', { className: 'dapres' }, item.accroche), // le lieu, en une phrase, sous son nom
    item.origine && h('p', { className: 'origine' }, item.origine),
    art ? references(bundle, item) : textBody(kind, item),
    facts(kind, item).filter(Boolean).map((line) => h('p', { className: 'stats' }, line)),
    where.length && ['heros', 'recrues', 'ennemis', 'boss'].includes(kind) ? h('p', { className: 'indice' }, hintLine(where, true, kind)) : null);
}

/**
 * Une carte compacte : numéro, image ou pictogramme, nom. Toutes de la même taille.
 * @param {{found?: boolean, fresh?: boolean, onOpen?: Function}} options  `fresh` : badge « Nouveau »
 */
export function miniCard(bundle, card, { found = true, fresh = false, onOpen = null } = {}) {
  const { kind, item, number } = card;
  const art = artOf(bundle, kind, item, 56);
  const rare = found && item.rarete > 0;
  return h('button', { type: 'button', className: `carte-mini ${kind}${found ? '' : ' cachee'}${rare ? ` rarete-${item.rarete}` : ''}`, onclick: onOpen },
    h('span', { className: 'numero' }, `N° ${String(number).padStart(3, '0')}`, rare && h('b', {}, '★'.repeat(item.rarete))),
    fresh && h('span', { className: 'nouveau' }, 'Nouveau'),
    h('span', { className: 'vignette' }, art || (found ? emblem(kind, item) : h('span', { className: 'signe' }, '?'))),
    h('span', { className: 'nom' }, found ? shortName(kind, item) : '???'));
}

/**
 * Ouvre une carte en grand, par-dessus l'écran, avec ses références.
 * Se ferme d'un toucher à côté, avec Échap ou avec « Fermer ». `actions` : boutons ajoutés au pied.
 * Tant qu'elle est ouverte, elle garde le clavier : Échap la ferme où que soit le focus, Tab tourne dedans,
 * et à la fermeture le focus revient sur ce qui l'a ouverte.
 */
export function openCard(bundle, card, { found = true, actions = [] } = {}) {
  const opener = document.activeElement;
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (!overlay.isConnected) return document.removeEventListener('keydown', onKey, true); // l'écran a changé sous elle
    if (e.key === 'Escape') {
      e.stopPropagation(); // Échap ferme la carte, pas l'écran
      e.preventDefault();
      return close();
    }
    if (e.key !== 'Tab') return undefined;
    const inside = [...overlay.querySelectorAll('a[href], button, summary')].filter((el) => el.offsetParent);
    if (!inside.length) return undefined;
    const at = inside.indexOf(document.activeElement);
    e.preventDefault();
    return inside[(at + (e.shiftKey ? -1 : 1) + inside.length) % inside.length].focus(); // une carte haute défile jusqu'au lien
  };
  const article = collectionCard(bundle, card, found);
  // Pas de `&&` qui rendrait faux : un `onclick` qui rend faux annule le clic, et les liens des sources avec.
  const overlay = h('div', { className: 'carte-ouverte', onclick: (e) => { if (e.target === overlay) close(); } },
    h('div', { className: 'cadre' },
      article,
      h('div', { className: 'pied' }, actions, h('button', { type: 'button', className: 'discret fermer', onclick: close }, 'Fermer'))));
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', found ? cardName(card.item) : 'Carte à découvrir');
  document.addEventListener('keydown', onKey, true);
  (document.getElementById('ecran') || document.body).append(overlay);
  overlay.querySelector('.fermer').focus({ preventScroll: true });
  return overlay;
}

/** Une barre de progression : trouvées sur total. */
export const progress = (found, total) =>
  h('span', { className: 'jauge', title: `${found} / ${total}` }, h('i', { style: `width: ${total ? Math.round((found / total) * 100) : 0}%` }));

/**
 * La grille d'un rayon : des cartes compactes ; on en touche une, elle s'ouvre.
 * `actionsFor(carte)` : les boutons à montrer au pied d'une carte trouvée (« Jouer avec »).
 */
export function shelfGrid(bundle, shelf, save = null, actionsFor = () => [], rarity = null) {
  const cards = allCards(bundle).filter((c) => c.shelf === shelf && (rarity === null || c.item.rarete === rarity))
    .map((c) => ({ c, found: !save || isFound(save, c.kind, cardId(c.item)) }));
  // Ce qu'on a débloqué d'abord : avec des centaines de pancartes, les siennes ne se cherchent pas.
  return h('div', { className: 'grille-album' }, [...cards.filter((x) => x.found), ...cards.filter((x) => !x.found)].map(({ c, found }) =>
    miniCard(bundle, c, {
      found, fresh: Boolean(save) && found && isFresh(save, c),
      onOpen: () => openCard(bundle, c, { found, actions: found ? actionsFor(c) : [] }),
    })));
}

/** Par rareté, combien de cartes débloquées sur combien, dans ce rayon ? Vide si le rayon n'a pas de rareté. */
export function rarityCounts(bundle, save, shelf) {
  const cards = allCards(bundle).filter((c) => c.shelf === shelf && c.item.rarete !== undefined);
  if (!cards.length) return [];
  return RARITIES.map((name, rarity) => {
    const mine = cards.filter((c) => c.item.rarete === rarity);
    return { rarity, name, total: mine.length, found: mine.filter((c) => !save || isFound(save, c.kind, cardId(c.item))).length };
  });
}

/**
 * Ce qui a été débloqué pendant un niveau, en rangée : elles se retournent une à une.
 * @param {string[]} keys  clés de sauvegarde, « rayon:identifiant »
 */
export function wonCards(bundle, keys) {
  return h('div', { className: 'debloquees' }, cardsByKeys(bundle, keys).map((c, i) => {
    const mini = miniCard(bundle, c, { onOpen: () => openCard(bundle, c) });
    mini.style.animationDelay = `${Math.min(i, 30) * 70}ms`;
    return mini;
  }));
}

/** Combien de cartes trouvées, sur combien ? `save` nul : tout compte comme trouvé (Galerie). */
export function collectionCount(bundle, save = null, shelf = null) {
  const cards = allCards(bundle).filter((c) => !shelf || c.shelf === shelf);
  return { found: cards.filter((c) => !save || isFound(save, c.kind, cardId(c.item))).length, total: cards.length };
}

/** Les cartes d'un rayon. */
export function collectionShelf(bundle, shelf, save = null) {
  return h('div', { className: 'cartes-album' }, allCards(bundle).filter((c) => c.shelf === shelf)
    .map((c) => collectionCard(bundle, c, !save || isFound(save, c.kind, cardId(c.item)))));
}

/** L'album complet, rayon par rayon (Galerie). `more(rayon)` : ce qui s'ajoute au titre d'un rayon (un lien). */
export function collectionAlbum(bundle, save = null, more = () => null) {
  const { found, total } = collectionCount(bundle, save);
  return h('div', { className: 'album' },
    h('p', { className: 'compte' }, `${found} / ${total}`),
    SHELVES.map((shelf) => (collectionCount(bundle, save, shelf.id).total
      ? [h('h3', { className: 'rayon' }, shelf.titre, more(shelf)), collectionShelf(bundle, shelf.id, save)] : [])));
}
