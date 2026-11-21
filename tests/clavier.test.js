// Le clavier : une touche tenue reste tenue d'un écran à l'autre (carton de héros, pause), seule ou avec d'autres.

import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Un navigateur réduit à ce que lit `Input` : les écouteurs de la fenêtre, et des éléments qui ne font rien. */
function browser() {
  const listeners = {};
  const element = () => ({
    style: { setProperty() {} }, classList: { toggle() {}, contains: () => false },
    querySelector: () => element(), querySelectorAll: () => [], addEventListener() {},
  });
  Object.assign(globalThis, {
    addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
    document: { body: element(), documentElement: element(), addEventListener() {} },
    innerWidth: 800, innerHeight: 450,
  });
  const fire = (type, code, repeat = false) => {
    for (const fn of listeners[type] || []) fn({ code, repeat, preventDefault() {} });
  };
  return {
    down: (code) => fire('keydown', code),
    repeat: (code) => fire('keydown', code, true),
    up: (code) => fire('keyup', code),
    blur: () => fire('blur'),
  };
}

const keys = browser();
const { Input } = await import('../src/client/input.js');
const input = new Input(globalThis.document.body);
input.active = true;
/** Ce que main.js fait à chaque changement d'écran (`setMode`). */
const screen = (active) => {
  input.release(false);
  input.active = active;
};
const held = () => Object.entries(input.actions()).filter(([a, on]) => on && a !== 'jumpPressed').map(([a]) => a).sort();

test('droite et haut tenus pendant le carton d’un camarade libéré : toujours tenus au retour en jeu', () => {
  keys.down('ArrowRight');
  keys.down('ArrowUp');
  assert.deepEqual(held(), ['jump', 'right', 'up']);
  screen(false); // le carton
  screen(true); // « Continuer »
  assert.deepEqual(held(), ['jump', 'right', 'up'], 'ni relâcher ni réappuyer');
  keys.up('ArrowRight');
  keys.up('ArrowUp');
  assert.deepEqual(held(), []);
});

test('une touche relâchée sous le carton ne reste pas enfoncée', () => {
  keys.down('ArrowLeft');
  screen(false);
  keys.up('ArrowLeft');
  screen(true);
  assert.deepEqual(held(), []);
});

test('Entrée enfoncée sur un menu, encore tenue quand la partie part : pas de tract', () => {
  screen(false); // le carton d'ouverture
  keys.down('Enter'); // « C'est parti »
  screen(true);
  keys.repeat('Enter');
  keys.repeat('Enter');
  assert.deepEqual(held(), [], 'ni l’appui du menu ni ses répétitions');
  keys.up('Enter');
  keys.down('Enter'); // relâchée puis réappuyée en jeu : elle tire
  assert.deepEqual(held(), ['fire']);
  keys.up('Enter');
});

test('une touche enfoncée en pause ne compte qu’une fois relâchée et réappuyée', () => {
  screen(false);
  keys.down('ArrowLeft');
  keys.repeat('ArrowLeft');
  screen(true);
  keys.repeat('ArrowLeft');
  assert.deepEqual(held(), []);
  keys.up('ArrowLeft');
  keys.down('ArrowLeft');
  assert.deepEqual(held(), ['left']);
  keys.up('ArrowLeft');
  assert.deepEqual(held(), []);
});

test('la page perd la main : tout est relâché, puis la répétition reprend la touche tenue', () => {
  keys.down('ArrowRight');
  keys.blur();
  assert.deepEqual(held(), []);
  keys.repeat('ArrowRight');
  assert.deepEqual(held(), ['right']);
  keys.up('ArrowRight');
});

test('Échap et P tenus ne basculent la pause qu’une fois', () => {
  let pauses = 0;
  let backs = 0;
  input.onPause = () => pauses++;
  input.onBack = () => backs++;
  keys.down('KeyP');
  keys.repeat('KeyP');
  keys.repeat('KeyP');
  keys.down('Escape');
  keys.repeat('Escape');
  assert.equal(pauses, 1);
  assert.equal(backs, 1);
  assert.deepEqual(held(), []);
});
