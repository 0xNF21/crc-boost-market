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

Current next step: `2. Public profile badges`.

| # | Slice | Status | Validation criteria |
|---|---|---|---|
| 1 | Trust and backer data read model | Validated | App finds the trust score source and the direct/indirect/no-backer source, caches both per wallet, and shows them in a simple internal/debug surface. |
| 2 | Public profile badges | Todo | Profile, leaderboard, and creator areas show trust/backer badges without making new users feel punished. |
| 3 | Dynamic creator fees | Todo | Campaign creation fee changes according to creator trust score and backer status. |
| 4 | Creator payment preview | Todo | Creator sees reward pool, NF Society fee, discount/premium reason, and total due before paying. |
| 5 | Settlement duration rules | Todo | Campaign settlement duration is stored and displayed based on creator quality tier. |
| 6 | Campaign ranking | Todo | Live boosts use creator trust/backer signals as one ranking factor. |
| 7 | Referral quality tiers | Todo | Referral rewards can vary by invited wallet quality while keeping the current milestones. |
| 8 | Campaign quality report | Todo | Creator dashboard explains claimant quality, settlement success, CRC spent, and X reads used. |
| 9 | Intelligent fee split | Todo | Fee allocation is configurable and visible in the creator payment preview. |
| 10 | Creator reputation page | Todo | A creator can show campaigns funded, CRC paid, quality stats, and trust/backer status. |
| 11 | Market health dashboard | Todo | Market status includes trust/backer distribution, not only raw claims and payouts. |
| 12 | Backer conversion missions | Parked | Only revisit once trust/backer data is reliable and the core market is stable. |

Decision log for slice 1:

- Decided: use Circles RPC indexed tables for both trust score and backer status.
- Decided: `direct` wins over `indirect`; `none` only means neither direct nor indirect.
- Implemented: DB cache, refresh endpoint, and profile debug card with manual refresh.
- Tested: production Neon branch contains `garage_trust_profiles`; wallet refresh stores trust `78`, level `HIGH`, direct backer status, and mutual trust `108`.
- Final status: `Validated`.

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

Settlement delay can also depend on trust score.

Proposed first tiers:

- `80-100 trust`: 2 minute settlement
- `50-79 trust`: 5 minute settlement
- `20-49 trust`: 10 minute settlement
- `0-19 trust / no score`: 15 minute settlement

This can apply first to campaign creators, then later to claimants if needed. The safer first version is creator-based: campaigns from higher-trust creators settle faster for everyone.

UX copy should stay simple:

`Trusted creator: faster CRC settlement.`

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
- Add creator-based settlement duration to campaign data.

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
