# ZK & GDPR

//tried doing proper noir circuits + groth16 verifiers. ~5k lines of
//contracts, a whole circuits/ dir, a ZKScreen on the frontend.
//never deployed. the frontend sent `0x` + `ab`.repeat(64) as proof,
//noir_js was never even npm installed, and the server said "yep
//youre verified" whenever the verifier address was empty (always).

the zk gate blocked one thing: claiming escrowed funds needed
ageVerified. but we already have DOB from aadhaar (govt id, not
user typed). so the whole thing became one line:

```
const age = ((Date.now() - new Date(user.kyc.verifiedDob).getTime()) / 31557600000) | 0;
if (age < 18) return res.status(403).json({ error: 'KYC age verification required' });
```

aadhaar-verified DOB is stronger evidence than any zk proof the
mvp would have produced, and it costs zero gas. the 5k lines of
circuits didnt know your birthday; the sandbox api did.

## why this works

| zk promised | reality |
|-------------|---------|
| "prove age without revealing DOB" | chain never saw DOB anyway. only the server has it, encrypted. |
| "regulators accept zk proofs" | regulators accept aadhaar. zk has zero regulatory precident in india. |
| "privacy preserving" | pii was never on chain. just addresses and amounts. |

//i wanted the zk thing to work, but it was solving a problem that
//didnt exist. the chain was already clean. the age check belonged
//at the api layer, where the data already lived.

## gdpr

gdpr comes down to:

- **minimised**: we store what we need. thats it. no names, DOBs,
  or aadhaar numbers touch polygon. the chain is pseudonymous.
- **purpose limited**: kyc data is for compliance. not shared, not
  sold, not exposed.
- **erasable**: `DELETE /auth/delete-account` wipes the mongo
  records. the chain keeps addresses -- theres no link back to a
  person without the db, and the db is gone.
- **protected**: totp secrets are AES-256-GCM before storage. kyc
  sits in mongo atlas with disk encryption.

//the blockchain layer is gdpr compliant by not putting pii on chain
//in the first place. no zk needed for that.

## what got deleted

- `ZKVerifier.sol` -- 91 lines, never made it on chain
- `AgeVerifier.sol` -- ~2500 lines of auto-generated code
- `CountryVerifier.sol` -- same, also ~2500
- `circuits/` -- noir packages for proving
- `frontend/src/zk.js` -- made `0x` + `ab`*64 look like a real proof
- `frontend/src/screens/ZKScreen.jsx` -- ui that never proved a thing
- `POST /zk/verify` route -- said yes to any string

**~5100 lines. zero functionality lost.** the best delete is the one nobody notices

## when to add zk back

if a specific corridor regulator demands on-chain age verification,
add it then. the architecture wont fight you: re-make ZKVerifier.sol,
compile the circuits, install noirjs. but until that regulator has a
name and an office address, its speculative code.

yagni.
