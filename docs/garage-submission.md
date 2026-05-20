# Circles Garage Submission

## Copy-Paste Fields

**Name**

CRC Boost Market

**Pitch**

CRC Boost Market is a Circles-native attention marketplace. Creators fund CRC reward pools for X posts, users connect their Circles wallet and X account, complete verified social actions, keep them live through a five-minute settlement window, and receive CRC on-chain. It turns CRC into a useful community distribution rail: projects buy real attention, users earn Circles, and every payout is tied to proof instead of trust.

**Live URL**

https://crc-boost-market.vercel.app

**Mini-app URL / route**

https://crc-boost-market.vercel.app/garage

**Repo**

https://github.com/0xNF21/crc-boost-market

**README**

https://github.com/0xNF21/crc-boost-market#readme

## Judge Narrative

### 01. Circles Integration Quality

CRC is not bolted on. Campaigns are funded in CRC, creator payments activate boosts, users are identified by Circles wallets and profiles, and rewards are paid back on-chain in CRC after proof survives settlement. The product also supports Circles mini-app passkey payments where the host allows them, plus QR/deep-link checkout fallbacks.

### 02. Usefulness

The app solves a concrete problem: small communities and projects need real distribution, but typical engagement marketplaces are opaque and fiat-centric. CRC Boost Market makes attention rewards transparent, lightweight, and native to the Circles economy. A non-crypto user can open it twice because the action is familiar: connect, repost, wait, receive CRC.

### 03. UX

The UI is built around the actual workflow: active boosts, creator funding, personal history, referrals, leaderboard, campaign status, payment state, and settlement countdown. Errors and success states are shown near the action being performed, and the app works as a standalone site plus Circles Playground-compatible mini-app.

### 04. Referrals

Referral links are generated inside the app using the connected Circles profile name when available. Referred wallets can unlock tiered CRC bonuses for the referrer after campaign participation milestones.

### 05. Activity

The app tracks dashboard stats for verified claims, CRC paid, active boosts, X API reads, personal history, referrals, and leaderboard participation. It is deployed publicly and ready for weekly wallet activity measurement through the Circles mini-app environment.

### 06. Shipped

Cycle 01 submission: production app, X OAuth verification, creator-funded CRC campaigns, settlement re-checks, on-chain payouts, referrals, leaderboard, personal dashboard, Circles profile display, passkey/QR payment paths, and Vercel deployment.

## Demo Script

1. Open https://crc-boost-market.vercel.app.
2. Connect a Circles wallet.
3. Link X with read-only OAuth.
4. Open or copy a campaign X post.
5. Complete the requested X action.
6. Verify the action in the app.
7. Wait for the five-minute settlement countdown.
8. Re-check and receive CRC on-chain.
9. Open Creator, create a draft campaign, and pay the calculated CRC amount.
10. Check payment to activate the campaign.

## Known Constraints

- The Circles Playground may block external X popups, so the app provides copy/open fallback behavior.
- X API reads cost money, so verification is intentionally scoped and surfaced in the dashboard.
- Payout happens only after a delayed re-check to reduce remove-after-claim abuse.
