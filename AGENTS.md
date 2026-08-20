# AGENTS.md — Build directives for the BlackSwan Relay build agents

This file is the single source of truth for anyone (human or autonomous agent) continuing the build. Read **README.md** first for the product decision, then follow the directives below. Do not silently re-derive product decisions — the research is done; the task now is execution.

---

## Mission

Build a working, **non-simulated Sepolia demo** of the private emergency recapitalization primitive for the **Road to Devcon — NITK Surathkal** hackathon, **Private DeFi & Mempools** track, aiming for **Overall**.

**Pitch framing (do not change product):** `BlackSwan Relay — recapitalize without the signal. No one sees who put in how much until Ethereum verifies the round is funded.` The rescue commitment is the DeFi flow — a private yield provision (discounted `RescueShare` premium) whose size is hidden from public mempool/MEV signal until aggregate `sum >= T` proves. Track keywords (`yield strategy`, `MEV`, `mempool`) are proved in execution (private-RPC commitments, explorer shows only `RescueTargetMet` + hashes), not in hero title. Keep the honest claim: amounts hidden, set-anonymity not claimed.

---

## Non-negotiable scope (HARD LIMITS)

These are deliberate constraints from the implementation analysis. Exceeding them is a failure, not a bonus.

1. **One Noir circuit**: prove `sum(c_i) >= T` over Pedersen-style commitments, bounded to a single round by a per-rescuer nullifier. No secondary circuits.
2. **One distressed vault + one orchestration contract + one generated verifier.** No multi-vault, no general-purpose framework.
3. **Three rescuers, fixed denominations, one ERC-20, one round** in the MVP demo flow. Example: `T=600` with denoms `100/200/500` — strategy size is the hidden field.
4. **Non-simulated testnet flow on Sepolia.** The honest path, the public-comparison path (public mempool leaks amounts), and the invalid-round rejection must all be real contract execution with real proofs — no mocked state. BlackSwan commitments must be submitted via private mempool (`eth_sendPrivateTransaction` / Flashbots Protect / MEV Blocker) so amounts never appear in public mempool.
5. **Honest privacy claim only:** individual contribution amounts / strategy sizes hidden from public mempool/MEV bots/explorer/analytics; aggregate capacity proven. **Do NOT claim participant-set anonymity** (not in scope, not buildable this weekend). Tagline `without the signal` refers to amount signal, not anonymity set.
6. **Do NOT port the other researched ideas** (Solver Conclave, Position Vault, ThresholdAudit) into this repo. They are recorded alternatives only.
7. **Do NOT re-derive product as swap-hider.** The rescue commitment is the DeFi flow (private yield provision, `RescueShare` premium). Track fit is shown by private-mempool execution, not by adding swaps.

---

## Toolchain (verified current)

- **Noir** circuits: `@noir-lang/noir_js` 1.0.0-beta.26, `noir_wasm`, `noirc_abi`, `acvm_js`, Barretenberg provers (`backend_barretenberg` 0.36.0). Proving can run in-browser/agent-side.
- **Foundry** for Solidity.
- **Sepolia** for deployment and the demo.
- **ethers or viem** for the frontend/WS connections.

Pinning exact versions is recommended to avoid breaking the agent loop. If a tool is unavailable, note it and pick the closest stable pinned alternative — do not silently invent a different architecture.

---

## Build order (do this sequence)

1. **Circuits** (`circuits/src/rescue_circuit`): write the Noir circuit, compile with `nargo`, write unit proofs, then generate the Solidity verifier.
2. **Contracts** (`contracts/src`): `RecapVault` (simplified undercollateralized vault), `BlackSwanRescue` (round orchestration + verifier call + atomic recap + reject path), `RecapVerifier` (generated).
3. **Test contracts** with Foundry before deployment (happy path, underfunded reject, nullifier reuse reject).
4. **Deploy + scripts** (`scripts/`): one Sepolia deploy, a compile->prove->settle flow, and an honest-vs-cheat demo branch.
5. **Frontend** (`frontend/`): three rescuer panels + trigger state + result state. No feature creep beyond this.

---

## Verification gates (do not skip)

- Circuit compiles and a unit proof verifies locally.
- Foundry tests pass for: valid round settles atomically; underfunded round rejected; reused nullifier rejected.
- A real proof is generated and verified **on Sepolia** (not mocked).
- The demo script runs end-to-end and prints the `RescueTargetMet` outcome for the honest path and the on-chain rejection for the cheat path.

---

## Working agreements

- Keep edits scoped to `blackswan/`. Do not modify `novel-use-case-research.md`, `blackSwan-baseline.md`, or the parent directory's other files unless asked.
- Never use destructive git commands on unrelated state.
- Leave a short `docs/BUILD_LOG.md` entry after each phase recording what was built, what was verified, and any deviation from scope with a reason.
- If you hit a scope decision you cannot resolve, stop and surface it rather than silently expanding scope.

---

## Reference

- Product + decision + prior art: `docs/novel-use-case-research.md`
- Baseline: `docs/blackSwan-baseline.md`
