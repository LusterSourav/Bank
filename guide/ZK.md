# Zero-Knowledge Proofs

## Why ZK

KYC today means uploading documents to a server. That server holds your Aadhaar number, PAN, DOB
— the full set of details needed for identity theft. Users trust us with their money; making them
trust us with their biometric ID is a different ask.

ZK proofs flip this: the user proves "I am over 18" without revealing their birth date. The
server (and the contract) only see a boolean — `age_verified: true`. If the server is breached,
the attacker gets no identity documents.

For cross-border remittance, this matters because many corridors require age or residency
verification. ZK lets us satisfy regulators without storing the evidence that would be valuable
in a breach.

## Why Noir

Three options exist for EVM ZK: Circom (DSL, JavaScript tooling), Halo2 (ZK protocol, Rust),
Noir (DSL, Rust compiler, universal setup). Noir wins for three reasons:

1. **Universal Powers of Tau.** Noir uses the Groth16 proving system with the Perpetual Powers of
   Tau ceremony — a public, already-completed setup that thousands of projects have contributed
   entropy to. There is no trusted setup to run. Circom also uses Groth16, but the ceremony is
   the same one; no advantage either way. Halo2 does not need a setup but is harder to audit.

2. **NoirJS.** Noir compiles to a Solidity verifier and a WASM proving binary. NoirJS runs the
   prover entirely in the browser. The alternative is sending data to a server for proving, which
   defeats the purpose — the server sees the private inputs. NoirJS proves on the user's machine
   and sends only the proof.

3. **Readable circuit language.** Noir looks like Rust. Circom is its own language. For a team
   that knows TypeScript and maybe Rust, Noir is the shortest path to a correct circuit.

## Circuits

### Age (age.nr)

```
// ponytail: simple comparison, no date arithmetic needed
// govt ID hash already includes DOB, circuit just extracts year
fn main(dob_hash: Field, min_age: pub Field, signed_hash: Field) -> pub bool {
    let age = compute_age_from_hash(dob_hash);
    constrain age >= min_age;
    constrain verify_signature(signed_hash, dob_hash);
    true
}
// tried using unix timestamps directly, too brittle across formats
```

Public inputs: `min_age`, proof. Private inputs: `dob_hash`, `signed_hash`. The verifier on-chain
checks the proof and stores `age_verified = true` in the user's ZK status.

### Country (country.nr)

```
fn main(res_hash: Field, allowed: pub [Field; 10], signed_hash: Field) -> pub bool {
    let country = extract_country(res_hash);
    constrain member_of(country, allowed);
    constrain verify_signature(signed_hash, res_hash);
    true
}
```

Checks that the user's country of residence is in the allowed list (defined by the app, not the
user). For example, an employer might restrict remittances to India, Philippines, Bangladesh. The
circuit proves residency in one of them without revealing which.

## How Users Prove

1. User scans their government ID (Aadhaar, PAN, passport) via the app camera.
2. The app hashes the relevant fields (DOB for age, address for country).
3. NoirJS generates a proof in-browser (~2-5 seconds on modern phones).
4. The proof + public signals are sent to `POST /api/zk/verify`.
5. The backend calls `ZKVerifier.verify(proof, pubSignals)` on Polygon.
6. If valid, the user's `zkStatus` in MongoDB is updated.

Step 2 is the only point where raw PII exists, and it is in browser memory for the duration of
hash computation — a few milliseconds. The server never sees the ID data.

## Trusted Setup

A custom trusted setup ceremony is expensive ($50k+) and logistically hard — you need multiple
parties to show up with their entropy contributions. Noir uses the universal Powers of Tau from
the Perpetual Powers of Tau ceremony (currently at 54 contributions, ~175KB of entropy). Any
Groth16 circuit can use this. No ceremony to run.

## Cost

| Item | Cost |
|------|------|
| Proving (browser, WASM) | Free (user's CPU) |
| Verification (Polygon) | ~$0.0005 per verify |
| Trusted setup | $0 (universal PoT) |
| Circuit development | ~1 week |

## What We Fork

The circuits in `tisura-labs/zk-kyc-app` and `knot-inc/noxx-contract` are MIT-licensed Noir
circuits for age and country verification. We fork them, adapt the hash functions to our KYC
provider's output format, and compile with our proving key. The changes are minimal — the circuit
structure is the same, only the input encoding changes.
