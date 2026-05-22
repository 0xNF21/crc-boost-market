# CRC Boost Market Roadmap

French version: [`roadmap.fr.md`](roadmap.fr.md).

This roadmap captures the Circles trust graph features we want to keep after the first shipped version. The goal is to make CRC Boost Market more Circles-native: campaign economics, visibility, referrals, and reporting should use Circles trust data instead of treating CRC as a simple payment token.

The product should combine two Circles-native reputation signals:

- `Trust score`: a continuous reputation score, useful for pricing, ranking, and quality reporting.
- `Backer status`: a simple identity category, useful for badges, creator confidence, and campaign segmentation.

## Working Process

We will move through this roadmap one small product slice at a time.

Status legend:

- `Todo`: selected for the roadmap, not started yet.
- `In progress`: being implemented or investigated now.
- `To test`: built, but not validated in the app yet.
- `Validated`: tested and accepted.
- `Parked`: useful idea, but intentionally delayed.

Every slice should follow the same process:

1. Define the exact product outcome.
2. Confirm the data source and database changes.
3. Build the smallest useful UI/API version.
4. Test on local and production if needed.
5. Mark the roadmap line as `Validated` with a short note.

Important rule: do not implement the full roadmap in one pass. Each slice must have its own clarification step, implementation step, test step, and validation decision before moving to the next slice.

For every slice, keep a short decision log:

- What we decided
- What remains unclear
- What was implemented
- What was tested
- Final status: `Todo`, `In progress`, `To test`, `Validated`, or `Parked`

## Progress Tracker

Current next step: `10. Creator reputation page validation`.

| # | Slice | Status | Validation criteria |
|---|---|---|---|
| 1 | Trust and backer data read model | Validated | App finds the trust score source and the direct/indirect/no-backer source, caches both per wallet, and shows them in a simple internal/debug surface. |
| 2 | Public profile badges | Validated | Profile, leaderboard, and creator areas show trust/backer badges without making new users feel punished. |
| 3 | Dynamic creator fees | Validated | Campaign creation fee changes according to creator trust score and backer status. |
| 4 | Creator payment preview | Validated | Creator sees reward pool, NF Society fee, discount/premium reason, and total due before paying. |
| 5 | Settlement duration rules | Validated | Claim settlement duration is set per claimant based on the wallet trust score and backer status. |
| 6 | Campaign ranking | To test | Live boosts use creator trust/backer signals as one ranking factor. |
| 7 | Referral quality tiers | To test | Referral rewards can vary by invited wallet quality while keeping the current milestones. |
| 8 | Campaign quality report | To test | Creator dashboard explains claimant quality, settlement success, CRC spent, and X reads used. |
| 9 | Intelligent fee split | Todo | Fee allocation is configurable and visible in the creator payment preview. |
| 10 | Creator reputation page | To test | A creator can show campaigns funded, CRC paid, quality stats, and trust/backer status. |
| 11 | Market health dashboard | Todo | Market status includes trust/backer distribution, not only raw claims and payouts. |
| 12 | Backer conversion missions | Parked | Only revisit once trust/backer data is reliable and the core market is stable. |

Decision log for slice 1:

- Decided: use Circles RPC indexed tables for both trust score and backer status.
- Decided: `direct` wins over `indirect`; `none` only means neither direct nor indirect.
- Implemented: DB cache, refresh endpoint, and profile debug card with manual refresh.
- Tested: production Neon branch contains `garage_trust_profiles`; wallet refresh stores trust `78`, level `HIGH`, direct backer status, and mutual trust `108`.
- Final status: `Validated`.

Decision log for slices 2, 3, and 4:

- Decided: public badges use the cached trust profile only; the leaderboard must not call Circles live for every row.
- Decided: creator fees are progressive by two axes: direct/indirect/no-backer first, then high/medium/low trust score inside each status.
- Implemented: compact trust/backer badges on profile and leaderboard surfaces.
- Implemented: fee matrix in shared frontend/backend code: direct high `1%`, direct medium `1.25%`, direct low `1.5%`, indirect high `1.75%`, indirect medium `2%`, indirect low `2.25%`, no-backer high `2.5%`, no-backer medium `2.75%`, no-backer low `3%`.
- Implemented: creator payment preview shows the computed NF Society fee, tier label, reason, reward pool, and total due.
- Tested: current direct/high wallet showed `1%` in the creator preview; a 10 CRC reward pool created a draft with `0.1 CRC` NF Society fee and `10.1 CRC` total due.
- Final status: `Validated`.

Decision log for slice 5:

- Decided: settlement duration belongs to the claimant, not the creator, because the risk is whether the claimant removes the X action before payout.
- Implemented: shared claimant settlement matrix: direct high `2 min`, direct medium `3 min`, direct low `4 min`, indirect high `5 min`, indirect medium `6 min`, indirect low `7 min`, no-backer high `8 min`, no-backer medium `9 min`, no-backer low `10 min`.
- Implemented: verification endpoint sets each claim's `payoutAvailableAt` from the claiming wallet trust/backer profile.
- Implemented: boost UI shows the current user's settlement window, while creator preview says settlement is user-based.
- Validated product decision: keep the claimant settlement grid as direct `2/3/4 min`, indirect `5/6/7 min`, and no-backer `8/9/10 min`.
- Tested: a direct/high wallet claim showed `2 min for you`, opened a settlement countdown, and kept payout locked until the re-check.
- Final status: `Validated`.

Decision log for slice 6:

- Decided: live boosts should not be ordered only by creation date.
- Implemented: campaign ranking combines active status, reward per action, open slots, freshness, and cached creator trust/backer status.
- Implemented: boost cards show compact ranking reasons such as `Direct creator`, `High trust creator`, `Good reward`, `Open slots`, or `Fresh boost`.
- To test: compare several live campaigns in production and confirm the ordering and ranking reasons feel understandable.
- Current status: `To test`.

Decision log for slice 7:

- Decided: keep the `1 / 3 / 5 mission` milestones, then apply a quality multiplier based on the invited wallet.
- Implemented: multiplier grid by backer status and trust score: direct `1.5x / 1.3x / 1.15x`, indirect `1.25x / 1.1x / 1x`, no-backer `1x / 0.85x / 0.7x`.
- Implemented: referral payouts store base amount, quality multiplier, final amount, invited wallet trust score, trust level, and backer status.
- Implemented: profile referral area includes an info bubble with the multiplier grid and minimum payout.
- Updated: referral milestones now create claimable balance instead of automatic micro-payouts; referrers can claim grouped CRC when they choose.
- Implemented: profile referral area includes an invited-wallet tracking drawer with missions, CRC state, multiplier, trust score, and backer status per referral.
- Migration: `0002_referral_quality_multiplier` applied to Neon.
- To test: invite a wallet, complete referral milestones, confirm the claimable balance uses the invited wallet multiplier, then claim the grouped payout.
- Current status: `To test`.

Decision log for slice 8:

- Decided: ship the report as an aggregate creator-dashboard surface first, without per-user claimant details.
- Implemented: each creator campaign now receives a quality report with verified claims, CRC paid/pending, X reads, settlement success, removed actions, average/median claimant trust, trust coverage, trust bands, and direct/indirect/no-link/unknown backer split.
- Implemented: campaign cards in `My boosts` include a collapsible `Campaign quality report` section that opens by default once claims exist.
- To test: run several claims on a creator campaign and confirm the report matches Neon data and feels understandable.
- Current status: `To test`.

Decision log for slice 10:

- Decided: creator reputation should be a public shareable page, linked from the Creator dashboard.
- Implemented: `/garage/creator/[id]` accepts a Circles profile slug or wallet address.
- Implemented: the page shows creator Circles identity, X account when linked, trust/backer status, campaigns funded, CRC paid/pending, wallets reached, settlement success, claimant trust quality, backer split, and campaign history.
- Implemented: Creator dashboard includes a `View creator profile` link that uses the Circles name when available, otherwise the wallet address.
- To test: open the creator page from production, verify `cryptosnf` resolution, and compare totals against creator dashboard data.
- Current status: `To test`.

## Trust Score Integration

CRC Boost Market should use the Circles trust score indexed data as a product primitive.

Useful endpoints:

- `POST /scoring/relative_trustscore` with `target_set_name: all_backers`: read the score that matches the Circles app display.
- `circles_query` on `V_TrustScores.Current`: read trust level, confidence, and graph counts for a wallet.
- `circles_query` on `CrcV2.CirclesBackingCompleted`: detect direct backers.
- `circles_query` on `V_CrcV2.TrustRelations`: detect incoming trusters, then check which of those trusters are direct backers to infer indirect backer status.
- The external advanced analytics endpoints may be useful later for separate moderation signals, but they are not part of the first shipped trust/backer read model.

The score should be cached in our database per wallet, with a refresh timestamp, so the UI and fee calculations do not depend on a live external request every time.

## Backer Status Layer

Circles also distinguishes between direct backers, indirect backers, and users who are not in either category yet.

Product interpretation:

- `Direct backer`: strongest creator/user confidence signal.
- `Indirect backer`: meaningful Circles graph signal, but one step less strong than direct backing.
- `No backer status`: new or less-established profile, still allowed to participate.

This should not replace trust score. It should sit next to it:

`Trust score = how strong the profile is numerically.`

`Backer status = what kind of Circles graph position the profile has.`

The app should cache backer status per wallet with the same refresh model as trust scores.

## Features We Keep

### 1. Dynamic Creator Fees By Trust Score

Creator campaign fees should be calibrated by the creator's Circles trust score.

The product framing should be positive: trusted Circles profiles get lower creator fees because the market has more confidence in them.

Backer status should adjust the trust-score fee instead of replacing it:

- Direct backer: best available fee for the creator's trust tier, or a small extra discount.
- Indirect backer: normal fee for the creator's trust tier.
- No backer status: normal fee, or a small risk premium if the trust score is also low.

Proposed first fee tiers:

- `80-100 trust`: `1%` NF Society fee
- `50-79 trust`: `2.5%` NF Society fee
- `20-49 trust`: `4%` NF Society fee
- `0-19 trust`: `6%` NF Society fee
- `no score / new profile`: `4%` default fee until the profile has a usable score

The creator flow should show:

- Creator trust score
- Fee tier
- Reward pool
- NF Society fee
- Total CRC due

This makes campaign creation feel tied to the Circles graph, not like a normal flat SaaS fee.

### 2. Settlement Time By Trust Score

Settlement delay should depend on the user who claims, not the campaign creator.

Proposed first tiers:

- Direct backer + high trust: 2 minute settlement
- Direct backer + medium trust: 3 minute settlement
- Direct backer + low trust: 4 minute settlement
- Indirect backer + high trust: 5 minute settlement
- Indirect backer + medium trust: 6 minute settlement
- Indirect backer + low trust: 7 minute settlement
- No backer + high trust: 8 minute settlement
- No backer + medium trust: 9 minute settlement
- No backer + low trust: 10 minute settlement

The first implementation is claimant-based: once a user verifies an X action, their own cached Circles trust profile determines the re-check window before CRC payout.

UX copy should stay simple:

`Your settlement window is based on your Circles trust/backer status.`

### 3. Campaign Visibility Boost

Campaigns created by higher-trust Circles profiles should rank higher in the Boosts list.

Suggested ranking factors:

- Live campaign status
- Remaining rewards
- Creator trust score
- Recent activity
- Campaign creation time

This gives trust score an immediate visible benefit without blocking anyone.

### 4. Public Trust Badges

Show trust badges in the app where users naturally evaluate people:

- Creator dashboard
- Campaign card creator area
- Leaderboard rows
- Personal profile
- Referral area

Suggested labels:

- `Direct Backer`
- `Indirect Backer`
- `Trusted creator` for high trust scores
- `Established profile` for medium trust scores
- `New Circles profile` for no score or low score

Avoid making the badge feel punitive. The UI should communicate reputation, not shame.

Best UI direction:

`Direct Backer · Trust 78`

`Indirect Backer · Trust 62`

`New Circles Profile`

### 5. Configurable Referral Bonus By Invited Wallet Quality

Keep the referral system, but make the bonus configurable based on the invited wallet's trust score or quality tier.

Current milestone idea remains:

- Invited wallet completes 1 verified mission: `+0.2 CRC`
- Invited wallet completes 3 verified missions: `+0.5 CRC`
- Invited wallet completes 5 verified missions: `+1 CRC`

Future configurable version:

- High-trust invited wallet: full referral bonus
- Medium-trust invited wallet: standard bonus
- Direct or indirect backer: stronger referral quality signal
- New or low-trust invited wallet: delayed bonus, smaller bonus, or bonus unlocked after more completed missions

This rewards people for bringing real Circles users instead of only driving raw signups.

### 6. Campaign Segmentation By Circles Graph Quality

Creators should eventually understand who they are trying to reach without turning the app into a closed whitelist.

Possible campaign modes:

- `Open market`: everyone can claim if they complete the verified action.
- `Trusted reach`: campaign is ranked and recommended more strongly to established Circles profiles.
- `Backer reach`: campaign analytics highlight direct and indirect backer participation.

The first implementation should not block claims by backer status. It should use backer status for display, ranking, and reporting first.

### 7. Creator Reputation Page

Each creator should have a lightweight reputation summary.

Useful signals:

- Campaigns funded
- CRC paid out
- Average claimant trust score
- Direct / indirect / no-status claimant split
- Settlement success rate
- Referral quality generated
- Creator trust score and backer status

This helps creators build credibility over time and gives judges a clearer "real product" surface.

### 8. Backer Conversion Missions

CRC Boost Market can run special missions that help users move deeper into the Circles graph instead of only pushing X engagement.

Examples:

- Follow or repost an educational post about Circles backing.
- Complete a mission that explains direct and indirect backing.
- Reward users who become stronger Circles participants over time.

This should be a later feature because it needs careful wording and reliable data, but it makes the app feel much more native to Circles.

### 9. Market Health Dashboard

The admin/market dashboard should eventually show the quality of the whole market, not only raw usage.

Useful metrics:

- Total claims
- CRC paid out
- X reads used
- Average claimant trust score
- Direct / indirect / no-status wallet distribution
- Average creator trust score
- Share of payouts going to direct or indirect backers
- Cost per verified settled action

This is useful for NF Society, campaign creators, and hackathon judges.

## Features We Do Not Keep

### Hard Anti-Farm Claim Restrictions

Do not add a hard feature like:

- low trust = max 1 claim per day
- high trust = unlimited access

This could feel hostile to new users and make the app less open. Trust score should influence economics, visibility, settlement, and reporting first, not block participation.

## Ideas Needing More Explanation

### 10. Campaign Quality Report

A Campaign Quality Report is a creator-facing summary that answers:

`Did this campaign attract real, trusted Circles users?`

It should be shown on each creator campaign after claims start coming in.

Useful report metrics:

- Total verified claims
- Total CRC paid
- Average claimant trust score
- Median claimant trust score
- Direct / indirect / no-status claimant distribution
- High / medium / low / new profile distribution
- Settlement success rate
- Removed-action failure count
- X API reads used
- Cost per verified claim
- Cost per settled payout

Why this matters:

- Creators can see whether their CRC attracted quality attention.
- Judges can understand the app's value in seconds.
- NF Society can position the app as a real market, not only a claim button.

Example report copy:

`This boost paid 32 wallets. Average claimant trust was 67/100. 81% of actions survived settlement.`

This is stronger than only showing `claims` and `spent`, because it explains the quality of the demand generated.

### 11. Intelligent Fee Split

The NF Society fee should eventually be split into configurable buckets instead of being a single opaque fee.

Possible buckets:

- NF Society treasury
- Referral reward pool
- Trust-based creator discount reserve
- Campaign quality / settlement reserve
- Future contributor rewards

Example:

For a `2.5%` campaign fee:

- `1.5%` to NF Society treasury
- `0.5%` to referral rewards
- `0.3%` to trust discount reserve
- `0.2%` to campaign quality reserve

Why this matters:

- The product can explain where fees go.
- Lower-trust creators can pay a higher risk-based fee without it feeling arbitrary.
- Higher-trust creators can receive discounts funded by the market itself.
- Referral rewards become sustainable instead of manually funded.

UX copy should be transparent:

`NF Society fee funds the DAO, referrals, and trust-based market incentives.`

## Implementation Order

### Phase 1: Trust And Backer Data Read Model

- Add a backend helper for Relative Trust Score API calls.
- Cache trust score per wallet in the database.
- Find and confirm a reliable source for direct / indirect / no-backer status.
- Add backer status fetch/cache.
- Add refresh timestamps for both signals.
- Display trust score, backer status, and trust badge in Profile and Leaderboard.

### Phase 2: Creator Fee And Settlement Rules

- Add trust-score fee tiers to settings.
- Add backer-status fee adjustments.
- Apply dynamic fee in campaign creation.
- Show fee explanation in creator payment preview.
- Add claimant-based settlement duration to claim creation.

### Phase 3: Campaign Ranking And Reports

- Sort live boosts using creator trust score as one ranking signal.
- Add creator backer status as a ranking/reporting signal.
- Add campaign quality report to creator dashboard.
- Track aggregate claimant trust stats per campaign.
- Track direct / indirect / no-status claimant distribution.

### Phase 4: Referral And Fee Split Configuration

- Add configurable referral bonus tiers by invited wallet quality.
- Include invited wallet backer status in referral quality.
- Add fee split configuration.
- Surface fee allocation in the creator payment preview.

### Phase 5: Reputation And Market Health

- Add creator reputation pages.
- Add market health dashboard metrics.
- Add optional campaign segmentation labels.
- Explore backer conversion missions once the data model is stable.

## Product Positioning

The core message:

`CRC Boost Market uses the Circles trust graph to price, rank, and report attention markets.`

This improves the hackathon narrative:

- CRC is the payment and payout rail.
- Circles profiles are the identity layer.
- Circles trust score becomes the reputation layer.
- Direct and indirect backing become the graph-quality layer.
- The app becomes a trust-aware attention market, not a generic X engagement tool with CRC bolted on.
