// La consigne du tuto : un panneau qui nomme une commande attend le geste, puis montre un ✓ et s'efface.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coach, gesturesOf, guideView, dodge, CHECK_TIME, DODGE_DELAY } from '../src/client/consigne.js';
import { askedFor } from '../src/client/ui.js';
import { loadContent } from '../tools/content.mjs';
import { readFileSync } from 'node:fs';
import { TUTORIAL, levelOrder, nextLevel, nextStep, startingHero } from '../src/client/collection.js';
import { firstVisit, eraseProgress, upgrade, fold, tutorialDone } from '../src/client/save.js';

test('chaque panneau attend les gestes que nomment ses marqueurs', () => {
  assert.deepEqual(gesturesOf('[avancer] : avancer · [sauter] : sauter'), ['avancer', 'sauter']);
  assert.deepEqual(gesturesOf('[tirer] : lancer des tracts'), ['tirer']);
  assert.deepEqual(gesturesOf('[spéciale] : lance ta spéciale'), ['speciale']);
  assert.deepEqual(gesturesOf('Pousse contre le mur : [sauter], [sauter], [sauter]'), ['sauter']);
  assert.deepEqual(gesturesOf('[bas] + [tirer] : creuser · [haut] + [tirer] : lancer en haut'), ['creuser', 'lancer-haut']);
  assert.deepEqual(gesturesOf('[avancer] + [sauter] : grimper au mur'), ['grimper'], 'avancer + sauter : un seul geste');
  assert.deepEqual(gesturesOf('[avancer] : avancer · [sauter] : sauter'), ['avancer', 'sauter'], 'sans « + », deux gestes');
  assert.deepEqual(gesturesOf('[sauter] + [spéciale]'), ['sauter', 'speciale'], 'un « + » inconnu se défait');
  assert.deepEqual(gesturesOf('[ Spéciale ]'), ['speciale'], 'les mêmes formes que withKeys');
  assert.deepEqual(gesturesOf('Va jusqu’à la paysanne : elle rejoint la manif ✊'), [], 'sans marqueur : rien à attendre');
  assert.deepEqual(gesturesOf('[pause] ou [inconnu]'), []);
  assert.deepEqual(gesturesOf(''), []);
});

test('les panneaux du tuto : chacun enseigne un geste ou une règle, et les gestes de base y sont tous', async () => {
  const { bundle } = await loadContent();
  const signs = Object.values(bundle.niveaux[TUTORIAL].panneaux);
  const taught = new Set(signs.flatMap(gesturesOf));
  for (const g of ['avancer', 'sauter', 'tirer', 'speciale']) assert.ok(taught.has(g), g);
  assert.ok(!bundle.campagne.includes(TUTORIAL), 'le tuto n’est pas une étape de la campagne');
  assert.ok(!levelOrder(bundle).includes(TUTORIAL), 'ni du plan de campagne');
});

test('le tout premier passage (pour le tirage du héros) : aucun niveau commencé', () => {
  assert.equal(firstVisit({ decouvertes: [] }), true);
  assert.equal(firstVisit({ decouvertes: ['heros:melenchon', 'citations:x'] }), true);
  assert.equal(firstVisit({ decouvertes: ['niveaux:millevaches'] }), false, 'un joueur qui a déjà joué');
  assert.equal(firstVisit({ decouvertes: [`niveaux:${TUTORIAL}`] }), false, 'le tuto lancé une fois compte aussi');
});

test('« Jouer » mène au tuto tant qu’il n’a été ni joué ni passé, même avec une sauvegarde qui a progressé', async () => {
  const { bundle } = await loadContent();
  const order = levelOrder(bundle);
  assert.equal(nextLevel(bundle, upgrade(null)), TUTORIAL, 'tout nouveau joueur');
  // Une vraie sauvegarde d'avant : deux niveaux terminés, et le tuto lancé une fois (« niveaux:… ») sans `tuto`.
  const v5 = upgrade(JSON.parse(readFileSync(new URL('./fixtures/sauvegardes/v5.json', import.meta.url), 'utf8')));
  assert.equal(v5.tuto, false, 'un champ absent : pas encore joué');
  assert.equal(nextLevel(bundle, v5), TUTORIAL);
  assert.equal(nextLevel(bundle, { ...v5, decouvertes: [...v5.decouvertes, `niveaux:${TUTORIAL}`] }), TUTORIAL, 'même déjà vu sous l’ancienne règle');
  tutorialDone(v5); // « C’est parti » ou « Passer le tuto »
  assert.equal(v5.tuto, true);
  assert.equal(nextLevel(bundle, v5), nextStep(bundle, v5));
  assert.notEqual(nextLevel(bundle, v5), TUTORIAL);
  assert.equal(nextLevel(bundle, { ...upgrade(null), tuto: true }), order[0], 'passé dès la première fois : le premier niveau');
});

test('le tuto joué ou passé le reste : effacer sa progression le garde, un autre onglet ne le défait pas', async () => {
  const { bundle } = await loadContent();
  const save = { ...upgrade(null), termines: { millevaches: true }, decouvertes: ['niveaux:millevaches'], tuto: true };
  eraseProgress(save, [`niveaux:${TUTORIAL}`]);
  assert.equal(save.tuto, true);
  assert.notEqual(nextLevel(bundle, save), TUTORIAL);
  const other = upgrade(null); // un onglet ouvert avant, qui n'a pas vu le tuto
  fold(other, save);
  assert.equal(other.tuto, true);
});

/** Joue la consigne pas à pas : `sign` le panneau lu, `actions` ce qui est enfoncé, `hero` le héros après le pas, 1/60 s par pas. */
function player() {
  let state = null;
  let time = 0;
  return {
    step(sign = null, actions = {}, n = 1, hero = undefined) {
      for (let i = 0; i < n; i++) {
        time += 1 / 60;
        state = coach(state, { sign, actions, time, hero });
      }
      return guideView(state);
    },
  };
}

test('la consigne reste tant que le geste manque, même loin du panneau, puis ✓ et s’efface', () => {
  const p = player();
  const sign = '[tirer] : lancer des tracts';
  let view = p.step(sign);
  assert.deepEqual(view, { text: sign, done: false, hints: ['fire'] });
  view = p.step(null, { right: true }, 600); // dix secondes plus loin, sans lancer
  assert.equal(view?.text, sign, 'toujours là, sans limite de temps');
  assert.equal(view.done, false);
  view = p.step(null, { fire: true });
  assert.equal(view.done, true, 'le geste fait : ✓');
  assert.deepEqual(view.hints, [], 'plus rien ne clignote');
  view = p.step(null, {}, Math.ceil(CHECK_TIME * 60) + 1);
  assert.equal(view, null, 'le ✓ tombe');
  assert.equal(p.step(sign, {}), null, 'un panneau déjà fait n’attend plus');
});

test('un panneau à deux gestes les attend tous les deux, et allume le prochain', () => {
  const p = player();
  const sign = '[bas] + [tirer] : creuser · [haut] + [tirer] : lancer en haut';
  assert.deepEqual(p.step(sign).hints, ['bas', 'fire']);
  assert.deepEqual(p.step(sign, { fire: true }).hints, ['bas', 'fire'], 'lancer seul ne creuse pas');
  assert.deepEqual(p.step(sign, { down: true, fire: true }).hints, ['haut', 'fire']);
  const view = p.step(null, { up: true, fire: true });
  assert.equal(view.done, true);
});

test('grimper attend un rebond contre un mur, pas un simple saut', () => {
  const p = player();
  const sign = '[avancer] + [sauter] : grimper au mur';
  assert.deepEqual(p.step(sign).hints, ['cote', 'jump']);
  assert.equal(p.step(sign, { right: true, jump: true, jumpPressed: true }, 30, { climbed: false }).done, false, 'un saut ne suffit pas');
  assert.equal(p.step(sign, { right: true, jump: true }, 1, { climbed: true }).done, true, 'le rebond : ✓');
});

test('un autre panneau lu remplace la consigne ; un panneau sans marqueur l’efface', () => {
  const p = player();
  p.step('[spéciale] : lance ta spéciale');
  assert.equal(p.step('[avancer] : avancer · [sauter] : sauter').text, '[avancer] : avancer · [sauter] : sauter');
  assert.equal(p.step('Un tonneau saute, ses voisins aussi'), null, 'rien ne reste figé');
  assert.equal(p.step(null, {}, 120), null);
});

test('un geste déjà tenu à l’arrivée compte : le joueur n’est jamais retenu', () => {
  const p = player();
  const view = p.step('[avancer] : avancer · [sauter] : sauter', { right: true });
  assert.deepEqual(view.hints, ['jump']);
});

test('le clignotement réunit la spéciale demandée et le geste de la consigne', () => {
  assert.deepEqual([...askedFor(false, null)], []);
  assert.deepEqual([...askedFor(true, null)], ['special']);
  assert.deepEqual([...askedFor(false, { hints: ['bas', 'fire'] })].sort(), ['bas', 'fire']);
  assert.deepEqual([...askedFor(true, { hints: ['special'] })], ['special']);
});

test('après le tuto, fini ou passé, le premier niveau tire son héros parmi tous, comme une toute première partie', async () => {
  const { bundle } = await loadContent();
  const playable = Object.values(bundle.heros).filter((x) => x.statut === 'jouable').map((x) => x.id);
  const tuto = bundle.niveaux[TUTORIAL];
  const afterTuto = { heros: '', decouvertes: [`niveaux:${TUTORIAL}`, `heros:${tuto.heros}`, 'heros:melenchon'] };
  const seen = new Set();
  for (let i = 0; i < playable.length; i++) {
    const pick = startingHero(bundle, afterTuto, () => (i + 0.5) / playable.length);
    assert.equal(pick.source, 'premier');
    seen.add(pick.id);
  }
  assert.deepEqual([...seen].sort(), [...playable].sort(), 'tous les héros jouables, pas seulement ceux du tuto');
  // Un niveau de la campagne commencé : on revient au tirage parmi ceux débloqués.
  const later = { ...afterTuto, decouvertes: [...afterTuto.decouvertes, 'niveaux:millevaches'] };
  for (const r of [0, 0.5, 0.99]) {
    const pick = startingHero(bundle, later, () => r);
    assert.equal(pick.source, 'aleatoire');
    assert.ok([tuto.heros, 'melenchon'].includes(pick.id));
  }
  assert.deepEqual(startingHero(bundle, { ...afterTuto, heros: 'melenchon' }), { id: 'melenchon', source: 'choisi' });
  assert.deepEqual(startingHero(bundle, { heros: '', decouvertes: [] }, () => 0), { id: playable[0], source: 'premier' });
});

test('après le tuto, la suite est la prochaine étape non terminée', async () => {
  const { bundle } = await loadContent();
  const order = levelOrder(bundle);
  assert.equal(nextStep(bundle, { termines: {} }), order[0]);
  assert.equal(nextStep(bundle, { termines: { [order[0]]: true } }), order[1]);
  assert.equal(nextStep(bundle, { termines: Object.fromEntries(order.map((id) => [id, true])) }), order[0]);
});

test('effacer sa progression garde la carte du tuto', () => {
  const save = { termines: { millevaches: true }, records: {}, decouvertes: ['niveaux:millevaches', 'heros:melenchon'], vues: {}, heros: 'x', options: {} };
  eraseProgress(save, [`niveaux:${TUTORIAL}`]);
  assert.deepEqual(save.decouvertes, [`niveaux:${TUTORIAL}`]);
  assert.equal(firstVisit(save), false);
});

test('le panneau du tuto ne saute pas au sommet d’un saut ; il laisse la place au héros qui reste dessous', () => {
  const board = { y0: 30, y1: 46 };
  const hero = { y0: 36, y1: 60 };
  const frame = (overlap, extra = {}) => ({ text: 'A', board, hero, overlap, viewH: 216, dt: 1 / 60, ...extra });
  const memo = {};
  const at = (overlap, n, extra) => {
    let dy = 0;
    for (let i = 0; i < n; i++) dy = dodge(memo, frame(overlap, extra));
    return dy;
  };
  assert.equal(at(true, 15), 0, 'un saut : un quart de seconde dessous, le panneau ne bouge pas');
  assert.equal(at(false, 30), 0);
  assert.equal(at(true, 15), 0, 'un autre saut : l’attente repart de zéro');
  assert.equal(at(false, 1), 0);
  const dy = at(true, Math.ceil(DODGE_DELAY * 60) + 1);
  assert.equal(dy, hero.y1 + 2 - board.y0, 'resté dessous : il passe sous le héros');
  assert.equal(at(false, 60), dy, 'puis garde cette place, sans revenir');
  assert.equal(at(true, 60), dy);
  assert.equal(dodge(memo, frame(false, { text: 'B' })), 0, 'le panneau suivant repart de sa place');
  const low = {};
  let up = 0;
  for (let i = 0; i < 60; i++) up = dodge(low, frame(true, { hero: { y0: 190, y1: 214 } }));
  assert.equal(up, 190 - 2 - board.y1, 'sans place dessous : au-dessus du héros');
  assert.equal(dodge({}, frame(false, { hero: null })), 0, 'sans héros : rien ne bouge');
});
