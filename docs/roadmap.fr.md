# Roadmap CRC Boost Market

Version anglaise : [`roadmap.md`](roadmap.md).

Cette roadmap regroupe les fonctionnalités liées au graphe de confiance Circles que l'on veut garder après la première version livrée. L'objectif est de rendre CRC Boost Market beaucoup plus natif à Circles : les frais, la visibilité des campagnes, les referrals et les rapports doivent utiliser les données de confiance Circles, au lieu de traiter le CRC comme un simple moyen de paiement.

## Intégration Du Trust Score

CRC Boost Market doit utiliser l'API Circles Relative Trust Score comme une vraie brique produit.

Endpoints utiles :

- `POST /scoring/relative_trustscore` : score une ou plusieurs adresses wallet/avatar contre le target set par défaut `all_backers`.
- `POST /scoring/global_relative_trustscore` : récupère des scores globaux paginés.
- Les endpoints bot analytics peuvent être utiles plus tard comme signal de modération séparé, mais ils ne font pas partie du premier lot de fonctionnalités trust score.

Le score doit être mis en cache dans notre base de données par wallet, avec une date de refresh, pour éviter que l'UI et les calculs de fees dépendent d'un appel externe en live à chaque action.

## Fonctionnalités Que L'on Garde

### 1. Fees Créateur Dynamiques Selon Le Trust Score

Les fees de création de campagne doivent être calibrées selon le trust score Circles du créateur.

Le framing produit doit rester positif : les profils Circles les plus fiables obtiennent des fees plus basses parce que le marché a plus confiance en eux.

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

- `Trusted creator` pour les scores élevés
- `Established profile` pour les scores moyens
- `New Circles profile` pour les profils sans score ou avec faible score

Il faut éviter que le badge soit punitif. L'UI doit communiquer une réputation, pas humilier les nouveaux profils.

### 5. Bonus Referral Configurable Selon La Qualité Du Wallet Invité

On garde le système de referral, mais on rend le bonus configurable selon le trust score ou la qualité du wallet invité.

Idée actuelle de milestones :

- Wallet invité complète 1 mission vérifiée : `+0.2 CRC`
- Wallet invité complète 3 missions vérifiées : `+0.5 CRC`
- Wallet invité complète 5 missions vérifiées : `+1 CRC`

Version configurable future :

- Wallet invité high-trust : bonus referral complet
- Wallet invité medium-trust : bonus standard
- Wallet nouveau ou low-trust : bonus retardé, bonus réduit, ou bonus débloqué après plus de missions complétées

Ça récompense les gens qui ramènent de vrais utilisateurs Circles, pas seulement des inscriptions brutes.

## Fonctionnalités Que L'on Ne Garde Pas

### Restrictions Hard Anti-Farm Sur Les Claims

Ne pas ajouter de logique dure du type :

- low trust = max 1 claim par jour
- high trust = accès illimité

Ça peut être hostile pour les nouveaux users et rendre l'app moins ouverte. Le trust score doit d'abord influencer l'économie, la visibilité, le settlement et le reporting, pas bloquer la participation.

## Idées Qui Demandent Plus D'explications

### 6. Campaign Quality Report

Un Campaign Quality Report est un résumé côté créateur qui répond à une question simple :

`Est-ce que cette campagne a attiré de vrais utilisateurs Circles fiables ?`

Il doit être affiché sur chaque campagne créateur après les premiers claims.

Metrics utiles :

- Total des claims vérifiés
- Total CRC payé
- Trust score moyen des claimants
- Trust score médian des claimants
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

### 7. Intelligent Fee Split

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

### Phase 1 : Read Model Trust Score

- Ajouter un helper backend pour appeler l'API Relative Trust Score.
- Mettre en cache le trust score par wallet dans la DB.
- Ajouter des timestamps de refresh.
- Afficher le trust score et le badge trust dans Profile et Leaderboard.

### Phase 2 : Fees Créateur Et Règles De Settlement

- Ajouter les tiers de fees selon trust score dans les settings.
- Appliquer la fee dynamique à la création de campagne.
- Afficher l'explication de la fee dans la preview de paiement créateur.
- Ajouter une durée de settlement par campagne selon le créateur.

### Phase 3 : Ranking Et Reports De Campagne

- Trier les boosts live en utilisant le trust score créateur comme signal.
- Ajouter le Campaign Quality Report dans le creator dashboard.
- Tracker les stats agrégées de trust des claimants par campagne.

### Phase 4 : Referral Et Fee Split Configurables

- Ajouter des tiers de bonus referral selon la qualité du wallet invité.
- Ajouter la configuration de fee split.
- Afficher l'allocation de la fee dans la preview de paiement créateur.

## Positionnement Produit

Message central :

`CRC Boost Market utilise le graphe de confiance Circles pour scorer, ranker et reporter les marchés d'attention.`

Ça améliore le narratif hackathon :

- Le CRC est le rail de paiement et de payout.
- Les profils Circles sont la couche d'identité.
- Le trust score Circles devient la couche de réputation.
- L'app devient un marché d'attention aware du trust graph, pas un outil générique d'engagement X avec du CRC collé dessus.
