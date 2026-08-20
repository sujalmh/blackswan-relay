# BlackSwan Relay — Pitch v2 (tagline #3)

**Hero:** `BlackSwan Relay — recapitalize without the signal. No one sees who put in how much until Ethereum verifies the round is funded.`

> Track keywords are proved in execution, not in title. Title stays product-native so it does not read as tailored to `Private DeFi & Mempools` brief.

---

## 1. Why #3

- Previous hero `The private emergency capital market for DeFi crises` (`README.md:3` before) is accurate but does not bridge to `swaps/yield/trades invisible to MEV`.
- Proposed `The private rescue-yield market — DeFi yield strategies invisible to MEV...` echoes track verbatim — judges penalize as tailored.
- **#3** uses `without the signal` and `no one sees who put in how much until Ethereum verifies` — plain English for `invisible to MEV bots and on-chain analytics`. Track fit is then shown in demo: private-mempool commits, explorer hides amounts.

---

## 2. Gap -> Bridge (what changed in repo context)

| Gap | Bridge (repo ref) |
|---|---|
| Rescue != DeFi flow in judge mind | Reframe rescue commitment as private yield provision: `RecapVault.recap()` mints pro-rata `RescueShare` at discount. Strategy size = hidden field. See `README.md:2` hero + `README.md:4` architecture + `contracts/README.md:4` |
| Mempools absent | Commitments `c_i = hash(amount,nullifier,secret,round_id)` submitted via `eth_sendPrivateTransaction` / Flashbots Protect / MEV Blocker. Public mempool sees only hashes. See `AGENTS.md:19` hard limit #4, `README.md:28` primitive, `scripts/README.md:6`, `frontend/README.md:4-6` |
| Amount vs set-anonymity overclaim | Keep honest claim: amounts/strategy sizes hidden from public mempool/explorer/other rescuers/analytics; aggregate proven; `without the signal` = amount signal, not anonymity set. EIP-8182 still Review, Tornado set heavy for demo. See `README.md:49` scope #1, `README.md:83` threat model, `AGENTS.md:21` |
| Trigger hand-wave | Agreed mock oracle `health < threshold`, keeper opens `T`. Malicious oracle out of scope. See `README.md:27` primitive, `contracts/README.md:4` |
| Why rescue? incentive | Discounted rescue premium = yield. One slide, no new circuit. See `README.md:32`, `contracts/README.md:4` |
| Scope creep risk | Explicit guard `AGENTS.md:24` #7: do not add swaps; rescue commitment IS the DeFi flow |

No hard limit violated: still `AGENTS.md:17-19` — 1 circuit, 1 vault + 1 rescue + 1 verifier, 3 rescuers fixed denoms (`T=600` with `100/200/500`), 1 ERC-20, 1 round, non-simulated Sepolia.

---

## 3. Deck (6 slides, 3 min)

1. **Hook (15s):** Public rescue leaks amounts in mempool/explorer -> front-run, free-ride. Show `Amount: 300 USDC visible` red.
2. **Primitive (30s):** `Protocol danger -> private-mempool commitments -> Noir sum>=T -> RescueTargetMet -> atomic recap + RescueShares` (`README.md:22-33`). Badge `Noir 1.0.0-beta.26 + Barretenberg 0.36.0` (`README.md:96-98`).
3. **Honest claim (15s):** Hidden = amounts/strategy sizes (mempool, explorer, analytics) | Public = T, round_id, commitments, proof | Out of scope = set-anonymity, trigger oracle, Sybil (`README.md:83-91`).
4. **Architecture (30s):** `frontend -> scripts -> circuits -> contracts` (`README.md:61-71`) with private-mempool arrow; `RecapVault` mints yield; `RescueTargetMet` only event.
5. **Demo (45s):** See `README.md:116-122` — danger zone, public path leaks (pause), BlackSwan private path (badge `Private mempool active`, explorer shows hashes only, 1 tx settle), cheat path rejected (underfunded or nullifier reuse).
6. **Post-hack (15s):** Rescue market for L2 vaults + DAO treasuries. One-step-removed from all verified prior art (`docs/novel-use-case-research.md:37-58`).

---

## 4. Demo script (90s narrated)

1. `Health 0.92 < 1.0` -> keeper opens round `T=600`.
2. Toggle ON `Public path`: show `Rescuer A: 300, B: 200` on-chain — `signal visible`.
3. Toggle OFF -> `BlackSwan path`: 3 rescuer panels commit dark (private mempool). `scripts: compile -> prove -> settle` runs, prints `RescueTargetMet`. Explorer: `commitments[6] = 0x9a...` no amounts.
4. 4th actor tries `sum=400 < T` or reused nullifier -> `BlackSwanRescue` reverts, print `Rejected: below target / nullifier reused`.

Frontend split view `Public mempool: visible (red)` vs `Private mempool: hidden (green)` required (`frontend/README.md:7`, `scripts/README.md:6`).

---

## 5. Q&A shield

- **Isn't this confidential lending?** `Fhenix CONFIDENTIALCREDIT/Xypher originate new credit to borrowers; we recapitalize an existing vault after aggregate proof — origination vs rescue` (`docs/novel-use-case-research.md:56`).
- **Where is Tornado / EIP-8182?** `Not used. EIP-8182 Review, Tornado set too small for demo; we claim amount hiding, not set anonymity` (`README.md:49`).
- **Why not Position Vault?** `Position health is public per-wallet; hiding needs shielded aggregate story heavier. Rescue yield is direct MEV case: hiding size prevents predatory pricing of discount.` (`docs/novel-use-case-research.md:83-98`).
- **Who funds?** `T fixed, RescueShares discounted pro-rata. Fixed denoms keep ZK small.` (`README.md:50` #2).
- **Is sum>=T trivial?** `Intentional — aggregation + range + nullifier keeps 3-4 day build feasible; verifier + atomic settle is the depth` (`docs/novel-use-case-research.md:154-159`).

---

## 6. Reference for agents

- Single source of truth: `AGENTS.md` (do not re-derive product).
- Product decision: `README.md:1-8` hero + `README.md:22-33` primitive.
- Honest scope: `README.md:49-58` + `README.md:83-91` + `AGENTS.md:17-24`.
- Prior art: `docs/novel-use-case-research.md` (do not port Solver Conclave / Position Vault / ThresholdAudit).
