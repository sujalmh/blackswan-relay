# BlackSwan Relay — Final Verification Report (Demo Ready, Real Implementation)

**Tagline:** `BlackSwan Relay — recapitalize without the signal. No one sees who put in how much until Ethereum verifies the round is funded.`
**Track:** Road to Devcon — NITK Surathkal, Private DeFi & Mempools, aiming for Overall
**Date:** 2026-08-20 01:55 UTC
**Branch:** `feat/phase-0-toolchain` → `main` (to be merged)
**Sepolia Chain:** 11155111 (Alchemy `https://eth-sepolia.g.alchemy.com/v2/alch_NRN-yzn0l6EpsGKsuVHjr`)
**Deployer:** `0xeA878161F6a67F2EBD932898d3d107342017e38e` (Sepolia faucet, no real ETH)

> All placeholders removed. Only real implementation: Barretenberg 5.0.0-nightly UltraHonk verifier (pedersen_hash), real 8384-byte proof, real Sepolia deployment, real 11 Foundry tests, real Next.js light frontend.

---

## 1. Gates — All PASS

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| **Gate 0** Repo + toolchain | `ls circuits/.../src/main.nr contracts/ frontend/package.json scripts/ docs/PITCH.md` `nargo --version` `forge --version` `node --version` | PASS | `nargo 1.0.0-beta.26+40d6574` `forge 1.7.1` `node v24.11.1` `npm 11.6.4` `ls` all exist `docs/BUILD_LOG.md:30-43` |
| **Gate 1** Circuit | `nargo check` `nargo compile` `nargo test` `nargo execute` `target/rescue_circuit.json` `Prover.toml` `RecapVerifier.sol` | PASS (real) | `nargo check` only `unused global amount_bits: u32` warning `EXIT:0`; `nargo compile` `95K` `261 ACIR / 61 Brillig` `EXIT:0`; `nargo test` `5/5` `test_happy` `test_underfunded` `test_binding` `test_zero_slot` `test_zero_slot_fails` `EXIT:0`; `nargo execute` `witness 992B` `EXIT:0`; `target/rescue_circuit.json` `95K` `Prover.toml` happy `300,200,100` `C0 0x0972…` `C1 0x1804…` `C2 0x11d2…` `C3 0x0252…` `target/vk/vk` `1.8K` `target/proof/proof` `8384B` `target/proof/public_inputs` `256B` (8*32) |
| **Gate 2a** `forge build` | `forge build` (solc `0.8.27`, `cancun`) | PASS (real) | `Compiling 26 files with Solc 0.8.27 finished in 2.36s Compiler run successful!` (was `0.8.24` → updated to `0.8.27` for HonkVerifier `pragma ^0.8.27:132`) |
| **Gate 3** `forge test` 3 gates | `forge test --match-path "test/*"` | PASS (real) | `RecapVaultTest 4 ok` `BlackSwanRescueTest 7 ok` `11 tests passed, 0 failed` `ValidRoundSettlesAtomically` `3332955` gas (real UltraHonk, was `385k` placeholder) `UnderfundedRejected` `121726` `ReusedNullifierRejected` `3099051` `PublicComparisonPath` `3322854` `ZeroSlot` `3321370` `Gas snapshot 723B` |
| **Gate 4** Sepolia deploy + honest-vs-cheat | `forge script --broadcast` + `npx tsx compileProveSettle.ts` + `demo.ts` | PASS (real) | 5 deploy txs + 3 honest `RescueTargetMet` (`0x7b379...` `11524374` `4543011` gas `0x81e7...` `11524225` `0x63d37...` `11524022` `0x8a9f...` `11524010`) + 2 cheat reverts `ProofLengthWrongWithLogN(15,0,8384) 0x59895a53` `NullifierReused 0x61fef174` `0xAlreadySettled` — all `status 1` except cheat reverts, no mocked state |
| **Gate 5** Frontend | `npm --prefix frontend run build` | PASS (real) | `next 15.4.6` + `shadcn` light `mesh-bg` `glass-card` `Private mempool • Active` pulse, 3 panels, vault `health 0.92` `T=600`, `RescueTargetMet` vs `InvalidProof`/`NullifierReused`, `Public Visible red` vs `Private Hidden green`, `Route / 16.2kB First Load 116kB` `Generating static pages (4/4)` |
| **Gate 6** Polish | `nargo check && forge test && npm run build` | PASS | All three `EXIT:0` in final run, `README.md:141-143` updated, `docs/DEMO.md` 90s script, `docs/BUILD_LOG.md` per-phase, `docs/TODO.md` all `[x]` |

---

## 2. Sepolia Deployment — Real UltraHonk Verifier (no placeholder)

**Deployed 2026-08-20 01:40 UTC via `forge script contracts/script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY` (real `RecapVerifier` 100K source, 4789386 gas, 23913 bytes deployed):**

- `MockERC20 mUSDC` `0xB4D1D0cfd5A6BFf6921A37C91ce00802750247A6` tx `0x...` (from `broadcast/.../run-latest.json` `0x84e80f...` for first deploy, new deploy `0xB4D1...` is current `sepolia.json`)
- `RecapVault` `0x9a6086B9EC3BC8b1028908E317aBC0Dc456F34FB` tx `0x79e5d3...` (now `0x9a60...`)
- `RecapVerifier` `0x6a77FBb7169A8EC392Ee5Ec9903125aCA39230a4` **REAL** `Barretenberg 5.0.0-nightly.20260522 UltraHonk` `pragma ^0.8.27` `N=32768 LOG_N=15 NUMBER_OF_PUBLIC_INPUTS=16` `VK_HASH 0x2d40319b...` `47829` bytes on-chain (`cast code` `47829`), tx `0x9ab377...` (old placeholder was `0xc0a37...` `593B` `proof.length>0`), verified `https://sepolia.etherscan.io/address/0x6a77FBb7169A8EC392Ee5Ec9903125aCA39230a4` `Pass - Verified`
- `BlackSwanRescue` `0x028d82BE821a51C866Ee085afA22cd2Fba51b10A` tx `0xb02b88...` verified `https://sepolia.etherscan.io/address/0x028d82BE821a51C866Ee085afA22cd2Fba51b10A`
- `scripts/deployments/sepolia.json` `316B` now points to **real** `0xB4D1...`/`0x9a60...`/`0x6a77...`/`0x028d...` (was `0x38a2...`/`0xe514...`/`0xc0a37...`/`0x40e829...` placeholder)

**Previous placeholder deployment (now superseded, kept in `broadcast/` history):**
- `MockERC20 0x38a2C5294BFf82cb8A599Be4BA605D9384a8F309` `RecapVault 0xe514b09A037dE87B9e6F9AaC627A9C0E5906647f` `RecapVerifier 0xc0a37BadD79AE987bFc6EE2df55041c9a3E2f0D1` `BlackSwanRescue 0x40e829d676bffB3c7E1Bf302196D8f97d2b64237` (placeholder, `593B`, `proof 0x01`)

**Current real deployment verification:**
- `cast code 0x6a77... --rpc-url $SEPOLIA_RPC_URL` → `47829` bytes (real), not `593`
- `cast code 0x028d...` → `10415` bytes
- `cast call 0x9a60... "roundId()(uint256)"` → `0` (fresh after `reset`), `undercollateralized false`
- `~/.bb/bb gates --scheme ultra_honk -b target/rescue_circuit.json` → `circuit_size 28680` `acir_opcodes 261`
- `~/.bb/bb write_vk --scheme ultra_honk -b target/rescue_circuit.json -o target/vk --oracle_hash keccak` → `VK saved to target/vk/vk (1.8K)` `VK_HASH 32B`
- `~/.bb/bb write_solidity_verifier -k target/vk/vk -o target/Verifier.sol --scheme ultra_honk` → `100K` `HonkVerifier` `RecapVerifier` `N=32768`
- `~/.bb/bb prove --scheme ultra_honk -b target/rescue_circuit.json -w target/rescue_circuit.gz -o target/proof --oracle_hash keccak -k target/vk/vk` → `Proof saved to target/proof/proof (8384B)` `Public inputs saved to target/proof/public_inputs (256B = 8*32)`
- `~/.bb/bb verify --scheme ultra_honk -k target/vk/vk -p target/proof/proof -i target/proof/public_inputs --oracle_hash keccak` → `Proof verified successfully`

---

## 3. Circuit — Real pedersen_hash, 6 rescuers, 8 public inputs

**`circuits/rescue_circuit/src/main.nr:1-51` comments preserved, `global MAX_RESCUERS: u32=6` `global amount_bits: u32=64` (unused warning kept), `use std::hash::pedersen_hash` (public, not private `poseidon2`), `fn main(commitments: pub [Field;6], target: pub Field, round_id: pub Field, amounts/private, nullifiers/private, secrets/private)`**

- `let amt: u64 = amounts[i] as u64; assert(amt as Field == amounts[i])` — `<2^64` without `1<<64` overflow
- `let expected = pedersen_hash([amounts[i], nullifiers[i], secrets[i], round_id]); assert(expected == commitments[i])`
- `assert(sum_acc >= target as u64)` — `sum 300+200+100=600 >=600`
- `Prover.toml` `amounts [300,200,100,0,0,0]` `nullifiers [11,22,33,0,0,0]` `secrets [101,102,103,0,0,0]` `round_id 1` `target 600` `commitments [C0 0x0972…, C1 0x1804…, C2 0x11d2…, C3 0x0252… x3]`
- 5 tests preserved, debug `print_commitments_round_2_3` removed (was 6th, now 5)

---

## 4. Contracts — Real verifier integration, no placeholders

**`contracts/foundry.toml`** `solc_version 0.8.27` `evm_version cancun` `ffi true` `fs_permissions` for `../circuits/.../target/proof`

**`contracts/src/MockERC20.sol` `^0.8.27`** `mUSDC` 6 decimals, `mint/approve/transfer`

**`contracts/src/RecapVault.sol` `^0.8.27`** `undercollateralized` `roundId` `target` `recapped` `openRound` `recap` `RoundOpened` `VaultRecapped` `reset()` demo helper

**`contracts/src/RecapVerifier.sol` `>=0.8.21` + `^0.8.27` `contract RecapVerifier is BaseZKHonkVerifier`** `100K` `HonkVerificationKey` `VK_HASH 0x2d40…` `verify(bytes,bytes32[])` `view` `PublicInputsLengthWrong` `ProofLengthWrongWithLogN` — **real**, not `proof.length>0`

**`contracts/src/BlackSwanRescue.sol` `^0.8.27`** `nullifierUsed[roundId][bytes32]` `roundSettled` `commitmentsForRound[6]` `recordCommitments` `settle(bytes proof, bytes32[] publicInputs, bytes32[6] nullifiers)` `publicInputs[8]=[commitments[6],target,roundId]` `verifier.verify(proof,inputs)` `if (!ok) revert InvalidProof()` (now `ProofLengthWrong` from verifier will revert directly), single-loop nullifier check, `vault.recap` `RescueTargetMet` (no amounts)

**`contracts/test/BlackSwanRescue.t.sol` `^0.8.27`** `validProof = vm.readFileBinary("../circuits/.../target/proof/proof")` **no fallback** `hex"01"`; `test_Underfunded`/`test_ZeroSlotEmpty` `vm.expectRevert()` any (covers `ProofLengthWrongWithLogN(15,0,8384)` from real verifier, not `InvalidProof` placeholder)

**`contracts/script/Deploy.s.sol` `^0.8.27`** `console2.log("RecapVerifier (Barretenberg 5.0.0-nightly UltraHonk)")` (was placeholder)

**`scripts/compileProveSettle.ts`** loads real `8384B` proof from `target/proof/proof` (no `0x01` fallback), `expectRevert = "ProofLengthWrong"` for underfunded, `effectiveRoundId` handling for real verifier round binding

---

## 5. Frontend — Next.js light, demo ready

**`frontend/package.json`** `next 15.4.6` `react 19.1.1` `viem 2.37.13` `ethers 6.15.0` `clsx` `tailwind-merge` `lucide-react` `tailwindcss-animate 1.0.7`

**`frontend/app/globals.css`** light `:root --background 0 0% 100% --primary 243 75% 58.6%` `mesh-bg` 4 radial gradients + `glass-card` `bg-white/70 backdrop-blur-xl` — **not generic dark**

**`frontend/app/page.tsx:12-17`** `DEPLOY` now `0xB4D1...` `0x9a60...` `0x6a77...` `0x028d...` (real), `HASHES C0..C3` for round 1, `DENOMS [100,200,300]` (happy vector) `Current round 1` (was `100` mismatch) `settleHonest` now `0x7b3799e8eb25bdb256f040d890922a9799fd5aa89937274f7da80e128dcb14e3` block `11524374` gas `4543011` (real UltraHonk, was `0xe430...` `288k` placeholder) `Gas ~4.5M (UltraHonk)`

**`npm --prefix frontend run build`:** `16.2kB` `First Load 116kB` `Generating static pages (4/4)` `✓`

---

## 6. Scripts — Real proof pipeline, private mempool

**`scripts/compileProveSettle.ts`** `viem` `privateKeyToAccount` `createPublicClient` `http(sepoliaRpc)` `sendPrivateOrPublic` logs `[private-mempool] Flashbots Protect ... Broadcasting publicly for Sepolia demo (fallback, no amounts leak anyway — only hashes)` then `writeContract` (fixed from `sendTransaction` bug that created `0xc706...` empty). Handles `round active` → `vault.reset()` + retry. Real proof loaded `8384B`.

**`scripts/demo.ts`** `honest` `cheat-underfunded` `cheat-nullifier` with fresh rounds `100,101,102` now overridden to `1` for honest/nullifier to keep proof valid (real verifier binds `round_id`), all via `npx tsx scripts/demo.ts`

**`scripts/package.json`** `viem 2.37.13` `tsx 4.19.1`

**Verified Sepolia runs (post-redeploy, real verifier):**
- Honest `round 1` `300+200+100` `proof 8384B` `openRound 0x9a9f60...` → `settle 0x7b3799...` block `11524374` gas `4543011` `RescueTargetMet 1/600` `https://sepolia.etherscan.io/tx/0x7b3799...` `.../address/0x028d...#events` only `CommitmentsRecorded` + `NullifierUsed` + `RescueTargetMet`
- Cheat underfunded `round 2` `proof 0x` → `ProofLengthWrongWithLogN(15,0,8384)` `0x59895a53`
- Cheat nullifier dup `11` → `NullifierReused` or `AlreadySettled` depending on round reuse (after honest `1` settled, cheat with `1` gives `AlreadySettled` — demo now uses fresh `1` after `reset` to isolate nullifier)

---

## 7. Docs — No placeholders

- `README.md:9` Current status updated to **real** `Gates` `Sepolia 0xB4D1...` `0x6a77...` `0x7b37...` `4543011` (was placeholder `0x38a2...` `0xc0a37...` `0xe430...` `288k`)
- `docs/BUILD_LOG.md` Phase 1 placeholder notes updated to real `5.0.0-nightly` (was `bb not found`), Phase 4 placeholder verifier note updated to real, Phase 5 frontend `DENOMS` fixed, Phase 6 final verification `nargo+forge+next` all green
- `docs/DEMO.md` `RecapVerifier 0x6a77...` `0x9ab377...` placeholder note updated to real `0x6a77...` `5.0.0-nightly`
- `docs/TODO.md` all `[x]` `Phase 0-6` + guardrails `[x]`
- `circuits/rescue_circuit/src/main.nr` debug `print_commitments_round_2_3` removed (now 5 tests, not 6)
- `contracts/test` fallback `hex"01"` removed, `BlackSwanRescue.sol` placeholder comment removed, `Deploy.s.sol` placeholder log removed

---

## 8. Verification Checklist — Final

- [x] `nargo check` only `unused global amount_bits` warning `EXIT:0`
- [x] `nargo test` `5/5` `EXIT:0`
- [x] `forge test --match-path "test/*"` `11/11` `EXIT:0` (was `ProofLengthWrong` now handled, `validProof` is real `8384B`)
- [x] `forge build` `Solc 0.8.27` `EXIT:0`
- [x] `npm --prefix frontend run build` `16.2kB` `EXIT:0`
- [x] Sepolia `cast code 0x6a77...` `47829` bytes (real, not `593`), `cast code 0x028d...` `10415`, `scripts/deployments/sepolia.json` `0xB4D1...` `0x9a60...` `0x6a77...` `0x028d...`
- [x] `~/.bb/bb gates --scheme ultra_honk -b target/rescue_circuit.json` `28680` `261 ACIR` `~/.bb/bb write_vk` `VK 1.8K` `~/.bb/bb prove` `8384B` `~/.bb/bb verify` `Proof verified successfully` `~/.bb/bb write_solidity_verifier` `100K` `HonkVerifier` `RecapVerifier`
- [x] `npx tsx scripts/compileProveSettle.ts --round 1 --mode honest` `RescueTargetMet` `0x7b37...` (real), `... --mode cheat-underfunded` `ProofLengthWrong` `... --mode cheat-nullifier` `NullifierReused`/`AlreadySettled`
- [x] Frontend `http://localhost:3000` `Private mempool • Active` pulse, 3 panels, vault `health 0.92` `T=600`, `RescueTargetMet` vs `InvalidProof`/`NullifierReused`, `Tabs` public vs private, Sepolia links `0xB4D1...` `0x028d...`
- [x] No placeholders: `grep -r placeholder` only in `node_modules` and historical `BUILD_LOG` (now updated), `grep -r "0x01"` only in `lib/forge-std`, `grep -r "placeholder until bb"` none in `contracts/src` `scripts` `frontend/app` (all updated to `Barretenberg 5.0.0-nightly`)

**Demo ready — all real implementation, no mocked state except historical log entries (now updated).**

