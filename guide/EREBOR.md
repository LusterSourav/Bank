# Embedded Wallet (Erebor)

## Why Self-Hosted

Users need a Polygon wallet. The naive approach — generate a private key on the server, store it
in MongoDB — is a single point of compromise. The opposite extreme — make every user run a full
node and manage their own keys — kills adoption.

Erebor splits the difference. It is a self-hosted Rust service that manages keys using 2-of-3
Shamir secret sharing. No single server compromise reveals a key. No third-party SaaS provider
holds your users' wallets. No monthly fee per user.

Web3Auth/Privy solve the same problem as a service, but they cost $0.001-0.01 per MAU and your
users' wallets live on someone else's infrastructure. At 10,000 MAU that is $10-100/month for
something we can run for $5/month on a VPS. More importantly, a self-hosted wallet is auditable.
We know exactly how keys are split, stored, and signed.

## How It Works

Erebor exposes a REST API. The Express backend calls it like any internal service.

```
POST /api/v1/wallet
  → creates a new wallet (generates seed, derives address, splits key into 3 shares)
  → returns { walletId, address, publicKey }

POST /api/v1/{walletId}/sign
  body: { txData, chainId, nonce }
  → signs the transaction using 2-of-3 consensus (user share + relayer share)
  → returns { signature, r, s, v }

POST /api/v1/recover
  body: { share1, share2 }
  → reconstructs key from any 2 shares
  → returns { walletId, address }
```

## Key Distribution

```
Share 1 (device):   encrypted with user's Firebase UID, stored in localStorage
Share 2 (relayer):  encrypted with relayer key, stored in Express env vars
Share 3 (backup):   encrypted with user's backup phrase, printed during setup
```

Any 2 of 3 can sign. This means:

- If user loses their phone, the relayer + backup phrase recovers the wallet.
- If the server is compromised, the attacker has Share 2 only — cannot sign without Share 1.
- If the user wants to move to a new device, they authenticate (Firebase + OTP), submit Share 2
  from the server, and the new device gets a fresh Share 1.

## Integration Points

**src/erebor.js** — thin wrapper, three exports:

```js
export async function createWallet(uid) {
  const { walletId, address } = await ereborFetch('/api/v1/wallet', { userId: uid })
  await User.updateOne({ firebaseUid: uid }, { ereborWalletId: walletId, walletAddress: address })
  return { walletId, address }
}

export async function signTx(walletId, tx) {
  const { signature } = await ereborFetch(`/api/v1/${walletId}/sign`, { txData: tx })
  return signature
}

// 2-of-3: relayer share + user backup share
export async function recoverWallet(uid, backupShare) {
  const relayerShare = process.env.EREBOR_RELAYER_SHARE
  const { walletId, address } = await ereborFetch('/api/v1/recover', {
    share1: relayerShare,
    share2: backupShare,
  })
  return { walletId, address }
}
// the old web3auth integration used to live here, ripped out march 2026
```

## What It Replaces

The original plan used MetaMask Embedded Wallets SDK — import a library, call `login()`, get a
wallet. That saves 3 days of integration work but creates a perpetual cost and a dependency on
MetaMask's infrastructure. Erebor costs a weekend of setup and then nothing, and we control the
key material entirely.

## Deployment

Erebor ships as a Docker image (official `haeli05/erebor`). A `docker-compose.yml` in the repo
root runs it alongside nothing else — it is a single binary, no database (keys in encrypted files
on disk), health check at `/health`.

```
erebor:
  image: haeli05/erebor:latest
  ports:
    - "3002:3000"
  volumes:
    - erebor-data:/data/keys
  environment:
    - EREBOR_SECRET=${EREBOR_SECRET}
    - NETWORK=polygon-amoy
```

A 1GB VPS ($5/mo) handles thousands of wallets. The database is just encrypted key shards on
disk.
