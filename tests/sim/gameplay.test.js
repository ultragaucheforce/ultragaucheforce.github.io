// Règles du jeu : sauvetage, armes, boucliers, grenades fratricides, panique, cortège, vies, boss.

import { spawnProjectile } from '../../src/sim/projectile.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { fixtureBundle, flat, play, run, settle } from './helpers.js';
import { Game } from '../../src/sim/game.js';
import { TILE } from '../../src/sim/world.js';
import { botActions } from '../../src/sim/bot.js';
import { loadContent } from '../../tools/content.mjs';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  (e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []));
const enemy = (id) => ({ type: 'ennemi', id });
const types = (events) => events.map((e) => e.type);

// ---------------------------------------------------------------- sauvetage

test('sauvetage : exactement une vie de plus, un autre héros, une seule fois', () => {
  const game = settle(play(flat({ draw: (put, ground) => put(ground, 6, 'K') })));
  const before = game.hero.def.id;
  const events = run(game, 60, { right: true });
  assert.equal(game.lives, 4, 'une vie de plus');
  assert.notEqual(game.hero.def.id, before, 'le héros a changé');
  assert.equal(game.hero.hp, game.hero.def.pv, 'vie pleine');
  assert.equal(game.hero.charges, game.hero.def.speciale.charges, 'charges pleines');
  assert.deepEqual(events.filter((e) => e.type === 'heroCard').map((e) => e.hero), [game.hero.def.id]);
  assert.deepEqual(events.filter((e) => e.type === 'card'), [{ type: 'card', id: 'garde-a-vue' }], 'une fiche « droits » débloquée');
  assert.ok(events.some((e) => e.type === 'sfx' && e.id === 'sauvetage'));

  run(game, 40, { left: true });
  run(game, 60, { right: true }); // repasse sur la cage ouverte
  assert.equal(game.lives, 4);
  assert.equal(game.stats.rescues, 1);
});

test('sauvetage : le niveau peut imposer le camarade libéré, et un tir ouvre aussi la cage', () => {
  const game = settle(play(flat({ camarades: 'test-hero', draw: (put, ground) => put(ground, 8, 'K') })));
  run(game, 60, { fire: true });
  assert.equal(game.stats.rescues, 1, 'la cage a cédé sous les tirs');
  assert.equal(game.hero.def.id, 'test-hero');
});

test('un héros « test » n’est ni héros de départ ni camarade tiré au hasard', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const game = settle(play(flat({ heros: '', draw: (put, ground) => put(ground, 4, 'K') }), { seed }));
    const first = game.hero.def.id;
    assert.ok(['alpha', 'beta'].includes(first), 'tiré parmi les héros jouables');
    run(game, 40, { right: true });
    assert.equal(game.hero.def.id, first === 'alpha' ? 'beta' : 'alpha');
  }
});

// ---------------------------------------------------------------- armes

test('deux héros, deux armes réellement différentes', () => {
  const volley = (hero) => {
    const game = settle(play(flat({ width: 80, heros: hero })));
    let arcs = false;
    let booms = 0;
    for (let i = 0; i < 150; i++) {
      game.step({ fire: i < 90 });
      arcs ||= game.projectiles.some((p) => Math.abs(p.vy) > 20);
      booms += game.events.splice(0).filter((e) => e.type === 'explosion').length;
    }
    return { shots: game.stats.tracts, arcs, booms };
  };
  const alpha = volley('alpha');
  const beta = volley('beta');
  assert.ok(alpha.shots >= 3 * beta.shots, `cadences : ${alpha.shots} tirs contre ${beta.shots}`);
  assert.equal(alpha.arcs, false, 'alpha tire droit');
  assert.equal(beta.arcs, true, 'bêta tire en cloche');
  assert.equal(alpha.booms, 0);
  assert.ok(beta.booms >= 1, 'les projectiles de bêta explosent');
});

test('un héros et son arme ajoutés par un simple fichier sont jouables, sans une ligne de moteur', () => {
  const bundle = fixtureBundle();
  assert.ok(bundle.heros['test-hero'], 'la fiche tests/fixtures/content/heros/test-hero.txt est chargée');
  const game = settle(play(flat({
    heros: 'test-hero',
    draw: (put, ground) => {
      put(ground, 12, 'A');
      put(ground - 1, 12, 'A');
    },
  })));
  assert.equal(game.hero.def.id, 'test-hero');
  game.step({ fire: true });
  assert.equal(game.projectiles.length, 3, 'arme.nombre: 3 → trois projectiles par tir');
  let bounced = false;
  for (let i = 0; i < 90; i++) {
    game.step({});
    bounced ||= game.projectiles.some((p) => p.vx < 0);
  }
  assert.ok(bounced, 'arme.rebonds: 2 → un projectile rebondit sur le mur');

  game.step({ special: true });
  assert.equal(game.hero.clones.length, 2, 'speciale.type: clones → deux doubles');
  assert.equal(game.hero.charges, game.hero.def.speciale.charges - 1);
  game.projectiles.length = 0;
  game.step({ fire: true });
  assert.equal(game.projectiles.length, 9, 'les doubles tirent avec le héros');
  run(game, 300);
  assert.equal(game.hero.clones.length, 0, 'les doubles disparaissent après speciale.duree');

  for (const file of sources(SRC)) {
    assert.ok(!readFileSync(file, 'utf8').includes('test-hero'), `${file} ne doit pas connaître ce héros`);
  }
});

test('creuser : sans avancer, bas + tir perce sous les pieds, haut + tir perce le plafond', () => {
  const ground = 10;
  const lvl = () => flat({ draw: (put, row) => {
    for (let y = row - 4; y <= row; y++) put(y, 6, 'TTTTT'); // un bloc de terre, quatre rangées au-dessus du sol d'acier
    put(row - 5, 8, 'D');
    put(row, 2, '.');
  } });
  const digger = settle(play(lvl()));
  const top = digger.hero.y;
  run(digger, 240, { down: true, fire: true });
  assert.ok(digger.hero.y >= top + 4 * TILE, `le héros est descendu de ${(digger.hero.y - top) / TILE} tuiles`);
  assert.equal(digger.world.at(8, ground), null, 'la terre sous lui a disparu jusqu’à l’acier');
  assert.equal(digger.world.at(8, ground + 1)?.id, 'acier', 'l’acier ne se creuse pas');
  assert.equal(digger.world.at(6, ground)?.id, 'terre', 'et il n’a creusé qu’un puits');

  const walker = settle(play(lvl()));
  run(walker, 60, { down: true, right: true, fire: true });
  assert.equal(walker.hero.aim, 0, 'en avançant, on tire devant soi');
  assert.equal(walker.world.at(8, ground - 4)?.id, 'terre');

  const roof = settle(play(flat({ draw: (put, row) => put(row - 3, 0, 'TTTTTT') })));
  run(roof, 60, { up: true, fire: true });
  assert.equal(roof.world.at(2, ground - 3), null, 'le plafond est percé au-dessus de sa tête');
});

// Owner : « les attaques de Poutou et de Sansdents sont impossibles à utiliser vers le haut ».
test('chaque héros de la campagne tire vers le haut, même avec une arme en cloche', () => {
  const real = loadContent();
  assert.deepEqual(real.errors, []);
  const heroes = Object.keys(real.bundle.heros);
  assert.ok(heroes.length > 0);
  for (const id of heroes) {
    const game = settle(play(flat({ height: 30, heros: id }), { bundle: real.bundle, hero: id, invincible: true }));
    const head = game.hero.y;
    game.step({ up: true, fire: true });
    const shot = game.projectiles.find((p) => p.team === 'luttes');
    assert.ok(shot, `${id} : un projectile part`);
    assert.ok(shot.vy < 0, `${id} : il part vers le haut (vy = ${shot.vy})`);
    let top = shot.y;
    for (let i = 0; i < 240 && !shot.dead; i++) {
      game.step({});
      top = Math.min(top, shot.y);
    }
    const reach = Math.min(real.bundle.heros[id].arme.portee * 0.8, 6 * TILE);
    assert.ok(head - top >= reach, `${id} : il monte de ${Math.round(head - top)} px au-dessus de la tête (au moins ${reach})`);
  }
});

// « il est bizarre le tir en haut […] il est pas pareil/cohérent avec le tir droit » : un tir en cloche tiré vers le
// haut retrouve sa gravité à son premier rebond, il retombe et sautille au sol comme devant soi.
test('sous un plafond, le tir en cloche de Poutou et du Sans-dents retombe au lieu de rebondir du plafond au sol', () => {
  const real = loadContent();
  for (const id of ['poutou', 'sans-dents']) {
    const game = settle(play(flat({ height: 30, heros: id }), { bundle: real.bundle, hero: id, invincible: true }));
    const { world, hero } = game;
    const row = Math.floor(hero.y / TILE) - 5; // un plafond d'acier cinq tuiles au-dessus de la tête
    for (let tx = 0; tx < world.w; tx++) world.set(tx, row, world.indexOf('acier'));
    const ceiling = (row + 1) * TILE;
    game.step({ up: true, fire: true });
    const shot = game.projectiles.find((p) => p.team === 'luttes');
    let roof = 0; // contacts avec le plafond
    let rising = true;
    let low = shot.y;
    for (let i = 0; i < 600 && !shot.dead; i++) {
      game.step({});
      if (rising && shot.vy > 0 && shot.y < ceiling + TILE) roof++;
      rising = shot.vy < 0;
      if (roof) low = Math.max(low, shot.y);
    }
    assert.equal(roof, 1, `${id} : il touche le plafond une fois`);
    assert.ok(low > hero.y, `${id} : puis il retombe jusqu’au sol`);
    assert.ok(shot.dead, `${id} : et il finit sa course`);
  }
});

test('vers le haut, un tir part juste au-dessus du crâne, aussi long que devant soi : un mot de héros aussi', () => {
  const real = loadContent();
  for (const id of ['rousseau', 'melenchon', 'tyrannogauchiste', 'poutou']) {
    const shoot = (actions) => {
      const game = settle(play(flat({ height: 30, heros: id }), { bundle: real.bundle, hero: id, invincible: true }));
      game.hero.facing = 1;
      game.step(actions);
      return { hero: game.hero, shot: game.projectiles.find((p) => p.team === 'luttes') };
    };
    const ahead = shoot({ fire: true });
    const above = shoot({ up: true, fire: true });
    assert.equal(above.shot.upright, -1, `${id} : tiré vers le haut`);
    assert.equal(above.shot.h, ahead.shot.w, `${id} : la même longueur dans le sens du tir`);
    assert.ok(above.shot.w <= above.hero.w, `${id} : pas plus large que le héros, il passe dans un puits d’une tuile`);
    const step = 1 / 60;
    assert.ok(Math.abs(above.shot.y + above.shot.h - above.hero.y - above.shot.vy * step) < 1, `${id} : il part juste au-dessus du crâne`);
    assert.ok(Math.abs(ahead.shot.x - ahead.hero.x - ahead.hero.w - ahead.shot.vx * step) < 1, `${id} : devant soi, juste devant le corps`);
  }
});

const withFoe = (real, id) => settle(play(flat({ height: 30, heros: id, legende: { f: { type: 'ennemi', id: 'barrage' } }, draw: (put, ground) => put(ground - 1, 20, 'f') }), { bundle: real.bundle, hero: id, invincible: true }));

test('sous un plafond proche, un mot tiré vers le haut touche l’adversaire entre la tête et le plafond', () => {
  const real = loadContent();
  for (const id of ['rousseau', 'melenchon']) {
    for (const tiles of [2, 3]) {
      const game = withFoe(real, id);
      const { world, hero } = game;
      const e = game.enemies[0];
      for (let tx = 0; tx < world.w; tx++) world.set(tx, Math.floor(hero.y / TILE) - tiles, world.indexOf('acier'));
      const before = e.hp;
      for (let i = 0; i < 3; i++) {
        [e.x, e.y, e.vx, e.vy] = [hero.x + hero.w / 2 - e.w / 2, hero.y - e.h - 2, 0, 0];
        game.step(i === 0 ? { up: true, fire: true } : {});
      }
      assert.ok(e.hp < before, `${id}, plafond ${tiles} tuiles au-dessus : l’adversaire est touché (${before} → ${e.hp})`);
    }
  }
});

test('un tir ne touche jamais à travers un mur ou un plafond d’une tuile', () => {
  const real = loadContent();
  for (const id of ['rousseau', 'melenchon', 'poutou', 'tyrannogauchiste']) {
    for (const gap of [0, 4, 10, 20]) { // devant soi : le mur à `gap` px du corps, l'adversaire derrière lui
      const game = withFoe(real, id);
      const { world, hero } = game;
      hero.facing = 1;
      const e = game.enemies[0];
      const col = Math.floor((hero.x + hero.w + gap) / TILE);
      hero.x = col * TILE - gap - hero.w;
      for (let ty = 0; ty < world.h - 1; ty++) world.set(col, ty, world.indexOf('acier'));
      const before = e.hp;
      for (let i = 0; i < 3; i++) {
        [e.x, e.y, e.vx, hero.vx] = [(col + 1) * TILE + 1, hero.y + hero.h - e.h, 0, 0];
        game.step(i === 0 ? { fire: true } : {});
      }
      assert.equal(e.hp, before, `${id}, mur à ${gap} px : rien derrière lui n’est touché`);
    }
    for (const gap of [0, 8, 20, 36]) { // vers le haut : le plafond à `gap` px du crâne, l'adversaire debout dessus
      const game = withFoe(real, id);
      const { world, hero } = game;
      const e = game.enemies[0];
      const row = Math.floor((hero.y - gap - 1) / TILE);
      for (let tx = 0; tx < world.w; tx++) world.set(tx, row, world.indexOf('acier'));
      const before = e.hp;
      for (let i = 0; i < 3; i++) {
        [e.x, e.y, e.vx, e.vy] = [hero.x + hero.w / 2 - e.w / 2, row * TILE - e.h, 0, 0];
        game.step(i === 0 ? { up: true, fire: true } : {});
      }
      assert.equal(e.hp, before, `${id}, plafond à ${gap} px : rien au-dessus de lui n’est touché`);
    }
  }
});

test('spéciale « onde » : repousse, étourdit et casse les planches autour', () => {
  const game = settle(play(flat({
    legende: { f: enemy('fonceur') },
    draw: (put, ground) => {
      put(ground, 2, '.');
      put(ground, 10, 'D');
      put(ground, 12, 'f');
      put(ground, 8, 'P');
    },
  }), { invincible: true }));
  const target = game.enemies[0];
  const events = [];
  game.step({ special: true });
  events.push(...game.events.splice(0));
  assert.equal(game.hero.charges, 2);
  assert.equal(target.state, 'done', 'onde.degats: 2 met le fonceur (1 pv) en panne');
  assert.ok(events.some((e) => e.type === 'bubble' && e.text === 'BOUM'), 'le nom de la spéciale s’affiche');
  run(game, 2);
  assert.equal(game.world.at(8, game.world.h - 2), null, 'la planche voisine a sauté');
});

test('spéciale « sol » : deux ondes rasent le plancher et passent sous les boucliers', () => {
  const bundle = structuredClone(fixtureBundle());
  bundle.heros.alpha.speciale = { type: 'sol', vitesse: 240, portee: 220, degats: 3, terrain: 3, son: '', nom: 'PLANCHER', charges: 1 };
  const game = settle(play(flat({
    legende: { s: enemy('statue') },
    draw: (put, ground) => {
      put(ground, 2, '.');
      put(ground, 10, 'D');
      put(ground, 14, 's');
      put(ground, 5, 'P');
    },
  }), { bundle }));
  game.step({ special: true });
  assert.equal(game.projectiles.length, 2);
  assert.deepEqual(game.projectiles.map((p) => Math.sign(p.vx)).sort(), [-1, 1]);
  run(game, 90);
  assert.equal(game.enemies[0].state, 'done', 'la statue à bouclier (3 pv) est tombée');
  assert.equal(game.world.at(5, game.world.h - 2), null, 'la planche de gauche aussi');
  assert.ok(game.world.solid(8, game.world.h - 1), 'le plancher n’est pas abîmé');
  assert.equal(game.hero.charges, 0);
});

test('spéciale « billes » : elles roulent, restent au sol, et qui marche dessus glisse, sonné', () => {
  const bundle = structuredClone(fixtureBundle());
  bundle.heros.alpha.speciale = {
    type: 'billes', nombre: 5, vitesse: 120, duree: 4, glisse: 2, recul: 160, degats: 0, son: '', nom: 'BILLES', charges: 1,
  };
  const game = settle(play(flat({
    legende: { f: enemy('fonceur'), v: enemy('blinde') },
    draw: (put, ground) => {
      put(ground, 2, '.');
      put(ground, 6, 'D');
      put(ground, 16, 'f');
      put(ground, 34, 'v');
    },
  }), { bundle, invincible: true }));
  const [walker, tank] = game.enemies;
  game.step({ special: true });
  assert.equal(game.projectiles.length, 5, 'speciale.nombre: 5');
  assert.equal(game.hero.charges, 0);
  run(game, 90);
  const rest = game.projectiles.filter((p) => p.slip > 0);
  assert.equal(rest.length, 5, 'les billes restent au sol');
  assert.ok(rest.every((p) => Math.abs(p.vx) < 30), 'et elles ont presque fini de rouler');
  assert.ok(walker.state === 'stunned' && walker.daze === 'glisse', 'le fonceur a glissé dessus');
  assert.notEqual(walker.state, 'done', 'degats: 0 : il glisse, il ne tombe pas en panne');
  assert.notEqual(tank.daze, 'glisse', 'un véhicule ne glisse pas');
  run(game, 4 * 60);
  assert.equal(game.projectiles.filter((p) => p.slip > 0).length, 0, 'speciale.duree : elles disparaissent');
});

test('spéciale « billes » : ni ce qui vole, ni le boss, ni le héros ne glissent', () => {
  const bundle = structuredClone(fixtureBundle());
  bundle.heros.alpha.speciale = {
    type: 'billes', nombre: 5, vitesse: 120, duree: 4, glisse: 2, recul: 160, degats: 2, son: '', nom: 'BILLES', charges: 1,
  };
  const game = settle(play(flat({
    width: 40, boss: 'gros', legende: { d: enemy('drone') },
    draw: (put, ground) => {
      put(ground, 2, '.');
      put(ground, 6, 'D');
      put(ground, 8, 'd');
      put(ground, 10, 'Y');
    },
  }), { bundle, invincible: true }));
  const [drone] = game.enemies;
  const { boss, hero } = game;
  const hp = boss.hp;
  game.step({ special: true });
  run(game, 40);
  assert.ok(game.projectiles.some((p) => p.slip > 0), 'les billes sont au sol');
  assert.notEqual(drone.daze, 'glisse', 'un drone ne glisse pas');
  assert.equal(boss.hp, hp, 'les billes ne touchent pas le boss, même avec des dégâts');
  assert.notEqual(boss.state, 'stunned');
  assert.equal(hero.stun ?? 0, 0, 'le héros ne glisse pas sur ses billes');
  assert.ok(!hero.daze);
});

test('spéciale « mur » : fait pousser des tuiles, jamais sur un personnage', () => {
  const game = settle(play(flat({ heros: 'beta' })));
  const ground = game.world.h - 2;
  const tx = Math.floor((game.hero.x + game.hero.w / 2) / TILE) + 1;
  game.step({ special: true });
  for (const row of [ground, ground - 1, ground - 2]) assert.equal(game.world.at(tx, row)?.id, 'haie');
  assert.equal(game.world.at(tx, ground - 3), null, 'speciale.hauteur: 3');
  assert.equal(game.hero.charges, 1);

  const crowded = settle(play(flat({ heros: 'beta', legende: { s: enemy('statue') }, draw: (put, row) => put(row, 3, 's') })));
  crowded.step({ special: true });
  assert.equal(crowded.world.at(3, ground), null, 'rien ne pousse sur la statue');
  assert.equal(crowded.hero.charges, 2, 'la charge n’est pas consommée');
});

// ---------------------------------------------------------------- automates

test('bilan : seuls les automates comptent parmi les « automates désactivés », pas un duplex ni un ministre', () => {
  const base = fixtureBundle();
  const camera = { ...base.ennemis.statue, id: 'camera', camp: 'medias', bouclier: false };
  const guard = { ...base.ennemis.statue, id: 'planton', bouclier: false };
  const shoot = (id) => {
    const bundle = { ...base, ennemis: { ...base.ennemis, camera, planton: guard } };
    const game = settle(play(flat({ legende: { s: enemy(id) }, draw: (put, ground) => put(ground, 8, 's') }), { bundle }));
    run(game, 120, { fire: true });
    assert.equal(game.enemies[0].state, 'done');
    return game.stats.breakdownsByPlayer;
  };
  assert.equal(shoot('planton'), 1);
  assert.equal(shoot('camera'), 0);
});

test('bouclier : arrête les tirs de face, pas ceux de dos ni les projectiles « blindage »', () => {
  const statue = (start, bundle = fixtureBundle()) => settle(play(flat({
    legende: { s: enemy('statue') },
    draw: (put, ground) => {
      put(ground, 2, '.');
      put(ground, start, 'D');
      put(ground, 8, 's');
    },
  }), { bundle }));
  const front = statue(3);
  run(front, 120, { fire: true });
  assert.equal(front.enemies[0].hp, front.enemies[0].def.pv, 'de face : aucun dégât');
  assert.equal(front.stats.breakdownsByPlayer, 0);

  const back = statue(13);
  run(back, 2, { left: true });
  run(back, 90, { fire: true });
  assert.equal(back.enemies[0].state, 'done', 'de dos : en panne');
  assert.equal(back.stats.breakdownsByPlayer, 1);
  assert.equal(back.stats.breakdownsBySelf, 0);

  // Même arme, même position de face, avec « arme.blindage: 1 » : le bouclier ne sert plus à rien.
  const piercing = structuredClone(fixtureBundle());
  piercing.heros.alpha.arme.blindage = 1;
  const armored = statue(3, piercing);
  run(armored, 120, { fire: true });
  assert.equal(armored.enemies[0].state, 'done', 'blindage : passe le bouclier de face');
});

test('bouclier : un tir qui monte d’en dessous n’est jamais paré, quelle que soit sa dispersion', () => {
  for (const vx of [-8, 8]) {
    const game = settle(play(flat({
      legende: { s: enemy('statue') },
      draw: (put, ground) => put(ground, 8, 's'),
    }), { bundle: fixtureBundle() }));
    const statue = game.enemies[0];
    const hp = statue.hp;
    spawnProjectile(game, {
      team: 'luttes', w: 6, h: 6, damage: 1, range: 60, upright: -1, vx, vy: -200,
      x: statue.x + statue.w / 2 - 3, y: statue.y + statue.h - 10,
    });
    run(game, 3);
    assert.ok(statue.hp < hp, `dispersion ${vx} : le tir d’en dessous touche le bouclier de face`);
  }
});

test('grenade fratricide : l’automate qui se blesse lui-même est compté à part', () => {
  const game = play(flat({ legende: { m: enemy('maladroit') }, draw: (put, ground) => put(ground, 9, 'm') }), { invincible: true });
  const events = run(game, 240);
  assert.equal(game.enemies[0].state, 'done');
  assert.equal(game.stats.breakdownsBySelf, 1, 'panne causée par sa propre grenade');
  assert.equal(game.stats.breakdownsByPlayer, 0);
  assert.ok(events.some((e) => e.type === 'sfx' && e.id === 'panne'));
  assert.equal(game.enemies[0].bubble?.text ?? 'EN PANNE', 'EN PANNE');
  // Un automate en panne reste dans le décor, inoffensif.
  run(game, 120);
  assert.equal(game.enemies.length, 1);
});

test('gaz lacrymogène : étourdit aussi les automates et blesse le héros qui s’attarde', () => {
  const game = settle(play(flat({ legende: { s: enemy('statue') }, draw: (put, ground) => put(ground, 4, 's') })));
  const { hero } = game;
  run(game, 2, { right: true }); // réveille la statue
  game.clouds.push({ x: hero.x + hero.w / 2, y: hero.y + hero.h / 2, r: 40, t: 3 });
  run(game, 30);
  assert.equal(game.enemies[0].state, 'stunned');
  assert.equal(hero.hp, hero.def.pv, 'une bouffée ne blesse pas');
  run(game, 60);
  assert.equal(hero.hp, hero.def.pv - 1, 'une seconde dans le nuage, si');
  run(game, 200);
  assert.equal(game.clouds.length, 0, 'le nuage se dissipe');
});

test('les automates dorment tant que le héros est loin (distance fixe, pas l’écran)', () => {
  const game = settle(play(flat({ width: 80, legende: { f: enemy('fonceur') }, draw: (put, ground) => put(ground, 40, 'f') })));
  const far = game.enemies[0];
  const x0 = far.x;
  run(game, 120);
  assert.equal(far.state, 'sleep');
  assert.equal(far.x, x0);
  run(game, 200, { right: true });
  assert.notEqual(far.state, 'sleep', 'réveillé à l’approche du héros');
});

test('contact : deux points de vie ; après un coup, le héros est invulnérable et l’automate recule, sonné', () => {
  const game = settle(play(flat({ legende: { f: enemy('fonceur') }, draw: (put, ground) => put(ground, 8, 'f') })));
  const { hero } = game;
  let events = [];
  for (let i = 0; i < 200 && hero.hp === hero.def.pv; i++) events = events.concat(run(game, 1));
  assert.equal(hero.hp, 1, 'premier contact : un point de vie en moins');
  assert.ok(events.some((e) => e.type === 'sfx' && e.id === 'degat'));
  const foe = game.enemies[0];
  assert.equal(foe.state, 'stunned', 'l’automate qui a bousculé le héros reste sonné');
  run(game, 50);
  assert.equal(hero.hp, 1, 'invulnérable juste après le coup');
  events = [];
  for (let i = 0; i < 600 && !hero.dead; i++) events = events.concat(run(game, 1));
  assert.ok(hero.dead, 'second contact, plus tard : à terre');
  assert.equal(game.lives, 2);
  assert.ok(types(events).includes('death'));
});

// ---------------------------------------------------------------- panique et cortège

test('panique : premier tract, paliers, manchettes du niveau d’abord, renforts bornés, jamais de baisse', () => {
  const game = new Game(fixtureBundle(), 'plaine', { seed: 2 });
  const enemies = game.enemies.length;
  game.step({ fire: true });
  assert.equal(game.panic, 6, 'premier tract');
  assert.match(game.events.find((e) => e.type === 'headline').text, /^MANCHETTE COMMUNE/, 'le premier tract fait la une');
  game.step({ fire: true });
  run(game, 30, { fire: true });
  assert.equal(game.panic, 6, 'les tracts suivants n’ajoutent rien');
  game.events.length = 0;

  game.addPanic(40);
  let events = game.events.splice(0);
  assert.equal(game.panicLevel, 1);
  assert.deepEqual(events.filter((e) => e.type === 'panic'), [{ type: 'panic', level: 1 }]);
  assert.deepEqual(events.filter((e) => e.type === 'headline'), [{ type: 'headline', text: 'MANCHETTE DU NIVEAU UN' }]);
  assert.equal(game.enemies.length, enemies + 2, 'deux renforts');
  assert.ok(game.enemies.slice(-2).every((e) => e.def.reaction === 'cadre'), 'des drones de PANIQUE TV');

  game.addPanic(40);
  events = game.events.splice(0);
  assert.equal(game.panicLevel, 2);
  assert.equal(events.find((e) => e.type === 'headline').text, 'MANCHETTE DU NIVEAU DEUX');

  game.addPanic(500);
  assert.equal(game.panic, 100);
  assert.equal(game.panicLevel, 2);
  assert.equal(game.enemies.length, enemies + 4, 'jamais plus de quatre renforts');
  let lowest = game.panic;
  for (let i = 0; i < 200; i++) {
    game.step({});
    lowest = Math.min(lowest, game.panic);
  }
  assert.equal(lowest, 100, 'la panique ne redescend jamais');
});

test('cortège : trois manifestants au départ, deux de plus par sauvetage, un par piquet, gazés comptés une fois', () => {
  const game = settle(play(flat({
    cortege: true,
    draw: (put, ground) => {
      put(ground, 8, 'K');
      put(ground, 14, 'Q');
    },
  })));
  assert.equal(game.cortege.length, 3);
  assert.deepEqual(game.cortege.map((m) => m.kind), ['pancarte', 'drapeau', 'fanfare']);
  assert.ok(['', 'PANCARTE UN', 'PANCARTE DEUX'].includes(game.cortege[0].label), 'une pancarte arrivée dans la manif, ou les mains vides');
  assert.equal(game.cortege[1].label, 'rouge');
  const events = run(game, 140, { right: true });
  assert.equal(game.cortege.length, 6);
  assert.ok(types(events).includes('checkpoint'));
  assert.ok(game.cortege.every((m) => m.x < game.hero.x + game.hero.w), 'le cortège suit, derrière');

  const m = game.cortege[0];
  game.clouds.push({ x: m.x, y: m.y - 8, r: 20, t: 9 });
  run(game, 300);
  assert.equal(game.stats.gassed, game.cortege.filter((c) => c.counted).length);
  assert.ok(m.counted && game.stats.gassed >= 1, 'le manifestant gazé est compté');
  const counted = game.stats.gassed;
  game.clouds.push({ x: m.x, y: m.y - 8, r: 20, t: 9 });
  run(game, 300);
  assert.equal(game.stats.gassed, counted, 'jamais compté deux fois');

  assert.equal(play(flat()).cortege.length, 0, 'pas de cortège si le niveau n’en veut pas');
});

test('panneau : son texte est disponible quand le héros est devant', () => {
  const game = settle(play(flat({ panneaux: { 1: 'BIENVENUE AU CAMP' }, draw: (put, ground) => put(ground, 6, '1') })));
  assert.equal(game.sign, null);
  run(game, 28, { right: true });
  assert.equal(game.sign, 'BIENVENUE AU CAMP');
  run(game, 60, { right: true });
  assert.equal(game.sign, null);
});

// ---------------------------------------------------------------- vies et reprises

const pit = (extra = () => {}) => flat({
  draw: (put, ground) => {
    put(ground + 1, 10, '....');
    extra(put, ground);
  },
});

test('tomber sous la carte coûte une vie ; plus de vie = partie perdue', () => {
  const game = settle(play(pit()));
  const events = run(game, 2000, { right: true });
  assert.equal(game.status, 'lost');
  assert.equal(game.lives, 0);
  assert.equal(game.stats.deaths, 3);
  assert.equal(events.filter((e) => e.type === 'death').length, 3);
  assert.equal(events.filter((e) => e.type === 'respawn').length, 2);
  assert.equal(events.at(-1).type, 'lost');
  const frozen = game.time;
  game.step({ right: true });
  assert.equal(game.time, frozen, 'une partie finie n’avance plus');
});

test('reprise au dernier piquet de grève allumé, avec une courte invulnérabilité', () => {
  const game = settle(play(pit((put, ground) => put(ground, 7, 'Q'))));
  let respawned = null;
  for (let i = 0; i < 400 && !respawned; i++) {
    game.step({ right: true });
    if (game.events.splice(0).some((e) => e.type === 'respawn')) respawned = { x: game.hero.x, invuln: game.hero.invuln };
  }
  assert.ok(respawned, 'le héros est revenu');
  assert.ok(Math.abs(respawned.x + game.hero.w / 2 - 7.5 * TILE) < 1, `reprise au piquet (x=${respawned.x})`);
  assert.ok(respawned.invuln > 1);
  assert.equal(game.lives, 2);
});

test('mode invincible : aucun dégât, et la chute ramène au piquet sans coûter de vie', () => {
  const game = settle(play(pit((put, ground) => put(ground, 4, 'X')), { invincible: true }));
  run(game, 900, { right: true, fire: true });
  assert.equal(game.status, 'playing');
  assert.equal(game.lives, 3);
  assert.equal(game.hero.hp, game.hero.def.pv);
  assert.ok(game.stats.deaths >= 2, 'il est bien tombé plusieurs fois');
});

// ---------------------------------------------------------------- boss

test('boss : se réveille à l’approche, change de phase, s’éjecte, puis ouvre la sortie', () => {
  const game = new Game(fixtureBundle(), 'arene', { seed: 4, invincible: true });
  const { boss, hero } = game;
  const exit = game.props.find((p) => p.kind === 'sortie');
  assert.equal(boss.active, false);
  assert.equal(exit.on, false, 'sortie verrouillée');

  hero.x = exit.x + 8; // même posé sur la sortie, on ne sort pas tant que le boss est là
  hero.y = exit.y + exit.h - hero.h;
  let events = run(game, 30);
  assert.equal(game.status, 'playing');
  assert.equal(boss.active, true);
  assert.deepEqual(events.filter((e) => e.type === 'boss'), [{ type: 'boss', state: 'enter' }]);
  assert.equal(boss.bubble?.text, 'PREMIÈRE RÉPLIQUE');

  game.hurtBoss(boss.hpMax * 0.6);
  events = run(game, 2);
  assert.equal(boss.phase, 1);
  assert.ok(events.some((e) => e.type === 'boss' && e.state === 'phase'));

  events = run(game, 400);
  assert.ok(game.enemies.some((e) => e.summoned), 'la phase 2 appelle des renforts');
  assert.ok(game.enemies.filter((e) => e.summoned && e.state !== 'done').length <= 4);

  game.hurtBoss(999);
  assert.equal(boss.state, 'ejecting', 'la machine se disloque, la caricature s’éjecte');
  assert.equal(boss.hp, 0);
  assert.equal(exit.on, false, 'sortie encore verrouillée pendant l’éjection');
  events = run(game, 400);
  assert.ok(events.some((e) => e.type === 'boss' && e.state === 'defeated'));
  assert.equal(boss.state, 'gone');
  assert.equal(game.status, 'won', 'le héros, resté sur la sortie, gagne dès qu’elle s’ouvre');
  assert.ok(types(events).includes('won'));
});

// ---------------------------------------------------------------- pureté

test('déterminisme : même graine et mêmes actions donnent la même partie', () => {
  const digest = (seed) => {
    const game = new Game(fixtureBundle(), 'plaine', { seed, invincible: true });
    const memory = {};
    for (let i = 0; i < 500; i++) {
      game.step(botActions(game, memory));
      game.events.length = 0;
    }
    return JSON.stringify([
      game.hero.x, game.hero.y, game.hero.def.id, game.panic, game.stats, game.projectiles.length,
      game.enemies.map((e) => [e.x, e.y, e.state]), game.cortege.map((m) => [m.x, m.y, m.label]),
    ]);
  };
  assert.equal(digest(5), digest(5));
});

test('la simulation est pure : ni navigateur, ni horloge, ni Math.random', () => {
  for (const file of sources(join(SRC, 'sim'))) {
    const code = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '');
    for (const banned of ['Math.random', 'Date.now', 'new Date', 'document.', 'window.', 'performance.', 'setTimeout', 'localStorage']) {
      assert.ok(!code.includes(banned), `${file} utilise ${banned}`);
    }
  }
});
