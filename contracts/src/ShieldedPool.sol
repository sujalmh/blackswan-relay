// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {MockERC20} from "./MockERC20.sol";

// Hybrid ShieldedPool — B (hash-only simulation, theater) + A (real escrow, DeFi)
// B: deposit(hash) — no amount in calldata, no Transfer per deposit; pool pre-funded 1000 → Release(600) one aggregated Transfer. Breakdown hidden in explorer but economic theater (V0).
// A: depositReal(hash, nullifierHash, amount) — does asset.transferFrom(msg.sender, pool, amount) and escrows. Breakdown necessarily leaks via ERC20 Transfer(from,to,amount) on standard ERC20 (MockERC20:17). Privacy holds at commitment layer + mempool if private RPC; aggregated release still possible via releaseToVaultReal but per-deposit Transfers are visible. Confidential token (Aztec/Fhenix FHEERC20) required for full amount privacy — see README honest limitations.
// Hybrid keeps both: B for hash-only story illustration, A for auditable capital. BlackSwanRescue.settle picks A if escrow exists else B.
// - Only one helper file, MAX_RESCUERS=6, T=600, denoms 100/200/300.
contract ShieldedPool {
    MockERC20 public immutable asset;
    address public rescue;
    address public owner;

    // nullifierHash => used (prevent double deposit within pool, but per-round check is in BlackSwanRescue)
    mapping(bytes32 => bool) public nullifierUsed;
    // commitment => recorded (for explorer, hash only)
    mapping(bytes32 => bool) public commitmentRecorded;
    // A: real escrow — nullifierHash => amount escrowed + depositor for recap shares
    mapping(bytes32 => uint256) public escrow;
    mapping(bytes32 => address) public depositor;

    event Deposit(bytes32 indexed commitment, bytes32 indexed nullifierHash);
    event Released(address indexed vault, uint256 total, uint256 roundId);
    event RescueSet(address indexed rescue);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    modifier onlyRescue() {
        require(msg.sender == rescue, "not rescue");
        _;
    }

    constructor(address _asset) {
        asset = MockERC20(_asset);
        owner = msg.sender;
    }

    function setRescue(address _rescue) external onlyOwner {
        rescue = _rescue;
        emit RescueSet(_rescue);
    }

    // B: hash-only deposit — ONLY hashes, no amount in calldata — eliminates 0x...012c leak.
    // No token transfer per deposit; capital is pre-funded and released aggregated on settle.
    // Event emits only commitment and nullifierHash, amount never appears in calldata or Transfer logs.
    // Simulation branch: theater, breakdown hidden but not real capital.
    function deposit(bytes32 commitment, bytes32 nullifierHash) external {
        require(commitment != bytes32(0), "invalid commitment");
        require(!nullifierUsed[nullifierHash], "nullifier reused");
        require(!commitmentRecorded[commitment], "commitment reused");
        nullifierUsed[nullifierHash] = true;
        commitmentRecorded[commitment] = true;
        emit Deposit(commitment, nullifierHash);
    }

    // A: real escrow deposit — does transferFrom and escrows amount per nullifierHash.
    // Amount necessarily leaks via ERC20 Transfer(from,to,amount) on explorer with standard ERC20; commitment still hides amount in calldata until Transfer log.
    // Caller must have approved pool for amount beforehand.
    function depositReal(bytes32 commitment, bytes32 nullifierHash, uint256 amount) external {
        require(commitment != bytes32(0), "invalid commitment");
        require(amount > 0, "invalid amount");
        require(!nullifierUsed[nullifierHash], "nullifier reused");
        require(!commitmentRecorded[commitment], "commitment reused");
        bool ok = asset.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");
        nullifierUsed[nullifierHash] = true;
        commitmentRecorded[commitment] = true;
        escrow[nullifierHash] = amount;
        depositor[nullifierHash] = msg.sender;
        emit Deposit(commitment, nullifierHash);
    }

    // B: aggregated release for pre-funded simulation — moves total as one Transfer (breakdown hidden, theater)
    function releaseToVault(address vault, uint256 roundId, uint256 total) external onlyRescue {
        require(vault != address(0), "invalid vault");
        require(total > 0, "invalid total");
        bool ok = asset.transfer(vault, total);
        require(ok, "transfer failed");
        emit Released(vault, total, roundId);
    }

    // A: real escrow release — sums escrows for provided nullifiers and transfers aggregated amount atomically.
    // Also clears escrow to prevent reuse. Returns total transferred.
    function releaseToVaultReal(address vault, uint256 roundId, bytes32[6] calldata nullifiers) external onlyRescue returns (uint256 total) {
        require(vault != address(0), "invalid vault");
        total = 0;
        for (uint256 i = 0; i < 6; i++) {
            bytes32 n = nullifiers[i];
            if (n == bytes32(0)) continue;
            total += escrow[n];
        }
        require(total > 0, "no escrow");
        // clear before transfer (reentrancy guard)
        for (uint256 i = 0; i < 6; i++) {
            bytes32 n = nullifiers[i];
            if (n == bytes32(0)) continue;
            escrow[n] = 0;
        }
        bool ok = asset.transfer(vault, total);
        require(ok, "transfer failed");
        emit Released(vault, total, roundId);
    }

    // Helpers
    function poolBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
    function getEscrow(bytes32 nullifierHash) external view returns (uint256) {
        return escrow[nullifierHash];
    }
    function getDepositor(bytes32 nullifierHash) external view returns (address) {
        return depositor[nullifierHash];
    }
}
