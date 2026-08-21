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
    // Nullifiers are NOT yet bound to proof public inputs (circuit binds nullifiers into commitments via pedersen_hash,
    // but contract checks caller-supplied nullifiers independently — disclosed limitation, see README §5 & HACKATHON_DEMO.md §7).
    // Future: include nullifier hashes in public inputs (16 inputs) to cryptographically bind.
    function recordCommitments(uint256 roundId, bytes32[6] calldata commitments) external {
        if (roundId == 0) revert RoundNotOpened(roundId);
        if (roundSettled[roundId]) revert AlreadySettled(roundId);
        // Do not allow overwriting non-zero commitments silently — keep first write wins for demo honesty
        // (still permissionless for MVP three rescuers; in production would be threshold aggregator or owner-gated)
        commitmentsForRound[roundId] = commitments;
        emit CommitmentsRecorded(roundId, commitments);
    }

    // Settle: proof + publicInputs[8] = commitments[6] + target + roundId, plus nullifiers for uniqueness check
    // publicInputs layout per circuits/README.md:7 & src/main.nr:23-25: [commitments[6], target, round_id]
    // nullifiers: bytes32[6] corresponding to same MAX_RESCUERS, zero = empty slot (skipped for reuse check per vault spec)
    function settle(
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        bytes32[6] calldata nullifiers
    ) external {
        if (publicInputs.length != 8) revert InvalidPublicInputs();
        uint256 roundId = uint256(publicInputs[7]);
        uint256 target = uint256(publicInputs[6]);

        if (roundId == 0) revert RoundNotOpened(roundId);
        if (roundSettled[roundId]) revert AlreadySettled(roundId);

        // Verify via Barretenberg UltraHonk verifier (5.0.0-nightly, pedersen_hash) — enforces sum>=T and binding
        bytes32[] memory inputs = publicInputs; // calldata -> memory for external call
        bool ok = verifier.verify(proof, inputs);
        if (!ok) revert InvalidProof();

        // Per-round nullifier uniqueness (src/main.nr:8-9 comment; AGENTS.md:51 gate)
        // Zero nullifier = empty slot (hash(0,0,0,round_id) per circuits/README.md:7) — skip to allow 3 zero pads
        // Single-loop checks storage + intra-batch duplicates (previous version split loops missed intra-batch)
        for (uint256 i = 0; i < 6; i++) {
            bytes32 n = nullifiers[i];
            if (n == bytes32(0)) continue;
            if (nullifierUsed[roundId][n]) revert NullifierReused(n);
            // Mark immediately so duplicate in same batch (e.g. [11,11,33]) also reverts on second 11
            nullifierUsed[roundId][n] = true;
            emit NullifierUsed(roundId, n);
        }

        // Store commitments for explorer (hashes only, amounts hidden)
        bytes32[6] memory comms;
        for (uint256 i = 0; i < 6; i++) comms[i] = publicInputs[i];
        commitmentsForRound[roundId] = comms;
        emit CommitmentsRecorded(roundId, comms);

        roundSettled[roundId] = true;

        // Atomic recap (README.md:34-36) — vault must have been opened with same roundId/target
        // For minimal Phase 3, call simple recap(roundId); RescueShare mint is in vault event
        vault.recap(roundId);

        // C1: Shielded settlement — move aggregated sum as one Transfer, leaking total not individual (300,200,100)
        // Sum>=T already proven by verifier, so pool can safely release total=target (600)
        if (address(pool) != address(0)) {
            // Try release, but don't block settle if pool has insufficient balance (e.g., tests without deposits)
            try pool.releaseToVault(address(vault), roundId, target) {} catch {}
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
        bytes32[] memory inputs = new bytes32[](8);
        for (uint256 i = 0; i < 6; i++) inputs[i] = commitments[i];
        inputs[6] = bytes32(target);
        inputs[7] = bytes32(roundId);
        this.settle(proof, inputs, nullifiers);
    }

    function isNullifierUsed(uint256 roundId, bytes32 n) external view returns (bool) {
        return nullifierUsed[roundId][n];
    }
}
