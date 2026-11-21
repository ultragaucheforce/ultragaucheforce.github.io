// La Collection : toutes les fiches du contenu deviennent des cartes, rangées et numérotées.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/content.mjs';
import { SHELVES, TUTORIAL, allCards, cardId, cardName, citationOfWord, hintLine, levelOrder, signNote, whereToFind, wonGroups } from '../src/client/collection.js';
import { RARITIES } from '../src/content/rarities.js';

const { bundle } = loadContent();
const cards = allCards(bundle);

test('collection : une carte par fiche, numérotée, avec un nom et une clé unique', () => {
  assert.deepEqual(cards.map((c) => c.number), cards.map((_, i) => i + 1));
  const keys = cards.map((c) => `${c.kind}:${cardId(c.item)}`);
  assert.equal(new Set(keys).size, keys.length, 'aucune carte en double');
  for (const c of cards) assert.ok(cardName(c.item), `${c.kind}:${cardId(c.item)} a un nom`);
  for (const kind of ['heros', 'recrues', 'ennemis', 'boss', 'niveaux', 'citations', 'fiches', 'drapeaux']) {
    const ids = Object.keys(bundle[kind]).filter((id) => !(kind === 'niveaux' && id === TUTORIAL)); // le tuto n'est pas un lieu
    assert.equal(cards.filter((c) => c.kind === kind).length, ids.length, kind);
  }
});

test('collection : les pancartes en deuxième, juste après les camarades ; les numéros suivent les rayons', () => {
  assert.deepEqual(SHELVES.map((s) => s.id), ['camarades', 'pancartes', 'en-face', 'lieux', 'paroles', 'tele', 'faits', 'propositions', 'luttes']);
  const shelfOf = cards.map((c) => SHELVES.findIndex((s) => s.id === c.shelf));
  assert.deepEqual(shelfOf, [...shelfOf].sort((a, b) => a - b), 'les cartes d’un rayon se suivent, rayon après rayon');
});

test('collection : les camarades viennent dans l’ordre de content/camarades.txt, le tyrannogauchiste en N° 001', () => {
  const order = ['tyrannogauchiste', 'melenchon', 'ecoterroriste', 'poutou', 'aubry', 'sale-gosse', 'dinos-gauchistes', 'zucman',
    'guette', 'gauche-atomique', 'rousseau', 'sniper', 'magma-gauche', 'bompard', 'sans-dents'];
  const heroes = cards.filter((c) => c.kind === 'heros');
  assert.deepEqual(heroes.map((c) => c.item.id), order);
  assert.equal(heroes[0].number, 1);
  assert.deepEqual(Object.keys(bundle.heros), order, 'la sélection et la Galerie suivent le même ordre');
});

test('collection : chaque rayon a ses cartes ; faits et propositions se partagent les fiches', () => {
  for (const shelf of SHELVES) assert.ok(cards.some((c) => c.shelf === shelf.id), `rayon « ${shelf.titre} »`);
  const of = (id) => cards.filter((c) => c.shelf === id);
  assert.ok(of('propositions').every((c) => c.item.theme === 'programme'));
  assert.ok(of('faits').every((c) => c.item.theme !== 'programme'));
  assert.equal(of('faits').length + of('propositions').length, Object.keys(bundle.fiches).length);
});

test('collection : toute pancarte, tout bandeau devient une carte, avec ou sans source', () => {
  const lines = { ...bundle, pancartes: [...bundle.pancartes, { texte: 'SANS SOURCE', credit: '', rarete: 0 }] };
  const signs = allCards(lines).filter((c) => c.kind === 'pancartes');
  assert.equal(signs.length, bundle.pancartes.length + 1);
  assert.equal(allCards(bundle).filter((c) => c.kind === 'manchettes').length, bundle.manchettes.length);
});

test('collection : chaque carte se débloque quelque part en jouant', () => {
  const lost = cards.filter((c) => whereToFind(bundle, c.kind, c.item).length === 0).map((c) => `${c.kind}:${cardId(c.item)}`);
  assert.deepEqual(lost, [], 'cartes sans aucun chemin : attache-les à un personnage, un niveau, une scène');
  const hint = (kind, id) => whereToFind(bundle, kind, kind === 'pancartes' ? bundle.pancartes.find((p) => p.texte === id) : bundle[kind][id]);
  assert.deepEqual(hint('pancartes', 'MACRON, RENDS-NOUS LE POGNON !'), ['dans la manif'], 'même le slogan d’une recrue se tire au hasard');
  assert.deepEqual(hint('heros', 'zucman'), ['dans n’importe quel niveau']);
  assert.deepEqual(hint('pancartes', 'TAXEZ LES RICHES'), ['dans la manif']);
  assert.deepEqual(hint('citations', 'melenchon-bruit-et-fureur'), ["L'Ingénieur du chaos"], 'les mots du héros viennent de sa citation');
  assert.deepEqual(hint('fiches', 'procuration'), ['à la fin de la campagne']);
  assert.deepEqual(hint('fiches', 'programme-train'), ['Cheminot'], 'une proposition se débloque avec le camarade qui la porte');
  assert.deepEqual(hint('fiches', 'programme-energie'), ["L'Écoterroriste"],'plus de bouton dans À propos, et le programme n’est pas sur l’écran du vote');
  assert.deepEqual(hint('fiches', 'patrimoine-moitie'), ['en taxant une fortune']);
  assert.ok(hint('ennemis', 'lance-pleurs').length >= 1, 'les renforts de l’hélicoptère comptent');
});

test('collection : les indices suivent l’ordre de la campagne', () => {
  const order = levelOrder(bundle);
  const shield = whereToFind(bundle, 'ennemis', bundle.ennemis['robot-bouclier']);
  assert.deepEqual(shield, order.filter((id) => shield.includes(bundle.niveaux[id].titre)).map((id) => bundle.niveaux[id].titre), 'dans l’ordre des étapes');
});

test('collection : un boss tiré au hasard se croise au bout de n’importe quel niveau ; un boss imposé, dans ses niveaux', () => {
  // Une campagne d'essai, faite ici : le contenu réel reste libre d'imposer ou non ses boss.
  const level = (titre, boss = '') => ({ titre, boss, carte: [boss === null ? '.....' : '..Y..'], legende: {}, camarades: [] });
  const campaign = (niveaux, campagne = Object.keys(niveaux)) => ({ campagne, niveaux, boss: { x: { id: 'x' }, y: { id: 'y' } }, heros: {}, ennemis: {} });
  const random = campaign({ a: level('A'), b: level('B'), sans: level('Sans boss', null) });
  for (const boss of Object.values(random.boss)) assert.deepEqual(whereToFind(random, 'boss', boss), ['au bout de n’importe quel niveau'], boss.id);
  const imposed = campaign({ a: level('A', 'x'), b: level('B'), c: level('C') }, ['c', 'a', 'b']);
  assert.deepEqual(whereToFind(imposed, 'boss', imposed.boss.y), ['C', 'B'], 'le niveau qui impose x n’est pas nommé pour y ; les autres, dans l’ordre de la campagne');
  assert.deepEqual(whereToFind(imposed, 'boss', imposed.boss.x), ['au bout de n’importe quel niveau']);
  const alone = campaign({ a: level('A'), b: level('B', null) });
  assert.deepEqual(whereToFind(alone, 'boss', alone.boss.x), ['A'], 'un seul niveau à boss : on le nomme');
});

test('collection : la ligne d’indice se lit d’un trait, sans « dans » en double', () => {
  assert.equal(hintLine(['dans n’importe quel niveau'], false, 'heros'), 'À libérer dans n’importe quel niveau');
  assert.equal(hintLine(['dans n’importe quel niveau'], true, 'heros'), 'À libérer dans n’importe quel niveau', 'la même ligne, trouvé ou non');
  assert.equal(hintLine(['au bout de n’importe quel niveau'], true), 'Vu au bout de n’importe quel niveau');
  assert.equal(hintLine(['Le rond-point', 'La raffinerie bloquée'], false), 'À découvrir : Le rond-point');
  assert.equal(hintLine(['Le rond-point', 'La raffinerie bloquée'], true), 'Vu dans : Le rond-point, La raffinerie bloquée');
  assert.equal(hintLine([], false), 'À découvrir');
  for (const c of cards) {
    for (const found of [false, true]) assert.doesNotMatch(hintLine(whereToFind(bundle, c.kind, c.item), found, c.kind), /dans : dans|: (dans|au|en|à|sur) /, `${c.kind}:${cardId(c.item)}`);
  }
});

test('collection : un mot crié en jeu retrouve sa citation, par son mot-clé ou par ses propres mots', () => {
  assert.equal(citationOfWord(bundle, 'ÉCOTERRORISME !').id, 'darmanin-ecoterrorisme');
  assert.equal(citationOfWord(bundle, 'LA FUREUR !').id, 'melenchon-bruit-et-fureur');
  assert.equal(citationOfWord(bundle, 'MOT INCONNU !'), undefined);
  for (const speaker of [...Object.values(bundle.heros), ...Object.values(bundle.ennemis)]) {
    for (const word of speaker.arme?.mots || []) assert.ok(citationOfWord(bundle, word), `${speaker.id} : « ${word} » ne vient d'aucune citation`);
  }
});

// Valentin, 17 novembre 2026 : « évite de couper les textes comme ici pour la pancarte débloquée. tu peux rajouter une
// ligne c'est ok . »
test('la note d’une pancarte débloquée dit son texte en entier, sans « … », quelle que soit sa longueur ou sa rareté', () => {
  const longest = Math.max(...bundle.pancartes.map((p) => p.texte.length));
  assert.ok(longest > 100, `la plus longue pancarte fait ${longest} signes`);
  for (const p of bundle.pancartes) {
    for (let rarete = 0; rarete < RARITIES.length; rarete++) {
      const note = signNote({ ...p, rarete });
      assert.ok(note.includes(`« ${p.texte} »`), `${p.texte} : en entier`);
      assert.ok(!note.replace(p.texte, '').includes('…'), `${p.texte} : pas de « … » ajouté`);
      assert.ok(note.startsWith(`Pancarte ${RARITIES[rarete]} débloquée : `), note);
    }
  }
});

test('fin de niveau : les pancartes d’abord, chaque groupe annoncé avec son nombre', () => {
  const key = (c) => `${c.kind}:${cardId(c.item)}`;
  const signs = cards.filter((c) => c.kind === 'pancartes').slice(0, 7);
  const others = cards.filter((c) => c.kind !== 'pancartes').slice(0, 22);
  const groups = wonGroups(bundle, [...others, ...signs].map(key));
  assert.deepEqual(groups.map((g) => g.label), ['7 pancartes débloquées', 'Aussi débloqué : 22']);
  assert.deepEqual(groups[0].cards.map(key), signs.map(key));
  assert.deepEqual(groups[1].cards.map(key), others.map(key), 'le reste garde l’ordre des rayons');
  assert.deepEqual(wonGroups(bundle, [key(signs[0])]).map((g) => g.label), ['1 pancarte débloquée'], 'sans autre carte, pas de seconde étiquette');
  assert.deepEqual(wonGroups(bundle, others.slice(0, 3).map(key)).map((g) => g.label), ['3 cartes débloquées'], 'sans pancarte, pas de « Aussi »');
  assert.deepEqual(wonGroups(bundle, [key(others[0])]).map((g) => g.label), ['1 carte débloquée']);
});
