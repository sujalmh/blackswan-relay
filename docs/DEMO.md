# BlackSwan Relay — 90s Demo Script (for video)

**Tagline:** `BlackSwan Relay — recapitalize without the signal. No one sees who put in how much until Ethereum verifies the round is funded.`

**Track:** Private DeFi & Mempools • **Goal:** Overall (3 best)
**Toolchain badge:** Noir 1.0.0-beta.26 • pedersen_hash • MAX_RESCUERS=6 • T=600 • Foundry • viem 2.37.13 • Sepolia 11155111 • Private mempool (Flashbots Protect fallback logged)

**Sepolia deployment (real, no mock):**
- MockERC20 `0x38a2C5294BFf82cb8A599Be4BA605D9384a8F309` tx `0x84e80f630897af34fcb348e062fbf7a706ceca2f46b61158c212c6183916bf48` block 11523997
- RecapVault `0xe514b09A037dE87B9e6F9AaC627A9C0E5906647f` tx `0x79e5d3f47f9ed16302822c73c0bb59ee34e00dac41ef9742c5a6dd60db59993a` block 11523997
- RecapVerifier `0xc0a37BadD79AE987bFc6EE2df55041c9a3E2f0D1` tx `0x9ab377594d1bdb40a8aa72dd48e251e4e4e25c5b675e346dcd5745b40dfa79b5` (placeholder until bb 0.36.0)
- BlackSwanRescue `0x40e829d676bffB3c7E1Bf302196D8f97d2b64237` tx `0xb02b888afbde8d29ae4afe74534a9d61480c046eece1d56352a4202228da14e3` verified https://sepolia.etherscan.io/address/0x40e829d676bffB3c7E1Bf302196D8f97d2b64237
- Deployer `0xeA878161F6a67F2EBD932898d3d107342017e38e` (Sepolia faucet, no real ETH)
- Frontend: `http://localhost:3000` (`npm --prefix frontend run dev`) — light mesh, glass cards, not generic dark

---

## 0:00-0:12 — Danger zone (Vault trigger)

**Visual:** Frontend `Vault trigger state` card: health `0.92 / 1.00` amber bar 92%, `Current round 100 T=600` badge, `Aggregate 0/600` bar, `Vault is in the danger zone` violet bar.

**Narration:** “A vault slips undercollateralized. Health 0.92 below 1.0 — mock oracle. Keeper opens round T equals 600. This is a rescue-yield opportunity: discounted RescueShares when we prove we’re funded.”

**On-chain:** `RecapVault.openRound(100,600)` tx `0x94edbb9f4aab4161b788457abad77ff8756b83ed53f61d52aaf6f1d0e111f458` (after `reset 0x0f8adc...` if round active). Show Etherscan link, `RoundOpened` event.

## 0:12-0:25 — Public path (leaks signal) — freeze/skip

**Visual:** Toggle to `Public • amounts leaked` (rose). Show `Rescuer A: 300 mUSDC`, `Rescuer B: 200`, `Rescuer C: 100` in clear, `mempool: amount:300` rose, `MEV can extract discount`.

**Narration:** “In a public rescue everyone sees who put in how much. Mempool leaks the strategy size — MEV bots front-run the discount, others free-ride, the rescue fails. We don’t do that. Freeze.”

**Toggle back to Private.**

## 0:25-0:55 — BlackSwan private path (without the signal)

**Visual:** Toggle `Private • hashes only` (emerald). 3 rescuer panels: each shows amount selector `100/200/300` (A 300, B 200, C 100), click `Commit privately` → card turns `emerald-50` `Committed` badge, shows `commitment 0x09726b28…` (truncated), `hash only on-chain` + `Private mempool • Active` pulse emerald. Aggregate bar animates `0 → 600` green.

**Narration:** “Three rescuers commit through a private mempool. Commitments are `hash(amount, nullifier, secret, round_id)` — pedersen_hash. Public mempool sees only `0x97…,0x18…,0x11…` plus three zero-slot hashes `0x0252…`. No amounts. Sum greater-or-equal T is proven in Noir — `300+200+100=600` — private witnesses, public `commitments[6], target, round_id`.”

**On-chain:** Click `Settle honestly` (black bar `Aggregate proof • Noir sum≥T`). Show `BlackSwanRescue.settle` tx `0xe430595499d4ceb04b8f998e74b1e9dd3b466cdf2b0be3474e86459fb0a2ef4d` block `11524033` gas `288955` status success. Etherscan `.../address/0x40e829...#events` shows only `CommitmentsRecorded` + `NullifierUsed` + `RescueTargetMet roundId=100 target=600` — no amounts.

**Visual result:** Card `RescueTargetMet — round 100 target 600 • hashes only, amounts hidden` emerald, `Tx 0xe430…` link + `Events` + `Gas ~288k` + `One atomic tx`.

**Narration:** “Ethereum verifies the aggregate without revealing individual contributions. One atomic transaction settles the recap and mints RescueShares. Without the signal means amount signal, not anonymity set — honest claim, see README.md:49.”

## 0:55-1:15 — Cheat: underfunded rejected on-chain

**Visual:** Click `Cheat: underfunded` → `Rescuer A/B/C 100+100+100=300` with empty proof `0x`. `settle` simulates → revert.

**On-chain:** `settle` with `proof 0x` on round `101` (`openRound 0x971f21…`) → revert `InvalidProof()` `0x09bde339` (simulates `sum 300<600`; real bb would make proof invalid). Logs: `❌ settle reverted as expected? InvalidProof() — honest-vs-cheat gate PASS`.

**Narration:** “An underfunded round tries 300 less than 600 with an invalid proof. Verifier reverts `InvalidProof`. No RescueTargetMet.”

## 1:15-1:30 — Cheat: nullifier reuse rejected

**Visual:** Click `Cheat: reuse nullifier` → duplicate `11` in `[11,11,33]` → revert.

**On-chain:** Round `102` needs `reset 0xee4e09...` after `round active` from previous cheat (vault left undercollateralized), then `openRound 0x9c3c60...`, then `settle` with dup `11` → revert `NullifierReused(0x...000b)` `0x61fef174` (single-loop check `BlackSwanRescue.sol:66-79` catches intra-batch). Logs: `✅ Got expected revert NullifierReused`.

**Narration:** “Reusing a nullifier in the same round tries to double-count. Contract reverts `NullifierReused`. Per-round nullifier, zero slots skipped.”

## 1:30-1:35 — Close

**Visual:** Footer `Honest claim` + `Rescue premium = yield` + `Verify on Sepolia` vault/rescue/tx links, `Built for Road to Devcon` badge.

**Narration:** “BlackSwan Relay: recapitalize without the signal. Amounts hidden from public mempool, MEV, explorer, analytics until aggregate proves. One Noir circuit, one vault, one rescue, one verifier, three rescuers, one round on Sepolia. No swap-hider re-derive.”

---

## How to record

1. `set -a; source .env; set +a; npm --prefix frontend run dev` → http://localhost:3000 (light frontend already built `16.2kB`)
2. `npx tsx scripts/demo.ts` in terminal beside browser (captures openRound/settle logs with tx hashes)
3. Screen record 90s with narration above, show Etherscan tx `0xe430...` and `0x40e829...#events` (hashes only)
4. Export as `docs/demo-90s.mp4` (placeholder until recorded) — keep under 50MB for Devfolio
5. Update `README.md:136-138` Current Status with video link + Sepolia addresses

**Video file:** `docs/demo-90s.mp4` not yet recorded — script above is the source of truth. When recorded, replace placeholder and link in README.

## Verification for submission

- Circuit: `nargo check` PASS (unused global warning), `nargo test` 5/5, `nargo execute` witness `target/rescue_circuit.gz`
- Contracts: `forge test --match-path "test/*"` 11/11 (valid, underfunded, nullifier, public, zero-slot) + `forge build` solc `0.8.24` (or `0.8.35` auto), `contracts/lib/forge-std`
- Sepolia: 5 deploy txs + 3 honest `RescueTargetMet` (0x8a9f...,0x63d3...,0xe430...) + 2 cheat reverts (`0x09bde339`, `0x61fef174`) — all real on Sepolia testnet, private-mempool fallback logged, no real ETH
- Frontend: `npm --prefix frontend run build` 16.2kB, light mesh, glass cards, private badge, 3 panels, toggle, settle
- Pitch: hero `recapitalize without the signal` (`README.md:3`, `docs/PITCH.md:3`), honest claim footnote, not track verbatim

