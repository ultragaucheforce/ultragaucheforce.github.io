// Sauvegarde locale : progression, découvertes, options, brouillon de l'Atelier.
// Rien ne quitte l'appareil. Si le stockage est indisponible (navigation privée, quota),
// le jeu continue avec une sauvegarde en mémoire.

const KEY = 'ugf:sauvegarde'; // préfixé : le domaine peut être partagé avec d'autres pages
const UNREAD = 'ugf:sauvegarde:illisible'; // une sauvegarde qu'on n'a pas su lire reste ici, telle quelle

/** Le format de la sauvegarde. Il ne change qu'avec une fonction de passage dans `MIGRATIONS`. */
export const VERSION = 5;

/** Les anciens identifiants d'ennemis et ceux d'aujourd'hui : les automates avant la version 4, les chaînes avant la 5. */
const RENAMED_ENEMIES = {
  crs: 'robot-bouclier', bac: 'ramasseur', 'brav-m': 'petaradeurs', raid: 'defonceur', 'gendarme-mobile': 'lance-pleurs',
  centaure: 'gros-blinde',
  cnews: 'fnews', bfm: 'duplex-panique-tv',
};
const has = (o, k) => k !== null && Object.hasOwn(o, k);

/** Le texte d'un niveau dont la légende et `nasse.ennemi` portent les anciens identifiants, avec ceux d'aujourd'hui. */
export const renameEnemies = (text) => text.replace(/^(\S|nasse\.ennemi): *(\S+) *$/gm,
  (line, sign, id) => (has(RENAMED_ENEMIES, id) ? `${sign}: ${RENAMED_ENEMIES[id]}` : line));

/**
 * `MIGRATIONS[n - 1]` fait passer une sauvegarde de la version n à la version n + 1.
 * On n'en retire jamais : un joueur peut revenir après des mois. Chaque version garde une vraie
 * sauvegarde dans `tests/fixtures/sauvegardes/`, que les tests font remonter jusqu'à aujourd'hui.
 */
const MIGRATIONS = [
  // 1 → 2 : la question « Radio Manif ? » du premier lancement (`options.musiqueChoisie`). Qui avait mis la
  // musique l'a choisie ; les autres n'y ont jamais été invités : la question leur est posée une fois.
  (save) => {
    if (shape(save.options) !== 'object') return save; // abîmées : upgrade() les met de côté et repart des options de départ
    return { ...save, options: { ...save.options, musiqueChoisie: save.options.musique === true } };
  },
  // 2 → 3 : la musique part d'elle-même (Valentin, 17 novembre 2026 : « auto play by default »). Qui n'avait jamais
  // choisi l'a désormais ; qui l'avait coupée (« Non », ou les options) la garde coupée.
  (save) => {
    if (shape(save.options) !== 'object' || save.options.musiqueChoisie) return save;
    return { ...save, options: { ...save.options, musique: true } };
  },
  // 3 → 4 : les automates changent de nom et d'identifiant (cadrage choisi par Valentin : « Automates du capital » ;
  // noms : « Option 2 »). Les cartes débloquées suivent, et le brouillon de l'Atelier qui en posait aussi.
  (save) => renameSaved(save),
  // 4 → 5 : les chaînes changent de nom (Valentin : « change CNEWS pour "FNEWS" y compris le pictogramme. »,
  // « change BFMTV pour Panique TV. ») : `cnews` devient `fnews`, `bfm` devient `duplex-panique-tv`. Même passage.
  (save) => renameSaved(save),
];

/** Les cartes d'ennemis débloquées et le brouillon de l'Atelier prennent les identifiants d'aujourd'hui. */
function renameSaved(save) {
  const out = { ...save };
  if (shape(save.decouvertes) === 'liste') {
    out.decouvertes = [...new Set(save.decouvertes.map((key) => {
      const id = typeof key === 'string' && key.startsWith('ennemis:') ? key.slice('ennemis:'.length) : null;
      return has(RENAMED_ENEMIES, id) ? `ennemis:${RENAMED_ENEMIES[id]}` : key;
    }))];
  }
  if (typeof save.brouillon === 'string') out.brouillon = renameEnemies(save.brouillon);
  return out;
}

const DEFAULTS = {
  termines: {}, // identifiant de niveau → vrai
  records: {}, // identifiant de niveau → la plus grande manif à l'arrivée
  decouvertes: [], // ce qui est débloqué dans la Collection : « rayon:identifiant ». Une clé inconnue reste : la fiche peut revenir
  vues: {}, // rayon de la Collection → nombre de découvertes lors de sa dernière visite (badge « Nouveau »)
  heros: '', // le héros de départ choisi ; vide : au hasard
  // Le tuto a été joué (« C'est parti ») ou passé. Absent d'une sauvegarde d'avant : jamais proposé, il le sera au
  // prochain « Jouer », quelle que soit la progression. Effacer sa progression le garde.
  tuto: false,
  // La musique (lecteur SoundCloud) part d'elle-même ; les options la coupent. `musiqueChoisie` : le joueur l'a
  // réglée lui-même (options, ou l'ancienne question « Radio Manif ? ») ; son choix est gardé.
  options: { son: true, musique: true, sobre: false, musiqueChoisie: false },
  brouillon: '',
};

const shape = (value) => (Array.isArray(value) ? 'liste' : value === null ? 'rien' : typeof value);
/** Le numéro de version d'une sauvegarde : un entier à partir de 1 ; tout le reste vaut 1. */
const versionOf = (save) => (Number.isInteger(save?.version) && save.version >= 1 ? save.version : 1);

/**
 * Une sauvegarde lue, de n'importe quelle version, devient celle d'aujourd'hui. Rien n'est retiré :
 * ce que cette version du jeu ne connaît pas (une fiche partie, un champ d'une version plus récente) est gardé tel quel.
 * Un champ qui n'a pas la bonne forme reprend sa valeur de départ ; l'original reste dans `ecartes`.
 */
export function upgrade(stored) {
  let save = shape(stored) === 'object' ? { ...stored } : {};
  const from = versionOf(save);
  for (let v = from; v < VERSION; v++) save = MIGRATIONS[v - 1](save);
  const out = { ...structuredClone(DEFAULTS), ...save, version: Math.max(from, VERSION) };
  for (const [key, start] of Object.entries(DEFAULTS)) {
    if (shape(out[key]) === shape(start)) continue;
    out.ecartes = { ...out.ecartes, [key]: out[key] };
    out[key] = structuredClone(start);
  }
  out.options = { ...DEFAULTS.options, ...out.options };
  return out;
}

/** Écrite par une version plus récente du jeu : cette version-ci la lit, mais n'y écrit pas, pour ne rien abîmer. */
export const isReadOnly = (save) => versionOf(save) > VERSION;

export function loadSave() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return upgrade(null); // stockage interdit : sauvegarde en mémoire
  }
  try {
    return upgrade(JSON.parse(raw));
  } catch {
    // Illisible, ou un passage de version a échoué : on la met de côté sans y toucher, et on repart de zéro.
    try {
      localStorage.setItem(UNREAD, raw);
    } catch {
      // stockage plein : tant pis pour la copie
    }
    return upgrade(null);
  }
}

/**
 * Ce qu'un autre onglet a écrit entre-temps rejoint cette sauvegarde : l'union des découvertes, le meilleur record,
 * tout niveau terminé, le tuto joué ou passé. Le reste (options, héros choisi) est à celui qui écrit en dernier.
 */
export function fold(save, other) {
  for (const key of other.decouvertes) if (!save.decouvertes.includes(key)) save.decouvertes.push(key);
  for (const [id, crowd] of Object.entries(other.records)) if (!(save.records[id] >= crowd)) save.records[id] = crowd;
  for (const [id, done] of Object.entries(other.termines)) if (done) save.termines[id] = true;
  if (other.tuto) save.tuto = true;
  return save;
}

/**
 * @param {object} save
 * @param {{erase?: boolean}} o  `erase` : le joueur efface sa progression, on ne reprend pas ce qui est stocké
 * @returns {boolean} vrai si la sauvegarde a été écrite
 */
export function storeSave(save, { erase = false } = {}) {
  if (isReadOnly(save)) return false;
  try {
    const now = JSON.parse(localStorage.getItem(KEY));
    if (shape(now) === 'object') {
      if (versionOf(now) > VERSION) {
        save.version = versionOf(now); // un onglet plus récent est passé par là : on n'écrase pas son travail
        return false;
      }
      if (!erase) fold(save, upgrade(now));
    }
  } catch {
    // rien de lisible à reprendre
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false; // tant pis : la partie reste jouable
  }
}

/**
 * « Effets réduits » suit le réglage du système (`prefers-reduced-motion`) tant que le joueur n'a pas choisi lui-même.
 * `sobreChoisi` absent (une sauvegarde d'avant) : des effets réduits déjà cochés l'avaient été à la main.
 * @returns {boolean} vrai si la valeur a changé
 */
export function followSystemMotion(options, reduce) {
  const chosen = options.sobreChoisi ?? options.sobre === true;
  if (chosen) return false;
  const before = options.sobre;
  options.sobre = Boolean(reduce);
  options.sobreChoisi = false;
  return before !== options.sobre;
}

/** Le joueur efface sa progression ; ses options, son brouillon et le tuto déjà joué restent, et les découvertes de `keep` aussi. */
export function eraseProgress(save, keep = []) {
  Object.assign(save, { termines: {}, records: {}, decouvertes: [...keep], vues: {}, heros: '' });
  return storeSave(save, { erase: true });
}

const key = (kind, id) => `${kind}:${id}`;

/** Cette carte (« heros », « ennemis », « citations »… + identifiant) a-t-elle déjà été rencontrée ? */
export const isFound = (save, kind, id) => save.decouvertes.includes(key(kind, id));

/**
 * Le tout premier passage : aucun niveau encore commencé (un niveau lancé est noté « niveaux:… »), sans compter
 * ceux de `except` (le tuto, pour le tirage du premier héros).
 */
export const firstVisit = (save, except = []) => !save.decouvertes.some((k) => typeof k === 'string' && k.startsWith('niveaux:')
  && !except.includes(k.slice('niveaux:'.length)));

/** Le tuto est joué ou passé : il n'est plus proposé à « Jouer », il reste dans le menu. */
export function tutorialDone(save) {
  if (save.tuto) return;
  save.tuto = true;
  storeSave(save);
}

/** Note une découverte ; renvoie vrai si elle est nouvelle. */
export function discover(save, kind, id) {
  if (isFound(save, kind, id)) return false;
  save.decouvertes.push(key(kind, id));
  storeSave(save);
  return true;
}
