# Roadmap CRC Boost Market

Version anglaise : [`roadmap.md`](roadmap.md).

Cette roadmap regroupe les fonctionnalités liées au graphe de confiance Circles que l'on veut garder après la première version livrée. L'objectif est de rendre CRC Boost Market beaucoup plus natif à Circles : les frais, la visibilité des campagnes, les referrals et les rapports doivent utiliser les données de confiance Circles, au lieu de traiter le CRC comme un simple moyen de paiement.

Le produit doit combiner deux signaux de réputation natifs à Circles :

- `Trust score` : un score continu, utile pour les fees, le ranking et les rapports de qualité.
- `Backer status` : une catégorie simple, utile pour les badges, la confiance créateur et la segmentation des campagnes.

## Process De Travail

On avance dans cette roadmap par petites briques produit, une par une.

Légende des statuts :

- `À faire` : sélectionné dans la roadmap, pas encore commencé.
- `En cours` : en train d'être implémenté ou investigué.
- `À tester` : construit, mais pas encore validé dans l'app.
- `Validé` : testé et accepté.
- `Mis de côté` : bonne idée, mais volontairement repoussée.

Chaque brique doit suivre le même process :

1. Définir le résultat produit exact.
2. Confirmer la source de données et les changements DB.
3. Construire la plus petite version utile côté UI/API.
4. Tester en local et en prod si nécessaire.
5. Marquer la ligne de roadmap comme `Validé` avec une courte note.

Règle importante : on ne doit pas implémenter toute la roadmap d'un traite. Chaque point doit avoir son étape de clarification, son étape d'implémentation, son étape de test, puis une décision de validation avant de passer au point suivant.

Pour chaque brique, garder un mini journal de décision :

- Ce qu'on a décidé
- Ce qui reste flou
- Ce qui a été implémenté
- Ce qui a été testé
- Statut final : `À faire`, `En cours`, `À tester`, `Validé`, ou `Mis de côté`

## Suivi D'avancement

Prochaine étape actuelle : `3. Validation des fees créateur dynamiques`.

| # | Brique | Statut | Critère de validation |
|---|---|---|---|
| 1 | Read model trust et backer data | Validé | L'app trouve la source du trust score et la source direct/indirect/sans backer, cache les deux par wallet, et les affiche dans une surface simple interne/debug. |
| 2 | Badges publics profil | À tester | Le profil, le leaderboard et les zones créateur affichent les badges trust/backer sans punir visuellement les nouveaux users. |
| 3 | Fees créateur dynamiques | À tester | La fee de création change selon le trust score et le backer status du créateur. |
| 4 | Preview paiement créateur | À tester | Le créateur voit reward pool, fee NF Society, raison du discount/premium, et total à payer avant paiement. |
| 5 | Règles de settlement | À faire | La durée de settlement est stockée et affichée selon le tier qualité du créateur. |
| 6 | Ranking des campagnes | À faire | Les boosts live utilisent le trust/backer du créateur comme un facteur de ranking. |
| 7 | Tiers de qualité referral | À faire | Les rewards referral peuvent varier selon la qualité du wallet invité tout en gardant les milestones actuels. |
| 8 | Campaign quality report | À faire | Le creator dashboard explique la qualité des claimants, le succès settlement, les CRC dépensés et les X reads utilisés. |
| 9 | Intelligent fee split | À faire | L'allocation de fee est configurable et visible dans la preview paiement créateur. |
| 10 | Page réputation créateur | À faire | Un créateur peut montrer campagnes financées, CRC payés, stats qualité et trust/backer status. |
| 11 | Dashboard santé du marché | À faire | Le market status inclut la distribution trust/backer, pas seulement les claims et payouts bruts. |
| 12 | Missions conversion backer | Mis de côté | À reprendre seulement quand les données trust/backer sont fiables et que le core market est stable. |

Journal de décision pour la brique 1 :

- Décidé : utiliser les tables indexées du RPC Circles pour le trust score et le backer status.
- Décidé : `direct` passe avant `indirect`; `none` veut seulement dire ni direct ni indirect.
- Implémenté : cache DB, endpoint de refresh, et carte debug dans le profil avec refresh manuel.
- Testé : la branche Neon production contient `garage_trust_profiles`; le refresh wallet stocke le trust `78`, le niveau `HIGH`, le statut direct backer, et mutual trust `108`.
- Statut final : `Validé`.

Journal de décision pour les briques 2, 3 et 4 :

- Décidé : les badges publics utilisent seulement le profil trust en cache ; le leaderboard ne doit pas appeler Circles en live pour chaque ligne.
- Décidé : les fees créateur sont progressives sur deux axes : direct/indirect/sans backer d'abord, puis trust score high/medium/low dans chaque statut.
- Implémenté : badges trust/backer compacts dans le profil et le leaderboard.
- Implémenté : matrice de fee commune frontend/backend : direct high `1%`, direct medium `1.25%`, direct low `1.5%`, indirect high `1.75%`, indirect medium `2%`, indirect low `2.25%`, sans backer high `2.5%`, sans backer medium `2.75%`, sans backer low `3%`.
- Implémenté : la preview paiement créateur affiche la fee NF Society calculée, le tier, la raison, la reward pool et le total à payer.
- À tester : créer une campagne avec le wallet direct/high actuel et confirmer que preview/paiement utilisent `1%` de fee.
- Statut actuel : `À tester`.

## Intégration Du Trust Score

CRC Boost Market doit utiliser les données indexées du trust score Circles comme une vraie brique produit.

Endpoints utiles :

- `POST /scoring/relative_trustscore` avec `target_set_name: all_backers` : lire le score qui correspond à l'affichage de l'app Circles.
- `circles_query` sur `V_TrustScores.Current` : lire le trust level, la confidence et les compteurs de graphe d'un wallet.
- `circles_query` sur `CrcV2.CirclesBackingCompleted` : détecter les direct backers.
- `circles_query` sur `V_CrcV2.TrustRelations` : détecter les trusters entrants, puis vérifier lesquels sont direct backers pour déduire le statut indirect backer.
- Les endpoints advanced analytics externes peuvent être utiles plus tard comme signal de modération séparé, mais ils ne font pas partie du premier read model trust/backer livré.

Le score doit être mis en cache dans notre base de données par wallet, avec une date de refresh, pour éviter que l'UI et les calculs de fees dépendent d'un appel externe en live à chaque action.

## Couche Backer Status

Circles distingue aussi les direct backers, les indirect backers, et les utilisateurs qui ne sont dans aucune des deux catégories pour le moment.

Interprétation produit :

- `Direct backer` : signal de confiance le plus fort pour un créateur ou un utilisateur.
- `Indirect backer` : vrai signal du graphe Circles, mais un niveau moins fort que le direct backing.
- `Pas de backer status` : profil nouveau ou moins établi, toujours autorisé à participer.

Ce signal ne doit pas remplacer le trust score. Il doit être affiché à côté :

`Trust score = la force numérique du profil.`

`Backer status = la position du profil dans le graphe Circles.`

L'app doit mettre le backer status en cache par wallet avec le même modèle de refresh que les trust scores.

## Fonctionnalités Que L'on Garde

### 1. Fees Créateur Dynamiques Selon Le Trust Score

Les fees de création de campagne doivent être calibrées selon le trust score Circles du créateur.

Le framing produit doit rester positif : les profils Circles les plus fiables obtiennent des fees plus basses parce que le marché a plus confiance en eux.

Le backer status doit ajuster la fee calculée par trust score, pas la remplacer :

- Direct backer : meilleure fee disponible pour le tier du créateur, ou petit discount supplémentaire.
- Indirect backer : fee normale du tier du créateur.
- Pas de backer status : fee normale, ou petite prime de risque si le trust score est aussi faible.

Premiers tiers proposés :

- `80-100 trust` : `1%` de fee NF Society
- `50-79 trust` : `2.5%` de fee NF Society
- `20-49 trust` : `4%` de fee NF Society
- `0-19 trust` : `6%` de fee NF Society
- `pas de score / nouveau profil` : `4%` par défaut jusqu'à avoir un score exploitable

Le flow créateur doit afficher :

- Trust score du créateur
- Tier de fee
- Reward pool
- Fee NF Society
- Total CRC à payer

Ça rend la création de campagne liée au graphe Circles, au lieu de ressembler à une fee SaaS classique.

### 2. Temps De Settlement Selon Le Trust Score

Le délai de settlement peut aussi dépendre du trust score.

Premiers tiers proposés :

- `80-100 trust` : settlement de 2 minutes
- `50-79 trust` : settlement de 5 minutes
- `20-49 trust` : settlement de 10 minutes
- `0-19 trust / pas de score` : settlement de 15 minutes

On peut d'abord l'appliquer au créateur de la campagne, puis éventuellement aux claimants plus tard. La version la plus simple et la plus safe : les campagnes créées par des profils à haut trust score settlent plus vite pour tout le monde.

Le wording UX doit rester simple :

`Créateur trusted : settlement CRC plus rapide.`

### 3. Boost De Visibilité Des Campagnes

Les campagnes créées par des profils Circles avec un meilleur trust score doivent remonter plus haut dans la liste des boosts.

Facteurs de ranking proposés :

- Campagne live
- Rewards restants
- Trust score du créateur
- Activité récente
- Date de création de la campagne

Ça donne un bénéfice visible au trust score sans bloquer les nouveaux utilisateurs.

### 4. Badges Publics De Trust

Afficher des badges de trust aux endroits où les users évaluent naturellement les profils :

- Creator dashboard
- Zone créateur sur la campaign card
- Leaderboard
- Profil personnel
- Zone referral

Labels proposés :

- `Direct Backer`
- `Indirect Backer`
- `Trusted creator` pour les scores élevés
- `Established profile` pour les scores moyens
- `New Circles profile` pour les profils sans score ou avec faible score

Il faut éviter que le badge soit punitif. L'UI doit communiquer une réputation, pas humilier les nouveaux profils.

Direction UI idéale :

`Direct Backer · Trust 78`

`Indirect Backer · Trust 62`

`New Circles Profile`

### 5. Bonus Referral Configurable Selon La Qualité Du Wallet Invité

On garde le système de referral, mais on rend le bonus configurable selon le trust score ou la qualité du wallet invité.

Idée actuelle de milestones :

- Wallet invité complète 1 mission vérifiée : `+0.2 CRC`
- Wallet invité complète 3 missions vérifiées : `+0.5 CRC`
- Wallet invité complète 5 missions vérifiées : `+1 CRC`

Version configurable future :

- Wallet invité high-trust : bonus referral complet
- Wallet invité medium-trust : bonus standard
- Wallet invité direct ou indirect backer : meilleur signal de qualité referral
- Wallet nouveau ou low-trust : bonus retardé, bonus réduit, ou bonus débloqué après plus de missions complétées

Ça récompense les gens qui ramènent de vrais utilisateurs Circles, pas seulement des inscriptions brutes.

### 6. Segmentation Des Campagnes Par Qualité Du Graphe Circles

Les créateurs doivent pouvoir comprendre qui ils touchent sans transformer l'app en whitelist fermée.

Modes possibles :

- `Open market` : tout le monde peut claim si l'action vérifiée est complétée.
- `Trusted reach` : la campagne est mieux rankée et recommandée aux profils Circles établis.
- `Backer reach` : les analytics de campagne mettent en avant la participation des direct et indirect backers.

La première implémentation ne doit pas bloquer les claims selon le backer status. Il faut d'abord utiliser ce signal pour l'affichage, le ranking et le reporting.

### 7. Page Réputation Créateur

Chaque créateur doit avoir un résumé de réputation léger.

Signaux utiles :

- Campagnes financées
- CRC payés
- Trust score moyen des claimants
- Répartition direct / indirect / sans status des claimants
- Taux de succès du settlement
- Qualité des referrals générés
- Trust score et backer status du créateur

Ça aide les créateurs à construire leur crédibilité dans le temps et donne aux juges une surface plus "vrai produit".

### 8. Missions De Conversion Backer

CRC Boost Market peut lancer des missions spéciales qui aident les utilisateurs à rentrer plus profondément dans le graphe Circles, au lieu de pousser uniquement de l'engagement X.

Exemples :

- Follow ou repost d'un post éducatif sur le backing Circles.
- Mission qui explique la différence entre direct et indirect backing.
- Reward pour les utilisateurs qui deviennent de meilleurs participants Circles avec le temps.

C'est une feature plus tardive parce qu'il faut un wording propre et une donnée fiable, mais ça rend l'app beaucoup plus native à Circles.

### 9. Dashboard Santé Du Marché

Le dashboard admin/market doit à terme montrer la qualité du marché, pas seulement l'usage brut.

Metrics utiles :

- Total claims
- CRC payés
- X reads utilisés
- Trust score moyen des claimants
- Répartition wallets direct / indirect / sans status
- Trust score moyen des créateurs
- Part des payouts envoyés à des direct ou indirect backers
- Coût par action vérifiée et settlée

C'est utile pour NF Society, les créateurs de campagne et les juges du hackathon.

## Fonctionnalités Que L'on Ne Garde Pas

### Restrictions Hard Anti-Farm Sur Les Claims

Ne pas ajouter de logique dure du type :

- low trust = max 1 claim par jour
- high trust = accès illimité

Ça peut être hostile pour les nouveaux users et rendre l'app moins ouverte. Le trust score doit d'abord influencer l'économie, la visibilité, le settlement et le reporting, pas bloquer la participation.

## Idées Qui Demandent Plus D'explications

### 10. Campaign Quality Report

Un Campaign Quality Report est un résumé côté créateur qui répond à une question simple :

`Est-ce que cette campagne a attiré de vrais utilisateurs Circles fiables ?`

Il doit être affiché sur chaque campagne créateur après les premiers claims.

Metrics utiles :

- Total des claims vérifiés
- Total CRC payé
- Trust score moyen des claimants
- Trust score médian des claimants
- Répartition direct / indirect / sans status des claimants
- Répartition high / medium / low / new profile
- Taux de succès du settlement
- Nombre d'actions retirées avant payout
- X API reads utilisés
- Coût par claim vérifié
- Coût par payout finalisé

Pourquoi c'est important :

- Les créateurs voient si leur CRC attire une attention de qualité.
- Les juges comprennent la valeur de l'app en quelques secondes.
- NF Society peut présenter l'app comme un vrai marché, pas juste un bouton claim.

Exemple de wording :

`Ce boost a payé 32 wallets. Trust moyen des claimants : 67/100. 81% des actions ont survécu au settlement.`

C'est plus fort que seulement afficher `claims` et `spent`, parce que ça explique la qualité de la demande générée.

### 11. Intelligent Fee Split

La fee NF Society devrait à terme être divisée en plusieurs buckets configurables, au lieu d'être une fee opaque unique.

Buckets possibles :

- Trésorerie NF Society
- Reward pool referral
- Réserve pour les réductions créateur basées sur le trust
- Réserve qualité / settlement des campagnes
- Récompenses futures pour les contributeurs

Exemple :

Pour une fee de campagne de `2.5%` :

- `1.5%` vers la trésorerie NF Society
- `0.5%` vers les rewards referral
- `0.3%` vers la réserve de discounts trust
- `0.2%` vers la réserve qualité campagne

Pourquoi c'est important :

- Le produit peut expliquer à quoi servent les fees.
- Les créateurs low-trust peuvent payer une fee de risque plus élevée sans que ça semble arbitraire.
- Les créateurs high-trust peuvent recevoir des discounts financés par le marché lui-même.
- Les rewards referral deviennent soutenables au lieu d'être financées manuellement.

Wording UX transparent :

`La fee NF Society finance la DAO, les referrals et les incentives trust-based du marché.`

## Ordre D'implémentation

### Phase 1 : Read Model Trust Et Backer Data

- Ajouter un helper backend pour appeler l'API Relative Trust Score.
- Mettre en cache le trust score par wallet dans la DB.
- Trouver et confirmer une source fiable pour le statut direct / indirect / sans backer.
- Ajouter le fetch/cache du backer status.
- Ajouter des timestamps de refresh pour les deux signaux.
- Afficher le trust score, le backer status et le badge trust dans Profile et Leaderboard.

### Phase 2 : Fees Créateur Et Règles De Settlement

- Ajouter les tiers de fees selon trust score dans les settings.
- Ajouter les ajustements de fees selon le backer status.
- Appliquer la fee dynamique à la création de campagne.
- Afficher l'explication de la fee dans la preview de paiement créateur.
- Ajouter une durée de settlement par campagne selon le créateur.

### Phase 3 : Ranking Et Reports De Campagne

- Trier les boosts live en utilisant le trust score créateur comme signal.
- Ajouter le backer status du créateur comme signal de ranking/reporting.
- Ajouter le Campaign Quality Report dans le creator dashboard.
- Tracker les stats agrégées de trust des claimants par campagne.
- Tracker la répartition direct / indirect / sans status des claimants.

### Phase 4 : Referral Et Fee Split Configurables

- Ajouter des tiers de bonus referral selon la qualité du wallet invité.
- Inclure le backer status du wallet invité dans la qualité referral.
- Ajouter la configuration de fee split.
- Afficher l'allocation de la fee dans la preview de paiement créateur.

### Phase 5 : Réputation Et Santé Du Marché

- Ajouter les pages réputation créateur.
- Ajouter les metrics de santé du marché.
- Ajouter les labels optionnels de segmentation de campagne.
- Explorer les missions de conversion backer quand le modèle de données est stable.

## Positionnement Produit

Message central :

`CRC Boost Market utilise le graphe de confiance Circles pour scorer, ranker et reporter les marchés d'attention.`

Ça améliore le narratif hackathon :

- Le CRC est le rail de paiement et de payout.
- Les profils Circles sont la couche d'identité.
- Le trust score Circles devient la couche de réputation.
- Le direct et indirect backing deviennent la couche de qualité du graphe.
- L'app devient un marché d'attention aware du trust graph, pas un outil générique d'engagement X avec du CRC collé dessus.
