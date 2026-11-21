# Ajouter un niveau

On le dessine dans le jeu, on l'essaie, on le propose. Le niveau lui-même est un fichier texte : un en-tête, puis une carte où un caractère vaut une case.

## Le plus simple : l'Atelier (bêta)

1. Dans le jeu, ouvrez **Atelier**.
2. Choisissez dans la palette (Terrain, Repères, En face, La manif, Décors), puis peignez : un toucher pose, un glissé trace. Il y a une gomme, un rectangle, et une case « Mur du fond ».
3. La carte s'agrandit par ses quatre côtés, jusqu'à 400 × 60. L'en-tête s'écrit tout seul.
4. **Tester** lance votre niveau tout de suite. S'il manque quelque chose, l'Atelier le dit en une phrase et montre la case. **← Retour à l'édition**, à côté de la pause, dans la pause et à la fin de l'essai, ramène à la carte, là où vous en étiez.
5. **Proposer** ouvre la page GitHub de création du fichier, déjà remplie. Niveau trop long pour un lien ? Il est copié : collez-le dans la page qui s'ouvre.
6. **Mes niveaux** : chaque niveau commencé s'enregistre tout seul dans le navigateur pendant qu'on dessine. L'Atelier rouvre sur leur liste : ouvrir, tester, renommer, dupliquer, supprimer, en commencer un nouveau. Rien ne quitte l'appareil.
7. **GitHub** mène au reste : les propositions en cours, une idée de niveau, une pancarte, un personnage, une source à corriger, un bug.

> [!NOTE]
> Le bouton **Texte** montre la fiche du niveau. C'est là que se règlent les clés que la palette ne couvre pas (`citation`, `fiche`, `accroche`, `heros`, `camarades`, `musique`, `musique-boss`, `manif`, `panique`, `nasse.*`).

Sans l'Atelier : créez `content/niveaux/mon-niveau.txt` (voir [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Un niveau complet

<!-- fichier: content/niveaux/la-place-du-marche.txt -->
```text
titre: La place du marché
auteur: ton pseudo
citation: macron-traverse-la-rue
fiche: droit-de-manifester
fond: ville
cortege: oui
manif: 5
panneau.1: Va jusqu'à la soignante : elle rejoint la manif ✊
s: soignante
b: barrage
d: drone
=: banderole
--- carte
........................................
........................................
........................................
..................d.....................
........................................
.........................PPP............
........................................
..D...1..s...=.......b...K......Q...S...
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO
```

Déposé dans `content/niveaux/`, il devient une étape du plan de campagne, à la suite des autres (sauf le tuto, `get-ready-with-me`, joué au premier « Jouer », tant qu'il n'a été ni joué ni passé). [`content/campagne.txt`](../content/campagne.txt) fixe l'ordre des premières étapes.

## L'en-tête

| Clé | Rôle |
|---|---|
| `titre` | obligatoire |
| `auteur` | votre pseudo, pour le crédit |
| `citation` | la vraie déclaration qui ouvre le niveau (un fichier de `content/citations/`) |
| `fiche` | un fait sourcé de `content/fiches/` ; répétable ; la première s'affiche à la fin du niveau |
| `accroche` | une phrase courte et factuelle sur le lieu, sans sermon : elle s'affiche sur le plan de campagne, sur le carton d'ouverture et sur la carte du lieu dans la Collection |
| `fond` | `campagne`, `ville` ou `citadelle` |
| `cortege` | `oui` : la manif suit le héros |
| `manif` | combien de manifestants au départ (10 avec un cortège, sauf indication ; 5000 au plus) |
| `panique` | la panique de PANIQUE TV au départ, de 0 (par défaut) à 33, sous le premier palier : quelques secondes filmé par un drone suffisent alors pour passer à « alerte ». Le tuto part de 20 |
| `panneau.1` à `panneau.9` | le texte du panneau placé par le chiffre correspondant sur la carte. Une touche s'écrit entre crochets, et chacun la lit sur son appareil : `[tirer] : lancer des tracts` devient « J : … » au clavier, « X : … » à la manette, « LANCER : … » au pouce. Les touches : `[avancer]`, `[sauter]`, `[tirer]`, `[bas]`, `[haut]`, `[spéciale]`, `[pause]`. Le premier panneau d'une partie qui dit `[spéciale]` fait clignoter la puce de la spéciale et le bouton SPÉ, jusqu'au premier usage, huit secondes au plus, jamais en pause. Dans le tuto ([`get-ready-with-me`](../content/niveaux/get-ready-with-me.txt)), un panneau qui dit une touche attend le geste : il reste en haut jusqu'à ce que le joueur l'ait fait (`[bas]` + `[tirer]` : creuser ; `[haut]` + `[tirer]` : lancer en haut ; `[avancer]` + `[sauter]` : grimper, un rebond contre un mur), puis montre un ✓ et s'efface ; au pouce, le bouton concerné clignote. Le panneau suivant prend sa place. Dans le tuto, le panneau lu est mis en avant : plus grand, sur fond jaune, il descend en place (immobile avec les effets réduits) et passe sous le héros plutôt que de le cacher |
| un signe de légende | `b: barrage` place une unité, une recrue ou un décor à chaque `b` de la carte |
| `heros` | le héros avec lequel on essaie le niveau dans l'Atelier. En jeu, le joueur choisit parmi ceux qu'il a débloqués ; la première fois, le hasard choisit. Sans cette clé ni choix du joueur, un héros jouable est tiré au hasard, le même pour une même graine |
| `camarades` | l'ordre des héros libérés, séparés par une barre verticale : `melenchon \| zucman` (sinon au hasard) |
| `boss` | facultatif : impose un boss de `content/boss/`. Sans cette ligne, le boss du `Y` est tiré au hasard à chaque partie |
| `nasse.ennemi` | l'unité qui forme la nasse ; obligatoire s'il y a un `N` sur la carte |
| `nasse.nombre` | unités de chaque côté (1 à 6, défaut 3) |
| `nasse.vitesse` | vitesse à laquelle les lignes se referment, en pixels par seconde (4 à 80, défaut 18) |
| `nasse.rythme` | la nasse revient d'elle-même autour du héros, toutes les tant de secondes (0 à 600 ; 0, par défaut : seulement aux repères `N`) |
| `manchette` | une alerte de PANIQUE TV propre au niveau ; répétable. Elle reprend le texte d'un vrai bandeau de [`content/manchettes/`](../content/manchettes) (à la casse près) : c'est ce bandeau, il passe avec sa chaîne et sa date, et débloque sa carte. Sinon, elle passe sans crédit. Un crédit ne s'écrit pas ici : ajoutez d'abord le bandeau au fonds commun, avec sa source |
| `intro` | le texte du carton d'ouverture, quand il n'y a pas de `citation` |
| `musique` | une piste de `content/musiques/` : elle ouvre chaque entrée dans le niveau, même s'il a d'autres pistes à lui (`ou` : ce niveau). Ensuite, les pistes tournent. Si elle ne joue pas, l'entrée prend une autre de ses pistes, sinon le sac. Répétée (une ligne `musique:` par piste), elle donne un enchaînement : la première ouvre la visite, les suivantes viennent à la fin de chacune, dans l'ordre, puis le sac ; ⏭ ou une piste qui ne joue pas passe à la suivante de la liste, « Recommencer » garde la piste en cours, une nouvelle entrée reprend au début |
| `musique-boss` | une piste de `content/musiques/` (de préférence `ou: boss`) : elle ouvre chaque arrivée au boss de ce niveau, suivie de sa suite (`puis`) s'il y en a une. Ensuite, et si elle ne joue pas, le hasard parmi les pistes du boss. Sans elle, le boss tire au hasard dès l'arrivée |

Un signe de légende est une minuscule, ou l'un de ceux-ci : `+ * @ & % $ ! ? = ~ ^ < > _ , ;`.

Le niveau devient une carte de la Collection, avec sa citation et ses fiches.

## La carte

| Symbole | Case |
|---|---|
| `.` | vide |
| `D` | départ du héros (un seul) |
| `S` | sortie : le camion-sono (au moins une ; il occupe la case du `S` et les deux à sa droite) |
| `K` | camarade en garde à vue : le libérer donne une vie, change de héros et amène 20 personnes |
| `Q` | piquet de grève : point de reprise, et 10 personnes de plus |
| `Y` | l'emplacement du boss : un ultra-riche de `content/boss/`, tiré au hasard à chaque partie |
| `N` | nasse : deux lignes se referment quand le héros passe ici |
| `1` à `9` | panneau |
| un signe de légende | unité, recrue ou décor déclaré dans l'en-tête |
| une majuscule | une tuile |

Les tuiles disponibles (la liste à jour est dans l'Atelier et dans [`content/tuiles/`](../content/tuiles)) :

| | Tuile | Résistance |
|---|---|---|
| `T` | terre | 3 |
| `P` | planche | 1 |
| `F` | botte de foin | 1 |
| `R` | pierre sèche | 3 |
| `B` | brique | 3 |
| `G` | pavé | 3 |
| `V` | vitrine | 1 |
| `M` | marbre | 4 |
| `H` | haie | 2 |
| `L` | liasses de billets | 2 |
| `C` | bâche de bassine | 1 |
| `X` | tonneau : explose, et fait exploser ses voisins | 1 |
| `A` | acier | indestructible |
| `O` | socle rocheux | indestructible |

Unités : tout fichier de [`content/ennemis/`](../content/ennemis) (`robot-bouclier`, `ramasseur`, `drone`…). Recrues : tout fichier de [`content/recrues/`](../content/recrues) (`soignante`, `cheminot`, `ag`…). Décors : tout fichier de [`content/decors/`](../content/decors) (`kiosque`, `banderole`, `vache`…).

## La manif

Le but du joueur : la plus grosse manif possible, pour aller taxer le boss au bout.

- Une **recrue** rejoint quand le héros la touche ou lui tend un tract. Son gain s'affiche au-dessus d'elle : `+ 20`, `× 2`.
- Plus on est nombreux, plus les tracts font de dégâts.
- Une charge, un nuage de gaz ou une chute du héros dispersent une part de la manif.

## Les lignes

Une unité qui porte `ligne.vie` (le barrage, le blindé, la grille) est une ligne : on ne la saute pas, on la casse. Sa vie s'affiche en haut de l'écran quand on arrive devant elle. Les tracts l'entament ; la manif la pousse, d'autant plus fort qu'elle est nombreuse.

Elle arrête les deux camps. Une unité posée derrière y reste tant qu'elle tient : ni sa charge ni ses tirs ne passent, seulement ses grenades, par-dessus.

Personne ne reste coincé : même seul, on finit par la casser à coups de tracts. Pour que ce soit un choix et non une attente, placez avant elle de quoi grossir la manif, et davantage en hauteur pour qui explore.

## La nasse

Un `N` sur la carte, `nasse.ennemi` dans l'en-tête. Quand le héros passe sur le `N`, à son étage, deux lignes apparaissent à neuf cases de chaque côté et se referment. La nasse ne tient que leur étage : de leur sol jusqu'à quatre cases au-dessus. Elle est levée si le héros en sort : sur le côté, en se posant à l'étage au-dessus, ou en descendant d'un étage entier, quatre cases ou plus (une galerie, le métro) ; un trou d'une case ne suffit pas. Elle est aussi levée si l'une des deux lignes est hors service, ou au bout de vingt secondes : un décompte, au-dessus d'elle, dit combien il en reste. Ses lignes sont des unités, pas des obstacles : on les met hors service comme les autres, à coups de tracts (un bouclier les pare de face) ; la manif, prise dedans, ne les pousse pas.

Il faut du sol plat de chaque côté du `N`, et une issue en hauteur (un étage à quatre cases au-dessus de la rue) ou en sous-sol.

## Un décor

Un fichier `content/decors/mon-decor.txt` : un dessin `image` (et `image2` pour l'animer), sans collision : on passe à travers, mais un décor à `pv` arrête les tracts.

| Clé | Rôle |
|---|---|
| `nom` | obligatoire |
| `devant` | `oui` : dessiné devant les personnages |
| `ecrit` | `pancarte` : le jeu écrit sur le dessin une vraie pancarte de `content/pancartes/` (une banderole) ; `tag` : il la peint au-dessus, sans fond (un mur) |
| `ecrit.y` | hauteur du texte, en pixels depuis le haut du dessin (0 à 96, défaut 8) |
| `brule` | `oui` : quand la panique de PANIQUE TV franchit un palier près de lui, il prend feu, et une unité télé de la légende (réaction `cadre`) vient filmer le feu plutôt que la manif. Modèle : [`poubelles`](../content/decors/poubelles.txt) |
| `pv` | les tracts et les explosions du héros le cassent, en autant de coups (1 à 12 ; 0, par défaut : il ne se casse pas). Un dessin `--- cassee`, de la taille de `image`, le remplace alors |
| `coupe` | cassé, il coupe l'antenne de PANIQUE TV pendant tant de secondes (0 à 30) : le bandeau passe au noir, « ÉCRAN NOIR » ; la panique ne monte plus, aucune alerte ne passe, et les unités des médias (`camp: medias`) restent sur place sans filmer, sans tirer ni rien dire. Demande `pv`. Modèle : [`regie-antenne`](../content/decors/regie-antenne.txt), au dernier étage de la chaîne d'info |
| `coupe.panique` | cassé, il retire autant de points de panique (0 à 33), sans repasser sous le palier déjà franchi. Demande `pv` |

Au même endroit, c'est toujours la même pancarte. Modèles : [`banderole`](../content/decors/banderole.txt), [`tag`](../content/decors/tag.txt).

## Les règles que le robot vérifie

- Au moins 8 lignes ; au plus 400 colonnes sur 60 lignes.
- Exactement un `D`, au moins un `S`, un `Y` au plus.
- Chaque chiffre a son `panneau.N`, chaque signe sa légende, un `N` son `nasse.ennemi`.
- La sortie doit être atteignable : aucun mur indestructible ne doit couper la carte en deux.
- En plus, pour la campagne : un robot joueur doit réussir à traverser le niveau.

## Conseils de construction

- **Du sol épais** : plusieurs rangées de terre, de pavé ou de pierre, et deux rangées de socle (`O`) tout en bas. On creuse partout, on ne tombe jamais dans le vide.
- **Des étages et des sous-sols** : un bâtiment à planchers, une cave, une galerie. Le héros tire devant lui, et aussi vers le bas ou vers le haut quand il ne bouge pas : c'est ainsi qu'il creuse.
- **Récompensez qui explore** : des recrues, un camarade (`K`), une assemblée générale, sur un toit ou au fond d'une galerie. Plus de monde, c'est plus de pancartes.
- **Un mur du fond derrière chaque cavité** : sans lui, on voit le ciel à travers le sol.
- **Tout mur se grimpe** en sautant plusieurs fois contre lui. Évitez seulement un surplomb d'acier au-dessus d'un mur à escalader.
- Pas de trou de plus de quatre cases de large.
- Écartez les tonneaux de deux cases : assez près pour la réaction en chaîne, assez loin pour qu'on la voie. Un tonneau ouvre le sol sur deux rangées : une cave juste dessous devient un raccourci.
- **Des gardes à vue sur le chemin** : on part avec un seul personnage, les autres en sortent.
- **Des recrues sur le chemin au sol** avant chaque ligne : le robot joueur ne monte pas les chercher.
- Une ligne (barrage, grille) se contourne par-dessous si le sol se creuse. Pour qu'il faille la casser, posez-la sur du socle.
- Trois à six minutes suffisent : un sauvetage, une ligne à casser, un passage à creuser, la sortie.
- Un panneau, c'est un conseil en quelques mots. Il s'affiche quand on passe devant, et reste lisible un instant après.

## Les murs du fond (facultatif)

Pour qu'un bâtiment ait un intérieur, ou une cave un fond, cochez « Mur du fond » dans l'Atelier. Dans le fichier, c'est une section `--- murs` après la carte, de la même taille : les tuiles qu'on y dessine s'affichent assombries, derrière l'action, sans collision. Les niveaux de la campagne s'en servent pour la grange, le métro ou la Citadelle.

```text
--- murs
........................................
.........................BBB............
.........................BBB............
```
(complétez avec des lignes de points jusqu'à la hauteur de la carte)
