# CRC Boost Market

Circles-native attention market by NF Society.

CRC Boost Market lets creators fund CRC reward pools for verified X actions. Users connect a Circles wallet, link their X account with read-only OAuth, complete a campaign action, keep it live through a settlement window, then receive CRC on-chain.

## Live App

- Production: https://crc-boost-market.vercel.app
- Garage route: https://crc-boost-market.vercel.app/garage
- Circles Playground: open https://circles.gnosis.io/playground and load `https://crc-boost-market.vercel.app/`

## Pitch

Creators need real distribution, not vanity dashboards. CRC Boost Market turns Circles into a community reward rail for attention: projects fund a pool, users complete verified social actions, and CRC moves only after proof survives a short re-check window.

The result is simple for non-crypto users: connect Circles, link X, complete an action, earn CRC. For creators, it is a self-serve way to launch a campaign and pay only verified participants.

## What Uses Circles

- Circles wallet identity for the mini-app session.
- Circles profile names and images for user identity, referrals, and leaderboard rows.
- CRC payments from creators to activate campaigns.
- CRC reward payouts to users after verification and settlement.
- QR/deep-link checkout fallback for desktop and standalone flows.
- Passkey transaction flow inside the Circles/Gnosis mini-app context where supported.
- On-chain transaction hashes shown after CRC payout.

## Core Flow

1. User connects their Circles wallet.
2. User links X through read-only OAuth.
3. User opens or copies the X post link and performs the requested action.
4. The app verifies the action through the X API.
5. The app waits five minutes, then re-checks the action.
6. If the action is still live, CRC is sent on-chain to the user's wallet.

## Creator Flow

1. Creator enters a campaign title, X post URL, action type, reward per user, and max payouts.
2. The app calculates the reward pool plus the NF Society fee.
3. Creator pays CRC through passkey, checkout link, or QR fallback.
4. The app scans the payment and activates the campaign.
5. Users can claim until the funded campaign cap is reached.

## Anti-Abuse

- X OAuth uses read-only scopes only.
- Verification is tied to wallet, X user, tweet, campaign, and action.
- Claims are settled after a delay, then re-checked before payout.
- One wallet/X account cannot repeatedly claim the same campaign.
- X API reads are displayed in the dashboard as a cost signal.
- Creator payments must be detected before campaigns become active.

## Referrals

Referral links use the connected Circles profile name when available. A referrer earns bonus CRC when a referred wallet completes campaign milestones:

- first completed mission: 0.2 CRC
- three completed missions: 0.5 CRC
- five completed missions: 1 CRC

## Technical Notes

- Deployed on Vercel as a standalone Garage app.
- Uses Neon Postgres for campaigns, X accounts, claims, referrals, and verification state.
- Uses X OAuth 2.0 with read-only scopes for account linking and action verification.
- Uses Circles wallet/profile data for identity, referrals, and leaderboard display.
- Uses Circles checkout links/QR codes and mini-app passkey transactions for creator funding.
- Uses backend-triggered CRC payouts after the settlement re-check passes.

Main code paths:

- `src/app/garage/page.tsx`
- `src/components/circles-garage-page.tsx`
- `src/app/api/garage`
- `src/lib/garage-x.ts`
- `src/lib/circles-miniapp-payment.ts`
- `src/lib/garage-referral-rewards.ts`

## Current Notes

The app is production-deployed on Vercel and designed for both standalone browser use and Circles mini-app testing through the Playground. In the Playground, external X popups may be blocked by the host, so the app provides copy/open fallback behavior.

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md) in English or [`docs/roadmap.fr.md`](docs/roadmap.fr.md) in French for the planned Circles trust score features: dynamic creator fees, trust-based settlement, campaign visibility, trust badges, configurable referrals, campaign quality reports, and fee split configuration.
