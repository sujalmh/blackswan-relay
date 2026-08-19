# BlackSwan Relay — retained baseline

## Decision

Build **BlackSwan Relay**, a private emergency capital market for DeFi crises.

When a DeFi protocol is undercollateralized, rescuers privately commit liquidity. Ethereum proves that aggregate commitments meet the rescue target before atomically settling the recapitalization, without revealing individual contributors or amounts.

## Why it survives the prior-art filter

The novelty is not private routing, private reputation, or generic confidential transfers. It is a narrowly defined crisis-financing primitive:

> A permissionless, ZK-enforced emergency recapitalization round that proves aggregate rescue capacity before revealing individual commitments.

Closest areas already rejected as insufficiently novel or not feasible for a 3–4 day build:

- private DEXs, dark pools, private routing, and solver benchmarking;
- private insurance and generic liquidation systems;
- proof of reserves/solvency;
- private oracles;
- private MEV compensation;
- validator exit liquidity;
- general private LP risk products.

## Hackathon MVP

- one ERC-20, one distressed vault, three rescuers;
- fixed-denomination private commitments;
- Noir/Circom proof that aggregate commitments exceed the target;
- atomic settlement on Sepolia;
- explicit rejection of a skipped or underfunded commitment.

## Winning demo

Show a protocol entering crisis, compare a public rescue that exposes contributors with BlackSwan's hidden rescue, then demonstrate that an invalid commitment fails while a valid aggregate rescue settles.

## Current scores

| Criterion | Score |
|---|---:|
| Novelty | 7.5/10 |
| Demo impact | 9.5/10 |
| Feasibility | 7/10 |

This note is the baseline. New ideas must beat it on use-case novelty, judge appeal, and honest implementation feasibility.
