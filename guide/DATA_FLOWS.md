# Data Flows

## 1. Onramp (INR → On-Chain USDC)

```
User ──→ DepositScreen (choose INR amount)
        ──→ Stripe/Razorpay payment
        ──→ Webhook fires → creditAndNotify()
        ──→ Express checks User.balance (INR credited)
        ──→ Calls erebor.createWallet(userId) if first time
        ──→ Calls relayer.relayTx() to mint MultiCurrencyWallet
        ──→ User sees USDC balance on WalletScreen
```

**Why in this order.** Pay in fiat first, then mint on-chain. If the mint fails, the user still
has INR in the database and can retry. If the payment fails, no mint call is made. The chain
never sees a failed fiat payment — no stuck escrows from partial transactions.

**Error case.** Stripe webhook succeeds but the mint tx reverts (e.g., out of gas). The watcher
detects no mint event within 5 blocks. Express then credits the user as pending-mint and retries
the relay. A background job completes the mint. The user sees "USDC pending" instead of a silent
loss.

## 2. Remit (Cross-Border Send)

```
Sender ──→ RemitScreen (amount, receiver wallet, corridor)
         ──→ POST /api/remit
         ──→ Express:
              1. Fetches USD/INR rate from OracleProxy (Chainlink)
              2. Deducts INR from User.balance (MongoDB)
              3. Calls relayer.relayTx() to create RemittanceEscrow
                 ──→ Polygon: transferFrom(sender, escrow, amount)
                 ──→ Polygon: store Escrow{ sender, receiver, amount, lockUntil }
              4. Returns escrowId, txHash
         ──→ Watcher detects EscrowCreated event
         ──→ Express stores Escrow record in MongoDB
         ──→ Notification sent to receiver ("You have an incoming remittance")
```

**Why deduct INR first.** The user's balance is the source of truth for available funds. Deducting
before the chain call prevents double-spend if the user submits two remittances from different
tabs. If the chain call fails, the deduction is reversed.

**Rate locking.** The rate from Chainlink at time of `POST /api/remit` is stored in the Escrow
document. The receiver sees `$120 USD locked at ₹83.50/USD = ₹10,020` regardless of rate changes
during the 72-hour escrow.

## 3. Claim (Receiver Releases Escrow)

```
Receiver ──→ ClaimScreen (see pending escrows)
           ──→ POST /api/claim { escrowId }
           ──→ Express:
                1. Verifies req.userId matches escrow receiver
                2. Checks !zkRequired || user.zkStatus.ageVerified
                3. Calls relayer.relayTx() to call release(escrowId)
                   ──→ Polygon: transfer(escrow, receiver, amount)
                   ──→ Polygon: emit EscrowReleased
                4. Returns txHash
           ──→ Watcher detects EscrowReleased event
           ──→ Express updates Escrow.status = 'released'
           ──→ MultiCurrencyWallet balance updated on Polygon
           ──→ Notification: "₹10,000 has been released to your wallet"
```

**ZK gate.** If the remittance corridor requires age or country verification (e.g., the sending
bank requires age 18+), the claim route checks `zkStatus` before calling `release()`. If
unverified, returns `403 ZK verification required` with a link to ZKScreen.

## 4. ZK Proof Submission

```
User ──→ ZKScreen
      ──→ Select proof type (age / country)
      ──→ Scan government ID (camera)
      ──→ Browser hashes relevant fields via NoirJS
      ──→ NoirJS generates Groth16 proof (~2-5 seconds)
      ──→ POST /api/zk/verify { proof, pubSignals, type }
      ──→ Express:
           1. Calls ZKVerifier.verify(proof, pubSignals) on Polygon
           2. If valid → User.zkStatus.{ageVerified,countryVerified} = true
           3. Returns { verified: true }
      ──→ ZKScreen shows success badge
```

## 5. Refund (Timelock Expiry)

Automatic, no user action required:

```
Watcher polls Escrow events
  → Finds Escrow where status == 'created' && lockUntil < now
  → Express calls relayer.relayTx() to call refund(escrowId)
  → Polygon: transfer(escrow, sender, amount)
  → Polygon: emit EscrowRefunded
  → Express updates Escrow.status = 'refunded'
  → Sender credited INR equivalent (at original locked rate or current rate)
```

**Why refund automatically.** If the receiver never claims (lost access, ignored notification),
the sender should not have to track down support. The timelock guarantees an exit. A background
cron (the watcher) processes expired escrows every 60 seconds.

## 6. Dispute

```
Either party calls dispute(escrowId) on-chain
  → Watcher detects Disputed event
  → Express updates Escrow.status = 'disputed'
  → Calls dispute.resolveDispute(escrowId)
     → LLM returns suggested split
     → Admin notified via dashboard
  → Admin reviews, clicks "Release" or "Refund"
     → Watcher picks up admin action
```

## 7. Gig Webhook (Automated Escrow)

```
Gig platform ──→ POST /api/webhook/gig-completed
               { jobId, workerWallet, clientWallet, amount, platform }
               → Express:
                   1. Validates webhook signature (platform secret)
                   2. Creates RemittanceEscrow via relayer
                   3. Client's USDC moved to escrow
                   4. Worker notified: "Your gig payment of $500 is ready to claim"
               → Worker logs into app, sees pending on ClaimScreen
```

## Flow Diagram (Text)

```
           ┌─────────┐
           │  User    │
           └┬───┬───┬┘
  INR deposit│   │   │ZK proof
             ▼   │   ▼
        ┌──────┐ │ ┌──────┐
        │Stripe│ │ │NoirJS│
        │Razor │ │ │WASM  │
        └───┬──┘ │ └──┬───┘
            │    │    │
            ▼    │    ▼
        ┌────────┴────────┐
        │  Express         │
        │  (orchestration) │
        └────────┬────────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
      ▼          ▼          ▼
┌─────────┐ ┌────────┐ ┌─────────┐
│ MongoDB  │ │ Relayer│ │ Erebor  │
│ (state)  │ │ (gas)  │ │ (keys)  │
└─────────┘ └────┬───┘ └─────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  Polygon            │
        │  MultiCurrencyWallet│
        │  RemittanceEscrow   │
        │  ZKVerifier         │
        │  OracleProxy        │
        └─────────┬──────────┘
                  │
                  ▼
          ┌──────────────┐
          │  Chainlink    │
          │  USD/INR Feed │
          └──────────────┘
```
