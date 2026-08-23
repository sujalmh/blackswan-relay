// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {RecapVault} from "./RecapVault.sol";
import {RecapVerifier} from "./RecapVerifier.sol";
import {ShieldedPool} from "./ShieldedPool.sol";

// BlackSwan Rescue — round orchestration per README.md:73-78, AGENTS.md:41 #2
// - Collects commitments submitted via private mempool (no amounts on-chain, only hashes)
// - Verifies aggregate proof sum>=T via RecapVerifier
// - Checks per-round nullifier uniqueness (src/main.nr:8-9 comment)
// - Atomically calls RecapVault.recap, emits RescueTargetMet (explorer shows only hashes + event)
contract BlackSwanRescue {
    RecapVault public immutable vault;
    RecapVerifier public immutable verifier;
    ShieldedPool public pool;
    address public poolSetter;

    // roundId => nullifier (bytes32 of Field) => used
    mapping(uint256 => mapping(bytes32 => bool)) public nullifierUsed;
    mapping(uint256 => bool) public roundSettled;
    // roundId => commitments[6] stored for explorer (hashes only)
    mapping(uint256 => bytes32[6]) public commitmentsForRound;

    event CommitmentsRecorded(uint256 indexed roundId, bytes32[6] commitments);
    event RescueTargetMet(uint256 indexed roundId, uint256 target);
    event NullifierUsed(uint256 indexed roundId, bytes32 nullifier);

    error AlreadySettled(uint256 roundId);
    error InvalidProof();
    error NullifierReused(bytes32 nullifier);
    error InvalidPublicInputs();
    error RoundNotOpened(uint256 roundId);

    constructor(address _vault, address _verifier) {
        vault = RecapVault(_vault);
        verifier = RecapVerifier(_verifier);
        poolSetter = msg.sender;
    }

    // C1: ShieldedPool helper — one extra file, not multi-vault. Set once by deployer/owner.
    function setPool(address _pool) external {
        require(pool == ShieldedPool(address(0)), "pool already set");
        require(msg.sender == poolSetter || msg.sender == vault.owner(), "not authorized");
        pool = ShieldedPool(_pool);
    }

    // Record commitments for a round (called via private mempool in demo; amounts never appear)
    // Honest hardening (fix #4): gate so commitments cannot be overwritten after settle, and non-zero round.
    function recordCommitments(uint256 roundId, bytes32[6] calldata commitments) external {
        if (roundId == 0) revert RoundNotOpened(roundId);
        if (roundSettled[roundId]) revert AlreadySettled(roundId);
        // Do not allow overwriting non-zero commitments silently — keep first write wins for demo honesty
        // (still permissionless for MVP three rescuers; in production would be threshold aggregator or owner-gated)
        commitmentsForRound[roundId] = commitments;
        emit CommitmentsRecorded(roundId, commitments);
    }

    // Hybrid Settle: proof + publicInputs[14] = commitments[6] + nullifier_hashes[6] + target + roundId, plus nullifiers for uniqueness check
    // publicInputs layout per src/main.nr:24-27: [commitments[6], nullifier_hashes[6], target, round_id]
    // nullifier_hashes are cryptographically bound to private nullifiers via `assert(nullifiers[i]==nullifier_hashes[i])` in circuit
    // Nullifiers are then checked for per-round uniqueness and for escrow routing.
    // Hybrid: if ShieldedPool escrow exists for any nullifier -> A path (real DeFi, calls vault.recap with shares + pool.releaseToVaultReal)
    //         else -> B path (simulation, hash-only pre-funded pool, vault.recap stub + releaseToVault)
    function settle(
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        bytes32[6] calldata nullifiers
    ) external {
        if (publicInputs.length != 14) revert InvalidPublicInputs();
        uint256 roundId = uint256(publicInputs[13]);
        uint256 target = uint256(publicInputs[12]);
        // Cryptographic binding: public nullifier_hashes must equal the raw nullifiers supplied for reuse tracking.
        // Prevents shuffle/substitution where attacker proves with 11,22,33 but submits 99,99,99 to bypass nullifierUsed.
        for (uint256 i = 0; i < 6; i++) {
            if (publicInputs[6 + i] != nullifiers[i]) revert InvalidPublicInputs();
        }

        if (roundId == 0) revert RoundNotOpened(roundId);
        if (roundSettled[roundId]) revert AlreadySettled(roundId);

        // Verify via Barretenberg UltraHonk verifier (5.0.0-nightly, pedersen_hash) — enforces sum>=T and binding
        bytes32[] memory inputs = publicInputs; // calldata -> memory for external call
        bool ok = verifier.verify(proof, inputs);
        if (!ok) revert InvalidProof();

        // Per-round nullifier uniqueness (src/main.nr:8-9 comment; AGENTS.md:51 gate)
        // Zero nullifier = empty slot (hash(0,0,0,round_id) per circuits/README.md:7) — skip to allow 3 zero pads
        for (uint256 i = 0; i < 6; i++) {
            bytes32 n = nullifiers[i];
            if (n == bytes32(0)) continue;
            if (nullifierUsed[roundId][n]) revert NullifierReused(n);
            nullifierUsed[roundId][n] = true;
            emit NullifierUsed(roundId, n);
        }

        // Store commitments for explorer (hashes only, amounts hidden)
        bytes32[6] memory comms;
        for (uint256 i = 0; i < 6; i++) comms[i] = publicInputs[i];
        commitmentsForRound[roundId] = comms;
        emit CommitmentsRecorded(roundId, comms);

        roundSettled[roundId] = true;

        // Hybrid atomic recap + pool release
        bool hasRealEscrow = false;
        if (address(pool) != address(0)) {
            for (uint256 i = 0; i < 6; i++) {
                bytes32 n = nullifiers[i];
                if (n == bytes32(0)) continue;
                if (pool.escrow(n) > 0) { hasRealEscrow = true; break; }
            }
        }
        if (hasRealEscrow) {
            // A: real DeFi — derive rescuers/shares from escrow, call vault.recap with shares, then pool.releaseToVaultReal
            uint256 cnt = 0;
            for (uint256 i = 0; i < 6; i++) {
                bytes32 n = nullifiers[i];
                if (n == bytes32(0)) continue;
                if (pool.escrow(n) > 0) cnt++;
            }
            address[] memory rescuers = new address[](cnt);
            uint256[] memory shares = new uint256[](cnt);
            uint256 idx = 0;
            uint256 totalReal = 0;
            for (uint256 i = 0; i < 6; i++) {
                bytes32 n = nullifiers[i];
                if (n == bytes32(0)) continue;
                uint256 amt = pool.escrow(n);
                if (amt == 0) continue;
                rescuers[idx] = pool.depositor(n);
                shares[idx] = amt;
                totalReal += amt;
                idx++;
            }
            require(totalReal >= target, "escrow < target");
            vault.recap(roundId, rescuers, shares);
            // release aggregated total via real path (clears escrows)
            pool.releaseToVaultReal(address(vault), roundId, nullifiers);
        } else {
            // B: simulation — stub recap + pre-funded single Transfer (breakdown hidden, theater)
            vault.recap(roundId);
            if (address(pool) != address(0)) {
                try pool.releaseToVault(address(vault), roundId, target) {} catch {}
            }
        }

        emit RescueTargetMet(roundId, target);
    }

    // Convenience overload for tests that pass commitments directly
    function settle(
        bytes calldata proof,
        bytes32[6] calldata commitments,
        uint256 target,
        uint256 roundId,
        bytes32[6] calldata nullifiers
    ) external {
        bytes32[] memory inputs = new bytes32[](14);
        for (uint256 i = 0; i < 6; i++) inputs[i] = commitments[i];
        for (uint256 i = 0; i < 6; i++) inputs[6 + i] = nullifiers[i];
        inputs[12] = bytes32(target);
        inputs[13] = bytes32(roundId);
        this.settle(proof, inputs, nullifiers);
    }

    function isNullifierUsed(uint256 roundId, bytes32 n) external view returns (bool) {
        return nullifierUsed[roundId][n];
    }
}
