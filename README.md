# BlackSwan Relay

**The private emergency capital market for DeFi crises.** When a DeFi protocol goes undercollateralized, rescuers commit liquidity in the dark; Ethereum cryptographically proves the aggregate rescue is funded before atomically settling the recapitalization, without revealing who contributed or how much.

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

**ZK-enforced aggregate rescue round:**

```text
Protocol enters undercollateralized state (trigger is agreed)
        |
        v
rescuers post hidden commitments  c_1, c_2, ..., c_n
        |
        v
Noir/Circom circuit proves:  sum(c_i) >= T   (recapitalization target)
        |
        v
on-chain verifier emits  RescueTargetMet  (only when a valid aggregate proof passes)
        |
        v
atomic call to the distressed vault's recap function settles the rescue
        |
        v
an underfunded / invalid round is rejected on-chain
```

Individual contribution amounts are hidden from the settlement; only the aggregate capacity is proven.

---

## 3. Honest scope decisions (READ BEFORE BUILDING)

These were finalized after the implementation-standpoint analysis. **Do not violate them without a strong reason.**

1. **The MVP does NOT claim true set-anonymity.** EIP-8182 is status Review (not mainnet) and a Tornado-class set-membership pool is too heavy with a tiny demo anonymity set. The build claims: *individual contribution amounts are hidden; aggregate capacity is cryptographically proven*. The "who participated" set is not the headline privacy claim.
2. **One token, one distressed vault, three rescuers, fixed denominations** for the MVP.
3. **Proof is `sum(c_i) >= T` over Pedersen-style commitments with a per-rescuer nullifier** (so one address cannot double-count in a single round). This is simple aggregation + range arithmetic — intentional, so the ZK does not become a time sink.
4. **The demo must be non-simulated on a testnet** (Sepolia): a public-rescue comparison path (leaks amounts) vs the BlackSwan path (hidden contributions, valid aggregate completes) plus an invalid-round on-chain rejection.
5. **Do not pick up the other researched ideas** (Solver Conclave, Position Vault, ThresholdAudit) unless the BlackSwan build falls through — they are alternatives, not additions.

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
- `RecapVault` (contract): a simplified undercollateralized vault that accepts a rescue round.
- `BlackSwanRescue` (contract): orchestrates the round — collects hidden commitments, verifies the aggregate proof, calls `RecapVault` atomically, rejects invalid/underfunded rounds.
- `RescueCircuit` (Noir): proves `sum(c_i) >= T` with a nullifier per rescuer; amounts are private witnesses, aggregate bound and round id are public inputs.
- `RecapVerifier.sol`: generated from the Noir circuit (Barretenberg / UltraHonk path).
- `RescueTargetMet` event + per-round nonce bind.

---

## 5. Threat model

**What is hidden:** individual contribution amounts (from on-chain observers, explorers, other rescuers, and analytics).

**What is public:** the round id, the recapitalization target `T`, the aggregate proof of sufficiency, the `RescueTargetMet` event.

**Adversary:** the default Demo adversary is an underfunded or dishonest actor trying to pass an invalid round (covered amount < T, or a nullifier reused).

**Out of scope for the MVP (documented, not claimed):** true anonymity of the *participant set*, resistance to a malicious "undercollateralized" trigger oracle, and Sybil across rescuers. These are recorded as future work, not demoed as solved.

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

## 7. How the demo should read (judges)

1. A protocol enters the danger zone (undercollateralized state).
2. Show the **public** rescue path: everyone sees who contributed and how much — freeze/skip.
3. Show the **BlackSwan** path: three rescuers commit in the dark, `sum >= T` proves, the recap settles in one tx, the explorer shows only `RescueTargetMet` and no amounts.
4. A 4th actor tries an invalid/underfunded contribution -> proof fails -> round rejected on-chain.

---

## 8. Decision record

- **Track:** Private DeFi & Mempools (lead), aiming for Overall.
- **Prize targets:** Track 1 pool $40; Overall $180 (3 winners across tracks).
- **Selected over:** Solver Conclave (best backup, most technically impressive but medium feasibility + claimsmanship risk), Position Vault (most buildable but threat-model subtlety on public positions), ThresholdAudit (payments/wallets, narrow delta over AuditPay, included only as a possible second submission).
- **Candidate scores (weights: novelty/privacy/depth/eth/feasibility/demo/post):** BlackSwan 59, Solver Conclave 58, Position Vault 55, ThresholdAudit 52.

**Full decision + prior-art evidence:** [docs/novel-use-case-research.md](docs/novel-use-case-research.md)

---

## 9. Current status

Scaffold initialized, directories created, context captured. No code has been written yet — the circuit, contracts, deploy scripts, and frontend are all pending the build phase (see [AGENTS.md](AGENTS.md)).
