# UltraGauche Force

> **Taxez les riches. Abattez la Citadelle.**

**[Jouer en ligne](https://ultragaucheforce.github.io/)**, dans le navigateur, sans rien installer.

Un jeu de plateforme en pixel art où vous incarnez l'ultragauche telle que les plateaux télé la racontent : surarmée de tracts et de tomates. Le but : faire la plus grosse manif pacifiste pour aller taxer le boss final. On part sur le plateau de Millevaches ; d'étape en étape, la manif grossit, et au bout de chacune on taxe la fortune qui s'y est assise. Ça se joue dans le navigateur, au clavier ou au pouce.

| | |
|---|---|
| ![La nasse se referme ; dessous, le métro](docs/captures/nasse.jpg) | ![On creuse : une paysanne attend sous le panneau](docs/captures/millevaches-creuser.jpg) |
| ![Le métro, sous le boulevard](docs/captures/metro.jpg) | ![Un immeuble, étage par étage](docs/captures/immeuble.jpg) |
| ![Le barrage, sa vie en haut de l'écran](docs/captures/barrage.jpg) | ![Le boss, assis sur sa fortune](docs/captures/boss-assis.jpg) |

- **Faire la plus grosse manif.** Une soignante, un cheminot, une intersyndicale : chaque recrue compte, une assemblée générale double tout.
- **Pousser.** Un barrage a une vie : les tracts l'entament, la manif le pousse, d'autant plus fort qu'elle est nombreuse.
- **Un tuto pour commencer.** « Get ready with me : rejoindre la manif » se lance au premier « Jouer », même avec une sauvegarde qui a déjà progressé, se passe d'un bouton et se rejoue depuis le menu : chaque panneau attend le geste qu'il montre.
- **Six étapes.** Le camp d'entraînement de Millevaches, le rond-point, la raffinerie bloquée, le soir du 49.3 devant l'Assemblée, le siège de la chaîne d'info, puis « Bismillah, c'est les ténèbres », du lycée bloqué à la plus grande manif.
- **Creuser, grimper.** Tout le décor se détruit. Sous la rue, le métro ; au-dessus, les étages et les toits.
- **Libérer.** On part avec un seul personnage, tiré au hasard la première fois. Chaque camarade sorti de garde à vue rejoint l'équipe et se joue tout de suite ; quand il tombe, on repart avec le précédent.
- **Débloquer.** Les gens qui rejoignent la manif portent parfois une pancarte : commune, rare, épique ou légendaire. Il y en a 389, toutes relevées en manif.
- **Taxer.** Au bout de chaque niveau, un ultra-riche est assis sur sa fortune : lequel, le hasard le dit, sauf à la chaîne d'info (Bolloré) et à Bismillah (Arnault). On en prend 2 % : de quoi payer, par exemple, 64 000 enseignants. Les comparaisons et les faits changent à chaque partie.
- **PANIQUE TV.** Un bandeau de chaîne d'info fait défiler de vraies déclarations. Quand la panique monte, une équipe télé vient filmer la poubelle qui brûle, pas la manif.
- **Partager.** En fin de niveau, une image à envoyer : la manif, ce que 2 % paieraient, une pancarte.

<details>
<summary>Plus de captures</summary>

| | |
|---|---|
| ![Le lycée bloqué](docs/captures/lycee-bloque.jpg) | ![Les toits](docs/captures/toits.jpg) |
| ![L'Arroseur](docs/captures/arroseur.jpg) | ![Millevaches : la base sous le rond-point](docs/captures/millevaches-base.jpg) |
| ![Millevaches : la grange et sa cave](docs/captures/millevaches-grange.jpg) | ![Millevaches : la mine](docs/captures/millevaches-mine.jpg) |
| ![Millevaches : le château d'eau](docs/captures/millevaches-chateau-d-eau.jpg) | ![Millevaches : la méga-bassine](docs/captures/millevaches-bassine.jpg) |
| ![Millevaches : le Bourdon](docs/captures/millevaches-bourdon.jpg) | ![Le rond-point : le péage levé](docs/captures/rond-point-peage.jpg) |
| ![La raffinerie bloquée : la cuve du dépôt de carburant](docs/captures/raffinerie-cuves.jpg) | ![Le siège de la chaîne d'info : la régie](docs/captures/chaine-info-regie.jpg) |
| ![Le soir du 49.3 : devant l'Assemblée](docs/captures/soir-du-49-3-assemblee.jpg) | ![Une équipe télé filme la poubelle qui brûle](docs/captures/feu-de-poubelle.jpg) |
| ![PANIQUE TV en pleine hystérie](docs/captures/panique-bandeau.jpg) | ![Le duplex de PANIQUE TV](docs/captures/duplex-panique-tv.jpg) |
| ![La fortune, à l'échelle](docs/captures/taxe-fortune.jpg) | ![Le menu](docs/captures/menu.jpg) |
| ![L'ouverture d'un niveau](docs/captures/ouverture.jpg) | ![Un camarade libéré](docs/captures/carton-heros.jpg) |
| ![Fin de niveau](docs/captures/fin-de-niveau.jpg) | ![Taxée à 2 % : ce que ça paierait, et ce que chacun paie déjà](docs/captures/taxe-ce-que-ca-paie.jpg) |
| ![Le plan de campagne](docs/captures/plan-de-campagne.jpg) | ![La Collection : les pancartes débloquées et leur rareté](docs/captures/collection-grille.jpg) |
| ![L'image à partager en fin de niveau](docs/captures/partage.jpg) | ![Une pancarte débloquée](docs/captures/collection-carte.jpg) |
| ![L'appel au vote](docs/captures/appel-au-vote.jpg) | ![L'Atelier : on dessine son niveau](docs/captures/atelier.jpg) |
| ![Sur téléphone](docs/captures/mobile-paysage.jpg) | ![Fin de niveau sur téléphone](docs/captures/mobile-fin-de-niveau.jpg) |

![Téléphone tenu debout : le jeu pivote](docs/captures/mobile-tenu-debout.jpg)

</details>

## Jouer

Le jeu est en ligne sur https://ultragaucheforce.github.io/.

En local, il faut [Node.js](https://nodejs.org/fr) 22 et rien d'autre :

```bash
git clone https://github.com/ultragaucheforce/ultragaucheforce.github.io.git
cd ultragaucheforce.github.io
npm start
```

Le jeu est sur http://localhost:8080.

| | Clavier | Manette | Tactile |
|---|---|---|---|
| Avancer | ← → ou Q D | croix ou stick | moitié gauche : glisser le pouce |
| Sauter, grimper | ESPACE ou Z | A | SAUT, ou pouce gauche vers le haut ; penché vers un mur, tenu, on grimpe |
| Lancer (maintenir) | J ou Entrée | X ou gâchette droite | LANCER |
| Creuser, lancer en haut | ↓ ou ↑ sans avancer, puis lancer | bas ou haut, puis lancer | pouce gauche vers le bas ou le haut, puis LANCER ; ou LANCER glissé vers le haut |
| Spéciale | K ou Maj | B ou gâchette gauche | SPÉ |
| Pause | Échap ou P | Start | II |
| Piste suivante (en pause) | N | croix jusqu’à ⏭, puis A | ⏭, à côté de « Pause » |

Sur téléphone, l'image remplit l'écran : le pouce gauche se pose où il veut, et à droite chaque bouton répond dans un cercle à peine plus grand que lui. Le jeu se joue en paysage ; téléphone tenu debout, il pivote tout seul.

Le tableau est aussi dans le jeu (**Commandes**, au menu et en pause). Les panneaux du premier niveau, le carton d'ouverture et la pause disent les touches de l'appareil en main : clavier, manette ou pouce.

## Contribuer

Tout le contenu est en fichiers texte, modifiables depuis GitHub sans rien installer.

| Je veux ajouter… | Comment |
|---|---|
| une pancarte vue en manif, un slogan, un bandeau télé | [une ligne de texte](docs/ajouter-une-blague.md) |
| un niveau | [le dessiner dans l'Atelier du jeu](docs/ajouter-un-niveau.md) |
| un héros, une recrue, une unité d'en face, un boss | [une fiche](docs/ajouter-un-personnage.md) |
| un drapeau, un son, une citation, un chiffre | [drapeau](docs/ajouter-un-drapeau.md) · [son](docs/ajouter-un-son.md) · [source](docs/ajouter-une-source.md) |
| une mécanique | [une fonction](docs/ajouter-une-mecanique.md) |
| une idée | [une issue](https://github.com/ultragaucheforce/ultragaucheforce.github.io/issues/new/choose) |

Tout ce qu'on dépose se débloque en jouant, et se retrouve dans la Collection. Le mode d'emploi : [CONTRIBUTING.md](CONTRIBUTING.md). Ce qui entre dans le jeu : [la charte](CHARTE.md).

## Sous le capot

```text
content/       héros, recrues, unités, niveaux, pancartes, citations, sons… en fichiers texte
src/sim/       la simulation, pure : elle tourne aussi dans Node, pour les tests
src/content/   lecture et validation du contenu
src/client/    rendu, entrées, sons, écrans, Atelier, Galerie
tools/         serveur local, vérification, build — zéro dépendance
```

| Commande | Effet |
|---|---|
| `npm start` | le jeu sur http://localhost:8080, la Galerie sur `/galerie.html` |
| `npm run verifier` | contrôle le contenu, en français, fichier et ligne |
| `npm test` | les tests ; un robot traverse chaque niveau de la campagne |
| `npm run build` | la version à héberger, dans `dist/` |
| `npm run robot` | quarante parties par niveau jouées par le robot : un repère de difficulté |

Mesure d'audience anonyme (PostHog), en ligne seulement : ni cookie, ni profil. Le build ajoute le script de PostHog quand `POSTHOG_PROJECT_TOKEN` est donné (et `POSTHOG_HOST`, l'hôte européen par défaut) ; sans clé, et toujours en local, rien n'est chargé. Mode sans cookie de PostHog : les visiteurs uniques sont comptés par jour, d'après un hachage calculé sur ses serveurs avec un sel renouvelé chaque jour. Ce qui est compté, événement par événement : [`docs/mesure-d-audience.md`](docs/mesure-d-audience.md).

Le pourquoi : [docs/DECISIONS.md](docs/DECISIONS.md).

## Licence

Code [MIT](LICENSE), contenus [CC BY-SA 4.0](content/LICENCE.md) sauf mention contraire (certains sons et musiques ont leur propre licence, dite dans le jeu, À propos → Crédits et licences). Mentions légales : [en ligne](https://ultragaucheforce.github.io/mentions-legales.html).

## Clins d'œil

[Broforce](https://store.steampowered.com/app/274190/Broforce/) (Free Lives, édité par Devolver Digital, 2015), un jeu au décor destructible où chaque prisonnier libéré change de héros. UltraGauche Force est un projet indépendant, sans lien avec Free Lives ni Devolver Digital. [Fiscal Kombat](https://fr.wikipedia.org/wiki/Fiscal_Kombat), un jeu militant fait par des bénévoles. [We Become What We Behold](https://ncase.itch.io/wbwwb) de Nicky Case, sur la caméra qui fabrique la panique. L'[Orchestre du Nouveau Monde](https://www.helloasso.com/associations/orchestre-du-nouveau-monde), pour la fanfare. [La Dernière](https://www.nova.fr/emissions/la-derniere/) sur Radio Nova, pour le ton. [ZzFX](https://github.com/KilledByAPixel/ZzFX) de Frank Force, pour les bruitages.
