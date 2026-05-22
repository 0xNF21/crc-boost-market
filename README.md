# CRC Boosts

CRC Boosts is a Circles-native attention market by NF Society.

Creators fund CRC reward pools for verified X actions. Users connect a Circles wallet, link X with read-only OAuth, complete a campaign action, keep it live through a settlement window, then receive CRC on-chain.

The product is designed for the Circles Garage hackathon: CRC is not bolted on as a tip button. Circles is used as the identity layer, payment rail, payout rail, referral layer, trust graph signal, and creator reputation signal.

## Live App

- Production app: https://crc-boost-market.vercel.app
- Garage route: https://crc-boost-market.vercel.app/garage
- Creator reputation example: `https://crc-boost-market.vercel.app/garage/creator/cryptosnf`
- Circles Playground: open https://circles.gnosis.io/playground and load `https://crc-boost-market.vercel.app/`
- Social preview image: https://crc-boost-market.vercel.app/crc-boost-preview.png

## Pitch

Creators need real distribution, not vanity dashboards.

CRC Boosts lets a project fund a reward pool, ask users for a verified X action, and pay CRC only when the action survives a settlement re-check. Users get a simple loop: connect Circles, link X, complete a mission, and earn CRC on-chain.

The Circles trust graph makes the market smarter:

- trusted creators pay lower campaign fees;
- trusted users get shorter settlement windows;
- campaign reports show the quality of the attention generated;
- referrals reward people for bringing real Circles users, not only raw signups.

## Core User Flow

1. Connect a Circles wallet.
2. Link X through read-only OAuth.
3. Open or copy the X post link.
4. Complete the requested action.
5. The backend verifies the action through the X API.
6. The app waits through a trust-based settlement window.
7. The backend re-checks the action.
8. If the action is still live, CRC is paid on-chain to the user's wallet.

## Creator Flow

1. Open the Creator section.
2. Add campaign title, description, X post URL, action type, CRC reward per user, and max payouts.
3. Preview the campaign card, reward pool, NF Society fee, and total due.
4. Pay CRC through the Circles mini-app passkey flow when available, or use checkout link / QR fallback.
5. The backend scans for the campaign payment and activates the boost.
6. Creator tracks claims, CRC paid, X reads, settlement success, and claimant quality.

## What Uses Circles

- Circles wallet connection for app identity.
- Circles profile names and images for user profiles, referral links, leaderboard rows, and creator pages.
- CRC creator payments to activate campaigns.
- CRC user payouts after verification and settlement.
- Circles checkout links and QR fallback for standalone payment flows.
- Circles mini-app passkey transaction flow where supported by the host.
- Circles trust score cached per wallet.
- Direct / indirect / no-backer status cached per wallet.
- Trust/backer status used for creator fees, user settlement duration, ranking, referral multipliers, badges, and reports.

## Shipped Features

- Verified X action campaigns with read-only X OAuth.
- Five-step claim state: opened, verified, settlement pending, re-checked, paid.
- Trust-based settlement windows per claimant.
- On-chain CRC payouts after settlement.
- Creator-funded campaign creation with payment detection.
- Dynamic creator fees using Circles trust score and backer status.
- Creator payment preview with reward pool, fee reason, and total due.
- Pending campaign drafts with cancel support before funding.
- QR checkout and payment link fallback.
- Mini-app passkey payment support for campaign funding where available.
- Market dashboard with claims, CRC paid, active boosts, and X API reads.
- Personal dashboard with completed actions, earned CRC, pending CRC, and history.
- Leaderboard with Circles identity, trust/backer badges, missions, earned CRC, and reads.
- Referral links based on Circles profile name when available.
- Referral reward milestones for invited wallets.
- Referral quality multipliers based on the invited wallet trust/backer status.
- Claimable referral balance instead of automatic micro-payouts.
- Referral tracking drawer for invited wallets.
- Trust graph profile card with manual refresh.
- Public creator reputation page at `/garage/creator/[id]`.
- Campaign quality report in the creator dashboard.
- Share preview card for Telegram/X/social links.
- Light/dark mode, FR/EN controls, and responsive mobile/desktop layout.

## Trust-Aware Economics

### Creator Fee Grid

Creator campaign fees depend on the creator wallet's Circles trust/backer profile.

| Creator status | High trust | Medium trust | Low trust |
|---|---:|---:|---:|
| Direct backer | 1% | 1.25% | 1.5% |
| Indirect backer | 1.75% | 2% | 2.25% |
| No backer link | 2.5% | 2.75% | 3% |

Trusted Circles profiles pay less to launch campaigns. Newer profiles can still create campaigns, but the market prices their trust risk higher.

### Claimant Settlement Grid

Settlement duration depends on the user who claims, not the campaign creator.

| Claimant status | High trust | Medium trust | Low trust |
|---|---:|---:|---:|
| Direct backer | 2 min | 3 min | 4 min |
| Indirect backer | 5 min | 6 min | 7 min |
| No backer link | 8 min | 9 min | 10 min |

This keeps the app open while giving stronger Circles profiles a better experience.

## Referrals

Referral links use the connected Circles profile name when available.

Base referral milestones:

- invited wallet completes 1 verified mission: `+0.2 CRC`;
- invited wallet completes 3 verified missions: `+0.5 CRC`;
- invited wallet completes 5 verified missions: `+1 CRC`.

The final referral reward uses a quality multiplier based on the invited wallet:

- `high trust` means trust score `>= 70`;
- `medium trust` means trust score `>= 40`;
- `low trust` means trust score `< 40` or no usable score yet;
- every referral payout has a `0.1 CRC` minimum after multiplier;
- rewards become claimable balance, then the referrer claims grouped CRC when they choose.

Referral quality multiplier grid:

| Invited wallet status | High trust | Medium trust | Low / no score |
|---|---:|---:|---:|
| Direct backer | 1.5x | 1.3x | 1.15x |
| Indirect backer | 1.25x | 1.1x | 1x |
| No backer link | 1x | 0.85x | 0.7x |

Examples:

- `0.2 CRC` first-mission bonus from a direct high-trust invited wallet becomes `0.3 CRC`.
- `1 CRC` five-mission bonus from an indirect medium-trust invited wallet becomes `1.1 CRC`.
- `0.2 CRC` first-mission bonus from a no-backer low-trust invited wallet becomes `0.14 CRC`.

## Creator Reputation

Every creator can have a public reputation page.

It shows:

- Circles identity and avatar;
- linked X account when available;
- trust score and backer status;
- campaigns funded;
- CRC paid and pending;
- wallets reached;
- settlement success;
- claimant trust quality;
- direct / indirect / no-link claimant split;
- campaign history.

This gives creators a durable proof surface and gives judges a fast way to see that the market has real state beyond a single claim button.

## Anti-Abuse

- X OAuth uses read-only scopes only.
- Claims are tied to wallet, X user, campaign, tweet, and action.
- A wallet/X account cannot repeatedly claim the same campaign.
- Payout happens only after a settlement re-check.
- Removed actions do not unlock CRC.
- Creator campaigns go live only after CRC funding is detected.
- X API reads are surfaced as a cost signal.
- Trust/backer data is cached and refreshed intentionally instead of making every UI view depend on live external calls.

## Garage Judging Fit

### Circles integration quality

CRC Boosts uses Circles primitives across the product: wallet identity, profile identity, CRC creator funding, CRC user payouts, trust score, backer status, referrals, creator reputation, and mini-app payment flows.

### Usefulness

A creator can pay for verified attention without trusting screenshots or manual forms. A user can earn CRC for actions they already understand. The app has repeatable loops for creators, users, and referrers.

### UX

The app is usable as a standalone website and through the Circles Playground. It includes copy/open fallbacks for host limitations, visible claim status, countdown settlement, dashboard stats, creator previews, and public reputation surfaces.

### Referrals

Invite links are built into the Profile section. They use Circles names when possible and track referred wallets, missions, reward quality, claimable balance, and claimed CRC.

### Activity

The app surfaces market stats in-app: unique wallets, total claims, CRC paid, live campaigns, and X API reads.

## Technical Notes

- Framework: Next.js App Router.
- Deployment: Vercel.
- Database: Neon Postgres.
- ORM/migrations: Drizzle.
- X integration: OAuth 2.0 Authorization Code with PKCE, read-only scopes.
- Circles integration: wallet/profile data, CRC checkout links, mini-app passkey payment flow, trust graph data, and CRC payouts.
- Social preview: static PNG at `public/crc-boost-preview.png`, referenced by Open Graph/Twitter metadata.

Main code paths:

- `src/app/garage/page.tsx`
- `src/components/circles-garage-page.tsx`
- `src/components/creator-reputation-page.tsx`
- `src/app/api/garage`
- `src/lib/garage-x.ts`
- `src/lib/garage-trust.ts`
- `src/lib/garage-fees.ts`
- `src/lib/garage-referral-quality.ts`
- `src/lib/garage-referral-rewards.ts`
- `src/lib/circles-miniapp-payment.ts`

Database migrations:

- `drizzle/0000_melted_vindicator.sql`
- `drizzle/0001_glossy_whiplash.sql`
- `drizzle/0002_referral_quality_multiplier.sql`

## Environment

Required production variables are documented in `.env.example`.

Important groups:

- app URL and standalone Garage mode;
- Neon `DATABASE_URL`;
- X OAuth credentials and bearer token;
- Garage admin wallets and campaign economics;
- CRC recipient / payout wallet;
- Circles RPC URL;
- optional Redis rate-limit storage.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run checks:

```bash
npm run typecheck
npm run build
```

## Production Test Checklist

- Connect Circles wallet on standalone site.
- Connect Circles wallet in the Circles Playground.
- Link X from standalone site.
- Link X through Playground fallback flow.
- Claim a live campaign.
- Confirm settlement countdown appears under the active campaign.
- Remove an X action before settlement and confirm payout is blocked.
- Keep an X action live and confirm CRC payout.
- Create a campaign draft.
- Pay campaign funding with passkey when available.
- Pay campaign funding with QR/payment link fallback.
- Confirm payment scan activates the campaign.
- Cancel an unpaid campaign draft.
- Test referral link with a second wallet.
- Confirm referral balance becomes claimable.
- Claim grouped referral CRC.
- Open creator reputation page and compare stats with creator dashboard.
- Check Telegram/X preview card with a cache-busted URL.

## Current Status

Production is deployed on Vercel and connected to Neon. The core product is built; the next work is mainly production validation with multiple wallets and campaign cleanup before the Garage submission.

The README intentionally focuses on what is shipped. Longer product planning lives in:

- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/roadmap.fr.md`](docs/roadmap.fr.md)
