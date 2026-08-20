# scripts

Deployment + demo automation — private-mempool aware.

- One Sepolia deploy flow (vault + rescue + verifier).
- `compile -> prove -> settle` pipeline: commitments submitted via `eth_sendPrivateTransaction` / Flashbots Protect / MEV Blocker when available; fallback commit path if Sepolia private RPC unavailable. Explorer after settle shows only `RescueTargetMet` + `commitments` hashes.
- An **honest-vs-cheat demo branch**: honest path prints `RescueTargetMet` (amounts hidden); cheat path prints the on-chain rejection (sum < T or reused nullifier).

All demo state must be real contract execution with real proofs on Sepolia — no mocked state. Honest path + public-comparison path + invalid rejection all real.
