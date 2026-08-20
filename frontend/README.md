# frontend

React + ethers/viem UI for the demo — `recapitalize without the signal`.

- Three rescuer panels (commit via **private mempool**, show only aggregate; amounts never hit public mempool).
- Vault trigger state ("protocol enters the danger zone") — mock oracle `health 0.92 < 1.0`, keeper opens round `T=600` (denoms `100/200/500`), badge `Recap premium: discounted RescueShares = yield`.
- Result state: `RescueTargetMet` on the honest path (explorer shows only hashes, no amounts), on-chain rejection on the cheat path.
- A toggle to show the public-rescue comparison path (public mempool leaks `A: 300, B: 200` — the MEV signal) vs the BlackSwan private-mempool path. Split view: `Public mempool: visible` (red) vs `Private mempool: hidden` (green).

No feature creep beyond the demo flow. This is a demo surface for judges, not a product.
