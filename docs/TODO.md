# BlackSwan Relay — Implementation TODO for Agents

**Goal:** Ship a working, **non-simulated Sepolia demo** for `Road to Devcon — NITK` `Private DeFi & Mempools` aiming for **Overall**. Follow `AGENTS.md:40-46` build order exactly. Do not expand scope.

**Pitch (frozen):** `BlackSwan Relay — recapitalize without the signal. No one sees who put in how much until Ethereum verifies the round is funded.` See `docs/PITCH.md:3` + `README.md:3` + `AGENTS.md:11`. The `without the signal` = amount/strategy-size hidden from public mempool/MEV/explorer/analytics, not set-anonymity (`README.md:49`, `AGENTS.md:23`). Track fit is proved in execution (private-mempool commitments, `RescueTargetMet` only event), not in hero title.

**Hard limits (never violate):** `AGENTS.md:17-25` — see that file. Summary: 1 Noir circuit `sum(c_i)>=T` + nullifier, 1 vault + 1 rescue + 1 verifier, 3 rescuers fixed denoms `T=600` with `100/200/500` USDC `README.md:50` #2, 1 ERC-20, 1 round, non-simulated Sepolia with private-mempool path + public-comparison path + invalid-reject, honest privacy claim only, no Solver Conclave/Position Vault/ThresholdAudit, no swap-hider re-derive.

**Toolchain pinned:** `AGENTS.md:29-33` — Noir `1.0.0-beta.26` (`noirc 40d6574`), `backend_barretenberg 0.36.0`, Foundry, Sepolia, `ethers|viem`. All proofs real, no mocked state.

**Working agreements:** Keep edits in `blackswan/`, no destructive git, append `docs/BUILD_LOG.md` after each phase, surface blockers not expand scope (`AGENTS.md:59-64`).

---

## How to use this file

- Agents work **sequentially by phase** — do not start Phase N+1 until Phase N verification gate passes (`AGENTS.md:50-55`).
- Check off `- [ ]` -> `- [x]` as you finish. Commit in phase-sized chunks.
- Every edit to `circuits/rescue_circuit/src/main.nr` must preserve all comments `src/main.nr:1-51` (amounts are private witnesses, nullifier, round binding, range check, `sum>=T` comments). Compare `oldString`/`newString` line counts before edit.
- Verification command is the gate — paste its output into `BUILD_LOG.md`.

---

## Phase 0 — Repo prep + toolchain lock (no product code)

- [x] 0.1 Verify local toolchain: `nargo --version` must be `1.0.0-beta.26` (`circuits/rescue_circuit/Nargo.toml`), `forge --version`, `node --version`, Sepolia RPC + funded deployer key in `.env` **not** committed
- [x] 0.2 Pin versions: ensure `circuits/rescue_circuit/Nargo.toml` has no floating deps, `contracts/foundry.toml` pins `solc` + remappings, `frontend/package.json` pins `ethers|viem` + `@noir-lang/noir_js 1.0.0-beta.26` etc. If tool unavailable, note in `BUILD_LOG.md` and pick closest stable per `AGENTS.md:33`
- [x] 0.3 Read in order: `README.md:22-91` primitive+scope+threat model, `docs/PITCH.md:17-26` gap->bridge, `circuits/rescue_circuit/src/main.nr:1-51` circuit spec comments — **do not edit those comments**
- [x] 0.4 Create a feature branch for work; leave `docs/novel-use-case-research.md` + `docs/blackSwan-baseline.md` untouched (`AGENTS.md:60`)

**Gate 0:** `ls circuits/rescue_circuit/src/main.nr contracts/ frontend/ scripts/ docs/PITCH.md` exists, `nargo --version` + `forge --version` logged in `BUILD_LOG.md`

---

## Phase 1 — Circuits (`circuits/rescue_circuit`) — MUST PASS BEFORE CONTRACTS

Reference: `circuits/README.md`, `circuits/rescue_circuit/src/main.nr:1-51` (spec is comments), `AGENTS.md:40` #1

- [x] 1.1 Fix `src/main.nr` syntax for beta.26 **while preserving every comment line** `src/main.nr:1-10,14-15,18-19,30-49`:
  - `global amount_bits` needs type `global amount_bits: u32 = 64` or `: u64` (`src/main.nr:20`)
  - `pub` position is `commitments: pub [Field; MAX_RESCUERS]` not `pub commitments:` (`src/main.nr:22-25`)
  - `std::hash::poseidon2` is `pub(crate)` — use allowed stdlib path (e.g. `std::hash::pedersen_hash` or `poseidon2_permutation` via `std::hash` `Hasher`/`Poseidon2Hasher` as exposed in beta.26). Do not hallucinate `Poseidon2::hash([..],4)` — verify against `nargo check` error output
  - Field compare/shift needs `as u64` cast (`src/main.nr:37`, `src/main.nr:50`)
  - Keep `MAX_RESCUERS: u32 = 6` (`src/main.nr:16`), `ROUND_ID` binding, nullifier commitment binding, `sum >= T` assert (`src/main.nr:40-50`). Unused slots must prove `hash(0,0,0,round_id)` (`circuits/README.md:7`)
- [x] 1.2 `nargo check` passes with 0 errors (this currently fails with 9 errors — see `BUILD_LOG.md:12-13` note). Paste output.
- [x] 1.3 `nargo compile` succeeds and writes `target/*.json` ACIR
- [x] 1.4 Add `Nargo.toml` test vectors + `nargo test` + `nargo execute` unit proofs:
  - Happy: 3 amounts `300+200+100 = 600 >= T=600` with valid `commitments[6]` (pad 3 zeros) — should verify
  - Underfunded: `100+100+100 = 300 < 600` — should fail `sum >= T`
  - Nullifier reuse is **not** in-circuit (on-chain check) — but circuit must bind nullifier to commitment so reuse is detectable; test same nullifier with different amount fails binding
  - Zero-slot: all 6 slots `hash(0,0,0,round_id)` with `T=0` passes, with `T=600` fails
- [x] 1.5 `nargo test` passes locally
- [x] 1.6 Generate Solidity verifier: `nargo codegen-verifier` or `bb` `UltraHonk` path to `contracts/src/RecapVerifier.sol` per `contracts/README.md:6`. Do not hand-write verifier.
- [x] 1.7 Append `docs/BUILD_LOG.md` Phase 1 entry: what compiled, test vectors, verifier path, any stdlib deviation + why

**Gate 1 (`AGENTS.md:51`):** Circuit compiles + unit proof verifies locally + verifier file exists

---

## Phase 2 — Contracts (`contracts/src`) — Foundry

Reference: `contracts/README.md`, `README.md:61-71` key components, `README.md:83-91` threat model, `AGENTS.md:41` #2

**Do not create extra vaults/verifiers/circuits.**

- [x] 2.1 Scaffold `contracts/foundry.toml`, `contracts/src/MockERC20.sol` (1 ERC-20, fixed), `contracts/src/RecapVault.sol`:
  - Mock oracle `health < threshold` trigger; `openRound(T)` by keeper; `recap()` only callable by `BlackSwanRescue`; on `recap` mints pro-rata `RescueShare` (ERC20 or internal balance) — discounted premium = yield leg (`contracts/README.md:5`, `README.md:32`, `README.md:61-71`). Keep it minimal.
  - Stores `round_id` nonce, `T`, undercollateralized flag.
- [x] 2.2 `contracts/src/BlackSwanRescue.sol`:
  - Stores `commitments[6]`, `round_id`, per-round `nullifierUsed[round_id][nullifier]`, `T`
  - `commit(commitments, round_id)` or `commit` per rescuer — **must use private-mempool path in demo** but contract just records hashes (no amounts)
  - `settle(proof, amounts_nullifiers_secrets_as_public_inputs)` — calls `RecapVerifier.verify(proof, publicInputs)` then checks `nullifier` uniqueness per round (`src/main.nr:8-9` comment), then atomic `RecapVault.recap()` + `RescueShare` mint, emits `RescueTargetMet(round_id, T)` (`README.md:34-36`, `contracts/README.md:5`). Revert reasons distinct for `below target` vs `nullifier reused` (needed for demo gate `AGENTS.md:55`)
  - Honest privacy: explorer after `settle` shows only `commitments` hashes + `RescueTargetMet`, never amounts — enforce in event design
- [x] 2.3 Integrate generated `contracts/src/RecapVerifier.sol` — wire public inputs as `commitments[6]`, `target`, `round_id` (`circuits/README.md:7`). Do not edit verifier manually except to adapt to `BlackSwanRescue` call.
- [x] 2.4 Keep `RescueTargetMet` + per-round nonce bind (`README.md:76-78`)

**Gate 2a:** `forge build` passes, no extra contracts

---

## Phase 3 — Foundry Tests (must pass before Sepolia)

Reference: `contracts/README.md:8` test list, `AGENTS.md:52` #2, `AGENTS.md:44` #3

- [x] 3.1 `contracts/test/BlackSwanRescue.t.sol` + `contracts/test/RecapVault.t.sol`:
  - `test_ValidRoundSettlesAtomically` — 3 rescuers `300+200+100 >=600`, private-commitment hashes, valid proof via `RecapVerifier` mock or real verifier with fixture proof from Phase 1, `BlackSwanRescue.settle` succeeds, `RecapVault` recapped, `RescueTargetMet` emitted, `RescueShare` balances pro-rata (`contracts/README.md:8`)
  - `test_UnderfundedRoundRejected` — `100+100+100=300 <600` — `settle` reverts (proof invalid or `sum<T`). This is the `underfunded` gate.
  - `test_ReusedNullifierRejected` — same nullifier twice in same `round_id` -> revert `nullifier reused` even if sum >= T
  - `test_PublicComparisonPath` — a `RecapPublic` helper or direct `RecapVault` call with amounts visible — shows public path leaks `A:300, B:200` for frontend toggle `frontend/README.md:7`
  - `test_ZeroSlotHandling` — 3 real + 3 zero slots `hash(0,0,0,round_id)` still verifies when sum >= T
- [x] 3.2 `forge test -vvv` passes with all 3 required gates (`AGENTS.md:52`) + emit checks
- [x] 3.3 Gas snapshot: `forge snapshot` for demo (keep settle < block limit)
- [x] 3.4 Append `docs/BUILD_LOG.md` Phase 2-3 entry: contracts built, tests passed, verifier integrated, no scope deviation

**Gate 3 (`AGENTS.md:52`):** All 3 Foundry tests pass (valid settles, underfunded rejected, nullifier reuse rejected)

---

## Phase 4 — Deploy + Scripts (`scripts/`) — One Sepolia deploy

Reference: `scripts/README.md`, `AGENTS.md:43` #4, `README.md:116-122` demo script, `docs/PITCH.md:43-50` 90s script

- [x] 4.1 `scripts/deploy.s.sol` or `scripts/deploy.ts` (viem/ethers) — deploys `MockERC20` -> `RecapVault` -> `RecapVerifier` -> `BlackSwanRescue` wiring. One deploy per `AGENTS.md:43`. Save addresses to `scripts/deployments/sepolia.json`. Use private-mempool RPC env `PRIVATE_RPC_URL` (Flashbots Protect / MEV Blocker) with fallback to public `SEPOLIA_RPC_URL` if `PRIVATE_RPC_URL` empty — log which used.
- [x] 4.2 `scripts/compileProveSettle.ts` — pipeline:
  1. `nargo compile` + `nargo execute` to get witness
  2. Backend `backend_barretenberg 0.36.0` prove in agent/browser (`AGENTS.md:30`) — generate real proof bytes
  3. Submit commitments via private mempool `eth_sendPrivateTransaction` when `PRIVATE_RPC_URL` set (`scripts/README.md:6`, `AGENTS.md:22` #4)
  4. Call `BlackSwanRescue.settle(proof, publicInputs)` — do not bypass verifier
  5. Wait for `RescueTargetMet` and print `RescueTargetMet round_id=T`
- [x] 4.3 Honest-vs-cheat demo branch `scripts/demo.ts`:
  - `honest` branch: 3 rescuers `300+200+100=600` private commits -> valid proof -> `RescueTargetMet` printed -> explorer link shows only hashes + event
  - `cheat` branch: 4th actor `100+100+100=300 <600` or reused nullifier -> `settle` reverts with distinct reason -> prints `Rejected: below target` or `Rejected: nullifier reused` (`AGENTS.md:55`, `scripts/README.md:7`)
  - `publicComparison` branch: public commitments leaked path (for frontend toggle)
- [x] 4.4 Test against Sepolia **with real proof** (no mocked verifier) — `AGENTS.md:53` gate. Capture tx hashes, block explorer URLs, gas used
- [x] 4.5 Append `docs/BUILD_LOG.md` Phase 4 entry: deploy addresses, private-mempool used (or fallback + why), proof verified on Sepolia (tx hash), honest + cheat branches printed correctly (paste logs)

**Gate 4 (`AGENTS.md:53-55`):** Real proof verified on Sepolia + demo script prints `RescueTargetMet` (honest) and on-chain rejection (cheat) with no mocked state

---

## Phase 5 — Frontend (`frontend/`) — Demo surface for judges, not a product

Reference: `frontend/README.md`, `README.md:61-71` architecture, `README.md:116-122` demo flow, `docs/PITCH.md:36-50` deck+script

- [x] 5.1 Scaffold React + `ethers|viem` + `@noir-lang/noir_js 1.0.0-beta.26` for client-side proving note (`README.md:96-98`). Keep `frontend/README.md:9` — no feature creep.
- [x] 5.2 Implement 3 rescuer panels (`frontend/README.md:5`):
  - Each panel: amount selector fixed `100/200/500` (hidden after commit), secret+nullifier generation, `commit` button that sends `commitment` via private mempool badge `Private mempool active` (`frontend/README.md:6`) when `PRIVATE_RPC_URL` configured. After commit show only `commitment 0x9a...`, never amount.
- [x] 5.3 Vault trigger state (`frontend/README.md:6`): show `health 0.92 < 1.0`, keeper `Open round T=600`, countdown to `sum>=T`
- [x] 5.4 Result state (`frontend/README.md:6`): honest path shows `RescueTargetMet round_id` + tx link + `RescueShare` balances (yield: `discounted premium`); cheat path shows `Rejected: below target` / `nullifier reused` with revert reason
- [x] 5.5 Public-vs-Private toggle (`frontend/README.md:7`, `README.md:116-122` step 2 vs 3): split view `Public mempool: visible (red) Amount: 300` vs `Private mempool: hidden (green) commitment: 0x9a...` — this is the `signal` story (`docs/PITCH.md:5` Q&A)
- [x] 5.6 Wire `scripts/compileProveSettle` proof generation or backend-proved fixture for Sepolia settle; no mocked `RescueTargetMet`
- [x] 5.7 Polish for `Overall` prize: one-page layout, no extra routes, mobile readable, explorer links clickable, copy uses `recapitalize without the signal` (`README.md:3`) not track verbatim

**Gate 5:** Frontend runs locally `npm run dev`, 3 panels commit, trigger -> honest -> `RescueTargetMet`, toggle shows public leaks vs private hidden, cheat path shows revert

---

## Phase 6 — Polish + docs + submission

- [x] 6.1 Final `nargo check && forge test && npm run build` all green in CI/local
- [x] 6.2 Record 90s demo video following `docs/PITCH.md:43-50` script: danger -> public leaks (pause) -> BlackSwan private (badge, hashes only) -> atomic settle 1 tx -> cheat reject. Narrate `without the signal = MEV signal hidden` (`docs/PITCH.md:13`)
- [x] 6.3 Update `README.md:136-138` Current status: replace `Scaffold initialized` with deployed addresses + demo links + `BUILD_LOG.md` phase links
- [x] 6.4 Append `docs/BUILD_LOG.md` Phase 5-6 entry + final status
- [x] 6.5 Verify submission checklist: Sepolia addresses, real proof tx hash, demo script logs, frontend URL, pitch deck uses `#3` hero and honest claim footnote (`README.md:49` #1, `README.md:83-91`)

**Final Gate (`AGENTS.md:50-55` all):** Circuit compiles + unit proof local + Foundry 3 tests + real proof on Sepolia + demo script honest + cheat both real

---

## Guardrails (check every phase)

- [x] No new circuit / vault / verifier / ERC20 / round beyond hard limits (`AGENTS.md:17-25`)
- [x] Comments in `circuits/rescue_circuit/src/main.nr:1-51` intact (diff them before commit)
- [x] Every commitment is `hash(amount,nullifier,secret,round_id)` — amount never in public mempool (`AGENTS.md:22`)
- [x] Honest claim only: never claim `participant anonymity` or `Tornado` in deck/code (`AGENTS.md:23`, `README.md:49`)
- [x] No Solver Conclave / Position Vault / ThresholdAudit code (`AGENTS.md:24`)
- [x] No swap-hider re-derive; rescue commitment IS the DeFi flow (`AGENTS.md:25`, `README.md:49` #6)

## References

- Build order + gates: `AGENTS.md:40-55`
- Product + pitch: `README.md:3`, `README.md:22-122`, `docs/PITCH.md:1-69`
- Scope + threat model: `README.md:49-91` + `AGENTS.md:17-25`
- Circuit spec: `circuits/rescue_circuit/src/main.nr:1-51` comments + `circuits/README.md`
- Prior art: `docs/novel-use-case-research.md` (read, do not port)
