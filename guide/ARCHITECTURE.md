# Architecture

## Why This Architecture

A single INR balance and two fiat payment rails (Stripe, Razorpay) is enough for a domestic
savings app. It breaks for cross-border remittance. A receiver in Dubai cannot hold rupees, and
the sender pays 2-5% in forex margins plus SWIFT fees. Moving settlement to a blockchain lets
both sides hold the same asset (USDC) and settles in seconds instead of days.

The question was how much blockchain to introduce. An all-chain app (everything on-chain, every
action a transaction) would price out Indian users where Polygon still costs ~$0.01 per tx and
the UX of waiting for confirmations is worse than instant INR updates. So we keep the Express
backend for the high-frequency low-value operations — deposits, sends, balance checks — and move
only the cross-border settlement layer to Polygon. That hybrid gives us instant INR UX for
domestic flows and trustless settlement for cross-border without forcing every user to touch the
chain.

## Layers

```
Browser (React SPA)
  │
  ├── Firebase Auth (unchanged)
  ├── NoirJS (browser-side ZK proving)
  └── Ethers.js (read-only chain queries)
  │
  ▼
Vercel (Express)
  │
  ├── Existing: routes.js, kyc/*, authRoutes.js
  └── New: erebor.js, relayer.js, watcher.js, dispute.js
  │
  ├── MongoDB Atlas (users, tx metadata, escrow records)
  └── Polygon Amoy/Mainnet (settlement, escrow, ZK verification)
       │
       ├── MultiCurrencyWallet.sol
       ├── RemittanceEscrow.sol
       └── OracleProxy.sol
```

## Key Decisions

**Express stays as orchestration layer, not replaced.** All the user management, KYC, rate
limiting, notifications already work. Adding `POST /remit` that deducts INR balance, calls the
relayer, and returns a tx hash is 15 lines. Rebuilding auth around wallet keys would be months of
work for zero security gain — Firebase Auth still handles identity, the wallet is a capability
attached to that identity.

**Erebor runs as a sidecar.** It exposes a REST API for wallet creation, signing, and key
recovery. The Express backend calls it over LAN when it needs to sign a transaction. This
decouples the Node.js codebase from the Rust wallet without needing a gRPC bridge or
sidecar injection into Vercel's runtime — Erebor lives on a small VPS or Docker host, Vercel
calls it via fetch.

**Relayer pattern for gas.** Users should not need MATIC to use the app. The relayer holds a
small MATIC balance (~$10) and signs meta-transactions. Users reimburse the relayer in USDC as
part of the same transaction batch. This is CPFP adapted to EVM: the relayer pre-funds gas, the
settlement includes a USDC transfer back to the relayer.

**Age verification via KYC, not ZK.** The original design had Noir circuits and Groth16 proofs
for age verification. The ZK pipeline was never deployed — `noir_js` was never installed, the
frontend generated dummy proofs, and the server accepted any string. Age is now verified from
Aadhaar-verified DOB (government-issued ID), which is stronger evidence than any ZK proof the
MVP would produce, with zero gas cost. See `guide/ZK.md`.

## What We Did Not Build

- **W3C DID / Verifiable Credentials.** Off-chain KYC is simpler and Firebase Auth already
  handles identity. ZK proofs attach to a Firebase user ID, not a DID. We can add DIDs later if
  a partner requires them, but they add no value today.
- **Cross-chain bridge.** USDC on Polygon is sufficient for MVP. Bridging to other chains (BNB,
  Solana) can wait until there is demand.
- **On-chain order book.** Matching senders and receivers on-chain adds complexity and gas costs.
  The Express backend maintains the order book off-chain, settles on-chain.
