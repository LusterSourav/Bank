# Product Readiness Checklist

## 1. Low-Fee Remittances (<1%)
| Item | Status | Notes |
|---|---|---|
| RemittanceEscrow.sol — timelock escrow | ✅ Ready | createRemittance, claim, refund, dispute all work |
| Relayer pattern (gas-free for users) | ✅ Ready | EOA relayer, `relayTx()` in routes |
| Watcher auto-refunds expired escrows | ✅ Ready | runs every 60s, refunds expired locks |
| Fee 0.5% | ✅ Ready | `REMIT_FEE_PERCENT` env var, defaults to 0.5 |

## 2. Multi-Currency Wallets & Real-Time Forex
| Item | Status | Notes |
|---|---|---|
| Wallet shows USDC/EURC balances | ✅ Ready | reads on-chain via ethers |
| Onramp with token param (USDC/USDT/EURC) | ✅ Ready | Stripe/Razorpay onramp |
| INR→USDC conversion via Chainlink | ✅ Ready | OracleProxy deployed, 83.5 fallback |
| EUR/USD feed | ✅ Ready | Chainlink `0xd8d9` + Pyth `0xa995` dual-source |
| **Oracle circuit breaker** | ✅ Ready | deviation threshold (500 bps), stale-feed hard-fail, dual-source median |
| **EURC remit** | ✅ Ready | remit create is token-aware (USDC/USDT/EURC), EURC ≈ USD via EUR/USD feed |
| **Deploy script (mock feeds)** | ✅ Ready | MockPythFeeds + OracleProxy 4-arg constructor |
| **Real-time forex for arbitrary pairs** | ⚠️ Partial | INR/USD + EUR/USD only (Chainlink + Pyth), no EUR/INR feed |
| **Unified multi-currency balance display** | ❌ Not Ready | wallet shows on-chain balances only |

**Ponytail:** remit now relays `config.escrows[token]` per-token. Remaining gaps: unified balance display, and arbitrary-pair forex (needs a EUR/INR feed or Pyth).

## 3. Compliance

### GDPR / ZK Privacy
| Item | Status | Notes |
|---|---|---|
| Server-side age check from KYC DOB | ✅ Ready | updated July 22 — auto-set on KYC finalize |
| Noir ZK circuits | ❌ Cut for v1 | ponytail: DOB from Aadhaar is sufficient for age proof |
| ZKVerifier.sol on-chain | ❌ Cut for v1 | not deployed, not needed without circuits |

### RBI KYC/AML
| Item | Status | Notes |
|---|---|---|
| Aadhaar OTP verification (Sandbox) | ✅ Ready | |
| PAN verification | ✅ Ready | |
| Cross-verification (name matching) | ✅ Ready | |
| Email verification | ✅ Ready | OTP-based |
| IP scoring + velocity checks | ✅ Ready | |
| KYC status tracking | ✅ Ready | none → pending → verified/rejected |

### FATF Travel Rule
| Item | Status | Notes |
|---|---|---|
| TravelRuleRecord logged for remits over threshold | ✅ Ready | |
| Originator/beneficiary info captured | ✅ Ready | |

### SAR / Suspicious Activity Monitoring
| Item | Status | Notes |
|---|---|---|
| Structuring detection | ✅ Ready | |
| Rapid-fire detection | ✅ Ready | |
| High-risk geo IP blocking | ✅ Ready | |
| SAR model in schema | ✅ Ready | |

## 4. Decentralized Identity (DID)

| Item | Status | Notes |
|---|---|---|
| did:web creation | ✅ Ready | |
| DID document with blockchain account verification | ✅ Ready | |
| VC issuance (JWT-signed KYC credentials) | ✅ Ready | |
| **VC verification by relying party** | ❌ Not Ready | VCs issued but never consumed — no verification flow |
| **Revocation mechanism** | ❌ Not Ready | no DID revocation |

## 5. Gig Marketplace Integration

| Item | Status | Notes |
|---|---|---|
| Webhook endpoint for gig completion | ✅ Ready | `POST /gig-completed` |
| Client trust scoring (DID + KYC) | ✅ Ready | trusted = 60s lock, untrusted = 72h |
| Fiverr connector | ❌ Cut | ponytail: no public Fiverr API exists |
| Upwork connector | ❌ Cut | was always a comment stub |
| No public gig APIs exist | — | design constraint, not a gap |

**Ponytail:** The gig webhook works on trust (DID + KYC) without platform verification. This is honest about the constraint.

---

## Summary

| Area | Ready | Blocked |
|---|---|---|
| Remittances (USDC) | ✅ | — |
| Multi-Currency | ✅ (USDC/USDT/EURC) | balance display, arbitrary-pair forex |
| KYC/AML | ✅ | — |
| ZK/GDPR | ✅ (v1) | server-side age check works, no circuits |
| Travel Rule / SAR | ✅ | — |
| DID | ⚠️ | VCs issued but never verified |
| Gig Integration | ✅ (v1) | works on trust, no platform API needed |

**One gap to ship:** unified multi-currency balance display in the wallet. EURC remit is done; arbitrary-pair forex (EUR/INR, or Pyth) is the follow-on.
