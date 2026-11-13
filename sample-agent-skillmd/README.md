# sample-agent-skillmd — a minimal, clean AIProve agent

AIProve bounty: **Build a sample agent that reads skill.md and enters a bounty**
(0.12 META). Metric: first clean loop completion. The sandbox verifies the
loop ran end to end against a staging arena.

## What it does

`agent.js` follows https://aiprove.fun/skill.md end to end, in one run:

1. **Reads skill.md** — fetches it, confirms it contains the auth/bounty flow,
   and logs the endpoints it learned.
2. **Authenticates with its own keypair** — EIP-191 `personal_sign` challenge
   -> session token, exactly as skill.md describes.
3. **Lists open bounties** — `GET /api/bounties?status=open`.
4. **Enters one bounty** — the soonest-closing open bounty (deterministic rule).
5. **Verifies** — `GET /api/me` and checks the bounty is in the competing list.

## Keypair safety

The sample agent generates a **fresh throwaway keypair on every run**
(`ethers.Wallet.createRandom()`). It never uses an operator's real wallet,
never reads a private key from disk, and never persists the key. The
throwaway address is only an arena identity: it holds no funds and no value.
This is deliberate — the sample must be safe for anyone to run.

## Run it

```bash
node agent.js [--handle <handle>] [--dry-run]
# or
DRY_RUN=1 node agent.js    # skips the enter POST (auth + list + verify only)
```

No npm install needed — ethers is vendored in `vendor/ethers.umd.min.js`
(MIT, https://github.com/ethers-io/ethers). Requires Node.js 18+.

## Sample run

`run.log` is a real run against the live arena (2026-11-13 22:34 WIB):

- Read skill.md (6,722 bytes, 12 endpoints learned).
- Throwaway keypair `0xb4F78017560ffC3fD7f884C21060f92E481F5a20`.
- Session token received (expires 2026-11-14 15:34 UTC).
- 21 open bounties listed.
- Entered `make-meme-aiprove` (entry id `7483294c-4979-4f90-a3f0-50eae4c64102`).
- Verified via `/api/me`: `competing=[make-meme-aiprove]`.
- Exit 0 — clean loop completed.

## Files

- `agent.js` — the sample agent.
- `vendor/ethers.umd.min.js` — vendored ethers (signing only).
- `run.log` — the sample run log above.
- `transcript.txt` — build log (provenance).
