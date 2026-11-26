// Projectiles : tracts, tampons, graines, grenades, mots d'éditorialistes…
// Un seul modèle, entièrement réglé par les fiches (voir WEAPONS dans behaviors.js).

import { TILE } from './world.js';
import { hitsSolid, overlap, holds } from './physics.js';
import { joinRecruit } from './manif.js';
import { sturdy } from './enemy.js';

const DEFAULTS = {
  vx: 0, vy: 0, team: 'luttes', word: null, def: null, image: 'projectile',
  gravity: 0, range: 240, damage: 1, terrain: 1, bounces: 0, explosion: 0,
  pierce: false, armor: false, friendly: false, gas: 0, hug: false, owner: null, age: 0, dead: false,
  touche: 0, // camp des automates (`team: 'ordre'`) : manifestants touchés si le projectile atteint le cortège
  drag: 0, // freinage par seconde : une bille roule, ralentit, s'arrête
  life: 0, // secondes avant de disparaître ; 0 : seule la portée compte
  slip: 0, // secondes où l'adversaire qui marche dessus glisse, sonné (les billes)
  slide: 0, // vitesse de sa glissade, pixels par seconde
  text: 0, // un mot d'en face : la longueur du mot dessiné derrière sa tête, pixels ; 0 sinon
  spare: false, // un mot né sur le héros : il le traverse sans le blesser
  fall: 0, // tiré vers le haut sans gravité : la gravité de l'arme, qu'il retrouve à son premier rebond
  upright: 0, // tiré à la verticale : -1 vers le haut, 1 vers le bas ; 0 devant soi (le dessin s'oriente)
};
const MAX_PROJECTILES = 240;

export function spawnProjectile(game, p) {
  const proj = { ...DEFAULTS, ...p, hits: new Set() };
  game.projectiles.push(proj);
  if (game.projectiles.length > MAX_PROJECTILES) game.projectiles.shift();
  return proj;
}

export function updateProjectiles(game, dt) {
  const { world } = game;
  for (const p of game.projectiles) {
    // Sous-pas : jamais plus de 6 pixels d'un coup, donc jamais à travers une tuile.
    const n = Math.max(1, Math.ceil((Math.max(Math.abs(p.vx), Math.abs(p.vy)) * dt) / 6));
    const h = dt / n;
    for (let i = 0; i < n && !p.dead; i++) {
      p.vy += p.gravity * h;
      const beforeX = p.x;
      p.x += p.vx * h;
      if (hitsSolid(world, p.x, p.y, p.w, p.h)) strike(game, p, 'x', beforeX);
      if (p.dead) break;
      const beforeY = p.y;
      p.y += p.vy * h;
      if (hitsSolid(world, p.x, p.y, p.w, p.h)) strike(game, p, 'y', beforeY);
      if (p.dead) break;
      p.range -= Math.hypot(p.vx, p.vy) * h;
      touchActors(game, p);
      if (!p.dead && p.range <= 0) {
        if (p.explosion > 0 || p.gas > 0) burst(game, p);
        else p.dead = true;
      }
    }
    p.age += dt;
    if (p.drag > 0) p.vx *= Math.max(0, 1 - p.drag * dt);
    if (p.life > 0 && p.age >= p.life) p.dead = true;
    if (p.y > world.h * TILE + 64 || p.y < -480 || p.x < -64 || p.x > world.w * TILE + 64) p.dead = true;
  }
  game.projectiles = game.projectiles.filter((p) => !p.dead);
}

/** Le projectile vient de toucher le décor sur l'axe donné. */
function strike(game, p, axis, before) {
  const rests = p.hug && axis === 'y'; // une onde au sol glisse sur le plancher sans l'abîmer
  if (!rests) {
    const x1 = Math.floor((p.x + p.w - 0.001) / TILE);
    const y1 = Math.floor((p.y + p.h - 0.001) / TILE);
    for (let ty = Math.floor(p.y / TILE); ty <= y1; ty++) {
      for (let tx = Math.floor(p.x / TILE); tx <= x1; tx++) {
        if (game.world.solid(tx, ty)) game.world.damage(tx, ty, p.terrain, p.team);
      }
    }
  }
  if (axis === 'x') p.x = before;
  else p.y = before;
  if (rests) {
    p.vy = 0;
  } else if (p.bounces > 0) {
    p.bounces--;
    if (p.fall) { // tiré vers le haut, il retombe après son premier rebond
      p.gravity = p.fall;
      p.fall = 0;
    }
    if (axis === 'x') p.vx = -p.vx;
    else p.vy = -p.vy * 0.7;
    game.sfx('impact', p.x);
  } else {
    burst(game, p);
  }
}

/** Fin du projectile : explosion et nuage éventuels. `quiet` : le coup a déjà son bruit (touché, paré). */
function burst(game, p, quiet = false) {
  p.dead = true;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  if (p.explosion > 0) {
    game.explode(cx, cy, p.explosion, {
      team: p.team, friendly: p.friendly, terrain: Math.max(1, p.terrain),
      damage: Math.max(1, p.damage) * (p.team === 'luttes' ? game.power() : 1),
    });
  } else if (!quiet) {
    game.sfx('impact', cx);
  }
  if (p.gas > 0) {
    game.clouds.push({ x: cx, y: cy, r: 26, t: p.gas, team: p.team });
    game.sfx('gaz', cx);
  }
}

/** L'adversaire glisse sur une bille : sonné, il file sur sa lancée (sinon dans le sens de la bille). */
function slipOn(game, e, p) {
  const dir = Math.sign(e.vx) || Math.sign(p.vx) || e.facing;
  e.state = 'stunned';
  e.stun = Math.max(e.stun, p.slip);
  e.daze = 'glisse';
  e.kick = dir * p.slide;
  e.aim = null;
  e.rush = null;
  game.sfx('impact', e.x);
}

/** Le mot entier, tête comprise : la tête file devant, les lettres suivent derrière elle. */
export function wordBox(p) {
  const w = Math.max(p.w, p.text);
  return { x: p.vx < 0 ? p.x : p.x + p.w - w, y: p.y, w, h: p.h };
}

function touchActors(game, p) {
  if (p.team === 'luttes') {
    const damage = p.damage * game.power(); // le nombre fait la force
    // Un tract qui atteint un mot d'en face l'abat : n'importe quelle lettre suffit.
    if (p.slip <= 0) {
      for (const q of game.projectiles) {
        if (q.dead || q.team !== 'ordre' || !q.text || !overlap(p, wordBox(q))) continue;
        q.dead = true;
        const box = wordBox(q);
        game.emit('debris', { x: box.x + box.w / 2, y: box.y + box.h / 2, color: 'R', n: 10 }); // le mot vole en éclats
        game.emit('wordDown', { x: box.x + box.w / 2, y: box.y, word: q.word });
        game.sfx('touche', box.x);
        if (!p.pierce) return burst(game, p, true);
      }
    }
    for (const e of game.enemies) {
      if (e.state === 'done' || p.hits.has(e) || !overlap(p, e)) continue;
      p.hits.add(e);
      // Une bille au sol : qui marche dessus glisse, bouclier ou pas. Ni ce qui vole, ni une ligne, ni un véhicule.
      if (p.slip > 0) {
        if (e.state !== 'sleep' && e.def.deplacement !== 'vol' && !sturdy(e)) slipOn(game, e, p);
        if (p.damage > 0) game.hurtEnemy(e, damage, 'luttes', Math.sign(p.vx));
        continue;
      }
      // Le bouclier pare ce qui arrive de face, sauf projectile « blindage ».
      // Un projectile perçant (« perce ») n'abîme pas l'automate protégé, mais continue sa route.
      // Un tract qui explose ici n'est pas « paré » : le bouclier arrête le tract, pas le souffle, qui l'atteint (voir burst).
      // Un tir qui monte d'en dessous (`upright` < 0) passe sous le bouclier : sa dispersion ne le fait pas parer au hasard.
      const blocked = e.def.bouclier && Math.sign(p.vx) === -e.facing && !p.armor && p.upright >= 0;
      const blast = p.explosion > 0 && !p.pierce;
      if (!blocked) game.hurtEnemy(e, damage, 'luttes', Math.sign(p.vx));
      else if (!blast) game.parry(e, e.facing > 0 ? e.x + e.w : e.x); // l'étincelle jaillit sur le bouclier, côté tireur
      if (!p.pierce) return burst(game, p, true);
    }
    if (p.slip > 0) return; // les billes n'agissent que sur les ennemis : ni boss, ni cage, ni recrue
    const boss = game.boss;
    if (boss && boss.state !== 'ejecting' && boss.state !== 'gone' && !p.hits.has(boss) && overlap(p, boss)) {
      p.hits.add(boss);
      game.hurtBoss(damage);
      if (!p.pierce) return burst(game, p, true);
    }
    for (const cage of game.props) {
      if (cage.kind !== 'cage' || cage.on || p.hits.has(cage) || !overlap(p, cage)) continue;
      p.hits.add(cage);
      cage.hp -= Math.max(1, p.damage);
      if (cage.hp <= 0) game.rescue(cage);
      if (!p.pierce) return burst(game, p);
    }
    // Un décor qui se casse (`pv`) : la régie de la chaîne.
    for (const d of game.decors) {
      if (!(d.hp > 0) || p.hits.has(d) || !overlap(p, game.decorBox(d))) continue;
      p.hits.add(d);
      game.hitDecor(d, p.damage);
      if (!p.pierce) return burst(game, p);
    }
    // Un tract tendu à une recrue : elle rejoint la manif.
    for (const r of game.recruits) {
      if (r.joined || !overlap(p, r)) continue;
      joinRecruit(game, r);
      if (!p.pierce) return burst(game, p);
    }
    return;
  }
  // Camp des automates : un tir qui touche une ligne qui tient s'y écrase, comme nos tracts (sauf « perce ») ; une grenade
  // en cloche passe au-dessus. Une grenade « fratricide » qui la touche y éclate, plus bas, comme sur un collègue.
  if (!p.friendly) {
    for (const l of game.lines) {
      if (l === p.owner || !holds(l) || p.hits.has(l) || !overlap(p, l)) continue;
      p.hits.add(l);
      game.parry(l, l.x + l.w / 2, true);
      if (!p.pierce) return burst(game, p, true);
    }
  }
  // Le boss vaincu, ce qui vole encore ne blesse plus ni le héros ni le cortège : il file jusqu'au décor.
  if (game.truce) return;
  // Puis il vise le héros… et, pour les grenades « fratricides », touche aussi les collègues.
  if (!game.hero.dead && !p.spare && overlap(p, game.hero)) {
    game.hurtHero(p.damage, { dir: Math.sign(p.vx), x: p.x + p.w / 2, kind: p.explosion > 0 ? 'explosion' : 'tir' });
    return burst(game, p);
  }
  // Un tir qui file dans le cortège (`arme.touche`) : quelques manifestants touchés quittent la manif.
  if (p.touche > 0) {
    const cx = p.x + p.w / 2;
    const m = game.cortege.find((c) => Math.abs(c.x - cx) < 4 + p.w / 2 && p.y + p.h > c.y - 16 && p.y < c.y);
    if (m) {
      game.loseCrowd(p.touche, 'touche', { x: m.x, y: m.y - 16 });
      return burst(game, p);
    }
  }
  if (!p.friendly) return;
  for (const e of game.enemies) {
    if (e.state === 'done' || (e === p.owner && p.age < 0.4) || !overlap(p, e)) continue;
    game.hurtEnemy(e, p.damage, 'ordre', Math.sign(p.vx));
    return burst(game, p);
  }
}
