# Frontend Screens

## Why New Screens

The current SPA is one `App.jsx` (1938 lines) with inline screen components for everything. Six
screens with overlapping logic — it works but adding blockchain wallet screens in the same file
would push it past 3000 lines and make maintenance painful. The screens already have natural
boundaries (login, dashboard, send, deposit, history, settings); the new ones (wallet, remit,
claim, ZK) follow the same pattern.

Splitting into separate files in `screens/` is the only structural change. No router library —
the existing `switch(screen)` pattern in `App.jsx` stays. Each screen file exports a function
component, same as the current inline components.

## WalletScreen

**Why.** Users need visibility into their Polygon balances — USDC and synthetic INR — alongside
their existing INR balance. The current dashboard only shows `user.balance` (INR). A separate
wallet screen shows on-chain holdings without crowding the dashboard.

**How.** Reads `MultiCurrencyWallet.balanceOf(userAddress, tokenId)` via ethers.js JSON-RPC call
(no gas cost, just a query). Shows USDC and sINR balances. A "Send from Wallet" button opens the
remit flow. A "Receive" button shows the wallet address as a QR code.

```
┌────────────────────────────┐
│  On-Chain Wallet            │
│                             │
│  USDC   1,234.56            │
│  sINR  ₹98,765.43           │
│                             │
│  [Send]  [Receive]  [Bridge]│
└────────────────────────────┘
```

**Connection to backend.** Queries are direct to Polygon RPC (via ethers.js CDN). Transfers go
through `POST /api/remit`. Wallet address comes from `user.walletAddress` on the user object
returned by `/auth/verify`.

**Why not Web3Modal/MetaMask.** We supply the wallet (Erebor). Users do not need a browser
extension. The app controls the wallet creation and signing flow. A Web3Modal would add 50KB to
the bundle for a "connect wallet" button that is unnecessary when the wallet is embedded.

## RemitScreen

**Why.** Cross-border remittance needs its own form. The current SendScreen assumes INR-to-INR
domestic transfer. RemitScreen handles INR-to-USDC, setting the timelock, choosing the corridor.

**How.** Dropdown for destination (USD, EUR, GBP, AED). Shows the Chainlink rate locked at form
submission. User enters recipient wallet address (or selects from saved addresses). Submits to
`POST /api/remit`. Returns escrow ID and tx hash.

```
┌────────────────────────────┐
│  Send Cross-Border          │
│  INR → USDC                 │
│  Rate: 1 INR = 0.012 USD    │
│  Amount: ₹10,000             │
│  Receiver: 0x...             │
│  Timelock: 72h              │
│                             │
│  [Review & Confirm]         │
└────────────────────────────┘
```

## ClaimScreen

**Why.** Receivers (often gig workers) need a page to see incoming escrows and claim them. The
dashboard does not show escrows from other senders.

**How.** Lists escrows where `receiverAddress == user.walletAddress` and `status == 'created'`.
Each has a "Claim" button that calls `POST /api/claim`. On success, the USDC appears in the
wallet and the user gets a notification.

## ZKScreen

**Why.** Proving age or country requires user interaction — scanning a document, waiting for the
proof to generate. A dedicated screen guides them through it step by step.

**How.** Three steps:
1. Select proof type (age 18+, country verification).
2. Scan government ID (camera opens, app hashes relevant fields).
3. Generating proof (NoirJS spinner, ~2-5 seconds).
4. Done — `zkStatus` updates, badge appears on profile.

## SettingsScreen (Extended)

**Why.** The existing settings screen has TOTP setup, biometric registration, and account
management. It needs wallet export, key recovery, and ZK status display.

**How.** Add sections:
- **Wallet** — shows wallet address, "Export backup phrase" (downloads recovery PDF), "Recover
  wallet from backup" (accepts backup share, calls Erebor recovery).
- **ZK Status** — shows age/country verification status, link to ZKScreen to (re)verify.
- **Connected Platforms** — list of gig platforms that send webhooks to this account.

## File Structure

```
frontend/src/
├── App.jsx           [MODIFY — add screen imports, switch cases]
├── screens/
│   ├── WalletScreen.jsx    [NEW]
│   ├── RemitScreen.jsx     [NEW]
│   ├── ClaimScreen.jsx     [NEW]
│   └── ZKScreen.jsx        [NEW]
├── styles/
│   ├── base.css            [from index.css shared rules]
│   ├── wallet.css          [NEW]
│   ├── remit.css           [NEW]
│   ├── claim.css           [NEW]
│   └── zk.css              [NEW]
└── (existing files unchanged)
```

## Why Not a Router Library

`react-router-dom` is the canonical solution but the app currently manages screens with a `switch`
on a state variable. Adding a router for 4 new screens means restructuring `App.jsx`, adding URL
routing logic that the SPA never needed (there are no deep links), and increasing the bundle size
by ~25KB. The `switch` pattern scales to ~15 screens before it becomes unwieldy; we are at 11
total. A router can be introduced when the team needs URL-based navigation; for now, the simplest
thing that works is more `case` statements.
