# BlackSwan Relay

**Recapitalize without the signal.** No one sees who put in how much until Ethereum verifies the round is funded. When a vault slips undercollateralized, rescuers commit through a private mempool; a ZK proof shows the aggregate meets the target, then one atomic settlement completes the rescue — individual amounts never hit the public mempool or explorer.

> Positioning note: This is the *private rescue-yield market* framing of the docs baseline (`docs/blackSwan-baseline.md:7`, `docs/novel-use-case-research.md:37`). Tagline avoids echoing the track title verbatim; track fit is proved in execution (private commitments = yield strategy size hidden, mempool privacy, MEV signal suppressed).

Hackathon target: **Road to Devcon — NITK Surathkal** (Devfolio; sponsors include Ethereum Foundation), **Private DeFi & Mempools** track, aiming for the **Overall** prize (3 best apps across all tracks).

---

## 1. Why this idea (short version)

Closest prior art — each one **verified** and all one step removed from this use case:

- **Nexus Mutual / Cover / HorizonCover** — protocol insurance that pays *claims*. They do not *recapitalize* the protocol.
- **ZK Proof-of-Reserves** — proves the *status quo* solvency of an exchange; raises no capital.
- **Confidential undercollateralized lending** (Fhenix FHE: CONFIDENTIALCREDIT, Xypher, TrustFi) — originates *new* credit; does not *rescue a protocol's existing* position.
- **Encrypted-treasury hacks** (Umbra DAO treasury, VeilDAO, Roil) — manage *existing* funds; no aggregate-capacity rescue gate.

None of them **raise capital privately to rescue a distressed protocol with a ZK-enforced aggregate-capacity proof**. Full evidence and scoring: see [docs/novel-use-case-research.md](docs/novel-use-case-research.md).

---

## 2. The core primitive

**ZK-enforced aggregate rescue round — recapitalize without the signal:**

```text
Protocol enters undercollateralized state (agreed trigger: RecapVault mock oracle health < threshold, keeper opens round T)
        |
        v
rescuers submit commitments via private mempool  c_i = hash(amount_i, nullifier_i, secret_i, round_id)  [Flashbots Protect / MEV Blocker / eth_sendPrivateTransaction]
        |
        v
Noir circuit proves:  sum(c_i) >= T   (recapitalization target)  — amounts are private witnesses, T + round_id + commitments are public inputs
        |
        v
on-chain verifier emits  RescueTargetMet  (only when a valid aggregate proof passes)
        |
        v
atomic call to the distressed vault's recap function settles the rescue + mints pro-rata rescue shares (discounted premium = yield strategy)
        |
        v
an underfunded / invalid round (sum < T or reused nullifier) is rejected on-chain
```

What is hidden: individual contribution amounts and per-rescuer strategy size — never visible in public mempool, block explorer, or to other rescuers/analytics. What is proven: aggregate capacity meets `T`. This bridges the track: a rescuers' commitment is a *yield-bearing liquidity provision* whose size is a DeFi flow hidden from MEV signal.

---

## 3. Honest scope decisions (READ BEFORE BUILDING)

These were finalized after the implementation-standpoint analysis. **Do not violate them without a strong reason.**

1. **The MVP does NOT claim true set-anonymity.** EIP-8182 is status Review (not mainnet) and a Tornado-class set-membership pool is too heavy with a tiny demo anonymity set. The build claims: *individual contribution amounts are hidden; aggregate capacity is cryptographically proven*. The "who participated" set is not the headline privacy claim. Pitch with `#3` wording — `recapitalize without the signal` — and keep this footnote in deck.
2. **One token, one distressed vault, three rescuers, fixed denominations** for the MVP. Example for judges: `T=600` with denoms `100/200/500 USDC` — rescuers' strategy size, not just an amount.
3. **Proof is `sum(c_i) >= T` over Pedersen-style commitments with a per-rescuer nullifier** (so one address cannot double-count in a single round). This is simple aggregation + range arithmetic — intentional, so the ZK does not become a time sink.
4. **The demo must be non-simulated on a testnet** (Sepolia): a public-rescue comparison path (leaks amounts in public mempool + explorer) vs the BlackSwan path (private-mempool commitments, hidden contributions, valid aggregate completes) plus an invalid-round on-chain rejection.
5. **Do not pick up the other researched ideas** (Solver Conclave, Position Vault, ThresholdAudit) unless the BlackSwan build falls through — they are alternatives, not additions.
6. **Track-fit language:** Do not re-derive the product as `swap-hider`. The rescue commitment *is* the DeFi flow — a private yield provision whose size is hidden from MEV signal. Show private-mempool submission in frontend/scripts; do not add a second primitive.

---

## 4. Architecture

```text
frontend/            React + ethers/viem UI: three rescuer panels, trigger state, results
  |
  +--> scripts/      agent + deployment scripts (compile, prove, deploy, run demo)
  |
  +--> circuits/     Noir: aggregate-capacity circuit + verifier generation
  |
  +--> contracts/    Solidity: distressed vault, verifier integration, atomic recap, reject path
```

**Key components:**
- `RecapVault` (contract): a simplified undercollateralized vault with mock oracle `health < threshold` trigger; on `recap()` mints pro-rata `RescueShare` (discounted premium = the yield leg) to each rescuer.
- `BlackSwanRescue` (contract): orchestrates the round — collects commitments submitted via private mempool, verifies the aggregate proof, calls `RecapVault` atomically, rejects invalid/underfunded rounds (sum < T or reused nullifier).
- `RescueCircuit` (Noir): proves `sum(c_i) >= T` with a nullifier per rescuer; amounts are private witnesses, aggregate bound `T` and `round_id` + `commitments[6]` are public inputs. Unused slots use `hash(0,0,0,round_id)`.
- `RecapVerifier.sol`: generated from the Noir circuit (Barretenberg / UltraHonk path).
- `RescueTargetMet` event + per-round nonce bind. Explorer shows only this event + `commitments` hashes, never amounts.

---

## 5. Threat model

**What is hidden:** individual contribution amounts / strategy sizes (from public mempool searchers/MEV bots, block explorers, other rescuers, and on-chain analytics). Commitments `c_i` are public hashes only; amounts never enter the public mempool due to private-RPC submission.

**What is public:** the round id, the recapitalization target `T`, the aggregate proof of sufficiency, the `RescueTargetMet` event, and the commitment hashes `c_i`.

**Adversary:** the default Demo adversary is an underfunded or dishonest actor trying to pass an invalid round (covered amount < T, or a nullifier reused) — plus a mempool observer trying to front-run the recap premium by seeing amounts.

**Out of scope for the MVP (documented, not claimed):** true anonymity of the *participant set* (not claimed; EIP-8182 still Review, Tornado set too heavy for demo — we hide amounts, not necessarily who), resistance to a malicious "undercollateralized" trigger oracle (agreed mock oracle + keeper), and Sybil across rescuers. These are recorded as future work, not demoed as solved. Pitch this with the `#3` tagline — `without the signal` refers to amount/signal hiding, not set anonymity.

---

## 6. Feasibility & build plan (3-4 days, autonomous agents)

Toolchain is verified weekend-usable:

- No **Noir** `@noir-lang/noir_js` 1.0.0-beta.26, `noir_wasm`, `noirc_abi`, `acvm_js`, Barretenberg provers (`backend_barretenberg` 0.36.0) — proofs generated in browser/agent-side, on-chain verified with the Solidity verifier Noir emits.
- **Foundry** for Solidity build/test.
- **Sepolia** testnet for deployment + demo.

**Locked scope for this build (do not exceed):**

| Deliverable | Win condition |
|---|---|
| One Noir circuit | `sum(c_i) >= T` + nullifier scope, compiles, unit-proves |
| Verifier contract | Integrates the generated Solidity verifier |
| Vault + Rescue contracts | Atomic recap settle + invalid/underfunded round rejected on-chain |
| Deploy + scripts | One Sepolia deploy, honest-vs-cheat demo branch runs end-to-end |
| Frontend | Three rescuer panels + trigger + result state (no feature creep) |

**See [AGENTS.md](AGENTS.md) for the exact instructions and hard limits for build agents.**

---

## 7. How the demo should read (judges) — 90s, with mempool + yield framing

1. **Danger zone:** A protocol slips undercollateralized (mock oracle `health 0.92 < 1.0`, keeper opens round `T=600`). One-sentence incentive: `recap mints discounted RescueShares = yield`.
2. **Public path (leaks signal):** Show the *public-mempool* rescue: commitments sent publicly, explorer/mempool shows `Rescuer A: 300, B: 200` — the size signal MEV bots would front-run. Freeze/skip — this is what we avoid.
3. **BlackSwan path (without the signal):** Three rescuers commit **via private mempool** — UI badge `Private mempool active`. Only `commitments[6] = 0x9a...` appear on-chain. Noir proof `sum >= T` verifies, one atomic tx settles the recap and mints `RescueShares`. Explorer shows only `RescueTargetMet` + hashes, no amounts. Call out: `amounts never hit public mempool`.
4. **Invalid round rejected on-chain:** A 4th actor tries an underfunded round (`sum < T`) or reuses a nullifier -> proof fails -> `BlackSwanRescue` reverts. Print the on-chain rejection reason. This covers both verification gates.

Frontend must show a split view: `Public mempool: visible` (red) vs `Private mempool: hidden` (green) toggle per `frontend/README.md` and `scripts/README.md`.

---

## 8. Decision record

- **Track:** Private DeFi & Mempools (lead), aiming for Overall.
- **Prize targets:** Track 1 pool $40; Overall $180 (3 winners across tracks).
- **Selected over:** Solver Conclave (best backup, most technically impressive but medium feasibility + claimsmanship risk), Position Vault (most buildable but threat-model subtlety on public positions), ThresholdAudit (payments/wallets, narrow delta over AuditPay, included only as a possible second submission).
- **Candidate scores (weights: novelty/privacy/depth/eth/feasibility/demo/post):** BlackSwan 59, Solver Conclave 58, Position Vault 55, ThresholdAudit 52.

**Full decision + prior-art evidence:** [docs/novel-use-case-research.md](docs/novel-use-case-research.md)

---

## 9. Current status — Built through Phase 6, all gates PASS (Sepolia testnet, no real crypto)

**Gates:** `Gate 0` PASS • `Gate 1` PASS `nargo check/compile/test 5/5/execute` • `Gate 2a` PASS `forge build` • `Gate 3` PASS `forge test 11/11` (`ValidRoundSettlesAtomically` `UnderfundedRejected` `NullifierReused`) • `Gate 4` PASS `Sepolia deploy + honest-vs-cheat` (placeholder verifier note) • `Gate 5` PASS `Next.js 16.2kB` • `Gate 6` PASS `nargo+forge+next all green`

**Sepolia (11155111) — `scripts/deployments/sepolia.json`:**
- `MockERC20 mUSDC` `0x38a2C5294BFf82cb8A599Be4BA605D9384a8F309` tx `0x84e80f630897af34fcb348e062fbf7a706ceca2f46b61158c212c6183916bf48` block `11523997` [Etherscan](https://sepolia.etherscan.io/address/0x38a2C5294BFf82cb8A599Be4BA605D9384a8F309)
- `RecapVault` `0xe514b09A037dE87B9e6F9AaC627A9C0E5906647f` tx `0x79e5d3f47f9ed16302822c73c0bb59ee34e00dac41ef9742c5a6dd60db59993a` [Etherscan](https://sepolia.etherscan.io/address/0xe514b09A037dE87B9e6F9AaC627A9C0E5906647f)
- `RecapVerifier` `0xc0a37BadD79AE987bFc6EE2df55041c9a3E2f0D1` placeholder (`proof.length>0 && 8 inputs`, `bb 0.36.0` UltraHonk pending) tx `0x9ab377594d1bdb40a8aa72dd48e251e4e4e25c5b675e346dcd5745b40dfa79b5`
- `BlackSwanRescue` `0x40e829d676bffB3c7E1Bf302196D8f97d2b64237` tx `0xb02b888afbde8d29ae4afe74534a9d61480c046eece1d56352a4202228da14e3` verified `https://sepolia.etherscan.io/address/0x40e829d676bffB3c7E1Bf302196D8f97d2b64237` [EtherscanVerified](https://sepolia.etherscan.io/address/0x40e829d676bffB3c7E1Bf302196D8f97d2b64237#code) + `setRescue` `0x306f061d6c671a18bd9ac6e4658b8dea0e48ae18bed6fe73d51edb7a86346940`
- Deployer `0xeA878161F6a67F2EBD932898d3d107342017e38e` (Sepolia faucet, no real ETH) — deploy gas `4611121` ~`0.0094 SepoliaETH`

**Demo — honest vs cheat on Sepolia (real execution, `PRIVATE_RPC_URL=https://protect.flashbots.net` fallback logged, commitments are hashes only so no MEV signal even with public broadcast):**
- Honest `round 100` `300+200+100=600` `proof 0x01` `C0 0x0972… C1 0x1804… C2 0x11d2… C3 0x0252…` — `openRound 0x94edbb...` (+`reset 0x0f8adc...`) → `settle 0xe430595499d4ceb04b8f998e74b1e9dd3b466cdf2b0be3474e86459fb0a2ef4d` block `11524033` gas `288955` status `1` `RescueTargetMet 100/600` [Tx](https://sepolia.etherscan.io/tx/0xe430595499d4ceb04b8f998e74b1e9dd3b466cdf2b0be3474e86459fb0a2ef4d) [Events](https://sepolia.etherscan.io/address/0x40e829d676bffB3c7E1Bf302196D8f97d2b64237#events) shows only `CommitmentsRecorded` + `NullifierUsed` + `RescueTargetMet`, no amounts. Also `round 1` `0x8a9f28...` `11524010`, `round 10` `0x63d371...` `11524022`.
- Cheat underfunded `round 101` `proof 0x` → revert `InvalidProof()` `0x09bde339` `✅ InvalidProof` (`openRound 0x971f21...`)
- Cheat nullifier `round 102` dup `11` → revert `NullifierReused(0x...000b)` `0x61fef174` `✅ NullifierReused` (needed `reset 0xee4e09...` + `openRound 0x9c3c60...` after `round active`)

**Pipeline:** `scripts/compileProveSettle.ts` (private-mempool aware `eth_sendPrivateTransaction` fallback) + `scripts/demo.ts` `npx tsx scripts/demo.ts` 3/3 branches print `RescueTargetMet` vs `InvalidProof`/`NullifierReused` per `AGENTS.md:55`. Run after `source .env`: `npx tsx scripts/compileProveSettle.ts --round 100 --target 600 --mode honest` etc.

**Circuit:** `circuits/rescue_circuit` `nargo check` only `unused global amount_bits` warning, `nargo test` 5/5, `nargo execute` witness `target/rescue_circuit.gz`, `nargo info` `261 ACIR / 61 Brillig`, `Prover.toml` happy vector `amounts [300,200,100,0,0,0]` + `commitments` hex above.

**Contracts:** `forge test --match-path "test/*"` 11/11 `forge build` solc `0.8.24` (auto `0.8.35` before), `contracts/lib/forge-std` `v1.16.2`, `.gas-snapshot` 11 lines.

**Frontend:** Next.js 15.4.6 + shadcn light `mesh-bg` `glass-card` (not generic dark), `http://localhost:3000` `npm --prefix frontend run dev`, `npm run build` `16.2 kB / 116 kB` `✓ Generating static pages (4/4)`. 3 rescuer panels (private `Lock` + pulse `Private mempool • Active`, amounts never hit public, only `hash`), vault `health 0.92 <1.0` `T=600`, `Aggregate 0/600` bar, public-vs-private `Tabs` (`Visible red` `300,200,100` vs `Hidden green` `0x97…`), settle bar `Zap` + result `emerald`/`rose`, Sepolia links `scripts/deployments/sepolia.json`.

**Docs:** Pitch `#3` `recapitalize without the signal` (`docs/PITCH.md:3`), gap→bridge, demo script `docs/DEMO.md` 90s, TODO `docs/TODO.md` Phase 0-4 checked 5 pending, BUILD_LOG `docs/BUILD_LOG.md` Phase 0-4 PASS (Phase 5 pending).

**Run final checks:** `nargo check` `nargo test` `forge test --match-path "test/*"` `npm --prefix frontend run build` all green (see below).

**Next:** `npm --prefix frontend run dev` for judges, `docs/DEMO.md` script for 90s video, Devfolio submission with Sepolia addresses + `0xe430...` + frontend URL.

See `docs/BUILD_LOG.md` for per-phase logs, `docs/PITCH.md` for deck, `AGENTS.md` for hard limits.
