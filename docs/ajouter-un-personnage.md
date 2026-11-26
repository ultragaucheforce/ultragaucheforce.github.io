# Ajouter un personnage : héros, recrue, unité d'en face ou boss

Une fiche texte : des réglages, puis des dessins. Tant qu'il combine des comportements existants, pas une ligne de code : déposez le fichier, il est dans le jeu.

- Un héros : `content/heros/mon-heros.txt`
- Une recrue : `content/recrues/ma-recrue.txt`
- Une unité d'en face : `content/ennemis/mon-unite.txt`
- Un boss : `content/boss/mon-boss.txt`

Pour voir le résultat : `npm start`, puis la Galerie (http://localhost:8080/galerie.html).

## Les dessins

Chaque section `--- nom` est une image : une lettre par pixel, les lettres étant les couleurs de [`content/palette.txt`](../content/palette.txt), et `.` le transparent. Le personnage regarde **vers la droite** ; le jeu le retourne tout seul.

| Section | Rôle |
|---|---|
| `repos` | héros, unité, boss : obligatoire, le personnage immobile |
| `marche1`, `marche2` | les deux pas de la marche (sinon `repos`) |
| `saut` | en l'air (sinon `marche1`) |
| `portrait` | héros : le portrait géant du carton de déblocage ; boss : obligatoire |
| `projectile` | ce que lance son arme |
| `onde` | héros : l'onde de la spéciale `sol` |
| `bille` | héros : une bille de la spéciale `billes` |
| `fin` | unité : une fois hors service, elle a posé ce qui la rendait menaçante (sans lui, son dessin `repos`, apaisé, presque gris) |
| `ejecte` | boss : la caricature qui s'éjecte, indemne |
| `image`, `image2` | recrue : obligatoire, et sa seconde pose |

Un héros fait une douzaine de pixels de large pour dix-huit de haut. Les fichiers existants sont les meilleurs modèles.

## La carte

Chaque personnage devient une carte de la Collection. Trois clés l'écrivent :

| Clé | Sur la carte |
|---|---|
| `citation` | une vraie citation de `content/citations/`, avec son auteur, sa date et sa source (héros, unité, boss) |
| `fiche` | un fait sourcé de `content/fiches/` ; répétez la ligne pour en mettre plusieurs |
| `origine` | une phrase, s'il reste quelque chose à dire |

Citations et fiches s'ajoutent d'abord dans leur dossier : [ajouter une source](ajouter-une-source.md).

Ce que dit un personnage est réel : un slogan scandé, une pancarte vue, les mots exacts d'une déclaration ou d'un texte officiel.

## Un héros

<!-- fichier: content/heros/casseroliere.txt -->
```text
nom: La Casserolière
traitement: archétype — une manifestante armée d'une casserole
cri: ON EST LÀ !
fiche: casseroles-arrete
pv: 2
vitesse: 145
saut: 3.2
auteur: ton pseudo

# Arme : des coups de casserole, courts, qui traversent tout.
arme.type: tir
arme.cadence: 4
arme.vitesse: 180
arme.portee: 120
arme.degats: 1
arme.terrain: 1
arme.perce: 1
arme.taille: 12
arme.mots: BING ! | BANG ! | CLONG !
arme.son: impact

# Spéciale : le concert.
speciale.type: onde
speciale.nom: CONCERT DE CASSEROLES !
speciale.charges: 2
speciale.rayon: 90
speciale.etourdit: 3

--- repos
...TTTT...
..TTTTTT..
..ssssss..
..skssks..
..ssssss..
...ssss...
..RRRRRRhh
.RRRRRRRhh
.RRRRRRR.t
.RRRRRRR..
..RRRRR...
..nnnnn...
..nn.nn...
..nn.nn...
..nn.nn...
.kkk.kkk..
```

| Clé | Rôle | Bornes |
|---|---|---|
| `nom` | obligatoire | |
| `inspiration` | la personnalité publique caricaturée, s'il y en a une | |
| `traitement` | en une phrase : archétype, ou nature de la caricature | |
| `cri` | la phrase du carton de déblocage : un slogan réel ou ses propres mots | |
| `citation`, `fiche`, `origine` | sa carte | |
| `pv` | combien de coups il encaisse avant de céder sa place au personnage précédent ; touché, ce qu'il lui reste s'affiche au-dessus de lui et dans la barre sous la pile | 1 à 5 |
| `vitesse` | pixels par seconde | 60 à 220 |
| `saut` | hauteur du saut, en cases | 1,5 à 5 |
| `largeur`, `hauteur` | la boîte de collision, en pixels | 6 à 16, 8 à 24 |
| `statut` | `jouable`, ou `test` pour l'écarter des sauvetages | |

[`content/camarades.txt`](../content/camarades.txt) fixe l'ordre des héros : la sélection, la Collection et la Galerie les montrent dans cet ordre. Un héros qu'il ne nomme pas vient après, par nom de fichier.

## Une recrue

Elle attend sur place. Le héros la touche, ou lui tend un tract : elle rejoint la manif.

<!-- fichier: content/recrues/pompier.txt -->
```text
nom: Pompier
apport: 25
slogan: DES MOYENS, PAS DES MIRACLES
fiche: programme-services-publics-ruraux
auteur: ton pseudo
--- image
...GGGG...
..GGGGGG..
..ssssss..
..skssks..
..ssssss..
...ssss...
..nnnnnn..
.nnYYYYnn.
.nnnnnnnn.
.nnRRRRnn.
..nnnnnn..
..nnnnnn..
..nn..nn..
..YY..YY..
..nn..nn..
.kkk..kkk.
```

| Clé | Rôle | Bornes |
|---|---|---|
| `nom` | obligatoire | |
| `apport` | combien de personnes rejoignent la manif | 1 à 500 |
| `multiplie` | à la place d'`apport` : la manif est multipliée (une assemblée générale) | 1,5 à 5 |
| `soin` | combien de coups elle rend au personnage en jeu en rejoignant la manif (une street medic) | 0 à 3 |
| `slogan` | ce qu'elle lance en rejoignant : un slogan réellement scandé ou une pancarte vue ; répétable. Si elle arrive avec une pancarte, elle crie la pancarte à la place | |
| `fiche`, `origine` | sa carte | |

`apport` ou `multiplie`, jamais les deux. Le dessin `image` donne sa taille (48 pixels au plus) ; `image2` l'anime. Son gain s'affiche au-dessus d'elle : `+ 25`, `× 2`.

Pour la placer, un niveau la déclare dans sa légende : `p: pompier`.

## Une unité d'en face

<!-- fichier: content/ennemis/automate-a-bouclier.txt -->
```text
# Les sommations sont celles de l'article R. 211-11 du code de la sécurité intérieure.
nom: Automate à bouclier
pv: 3
vitesse: 30
deplacement: marche
reaction: charge
vue: 190
bouclier: oui
fin: greve
fiche: sommations-mots-exacts
sommation: PREMIÈRE SOMMATION : NOUS ALLONS FAIRE USAGE DE LA FORCE.
sommation: DERNIÈRE SOMMATION : NOUS ALLONS FAIRE USAGE DE LA FORCE.
charge.distance: 150
charge.vitesse: 210
charge.pause: 2.4
charge.disperse: 6
auteur: ton pseudo

--- repos
..kkkkkk..
.kbbbbbbk.
.kccccsk..
..ssssss..
.nnnnnnnWW
.nnnnnnnWc
.nnKKnnnWc
.nnnnnnnWc
..nnnnnnWW
..nn..nn..
..nn..nn..
.kkk..kkk.
```

| Clé | Rôle | Choix ou bornes |
|---|---|---|
| `pv` | points de vie | 1 à 20 |
| `vitesse` | pixels par seconde | 0 à 200 |
| `deplacement` | | `marche`, `vol`, `fixe`, `moto` (traverse, dépasse le héros, fait demi-tour), `vehicule` (lourd : ni recul ni étourdissement, on ne le traverse pas, on le saute) |
| `reaction` | ce qu'elle fait en voyant le héros | `tire`, `fonce`, `cadre` (filme et fait monter la panique), `charge` (sommations, puis ruée), `projecteur` (en vol : un faisceau balaie le sol), `rien` |
| `vue` | distance de détection, en pixels | 32 à 400 |
| `bouclier` | pare les tirs de face | `oui`, `non` |
| `contact` | dégâts au toucher ; une ruée blesse toujours | 0 à 3 |
| `panique` | points de panique par seconde quand elle « cadre », ou quand le héros est dans son faisceau | 0 à 30 |
| `ligne.vie` | une ligne : ses points de vie ; 0, ce n'est pas une ligne | 0 à 5000 |
| `ligne.poussee` | une ligne : les points de vie que lui retirent cent manifestants qui poussent, par seconde | 0 à 50, 10 par défaut |
| `interpelle` | combien de manifestants elle emmène quand elle atteint le cortège, une fois toutes les deux secondes et demie | 0 à 20 |
| `fin` | à zéro point de vie | `greve` (elle s'assoit), `panne` (elle fume) |
| `camp` | à qui elle appartient ; seuls les automates comptent dans le décompte de fin (« automates désactivés ») ; celles des médias se taisent quand on casse la régie (voir le décor à `coupe` dans [ajouter-un-niveau.md](ajouter-un-niveau.md)) | `automates` (par défaut), `medias`, `pouvoir` |
| `replique` | une phrase qu'elle prononce ; répétable. La bulle reste 0,3 s par mot, 2 s au moins | |
| `sommation` | réaction `charge` : dites une par une avant la première ruée ; répétable | |
| `citation`, `fiche`, `origine` | sa carte | |
| `largeur`, `hauteur` | boîte de collision | 6 à 32 |

L'arme est facultative. Pour placer l'unité, un niveau la déclare dans sa légende : `c: automate-a-bouclier`.

Ce que le joueur voit, sans rien régler : une unité touchée blanchit et recule d'un pixel, puis montre sa jauge ; un bouclier de face arrête le coup (« PARÉ », des étincelles), mais pas le souffle d'une explosion ; sonnée, des étoiles tournent autour de sa tête ; gazée par son propre camp, elle pleure et tousse (« KOF ! ») ; quand elle repère le héros, un « ! » ; le boss vaincu, un automate à pied (`camp: automates`, `deplacement: marche`) près de qui passe le héros émet de petits cœurs. Des unités identiques côte à côte font un groupe : un seul « ! », un seul « KOF ! ».

Hors service, rien ne s'écrit au-dessus d'elle : le dessin suffit. Au moment où elle tombe, un cercle et son bruitage ; puis son dessin `fin`, sinon son `repos`, apaisé, presque gris. En grève, elle s'assoit en tailleur, si son dessin a deux jambes sous une ceinture d'au plus douze pixels. En panne, elle fume. Et une petite fleur pousse : assise, dans sa main tendue (le pixel de peau `s` ou `S` le plus en avant, sous la tête) ; sinon plantée au sommet de son dessin. Une ligne qui cède, elle, s'ouvre (voir plus bas), sans s'asseoir ni fleur : une grille ou un barrage s'écarte en deux et s'efface, laissant son dessin `fin` ; le Gros blindé recule, assombri s'il n'a pas de dessin `fin`. Son dessin `fin` reprend `repos` sans ce qui la rendait menaçante : le Robot-bouclier a posé son bouclier et ouvert sa visière, le drone a perdu ses hélices, l'éditorialiste montre la mire. Personne n'est blessé à l'écran ([charte](../CHARTE.md)).

### Une ligne : `ligne.vie`

Une ligne a une vie, comme le boss : quand le héros arrive devant elle, sa barre s'affiche en haut de l'écran, avec son nom. Les tracts l'entament, le souffle et les spéciales aussi ; les coups de son propre camp n'y font rien. Quand le héros arrive dessus, la manif pousse : chaque seconde, `ligne.poussee` points de vie par centaine de manifestants. Plus elle est nombreuse, plus elle pousse fort, et la ligne tremble. Tant qu'elle a de la vie, elle tient : on ne la saute pas, ses unités au sol ne la traversent pas, ni en marchant, ni en chargeant, ni en fonçant, et un tir qui la touche s'y écrase. Les grenades en cloche passent par-dessus, ce qui vole passe au-dessus. À zéro, elle cède et s'ouvre, sa barre vide un instant : plus personne n'est arrêté. Rien d'autre ne la fait céder. Sur une ligne, `pv` n'est pas lu : seule `ligne.vie` compte.

Modèles : [`barrage`](../content/ennemis/barrage.txt), [`gros-blinde`](../content/ennemis/gros-blinde.txt), [`grille`](../content/ennemis/grille.txt).

### Une charge : `reaction: charge`

| Réglage | Effet | Bornes | Défaut |
|---|---|---|---|
| `charge.distance` | longueur de la ruée, en pixels | 32 à 480 | 160 |
| `charge.vitesse` | pixels par seconde | 60 à 400 | 220 |
| `charge.pause` | secondes avant la charge suivante | 0,5 à 8 | 2,5 |
| `charge.disperse` | pour cent de la manif dispersés quand la ruée traverse le cortège | 0 à 30 | 5 |

Les sommations ne sont dites qu'une fois. Modèle : [`robot-bouclier`](../content/ennemis/robot-bouclier.txt).

### Un projecteur : `reaction: projecteur`

Pour une unité qui vole. Tant que le héros reste dans le faisceau, la panique monte ; au bout d'une seconde et demie, des renforts descendent à la corde.

| Réglage | Effet | Bornes | Défaut |
|---|---|---|---|
| `faisceau.largeur` | largeur éclairée au sol, en pixels | 24 à 200 | 64 |
| `faisceau.balayage` | amplitude du va-et-vient, en pixels | 0 à 200 | 90 |
| `renfort.ennemi` | l'unité déposée (un fichier de `content/ennemis/`) | | |
| `renfort.nombre` | unités déposées à chaque fois | 1 à 4 | 2 |
| `renfort.max` | nombre de déposes au plus | 0 à 6 | 2 |

Modèle : [`helicoptere`](../content/ennemis/helicoptere.txt).

## Un boss

Le modèle : [`content/boss/arnault.txt`](../content/boss/arnault.txt). À zéro point de vie, la machine s'arrête et son pilote s'éjecte (dessin `ejecte`). En face, plus personne n'attaque : les unités restent où elles sont, et ce qui volait encore ne blesse plus ni le héros ni le cortège.

| Clé | Rôle | Bornes |
|---|---|---|
| `nom`, `inspiration`, `traitement` | comme un héros | |
| `pv`, `vitesse` | | 5 à 400, 0 à 200 |
| `largeur`, `hauteur` | boîte de collision | 16 à 96 |
| `replique` | une phrase qu'il lance : ses propres mots, tirés de ses citations ; répétable | |
| `citation`, `fiche`, `origine` | sa carte | |
| `assis` | `oui` : il reste assis sur sa fortune, sans bouger ni charger | |
| `leve` | il se lève quand ses points de vie passent sous cette fraction | 0 à 1 (défaut 0,7) |
| `fortune.montant` | en milliards d'euros | |
| `fortune.fiche` | la fiche de `content/fiches/` qui source ce montant ; sans elle, pas de scène de taxation | |
| `fortune.rente` | les fiches dont les `valeur`, multipliées, donnent ce que cette fortune rapporte en un an, en euros (un dividende par action, puis un nombre d'actions) ; répétable ; la scène de taxation compare ce total aux 2 % | |
| `phase.1.jusqua` | la phase dure tant que les points de vie dépassent cette fraction | 0 à 1 |
| `phase.1.rythme` | secondes entre deux attaques | 0,4 à 8 |
| `phase.1.attaques` | les attaques de la phase, séparées par une barre verticale : `salve \| charge` | |

Jusqu'à cinq phases (`phase.1` à `phase.5`). Les dessins `repos` et `portrait` sont obligatoires.

Pour l'asseoir sur sa fortune, le niveau pose le `Y` au sommet d'un tas de tuiles `L` (liasses). Si on creuse le tas, il tombe avec.

Un autre nom sourcé pour le même ultra-riche : copiez sa fiche sous un autre nom de fichier, changez `nom` et dites d'où il vient dans `origine`. Même fortune, même comportement. Le boss d'un niveau est tiré parmi les fichiers de `content/boss/` : un ultra-riche qui a deux noms sort deux fois plus souvent. Exemple : [`arnault-terminator`](../content/boss/arnault-terminator.txt), « The Terminator ».

## Les comportements disponibles

Déclarés dans [`src/sim/behaviors.js`](../src/sim/behaviors.js), bornes comprises : le robot refuse ce qui dépasse.

### Arme : `arme.type: tir`

Lance un ou plusieurs projectiles devant soi.

| Réglage | Effet | Bornes | Défaut |
|---|---|---|---|
| `arme.cadence` | tirs par seconde | 0,2 à 20 | 5 |
| `arme.vitesse` | pixels par seconde | 30 à 420 | 240 |
| `arme.gravite` | 0 = tout droit ; plus = en cloche. Tiré vers le haut, le projectile file tout droit jusqu'à sa portée ; après un rebond, il retombe | 0 à 900 | 0 |
| `arme.elan` | impulsion vers le haut au départ | 0 à 400 | 0 |
| `arme.dispersion` | écart vertical au hasard | 0 à 80 | 0 |
| `arme.nombre` | projectiles par tir | 1 à 8 | 1 |
| `arme.portee` | pixels parcourus | 16 à 640 | 220 |
| `arme.degats` | dégâts aux adversaires | 0 à 10 | 1 |
| `arme.terrain` | dégâts au décor | 0 à 10 | 1 |
| `arme.rebonds` | nombre de rebonds | 0 à 5 | 0 |
| `arme.explosion` | rayon de l'explosion à l'impact | 0 à 64 | 0 |
| `arme.perce` | 1 = traverse les adversaires | 0 ou 1 | 0 |
| `arme.blindage` | 1 = passe les boucliers | 0 ou 1 | 0 |
| `arme.fratricide` | 1 = touche aussi son propre camp | 0 ou 1 | 0 |
| `arme.gaz` | secondes de nuage laissé à l'impact | 0 à 6 | 0 |
| `arme.taille` | côté du projectile, en pixels | 2 à 24 | 4 |
| `arme.recul` | pousse le tireur en arrière | 0 à 200 | 0 |
| `arme.vise` | unités seulement : 1 = tiré vers le héros plutôt qu'à l'horizontale | 0 ou 1 | 0 |
| `arme.visee` | unités seulement : secondes de préavis avant le tir, le joueur voit venir le coup : une visée sur le héros avec `arme.vise`, sinon un « ! » rouge qui clignote à la bouche | 0 à 2 | 0 |
| `arme.touche` | unités seulement : manifestants touchés quand le tir atteint le cortège ; ils quittent la manif | 0 à 20 | 0 |
| `arme.image` | le dessin du projectile (une section de la fiche) | | `projectile` |
| `arme.mots` | des mots lancés à la place d'un dessin, séparés par une barre verticale : `BING ! \| BANG !` | | |
| `arme.son` | un bruitage de `content/sons/` | | `tir` |

Un mot lancé par une unité qui reprend le `mot` d'une citation fait entrer cette citation dans la Collection.

Un mot d'en face part de la bouche et ne blesse que par sa tête, un carré de `arme.taille` pixels ; ses lettres suivent derrière, à la longueur du mot dessiné (3,3 pixels par lettre). Un tract du héros qui touche n'importe quelle lettre abat le mot entier. Un mot qui naît sur le héros, collé à la bouche, le traverse sans le blesser. Les mots du héros, eux, touchent sur toute leur longueur, vers le haut aussi : le mot s'y écrit à la verticale. Tiré vers le haut, un projectile part juste au-dessus du crâne, comme devant soi il part juste devant le corps, et son dessin pointe vers où il va. Les unités à mots ont `arme.visee: 0.4` : on les voit venir.

Un mot part de la vitesse de l'arme, pas de celle du tireur : plus lent que la marche du héros, il lui reste collé dessus. Les héros à mots tirent à 250 pour une marche autour de 145.

Plus la manif est nombreuse, plus les projectiles du héros font de dégâts.

### Arme : `arme.type: jet`

Réservée aux unités. Un jet continu qui repousse le héros et le cortège, sans blesser. Il s'arrête au premier mur, ou sur une ligne qui tient.

| Réglage | Effet | Bornes | Défaut |
|---|---|---|---|
| `arme.duree` | secondes de jet | 0,3 à 6 | 1,5 |
| `arme.pause` | secondes entre deux jets | 0,5 à 10 | 3 |
| `arme.portee` | longueur du jet, en pixels | 32 à 320 | 140 |
| `arme.poussee` | vitesse de recul imposée, en pixels par seconde | 20 à 600 | 220 |
| `arme.son` | un bruitage de `content/sons/` | | `jet` |

Modèle : [`canon-a-eau`](../content/ennemis/canon-a-eau.txt).

### Spéciales des héros : `speciale.type`

Toutes acceptent aussi `speciale.nom` (le cri affiché), `speciale.charges` (0 à 9, défaut 3) et `speciale.son`.

| Type | Effet | Réglages (bornes, défaut) |
|---|---|---|
| `onde` | onde circulaire qui repousse, étourdit et fissure le décor | `rayon` (16 à 160, 72), `degats` (0 à 10, 2), `terrain` (0 à 10, 2), `recul` (0 à 400, 220), `etourdit` en secondes (0 à 6, 2) |
| `sol` | onde qui court le long du sol, des deux côtés | `vitesse` (60 à 420, 240), `portee` (32 à 480, 220), `degats` (0 à 10, 3), `terrain` (0 à 10, 3) |
| `clones` | des doubles apparaissent et tirent avec le héros | `nombre` (1 à 4, 2), `duree` en secondes (1 à 12, 6) |
| `billes` | des billes roulent devant soi et restent au sol (dessin `bille`) : qui marche dessus glisse, sonné, et file sur sa lancée ; ni ce qui vole, ni une ligne, ni un véhicule | `nombre` (1 à 8, 5), `vitesse` (20 à 240, 120), `duree` en secondes au sol (1 à 12, 5), `glisse` en secondes (0,5 à 6, 2), `recul` (0 à 400, 160), `degats` (0 à 10, 0) |
| `mur` | fait pousser une colonne de tuiles devant soi | `hauteur` (1 à 5, 3), `distance` (1 à 3, 1), `tuile` (un fichier de `content/tuiles/`) |

### Attaques de boss

Les réglages s'écrivent au nom de l'attaque : `salve.nombre: 5`. Un boss assis n'emploie que les attaques à distance : `salve`, `invocation`, `pluie`.

| Attaque | Effet | Réglages (bornes, défaut) |
|---|---|---|
| `salve` | rafale visant le héros | `nombre` (1 à 12, 3), `vitesse` (40 à 300, 140), `degats` (0 à 3, 1), `ecart` (0 à 1, 0,25) |
| `charge` | fonce à travers l'arène | `vitesse` (60 à 400, 200), `degats` (0 à 3, 1) |
| `invocation` | appelle des renforts | `nombre` (1 à 4, 2), `ennemi` (un fichier de `content/ennemis/`) |
| `pluie` | fait tomber des projectiles du ciel | `nombre` (1 à 12, 5), `vitesse` (40 à 300, 120), `degats` (0 à 3, 1) |

Il vous faut un comportement qui n'existe pas ? C'est une [nouvelle mécanique](ajouter-une-mecanique.md).
