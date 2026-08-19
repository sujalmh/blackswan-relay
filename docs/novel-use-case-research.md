# Road to Devcon NITK — Novel Use-Case Research (final)

Prepared for the **Road to Devcon — NITK Surathkal** hackathon (Devfolio; sponsors include Ethereum Foundation). Tracks confirmed from the event page: **Private Wallets and Payments**, **Private DeFi & Mempools**, **Private AI on Ethereum**, plus **Overall** (3 best across all tracks, weighted by execution, technical depth, UX, meaningful privacy primitive use, and post-hack shipment plausibility).

Constraint honored from the prior run: payments/wallets are included **only** if the use-case is genuinely novel, not "private payment." The bar for every idea is: *what is the closest thing that already exists, and why is this not that?*

---

## 1. The 2026 novelty frontier (what is already crowded)

The following are **verified, close, live** prior-art clusters. Any new idea must be checked against these; an idea that lands inside one is not novel.

| Cluster | Verified examples (primary sources) | Why it is crowded |
|---|---|---|
| Confidential ERC-20 / encrypted treasury | Fhenix CoFHE confidential ERC-20 projects; Arcium MPC treasury hacks (Umbra DAO treasury); VeilDAO on Fhenix; Roil on Canton; zkVaultService (compliant USDC) | "Private/encrypted vault" is a solved hackathon trope in 2025-26 |
| Intelint / encrypted-solver and sealed-bid | ETHGlobal Lisbon 2026: **Aphotic** (redemption-carry vault + sealed-order batch auction on Sui), **Overlap** (sealed two-party negotiation via TEE), **VeilSolver** (TEE private solver) | Sealed orderbooks + TEE solvers already built at ETHGlobal |
| Shared / hidden-action vaults | ETHGlobal Lisbon 2026: **Agora** ("members public but not who acts", ENS seats, self-expiring mandates) | "Group acts privately" is taken |
| Agent payment security | MinMandate (ePrint 2026/1674, GitHub `Zora-G/minmandate`), ETHGlobal: **HumanMandate**, **Do Not Rug Me** (agent allowance caps), **PlanBound** | Agent spend-governance is a dense 2026 cluster |
| Private benchmarking | TRUCE (arXiv 2403.00393): private benchmarking of LLMs against hidden tests (confidential computing / crypto), 2024 | "Hidden-benchmark evaluation" exists as a research primitive |
| Anonymous payments with oversight | **AuditPay** (ePrint 2026/1118): Ethereum payment mixer, budgeted per-address monitoring enforced via ZK | Payments + controlled oversight already designed |
| Native private transfers | EIP-8182 (Private ETH/ERC-20 transfers, status Review), EIP-5566 stealth, zk.money/Aztec (sunset -> ejector repo) | Plain "private payment" rail is established |
| Confidential undercollateralized lending | Fhenix FHE builds: CONFIDENTIALCREDIT, Xypher, TrustFi | "Private lending" is a crowded hackathon theme |
| Proof-of-reserves / solvency | ZK Proof-of-Reserves (Circom/Groth16), exchange PoR commitments, Starkproof | "Privacy-preserving solvency" is a trope |
| Protocol / param insurance | Nexus Mutual, Cover, HorizonCover (parametric protocol insurance); "FDIC for DeFi" Defisurance | "Insure/pay claims" exists |
| Anti-collusion private voting | MACI (PSE), CipherVote, A-MACI, many MACI-based votes | Private governance voting is built |

**The thin valleys** — where the closest verified prior art is *one step removed*, not a match:
- **Private recapitalization / bail-in** of a distressed protocol (liability-side rescue, not insurance payout).
- **Hidden adversarial accreditation of DeFi solvers** (on-chain, permissionless, slashable; not an ML benchmark, not a public scoreboard).
- **Privacy of position / liquidation health** (hidden collateral-health proofs, liquidator front-running).

---

## 2. Candidates that survive the filter

### Idea A — BlackSwan Relay (refined)
**Name + pitch:** BlackSwan Relay — the private emergency capital market. When a protocol goes undercollateralized, rescuers commit liquidity in the dark; Ethereum proves aggregate commitments meet the rescue target before atomically settling the recap, without revealing who contributed or how much.

**Problem:** Today, when a DeFi protocol is undercollateralized, the "rescue" is either an uncoordinated public fire-sale (exposes every contributor + amount, invites front-running and free-riding) or it doesn't happen and the whole LP base absorbs loss. Insurance (Nexus Mutual, Cover, HorizonCover) pays *claims*; it does not *recapitalize* the protocol. Proof-of-reserves proves current solvency; it does not raise new capital privately.

**Why privacy matters:** If aggregate capacity is revealed before funding, *each* rescuer's identity and amount is public — that's the very reason large actors don't participate (reputation, price impact, tax, counterparty-signal). Privacy makes the *participation* possible.

**Novelty:** The primitive is a **ZK-enforced aggregate rescue round**: commit -> hidden contributions -> prove `aggregate >= target` -> atomically settle a recapitalization -> slash/reject partial rounds — while never revealing individual amounts. No verified project (research or hackathon) does private *liability-side* recapitalization. Closest verified neighbors are all on the *asset/insurance/credit* side (proof-of-reserves, protocol insurance, confidential lending, encrypted treasury), not this *rescue* side.

**Ethereum role:** Needs an L1 you can't corrupt + public settlement of a ZK proof of aggregate commitment + atomic multi-party settlement. Ethereum's PRIME/privacy-verifier + public-pool primitives (e.g. Tornado-style set membership, EIP-8182-style shielded pool) supply the unlinkability rail.

**Technical approach:** Noir/Circom circuit proving `sum(c_i) >= T` over hidden Pedersen commitments `c_i`, with a nullifier per rescuer so one address can't double-count; on-chain a verifier contract emits `RescueTargetMet` only when a valid aggregate proof passes, then atomically calls the distressed vault's recap function; per-round `rescue_id` nonce binds rounds. MVP uses one token, one distressed vault, three rescuers, fixed denominations.

**MVP (3-4 days, autonomous agents):** one ERC-20 + one undercollateralized vault contract; Noir circuit for aggregate-capacity proof; Sepolia verifier; a UI that lets three "rescuers" commit privately, then watch the recap settle in a single atomic tx; an explicit on-chain-reject path for an underfunded round.

**Killer demo:** A protocol enters the danger zone. Show the *public* rescue path (everyone sees who contributed how much — freeze/skip) vs the *BlackSwan* path (three commits in the dark, `sum >= target` proves, recap settles in one tx, explorer shows only "RescueTargetMet," no amounts). Then a 4th actor tries to commit an invalid amount -> proof fails -> round rejected on-chain.

**Existing solutions (closest, and the delta):**
- Nexus Mutual / Cover / HorizonCover — pay claims, don't recapitalize. *Not the same liability axis.*
- ZK Proof-of-Reserves — proves the *status quo* solvency, raises no capital. *Not a raise.*
- Confidential undercollateralized lending (Fhenix FHE: CONFIDENTIALCREDIT, Xypher) — originates *new* credit to borrowers; does not *rescue a protocol's* existing position. *Origination, not rescue.*
- Encrypted-treasury hacks (Umbra, VeilDAO) — manage *existing* funds privately; no aggregate-capacity rescue gate. *Different object.*
- Private Liquidity Matching via MPC (ePrint 2021/475) — MPC netting for RTGS gridlock; centralized-bank setting, not a permissionless on-chain rescue round.

**Risks:** Defining "undercollateralized" needs an agreed trigger (automate via a price/health oracle or a keeper-disputed path); rescuers' incentive/return must be legible in the demo; circuit must be simple enough to finish in 3-4 days.

**Score:** Novelty 9 | Privacy significance 9 | Technical depth 8 | Ethereum relevance 9 | Feasibility 7 | Demo 9 | Post-hack 8

### Idea B — Solver Conclave (hidden adversarial accreditation)
**Name + pitch:** Solver Conclave — a ZK gate that lets a protocol *continuously test solvers on hidden challenge orders* and get a slashable proof of coverage, average regret, and policy compliance — without leaking the orders, the routes, or the solver's strategy.

**Problem:** Solver networks and aggregators admit solvers on *public* scoreboards (Minotaur/Bittensor leaderboards, Chainscore reputation, OKX baseline/fairness rules). Public benchmarks are gameable: a solver optimizes for the *known* set and skips the hard (but ungraded) orders. There is no way to accredit "did the solver actually handle the hard stuff."

**Why privacy matters:** If the benchmark set is hidden, a solver cannot memorization-optimize. If the *evaluation* is hidden, a solver cannot selectively reject difficult orders without the protocol seeing it. If routes/strategy stay private, a solver's proprietary routing is not copied by competitors.

**Novelty:** Combines **hidden challenge generation + on-chain slashable accreditation of solver behavior**. The distinction from verified prior art is precise: TRUCE (private benchmarking) is about *LLMs against hidden tests*, not *DeFi solver behavior accredited on-chain*; Minotaur/OKX/Chainscore are *public* scoreboards; VeilSolver/Aphotic hide a *single* trade's route, not solver *performance over a batch*.

**Ethereum role:** Public settlement of an accreditation proof + a programmatic gate ("only solvers with a valid epoch credential may bid in my auction") + staking/slashing on-chain. This is infrastructure, not a dashboard.

**Technical approach:** Commit-band: protocol commits to a random (VRF-seeded) batch of orders as a Merkle root; solver stakes, commits to processing the whole batch; solver executes off-chain; solver produces a ZK proof over a fixed route graph (e.g. 3 pools, 1-2 hops, snapshot reserves) that `coverage = 100%`, `avg regret <= eps` (regret computed against the optimum within the fixed graph), `failure rate <= delta`, zero policy violations — with individual orders, routes, and per-order results as private witnesses. On-chain verifier turns the proof into a `SolverCredential`; an auction contract programmably requires it.

**MVP:** small N (5 orders), fixed 3-pool graph, Noir circuit, Sepolia verifier; demo an honest solver (5/5, valid) vs a skipping solver (coverage < 100% -> proof invalid -> stake/skip + rejected bid).

**Risks:** Proving "no better route exists" inside a general graph is the hard part — must fix the graph and snapshot exactly (disclose the regret baseline up front); economic questions (who funds challenges, collusion on the challenge set, solver Sybils) must be answered in the pitch. Feasibility is medium.

**Score:** Novelty 9 | Privacy significance 8 | Technical depth 9 | Ethereum relevance 9 | Feasibility 6 | Demo 8 | Post-hack 9

### Idea C — Position Vault: prove you are not liquidatable (without showing your wallet)
**Name + pitch:** Position Vault — a borrower proves "my position is above the liquidation line" (or "this liquidation is valid") with a ZK proof, while a liquidator/receiver learns nothing about the borrower's collateral or other wallets.

**Problem:** In DeFi lending, liquidators and MEV watchers monitor position health to front-run liquidations; a *borrower* who wants to dispute/certify that a liquidation was invalid, or to pre-empt a predatory liquidation, currently must expose their entire position and wallet graph to do so.

**Why privacy matters:** Position *health* is a private fact — it reveals leverage, holdings, and panic points. A borrower should be able to *prove the relevant fact* (health above the line, or a liquidation was mis-priced) without opening the whole book.

**Novelty:** Literature hits for *private* liquidation health are effectively zero (searches returned no primary research; Defi-Liquidation-Risk-Shield is *public* monitoring). Confidential-lending (Fhenix FHE) covers *origination* and *ongoing* confidentiality via FHE, but not *comparison/dispute primitives* like "prove health > threshold" or "prove the oracle price was stale" with ZK. The distinction is *proof-of-threshold health as a ZK primitive*, not *confidential accounting*.

**Ethereum role:** Needs on-chain position state + oracle price feeds + a ZK verifier to turn an off-chain health computation into an on-chain-enforceable fact (e.g. a keeper/liquidator check, a dispute gate).

**Technical approach:** Noir circuit over `(collateral, debt, oracle_price)` proving `LTV < threshold` with the actual asset amounts as private witnesses and only the threshold outcome public; optionally a second circuit proving "given oracle price p_t, a liquidation engine marked me liquidatable, but p_t was stale/wrong" without revealing amounts. MVP binds to a simplified lending contract on Sepolia.

**Risks:** In live lending, position state is already public (per-collateral), so the *privacy* depends on a borrower holding a *private/aggregate* position (e.g. multi-wallet, shielded) — the honest demo must use a scenario where the health is otherwise hidden. Judges may probe "where does the private state live?" — answer: the borrower's private (possibly shielded/off-chain) aggregate, not the on-chain per-wallet state.

**Score:** Novelty 8 | Privacy significance 8 | Technical depth 8 | Ethereum relevance 8 | Feasibility 8 | Demo 8 | Post-hack 7

### Idea D — ThresholdAudit Wallet (payments/wallets, included only because it clears the bar)
**Name + pitch:** ThresholdAudit Wallet — a wallet where payments **below a configurable threshold are fully private**, and payments **above it produce an auditable ZK receipt** (for compliance/sanctions) — without revealing the under-threshold history to the auditor.

**Problem:** Pure-private wallets are blocked by regulators and pure-auditable wallets leak everything. The synthesis — *value-thresholded audit, not address-thresholded audit* — is not built.

**Why privacy matters:** Daily small payments stay private (the bulk of personal finance), while large moves (tax/material/sanctions-relevant) become verifiable *without* exposing the small ones. This is the "private wallet that can actually ship" position.

**Novelty:** The closest verified prior art is **AuditPay** (ePrint 2026/1118) — an Ethereum mixer with *budgeted per-address monitoring*. AuditPay monitors **addresses**; ThresholdAudit instruments **value thresholds** (above-X reveals, below-X stays private) and produces a *receipt* hybrid with EIP-8182/EIP-5566 stealth rails. The delta is real but narrow, so this is the **scoped "only if you want a wallets entry"** pick, not a lead.

**Ethereum role:** EIP-8182 (native private transfers, Review status) + EIP-5566 (stealth) + AuditPay-style selective encryption; Noir circuit proving "payments < T are hidden, aggregate > T is auditable."

**Risks:** It is the closest to "private payment + oversight," which is the most-scolded zone (regulators, and the prior-art surface is real). Demo must be crisp: small payments invisible, large payment triggers a compliance receipt, small-tx history stays hidden from the auditor.

**Score:** Novelty 7 | Privacy significance 7 | Technical depth 7 | Ethereum relevance 8 | Feasibility 7 | Demo 7 | Post-hack 8

---

## 3. Selection

| Criterion | Idea A (BlackSwan Relay) | Idea B (Solver Conclave) | Idea C (Position Vault) | Idea D (ThresholdAudit Wallet) |
|---|:-:|:-:|:-:|:-:|
| Novelty | 9 | 9 | 8 | 7 |
| Privacy significance | 9 | 8 | 8 | 7 |
| Technical depth | 8 | 9 | 8 | 7 |
| Ethereum relevance | 9 | 9 | 8 | 8 |
| Feasibility (3-4d) | 7 | 6 | 8 | 7 |
| Demo impact | 9 | 8 | 8 | 7 |
| Post-hack potential | 8 | 9 | 7 | 8 |
| **Weighted total** | **59** | **58** | **55** | **52** |

- **Best overall:** **Idea A — BlackSwan Relay.** Best balance of genuine novelty vs verified prior art, strongest judge narrative (public rescue vs hidden rescue + invalid-round rejection), and a feasible 3-4 day build with autonomous agents. It does not fall into any verified 2026 cluster.
- **Best backup:** **Idea B — Solver Conclave.** Highest post-hack and technical-ceiling potential, but feasibility is the risk (regret-baseline must be fixed). Best if you want "infrastructure judges can reason about" over "dramatic rescue."
- **Most technically impressive:** **Idea B — Solver Conclave** (slashable, adversarial, provable solver accreditation) narrowly over **Idea C** (Position Vault).
- **Explicitly not selected as lead:** Idea D (wallets) — genuinely novel vs the closest verified prior art (AuditPay), but lives in the most adversarial privacy zone and its delta over AuditPay is narrow; include it **only** if you want a wallets-track submission alongside the DeFi lead.

---

## 4. Decisive recommendation

Build **BlackSwan Relay** for the **Private DeFi & Mempools** track (and Overall). Track 1's brief — "DeFi flows invisible to MEV bots and on-chain analytics" — is satisfied in the strongest register: not just hiding a single swap, but hiding *who is rescuing a protocol and by how much*, with Ethereum cryptographically proving the aggregate rescue is funded before it settles. It beats the verified closest things (insurance, proof-of-reserves, confidential lending, encrypted treasury) because none of them *raise capital privately to rescue a distressed protocol*.

Do **not** spend the AI build (Track 2) unless you have a *cheap* provable wedge — big-model output correctness is not provable in 3-4 days and small models won't catch vulnerabilities (the earlier analysis stands). If you push for a second submission at all, **Idea D** (ThresholdAudit) is the only one that clears the novelty bar in payments/wallets; otherwise single-submission BlackSwan.

---
*Sources:* ePrint (AuditPay 2026/1118, MinMandate 2026/1674, Private Liquidity Matching 2021/475, FairTraDEX 2022/155); arXiv (TRUCE 2403.00393); ETHGlobal Lisbon 2026 project pages (Aphotic, Overlap, Agora, VeilSolver, HumanMandate, DoNotRugMe, PlanBound, BlindSample, Scipio, MultisigPEv2); GitHub (Umbra DAO treasury, VeilDAO, Roil, zkVaultService, CONFIDENTIALCREDIT, Xypher, TrustFi, ZK Proof-of-Reserves, HorizonCover, CipherVote, A-MACI); EIP-8182 / EIP-8184 (ethereum/EIPs); zk.money -> Aztec Connect ejector redirect. Where searches returned empty (e.g. GitHub terms with total 0), no absence was inferred from empty result sets — only concrete negative matches from populated primary sources are treated as evidence.

---

## 5. Implementation-standpoint analysis (can these actually be built?)

This section pressure-tests each idea the way an engineering team would: does the crypto exist, what is the real circuit lift, what must degrade under a 3-4 day build, and can the demo be non-simulated on a testnet?

**Tooling baseline (verified):** Noir is live and weekend-usable. npm ships `@noir-lang/noir_js` (1.0.0-beta.26), `noir_wasm`, `noirc_abi`, `acvm_js`, and Barretenberg provers (`backend_barretenberg` 0.36.0), meaning proofs can be generated in-browser/agent-side and verified on-chain with the standard Solidity verifiers Noir emits (UltraHonk / uPLONK). RISC Zero's zkVM is mature (e.g. `boundless-xyz/zeth`, 450+ stars). Circomlib has broad circuit libraries (circomlib + circomlib-ml). The binding constraint is therefore **circuit size and trust-model scope**, not absence of tooling.

### Idea A — BlackSwan Relay
**Real crypto lift:** low. The core circuit (prove `sum(c_i) >= T` over Pedersen commitments, with a per-rescuer nullifier) is basic aggregation + range arithmetic in Noir — a first-day circuit. The on-chain verifier, atomic recap settlement, and `RescueTargetMet` event are conventional Solidity.

**What must degrade honestly:** true *set-anonymity* (hiding *which* addresses are rescuers) needs a shipped unlinkability rail. EIP-8182 is status Review (not mainnet); a Tornado-class set-membership pool is heavy and its anonymity set is tiny in a demo. So the MVP should not claim "nobody knows who the rescuers are" — it should claim "individual contribution amounts are hidden from the settlement; the aggregate capacity is proven." That is honest, buildable, and still a strong narrative.

**Feasibility: High.** A Noir aggregation proof + one vault contract + Sepolia verifier + a UI that runs three rescuers is realistically a 2-3 day build for an agent pipeline. The residual risk is demo discipline (make the "invalid round is rejected on-chain" path crisp).

### Idea B — Solver Conclave
**Real crypto lift:** medium, with a headline caveat. Proving *"no better route exists"* inside a general pool graph is not tractable in a weekend. The honest degradation: the protocol picks a **fixed 3-pool graph and a snapshot**, computes the optimum off-chain, publishes `best_out` as a public constant for each challenge order, and the circuit proves `out >= best_out * (1 - eps)` plus `coverage = 100%` / `failure rate <= delta` and policy compliance. That is a comparison, not an optimality search — 5 small circuits' worth of work, all day-one-able. The coverage + aggregate-regret statistics are trivial in-circuit.

**The cost of the honest scope:** once `best_out` is published as public input, the "the protocol couldn't have known" claim weakens to "the protocol set the baseline, the solver proved it cleared it." Judges who smell the difference may probe who computes `best_out` (a trusted benchmark oracle, or a second honest solver). This is a *claimsmanship* risk, not a build risk.

**Feasibility: Medium-high for the sized-down version, medium for the claim.** The commit–reveal protocol, staking, and credential-gated auction are conventional Solidity. The proof is small. The real work is the protocol choreography, not the ZK.

### Idea C — Position Vault
**Real crypto lift:** lowest of the four. The LTV-threshold proof is `collateral * price > debt * threshold` with asset amounts as private witnesses and only the boolean outcome public. Needs a price witness (feed a signed oracle price or hardcode a snapshot post) and a comparison — a small Noir circuit. The optional "this liquidation was mis-priced / stale oracle" variant is a slightly bigger but still small circuit.

**The honest weak point is adversarial, not cryptographic:** on L1, per-collateral positions are public, so "the borrower's health is secret" only holds for a *private aggregate / multi-wallet* position. The demo must be framed precisely (a borrower consolidating several positions or a shielded aggregate), or a judge will ask "but the vault is public." That is a threat-model discipline issue, not a build blocker.

**Feasibility: Highest.** Small circuit + simplified lending contract + Sepolia verifier + a "prove I'm not liquidatable / dispute a stale-price liquidation" flow is the most likely to fully land within 3-4 days.

### Idea D — ThresholdAudit Wallet
**Real crypto lift:** highest, and the hardest to scope. Faithfully building AuditPay-style selective encryption over a payment mixer, or FHE/MPC threshold disclosure, is research-grade and not a weekend build. The honest degradation is a *simplified* value-threshold + selective-reveal + ZK-threshold-receipt: a two-tier commitment where below-threshold payments reveal nothing and an aggregate above-threshold receipt is ZK-provable, with the auditor seeing only the receipt, not the small-tx history. That is buildable but requires careful scope discipline to avoid accidentally implementing a mixer from scratch.

**Also:** `NullProof` (GitHub) already ships "prove your wallet is not on the OFAC sanctions list" — a *sanctions-membership* proof, adjacent to but distinct from *value-threshold audit*. It does not build the threshold primitive, but it normalizes the compliance-ZK theme, so a judge could ask "how is this not NullProof + a number check?" The delta (threshold instrumentation over private payments + auditable receipt) is genuine but must be drawn crisply.

**Feasibility: Medium-low as the headline; Medium as a scoped second submission.** This is why it is not the lead.

### Autonomous-agent baseline
Noir + npm/cargo + in-browser provers fit an autonomous build loop well: deterministic CLI circuits, fast compile, testable unit proving, and Solidity verifiers emitted automatically. The failure modes are the same as for a human team — most critically *scope discipline on the trust model*. A 3-4 day agent build should be locked to: one circuit, one verifier, one Sepolia deploy, one reject-path, one honest-vs-cheat demo branch. The ideas that survive that discipline with the strongest *non-simulated* testnet demo are **BlackSwan Relay** and **Position Vault**; **Solver Conclave** survives only with its headline claim honestly resized.
