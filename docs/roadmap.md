# CRC Boost Market Roadmap

This roadmap captures the Circles trust graph features we want to keep after the first shipped version. The goal is to make CRC Boost Market more Circles-native: campaign economics, visibility, referrals, and reporting should use Circles trust data instead of treating CRC as a simple payment token.

## Trust Score Integration

CRC Boost Market should use the Circles Relative Trust Score API as a product primitive.

Useful endpoints:

- `POST /scoring/relative_trustscore`: score one or more wallet/avatar addresses against the default `all_backers` target set.
- `POST /scoring/global_relative_trustscore`: get paginated global scores.
- Bot analytics endpoints may be useful later for separate moderation signals, but they are not part of the first trust-score feature set.

The score should be cached in our database per wallet, with a refresh timestamp, so the UI and fee calculations do not depend on a live external request every time.

## Features We Keep

### 1. Dynamic Creator Fees By Trust Score

Creator campaign fees should be calibrated by the creator's Circles trust score.

The product framing should be positive: trusted Circles profiles get lower creator fees because the market has more confidence in them.

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

- `Trusted creator` for high trust scores
- `Established profile` for medium trust scores
- `New Circles profile` for no score or low score

Avoid making the badge feel punitive. The UI should communicate reputation, not shame.

### 5. Configurable Referral Bonus By Invited Wallet Quality

Keep the referral system, but make the bonus configurable based on the invited wallet's trust score or quality tier.

Current milestone idea remains:

- Invited wallet completes 1 verified mission: `+0.2 CRC`
- Invited wallet completes 3 verified missions: `+0.5 CRC`
- Invited wallet completes 5 verified missions: `+1 CRC`

Future configurable version:

- High-trust invited wallet: full referral bonus
- Medium-trust invited wallet: standard bonus
- New or low-trust invited wallet: delayed bonus, smaller bonus, or bonus unlocked after more completed missions

This rewards people for bringing real Circles users instead of only driving raw signups.

## Features We Do Not Keep

### Hard Anti-Farm Claim Restrictions

Do not add a hard feature like:

- low trust = max 1 claim per day
- high trust = unlimited access

This could feel hostile to new users and make the app less open. Trust score should influence economics, visibility, settlement, and reporting first, not block participation.

## Ideas Needing More Explanation

### 6. Campaign Quality Report

A Campaign Quality Report is a creator-facing summary that answers:

`Did this campaign attract real, trusted Circles users?`

It should be shown on each creator campaign after claims start coming in.

Useful report metrics:

- Total verified claims
- Total CRC paid
- Average claimant trust score
- Median claimant trust score
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

### 7. Intelligent Fee Split

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

### Phase 1: Trust Score Read Model

- Add a backend helper for Relative Trust Score API calls.
- Cache trust score per wallet in the database.
- Add score refresh timestamps.
- Display trust score and trust badge in Profile and Leaderboard.

### Phase 2: Creator Fee And Settlement Rules

- Add trust-score fee tiers to settings.
- Apply dynamic fee in campaign creation.
- Show fee explanation in creator payment preview.
- Add creator-based settlement duration to campaign data.

### Phase 3: Campaign Ranking And Reports

- Sort live boosts using creator trust score as one ranking signal.
- Add campaign quality report to creator dashboard.
- Track aggregate claimant trust stats per campaign.

### Phase 4: Referral And Fee Split Configuration

- Add configurable referral bonus tiers by invited wallet quality.
- Add fee split configuration.
- Surface fee allocation in the creator payment preview.

## Product Positioning

The core message:

`CRC Boost Market uses the Circles trust graph to price, rank, and report attention markets.`

This improves the hackathon narrative:

- CRC is the payment and payout rail.
- Circles profiles are the identity layer.
- Circles trust score becomes the reputation layer.
- The app becomes a trust-aware attention market, not a generic X engagement tool with CRC bolted on.
