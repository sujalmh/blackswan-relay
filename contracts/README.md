# contracts

Solidity contracts (Foundry layout implied; pin the toolchain in `foundry.toml`).

- `src/RecapVault.sol` — simplified undercollateralized vault that accepts a rescue round.
- `src/BlackSwanRescue.sol` — round orchestration: collect hidden commitments, verify the aggregate proof, atomically call the vault recap, and reject invalid/underfunded rounds.
- `src/RecapVerifier.sol` — generated from the Noir circuit (Barretenberg / UltraHonk path).
- `test/` — Foundry tests: valid round settles; underfunded rejected; reused nullifier rejected.

See `../AGENTS.md` for verification gates.
