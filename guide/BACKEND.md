# Backend Modules

## Why New Modules

The existing Express backend operates entirely in fiat: deposit INR, send INR, check INR balance.
Adding blockchain settlement means four new concerns the current code has no path for: signing
transactions, submitting to a chain, watching for events, and handling disputes. Each gets its
own module so the existing route handlers stay readable.

## Relayer (src/relayer.js)

**Why.** Users should not need to hold MATIC to move their money. Polygon charges gas in MATIC,
not USDC. If every user had to acquire MATIC before their first remittance, adoption would drop.

The relayer holds a small MATIC balance (~$10), accepts EIP-712 typed data signed by the user,
and submits the transaction. The user reimburses the relayer in USDC as part of the same batch.

**How.**

```js
// one route, one job
export async function relayTx(typedData, userSig) {
  const { to, value, data, nonce, deadline } = typedData.message
  if (deadline < Math.floor(Date.now() / 1000)) throw new Error('deadline passed')
  if (nonce !== await getNonce(relayerAddress)) throw new Error('bad nonce')

  const tx = {
    to, data, value,
    gasLimit: 200000,
    maxFeePerGas: ethers.parseUnits('50', 'gwei'),
  }
  const s = await relayerWallet.signTransaction(tx)
  const receipt = await provider.broadcast(s)
  return receipt.hash
}
// previous version used Multicall3, overkill for one tx
```

Replay protection via `nonce` + `deadline`. If the backend is compromised, the attacker has the
relayer key but needs user signatures to drain it. And the relayer only holds $10 of MATIC anyway;
the rest is in the escrow contracts.

## Erebor Client (src/erebor.js)

**Why.** A clean boundary between Node.js and the Rust wallet service. If Erebor's API changes,
only this file changes. If we switch to a different wallet backend, same thing.

**How.** Three exported functions (`createWallet`, `signTx`, `recoverWallet`), each
making an HTTP call to the Erebor REST API. Details in EREBOR.md. Environment variable
`EREBOR_URL` points to the Docker container.

## Watcher (src/watcher.js)

**Why.** On-chain events (escrow created, escrow released, dispute filed) need to update the
application database so the frontend can show current status and users get notifications. Polling
is simpler than running a full archive node with WebSocket subscriptions.

**How.** Runs as a `setInterval` loop in the Express process (Vercel's serverless functions make
this tricky — the watcher runs on the local dev server and a small VPS, not Vercel). Polls every
15 seconds for `EscrowCreated`, `EscrowReleased`, `EscrowRefunded` events from the
`RemittanceEscrow` contract using ethers.js. Updates the `Escrow` document in MongoDB and triggers
notifications.

```js
// 15s poll, good enough. tried websockets, too many reconnects.
export function startWatching() {
  setInterval(async () => {
    const evs = await escrowContract.queryFilter('*', lastBlock, 'latest')
    for (const e of evs) {
      if (e.event === 'EscrowReleased') {
        await Escrow.updateOne({ escrowId: e.args.escrowId }, { status: 'released' })
        notifyUser(e.args.receiver, 'Funds released')
      }
    }
    lastBlock = await provider.getBlockNumber()
  }, 15000)
}
```

## Dispute Handler (src/dispute.js)

**Why.** Escrows can go wrong: the receiver claims the work was not done, the sender claims the
receiver disappeared. A human mediator is expensive and slow. An AI-powered suggestion gets both
parties to an agreement faster.

**How.** When `dispute(escrowId)` is called on-chain, the event triggers the watcher which calls
`dispute.resolve(escrowId)`. The handler reads the escrow metadata (amount, timelock, any
messages or evidence stored in the off-chain DB) and sends it to an LLM prompt that returns a
suggested split — 50/50, full refund, full release. The admin reviews and executes via a
dashboard button.

```js
// LLM suggester, not arbiter. Admin always confirms the final call.
export async function resolveDispute(escrowId) {
  const e = await Escrow.findOne({ escrowId })
  const prompt = `Escrow $${e.amount} between ${e.sender} and ${e.receiver}. Timelock: ${e.lockUntil}. Suggest a fair split.`
  const suggestion = await callLLM(prompt)
  return suggestion
}
```

## Gig Webhook (src/webhooks/gig.js)

**Why.** Gig workers are a primary use case: someone in India completes a freelance job for a US
client, the client pays USDC, the worker receives in INR. Automating this through a webhook
means the flow works without manual escrow setup.

**How.** Accepts a POST with `{ workerId, clientId, amount, platform }`. Creates a remittance
escrow on Polygon (client deposits USDC), notifies the worker. The worker claims when work is
confirmed. Platform sends the webhook when both parties mark the job complete.

## Route Changes (src/routes.js)

New endpoints alongside existing ones:

| Route | Method | What it does |
|-------|--------|-------------|
| `/api/onramp` | POST | Takes INR, mints sINR on Polygon |
| `/api/remit` | POST | Creates escrow, returns escrow ID |
| `/api/claim` | POST | Releases escrow to receiver |
| `/api/rate` | GET | Returns USD/INR from Chainlink |
| `/api/relay` | POST | Submits meta-transaction |
| `/api/wallet` | POST | Creates Erebor wallet for user |

## File Additions

```
src/
├── relayer.js        [NEW — EIP-712 meta-tx submission]
├── erebor.js          [NEW — Erebor REST API client]
├── watcher.js         [NEW — Polygon event poller]
├── dispute.js         [NEW — AI dispute suggester]
└── webhooks/
    └── gig.js         [NEW — gig completion receiver]
```

## Model Changes (src/models.js)

```js
// fields added to User schema
walletAddress: String,
ereborWalletId: String,
// ZK removed — age check uses KYC-verified DOB from Aadhaar

const escrowSchema = new mongoose.Schema({
  escrowId: { type: String, unique: true, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverAddress: String,
  amount: Number,
  token: { type: String, enum: ['usdc', 'sinr'] },
  lockedRate: Number, // USD/INR at creation
  lockUntil: Date,
  status: { type: String, enum: ['created', 'released', 'disputed', 'refunded'] },
  txHash: String,
})
```
