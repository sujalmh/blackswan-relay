# scripts

Deployment + demo automation.

- One Sepolia deploy flow (vault + rescue + verifier).
- `compile -> prove -> settle` pipeline.
- An **honest-vs-cheat demo branch**: honest path prints `RescueTargetMet`; cheat path prints the on-chain rejection.

All demo state must be real contract execution with real proofs on Sepolia — no mocked state.
