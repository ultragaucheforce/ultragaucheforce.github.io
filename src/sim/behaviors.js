// Registre des comportements : tout ce qu'une fiche de contenu peut invoquer par son nom.
//
// Chaque comportement DÉCLARE ses réglages : `params` = { nom: [min, max, défaut] },
// `texts` = réglages en texte libre, `lists` = listes séparées par « | ».
// La validation du contenu lit ces déclarations : une fiche ne peut pas sortir des bornes.
//
// Ajouter une mécanique = ajouter une entrée ici (déclaration + fonction). Rien d'autre.

import { TILE } from './world.js';
import { hitsSolid, holds, overlap } from './physics.js';
import { spawnProjectile } from './projectile.js';

/** Largeur d'un mot dessiné, en pixels du monde : 3,3 par lettre, mesuré sur la police du jeu (voir render.js). */
export const WORD_CHAR = 3.3;
export const wordWidth = (word) => Math.ceil(word.length * WORD_CHAR);

/**
 * Armes principales (héros et ennemis).
 * `fire(game, tireur, réglages, camp, cible)` pour un tir ponctuel, ou
 * `update(game, tireur, réglages, dt, actif)` pour une arme continue (le jet du canon à eau).
 * `only: 'ennemi'` réserve une arme aux fiches d'ennemis.
 */
export const WEAPONS = {
  tir: {
    doc: 'Lance un ou plusieurs projectiles devant soi.',
    params: {
      cadence: [0.2, 20, 5], // tirs par seconde
      vitesse: [30, 420, 240], // pixels par seconde
      gravite: [0, 900, 0], // 0 = tout droit ; plus = en cloche
      elan: [0, 400, 0], // impulsion vers le haut au départ (tir en cloche)
      dispersion: [0, 80, 0], // écart vertical aléatoire, pixels par seconde
      nombre: [1, 8, 1], // projectiles par tir
      portee: [16, 640, 220], // pixels parcourus avant de disparaître
      degats: [0, 10, 1], // dégâts aux adversaires
      terrain: [0, 10, 1], // dégâts aux tuiles touchées
      rebonds: [0, 5, 0],
      explosion: [0, 64, 0], // rayon de l'explosion à l'impact, pixels
      perce: [0, 1, 0], // 1 = traverse les adversaires
      blindage: [0, 1, 0], // 1 = passe à travers les boucliers
      fratricide: [0, 1, 0], // 1 = touche aussi son propre camp
      gaz: [0, 6, 0], // secondes de nuage laissé à l'impact
      taille: [2, 24, 4], // côté de la boîte de collision, pixels
      recul: [0, 200, 0], // pousse le tireur en arrière
      vise: [0, 1, 0], // 1 = tiré vers le héros plutôt qu'à l'horizontale (ennemis seulement)
      visee: [0, 2, 0], // ennemis seulement : secondes de préavis avant le tir (visée, ou bouche qui s'ouvre) : le joueur voit venir le coup
      touche: [0, 20, 0], // ennemis seulement : manifestants touchés (ils quittent la manif) quand le tir atteint le cortège
    },
    texts: ['image', 'son'], // image = nom d'une section de sprite ; son = identifiant de bruitage
    lists: ['mots'], // si présent : le projectile est un mot écrit, tiré au hasard
    fire(game, shooter, w, team, target = null) {
      const dir = shooter.facing;
      const y = shooter.y + shooter.h * 0.35 - w.taille / 2;
      // Tir visé : vers le point donné, sinon vers le héros au moment du tir.
      let ux = dir;
      let uy = 0;
      const upright = team === 'luttes' && shooter.aim ? shooter.aim : 0; // le héros vise en haut (-1) ou en bas (1)
      if (upright) {
        ux = 0;
        uy = upright;
      } else if (w.vise > 0 && team === 'ordre') {
        const aim = target ?? { x: game.hero.x + game.hero.w / 2, y: game.hero.y + game.hero.h / 2 };
        const ox = shooter.x + shooter.w / 2;
        const oy = y + w.taille / 2;
        const reach = Math.hypot(aim.x - ox, aim.y - oy) || 1;
        ux = (aim.x - ox) / reach;
        uy = (aim.y - oy) / reach;
      }
      for (let i = 0; i < w.nombre; i++) {
        const word = w.mots?.length ? game.rng.pick(w.mots) : null;
        if (word) game.discover('mot', word); // un mot crié, par eux ou par nous, vient d'une vraie citation
        // À la verticale, le projectile ne dépasse pas de son tireur : il passe par un puits d'une tuile,
        // même collé à une paroi.
        // Un mot d'en face ne blesse que par sa tête (`taille`, les premières lettres) ; le reste du mot suit, dessiné
        // derrière elle, et se laisse abattre (voir projectile.js). Un mot du héros touche sur toute sa longueur.
        const foeWord = word && team === 'ordre';
        // `along` : la longueur de la boîte dans le sens du tir ; vers le haut, la même que devant soi.
        const along = word && !foeWord ? Math.max(w.taille, word.length * 5) : w.taille;
        const width = upright ? Math.min(w.taille, shooter.w) : along;
        const thick = Math.min(w.taille, shooter.h); // l'épaisseur d'un tir vertical, sans plus
        const left = shooter.x + shooter.w / 2 - width / 2;
        // Vers le haut, la boîte tient dans l'air libre au-dessus du crâne : sous un plafond proche, elle se raccourcit
        // (jamais sous son épaisseur) et touche ce qui est entre la tête et le plafond, jamais à travers.
        // Il garde un pas de marge (6 px, voir updateProjectiles) : son premier pas le laisse dans l'air libre, il touche.
        let free = 0;
        while (upright < 0 && free < along + 6 && !hitsSolid(game.world, left, shooter.y - free - 1, width, 1)) free++;
        const room = Math.max(0, free - 6);
        const height = upright < 0 ? Math.max(thick, Math.min(along, room)) : upright ? thick : w.taille;
        // Plusieurs projectiles : éventail régulier ; un seul : petit écart au hasard.
        const spread = w.nombre > 1 ? (i / (w.nombre - 1) - 0.5) * 2 * w.dispersion : game.rng.range(-w.dispersion, w.dispersion);
        // À la verticale : le projectile part du crâne ou des pieds, bien dans l'axe, sans élan de cloche.
        // Vers le haut, il naît juste au-dessus du crâne, comme devant soi il naît juste devant le corps (sous un plafond
        // trop proche, il naît sur le crâne, comme avant).
        // Il file tout droit jusqu'à sa portée, même si l'arme tire en cloche : sinon il retombe aussitôt.
        // Au premier rebond, il retrouve sa gravité (`fall`) et retombe, au lieu de rebondir du plafond au sol.
        const from = upright
          ? { x: left, y: upright > 0 ? shooter.y + shooter.h - height : shooter.y - Math.min(height, room) }
          : { x: ux >= 0 ? shooter.x + shooter.w : shooter.x - width, y };
        const proj = spawnProjectile(game, {
          ...from, w: width, h: height,
          vx: ux * w.vitesse + (upright ? spread : 0), vy: uy * w.vitesse + (upright ? 0 : spread - w.elan), team, word, def: shooter.def, image: w.image || 'projectile',
          gravity: upright < 0 ? 0 : w.gravite, fall: upright < 0 ? w.gravite : 0, upright, range: w.portee, damage: w.degats, terrain: w.terrain, bounces: w.rebonds,
          explosion: w.explosion, pierce: w.perce > 0, armor: w.blindage > 0, friendly: w.fratricide > 0,
          gas: w.gaz, owner: shooter, touche: team === 'ordre' ? w.touche : 0,
          text: foeWord ? wordWidth(word) : 0,
        });
        // Un mot qui naît sur le héros (collé à la bouche) le traverse sans le blesser : il ne démarre jamais sur lui.
        if (foeWord && overlap(proj, game.hero)) proj.spare = true;
      }
      if (!upright) shooter.vx -= dir * w.recul;
      game.sfx(w.son || 'tir', shooter.x);
    },
  },
  jet: {
    doc: 'Canon à eau : un jet continu qui repousse le héros et le cortège, sans blesser.',
    only: 'ennemi',
    params: {
      duree: [0.3, 6, 1.5], // secondes de jet
      pause: [0.5, 10, 3], // secondes entre deux jets
      portee: [32, 320, 140], // longueur du jet, pixels (il s'arrête au premier mur, ou sur une ligne qui tient)
      poussee: [20, 600, 220], // vitesse de recul imposée, pixels par seconde
    },
    texts: ['son'],
    update(game, shooter, w, dt, active) {
      const state = (shooter.jetState ??= { on: false, t: w.pause / 2 });
      shooter.jet = null;
      if (!active) {
        state.on = false;
        state.t = Math.min(state.t, w.pause / 2);
        return;
      }
      state.t -= dt;
      if (state.t <= 0) {
        state.on = !state.on;
        state.t = state.on ? w.duree : w.pause;
        if (state.on) game.sfx(w.son || 'jet', shooter.x);
      }
      if (!state.on) return;

      const { world, hero } = game;
      const dir = shooter.facing;
      const x = dir > 0 ? shooter.x + shooter.w : shooter.x;
      const y = shooter.y + shooter.h * 0.35;
      // Le jet s'arrête au premier mur, ou sur une ligne qui tient, comme un tir.
      const lines = game.lines.filter((l) => l !== shooter && holds(l) && y >= l.y && y <= l.y + l.h);
      const stops = (px) => world.solid(Math.floor(px / TILE), Math.floor(y / TILE)) || lines.some((l) => px >= l.x && px <= l.x + l.w);
      let length = 0;
      while (length < w.portee && !stops(x + dir * (length + 4))) length += 4;
      shooter.jet = { x, y, length, dir };
      const x0 = dir > 0 ? x : x - length;
      const soaked = (cx, top, bottom) => cx >= x0 && cx <= x0 + length && top <= y + 6 && bottom >= y - 6;
      const shove = dir * w.poussee * dt;
      if (!hero.dead && soaked(hero.x + hero.w / 2, hero.y, hero.y + hero.h) && !hitsSolid(world, hero.x + shove, hero.y, hero.w, hero.h)) {
        hero.x += shove;
      }
      for (const m of game.cortege) {
        if (!soaked(m.x, m.y - 16, m.y)) continue;
        m.pushed = 0.3; // le cortège recule lui aussi (voir updateCortege)
        m.shove = dir * w.poussee;
      }
    },
  },
};

/** Attaques spéciales des héros (charges limitées). `use(game, héros, réglages)` → vrai si la charge est consommée. */
export const SPECIALS = {
  onde: {
    doc: 'Onde circulaire qui repousse, étourdit et fissure le décor.',
    params: { rayon: [16, 160, 72], degats: [0, 10, 2], terrain: [0, 10, 2], recul: [0, 400, 220], etourdit: [0, 6, 2] },
    texts: ['son'],
    use(game, hero, s) {
      game.explode(hero.x + hero.w / 2, hero.y + hero.h / 2, s.rayon, {
        team: 'luttes', damage: s.degats, terrain: s.terrain, push: s.recul, stun: s.etourdit, quiet: true,
      });
      return true;
    },
  },
  sol: {
    doc: 'Onde qui court le long du sol, des deux côtés.',
    params: { vitesse: [60, 420, 240], portee: [32, 480, 220], degats: [0, 10, 3], terrain: [0, 10, 3] },
    texts: ['son'],
    use(game, hero, s) {
      for (const dir of [-1, 1]) {
        spawnProjectile(game, {
          x: hero.x + hero.w / 2 - 5 + dir * 4, y: hero.y + hero.h - 8, w: 10, h: 8, vx: dir * s.vitesse,
          def: hero.def, image: 'onde', gravity: 700, range: s.portee, damage: s.degats, terrain: s.terrain,
          pierce: true, armor: true, hug: true, owner: hero,
        });
      }
      game.emit('shake', { force: 5 });
      return true;
    },
  },
  clones: {
    doc: 'Des doubles apparaissent et tirent en même temps que le héros.',
    params: { nombre: [1, 4, 2], duree: [1, 12, 6] },
    texts: ['son'],
    use(game, hero, s) {
      hero.clones = Array.from({ length: s.nombre }, (_, i) => ({
        x: hero.x, y: hero.y, w: hero.w, h: hero.h, vx: 0, facing: hero.facing, def: hero.def, t: s.duree, lag: (i + 1) * 7,
      }));
      return true;
    },
  },
  billes: {
    doc: 'Des billes roulent devant soi et restent au sol : qui marche dessus glisse, sonné, et file sur sa lancée.',
    params: {
      nombre: [1, 8, 5], // billes répandues
      vitesse: [20, 240, 120], // élan de la plus rapide, pixels par seconde ; les autres partent moins vite
      duree: [1, 12, 5], // secondes où elles restent au sol
      glisse: [0.5, 6, 2], // secondes où l'adversaire qui glisse reste sonné
      recul: [0, 400, 160], // vitesse de sa glissade, pixels par seconde
      degats: [0, 10, 0],
    },
    texts: ['son'],
    use(game, hero, s) {
      for (let i = 0; i < s.nombre; i++) {
        // Un éventail au sol : de la plus lente, aux pieds du héros, à la plus rapide, qui roule le plus loin.
        const speed = s.vitesse * (0.25 + (0.75 * (i + 1)) / s.nombre);
        spawnProjectile(game, {
          x: hero.x + hero.w / 2 - 2 + hero.facing * 4, y: hero.y + hero.h - 4, w: 4, h: 4, vx: hero.facing * speed,
          def: hero.def, image: 'bille', gravity: 700, range: 9999, damage: s.degats, terrain: 0, bounces: 3,
          pierce: true, armor: true, hug: true, owner: hero, drag: 1.6, life: s.duree, slip: s.glisse, slide: s.recul,
        });
      }
      return true;
    },
  },
  mur: {
    doc: 'Fait pousser une colonne de tuiles devant soi.',
    params: { hauteur: [1, 5, 3], distance: [1, 3, 1] },
    texts: ['tuile', 'son'],
    use(game, hero, s) {
      const { world } = game;
      const index = world.indexOf(s.tuile);
      if (index < 1) return false;
      const tx = Math.floor((hero.x + hero.w / 2) / TILE) + hero.facing * s.distance;
      let ty = Math.floor((hero.y + hero.h - 1) / TILE);
      for (let k = 0; k < 4 && ty + 1 < world.h && !world.solid(tx, ty + 1); k++) ty++; // descend jusqu'au sol
      let grown = 0;
      for (let k = 0; k < s.hauteur; k++) {
        const cell = { x: tx * TILE, y: (ty - k) * TILE, w: TILE, h: TILE };
        // Jamais dans une case occupée : ni tuile, ni personnage.
        if (!world.inside(tx, ty - k) || world.at(tx, ty - k) || game.actorsIn(cell)) break;
        world.set(tx, ty - k, index);
        game.emit('debris', { x: cell.x + TILE / 2, y: cell.y + TILE / 2, color: 'v', n: 4 });
        grown++;
      }
      return grown > 0;
    },
  },
};

/**
 * Déplacements et réactions des ennemis (mis en œuvre dans enemy.js).
 * moto = passages rapides, aller et retour ; vehicule = lourd, ni recul ni étourdissement, pousse le héros.
 * charge = sommations puis ruée ; projecteur = (volant) balaie le sol d'un faisceau et dépose des renforts.
 */
export const MOVES = ['marche', 'vol', 'fixe', 'moto', 'vehicule'];
export const REACTIONS = ['tire', 'fonce', 'cadre', 'rien', 'charge', 'projecteur'];
export const ENDINGS = ['greve', 'panne'];

/** Réglages complémentaires d'une fiche d'ennemi, écrits « groupe.réglage: valeur ». */
export const ENEMY_GROUPS = {
  charge: {
    doc: 'Réaction « charge » : après les sommations, une ruée en ligne droite, puis une pause.',
    params: {
      distance: [32, 480, 160], // longueur de la ruée, pixels
      vitesse: [60, 400, 220], // pixels par seconde
      pause: [0.5, 8, 2.5], // secondes avant la charge suivante
      disperse: [0, 30, 5], // pour cent du cortège dispersé quand la charge le traverse
    },
  },
  ligne: {
    doc: 'Une ligne (barrage, grille, blindé) : infranchissable tant qu’elle a de la vie. Les coups de la manif l’entament,'
      + ' et la manif la pousse quand le héros arrive dessus : d’autant plus fort qu’elle est nombreuse.',
    params: {
      vie: [0, 5000, 0], // points de vie de la ligne ; 0 : l'unité n'est pas une ligne
      poussee: [0, 50, 10], // points de vie retirés par seconde, pour cent manifestants, quand la manif pousse
    },
  },
  faisceau: {
    doc: 'Réaction « projecteur » : le cône de lumière.',
    params: {
      largeur: [24, 200, 64], // largeur éclairée au sol, pixels
      balayage: [0, 200, 90], // amplitude du va-et-vient, pixels
    },
  },
  renfort: {
    doc: 'Réaction « projecteur » : renforts déposés à la corde près du héros resté dans le faisceau.',
    params: {
      nombre: [1, 4, 2], // unités déposées à chaque fois
      max: [0, 6, 2], // nombre de déposes au plus
    },
    texts: ['ennemi'],
  },
};

/** Attaques de boss, enchaînées par phases. `run(game, boss, réglages)`. */
export const BOSS_ATTACKS = {
  salve: {
    doc: 'Rafale de projectiles visant le héros.',
    distance: true, // attaque à distance : un boss « assis » peut s'en servir
    params: { nombre: [1, 12, 3], vitesse: [40, 300, 140], degats: [0, 3, 1], ecart: [0, 1, 0.25] },
    run(game, boss, a) {
      const { hero } = game;
      const ox = boss.x + boss.w / 2;
      const oy = boss.y + boss.h * 0.4;
      const aim = Math.atan2(hero.y + hero.h / 2 - oy, hero.x + hero.w / 2 - ox);
      for (let i = 0; i < a.nombre; i++) {
        const angle = aim + (i - (a.nombre - 1) / 2) * a.ecart;
        spawnProjectile(game, {
          x: ox - 3, y: oy - 3, w: 6, h: 6, vx: Math.cos(angle) * a.vitesse, vy: Math.sin(angle) * a.vitesse,
          team: 'ordre', def: boss.def, damage: a.degats, terrain: 1, range: 420, owner: boss,
        });
      }
      game.sfx('tir', ox);
    },
  },
  charge: {
    doc: 'Fonce à travers l’arène.',
    params: { vitesse: [60, 400, 200], degats: [0, 3, 1] },
    run(game, boss, a) {
      boss.state = 'charge';
      boss.charge = { dir: boss.facing, speed: a.vitesse, damage: a.degats, t: 1.4 };
      game.sfx('boss', boss.x);
    },
  },
  invocation: {
    doc: 'Appelle des renforts.',
    distance: true,
    params: { nombre: [1, 4, 2] },
    texts: ['ennemi'],
    run(game, boss, a) {
      const alive = game.enemies.filter((e) => e.summoned && e.state !== 'done').length;
      for (let i = 0; i < a.nombre && alive + i < 4; i++) {
        const cx = boss.x + boss.w / 2 + boss.facing * (boss.w / 2 + 14 + i * 18);
        game.spawnEnemy(a.ennemi, cx, boss.y + boss.h, { state: 'alert', summoned: true });
      }
      game.sfx('palier', boss.x);
    },
  },
  pluie: {
    doc: 'Fait tomber des projectiles du ciel.',
    distance: true,
    params: { nombre: [1, 12, 5], vitesse: [40, 300, 120], degats: [0, 3, 1] },
    run(game, boss, a) {
      const { hero } = game;
      for (let i = 0; i < a.nombre; i++) {
        spawnProjectile(game, {
          x: hero.x + hero.w / 2 + game.rng.range(-90, 90), y: hero.y - 150 - i * 10, w: 6, h: 6, vy: a.vitesse,
          team: 'ordre', def: boss.def, damage: a.degats, terrain: 1, range: 320, owner: boss,
        });
      }
      game.sfx('tir', boss.x);
    },
  },
};
