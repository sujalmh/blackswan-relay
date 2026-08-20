# contracts

Solidity contracts (Foundry layout implied; pin the toolchain in `foundry.toml`).

- `src/RecapVault.sol` — simplified undercollateralized vault with mock oracle (`health < threshold`); `recap()` settles rescue and mints pro-rata `RescueShare` (discounted premium = the yield leg).
- `src/BlackSwanRescue.sol` — round orchestration: collect commitments submitted via private mempool, verify the aggregate proof `sum >= T`, atomically call `RecapVault.recap` + mint, and reject invalid/underfunded rounds (sum < T or reused nullifier). Private-mempool path means amounts never appear in public mempool/explorer — only `commitments` hashes + `RescueTargetMet`.
- `src/RecapVerifier.sol` — generated from the Noir circuit (Barretenberg / UltraHonk path).
- `test/` — Foundry tests: valid round settles; underfunded rejected; reused nullifier rejected.

`without the signal` = amount/strategy-size hiding, not set-anonymity (see `../README.md:5` threat model). See `../AGENTS.md` for verification gates.
