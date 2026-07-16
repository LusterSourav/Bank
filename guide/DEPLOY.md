# Deployment

## Why This Setup

Zero-cost hosting for the existing app (Vercel + MongoDB Atlas free tier). The blockchain layer
adds two costs: the Erebor VPS ($5-10/month) and Polygon gas (<$1/month at MVP scale). The only
real expense is the contract audit ($5k-15k), and that happens once.

## Infrastructure

```
┌──────────┐    ┌──────────┐    ┌────────────┐
│ Vercel   │    │ VPS      │    │ Polygon    │
│ (free)   │    │ ($5/mo)  │    │ RPC        │
│          │    │          │    │            │
│ Express  │◄──►│ Erebor   │    │ Contracts  │
│ API      │    │ (Docker) │    │            │
│          │    │          │    │            │
│ Static   │    │ Watcher  │    │            │
│ frontend │    │ (cron)   │    │            │
└──────────┘    └──────────┘    └────────────┘
     │
     ▼
┌──────────┐
│ MongoDB  │
│ Atlas    │
│ (free)   │
└──────────┘
```

**Vercel** hosts the Express API (`api/index.js` serverless function) and the compiled React
frontend (`frontend/dist`). Everything the existing app uses stays on Vercel.

**Small VPS** (DigitalOcean $6/mo, or any Linux box) runs:
- Erebor (Docker container, port 3002)
- Watcher (a long-running Node process, or a cron that runs every 15 seconds)

The watcher cannot run on Vercel serverless functions — they have a 10-second timeout and no
persistent connection. A $6/mo VPS solves this. The same VPS can host the Erebor Docker
container.

**Polygon RPC.** Public RPC endpoints work for MVP (Amoy testnet is free, mainnet public RPC has
rate limits). For production, use a service like QuickNode ($0 tier covers tens of thousands of
requests/month) or Alchemy's free tier.

## Environment Variables

### Vercel (existing, plus new)

```
# Existing (unchanged)
FIREBASE_SERVICE_ACCOUNT={...}
MONGO_URI=mongodb+srv://...
STRIPE_SECRET_KEY=sk_...
RAZORPAY_KEY_ID=rzp_...
SANDBOX_API_KEY=...

# New
EREBOR_URL=http://<vps-ip>:3002
EREBOR_RELAYER_SHARE=<shamir-share-2>
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_RELAYER_PRIVATE_KEY=<hex-key>
MULTI_CURRENCY_WALLET_ADDRESS=0x...
REMITTANCE_ESCROW_ADDRESS=0x...
ORACLE_PROXY_ADDRESS=0x...
ZK_VERIFIER_ADDRESS=0x...
```

### VPS (Erebor + watcher)

```
EREBOR_SECRET=<master-secret>
NETWORK=polygon-amoy
```

## Deployment Steps

1. **Contracts to testnet.** Run `forge script script/Deploy.s.sol --rpc-url amoy` — deploys all
   4 contracts to Polygon Amoy. Writes addresses to `deployed-amoy.json`.

2. **Erebor on VPS.** `docker compose up -d` on the VPS. Erebor starts on port 3002. Verify with
   `curl http://localhost:3002/health`.

3. **Watcher on VPS.** `node src/watcher.js` as a systemd service or run via PM2. Connects to
   MongoDB and Polygon, polls every 15 seconds.

4. **Vercel deploy.** `git push` triggers Vercel deployment. The Express backend reads the
   deployed contract addresses from `deployed-amoy.json` or env vars.

5. **Test end-to-end.** Register a user, deposit INR via UPI, check WalletScreen shows USDC.

## Audit Plan

| What | Method | Cost |
|------|--------|------|
| Internal review | `forge test` + Slither | $0 |
| Professional audit | Code4rena or specialty firm | $5k-15k |
| Focus | RemittanceEscrow timelock/dispute paths | — |
| Focus | MultiCurrencyWallet mint/burn roles | — |
| Skip | ZKVerifier (auto-generated from Noir) | — |
| Skip | OracleProxy (passthrough to Chainlink) | — |
| Skip | Express backend (existing, already reviewed) | — |

The audit covers only the contracts with novel logic. The verifier is compiler-generated, the
oracle proxy is a two-line wrapper around Chainlink's battle-tested feed.

## Production Checklist

- [ ] Internal audit complete (`forge test --gas-report`)
- [ ] Slither static analysis shows no critical findings
- [ ] Professional audit completed, issues addressed
- [ ] Contracts deployed to Polygon mainnet
- [ ] Erebor running on VPS with backups
- [ ] Watcher running as systemd service
- [ ] Relayer funded with minimal MATIC ($10-20)
- [ ] Vercel env vars set for mainnet addresses
- [ ] Test: onramp $10 INR → USDC on mainnet
- [ ] Test: remit $100 USDC → escrow → release
- [ ] Test: timelock expiry → refund
- [ ] Test: ZK proof age verification
- [ ] Monitoring: watcher logs, relayer balance alerts

## Monitoring

**Watcher logs** go to stdout, collected by the VPS logging system. Alerts:
- Relayer MATIC balance < $5 (means gas is running low)
- Escrow stuck in `created` for > 96 hours (timelock should have expired)
- Watcher disconnected from RPC for > 5 minutes

**No external monitoring service.** For MVP, a daily `curl` check and log review is sufficient.
Add Sentry or similar when traffic justifies it.
