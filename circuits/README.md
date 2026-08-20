# circuits

Noir circuit proving the aggregate rescue capacity — `recapitalize without the signal`.

**Target:** `sum(c_i) >= T` over Pedersen-style commitments `c_i = hash(amount_i, nullifier_i, secret_i, round_id)`, bounded to one round by a per-rescuer nullifier.

- `src/rescue_circuit/` — the Noir source (see `src/main.nr:1-51` comments for the spec).
- Amounts are **private witnesses**; the aggregate bound `T`, `round_id`, and `commitments[6]` are **public inputs**. Unused slots carry `hash(0,0,0,round_id)` so amount signal stays hidden.
- Commitments are submitted via **private mempool** — public mempool/MEV bots see only hashes until `sum >= T` proves.

See `../AGENTS.md` for the build order and `nargo` workflow.
