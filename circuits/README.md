# circuits

Noir circuit proving the aggregate rescue capacity.

**Target:** `sum(c_i) >= T` over Pedersen-style commitments, bounded to one round by a per-rescuer nullifier.

- `src/rescue_circuit/` — the Noir source (not yet written).
- Amounts are **private witnesses**; the aggregate bound `T` and round id are **public inputs**.

See `../AGENTS.md` for the build order and `nargo` workflow.
