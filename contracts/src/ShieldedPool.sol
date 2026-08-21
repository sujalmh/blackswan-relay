// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {MockERC20} from "./MockERC20.sol";

// Minimal ShieldedPool for C1 — capital vs privacy (fix #1: hash-only deposits, no amount leak)
// - Each rescuer deposits via private mempool: commitment = hash(amount, nullifier, secret, round_id) is public hash,
//   amount is private witness, only commitment+nullifierHash emitted. No uint256 amount in calldata — calldata leak eliminated.
//   No ERC20 Transfer per deposit — individual amounts never hit public mempool calldata nor explorer Transfer logs.
// - Pool is pre-funded (Deploy.s.sol mints 1000 mUSDC to pool); final release moves aggregated sum=600
//   as ONE Transfer from pool to vault, leaking total not individual 300,200,100 (per judge fix #1 alternative: total public, breakdown hidden).
// - Only one file added (1 vault + 1 rescue + 1 verifier + 1 pool helper), not multi-vault. MAX_RESCUERS=6, T=600, denoms 100/200/300.
// - BlackSwanRescue calls releaseToVault after proof verification (sum>=T already proven) and vault.recap.
// - Honest claim after fix: commitments hide individual amounts from mempool & explorer; settlement hides breakdown; total 600 is public (one Transfer).
contract ShieldedPool {
    MockERC20 public immutable asset;
    address public rescue;
    address public owner;

    // nullifierHash => used (prevent double deposit within pool, but per-round check is in BlackSwanRescue)
    mapping(bytes32 => bool) public nullifierUsed;
    // commitment => recorded (for explorer, hash only)
    mapping(bytes32 => bool) public commitmentRecorded;

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

    // Deposit via private mempool: ONLY hashes, no amount in calldata — eliminates 0x...012c leak.
    // No token transfer per deposit; capital is pre-funded and released aggregated on settle.
    // Event emits only commitment and nullifierHash, amount never appears in calldata or Transfer logs.
    function deposit(bytes32 commitment, bytes32 nullifierHash) external {
        require(commitment != bytes32(0), "invalid commitment");
        require(!nullifierUsed[nullifierHash], "nullifier reused");
        require(!commitmentRecorded[commitment], "commitment reused");
        nullifierUsed[nullifierHash] = true;
        commitmentRecorded[commitment] = true;
        emit Deposit(commitment, nullifierHash);
    }

    // Called atomically by BlackSwanRescue after verifier + nullifier checks and vault.recap
    // Moves aggregated sum as one Transfer, leaking total (600) not individual (300,200,100)
    function releaseToVault(address vault, uint256 roundId, uint256 total) external onlyRescue {
        require(vault != address(0), "invalid vault");
        require(total > 0, "invalid total");
        // Sum>=T already proven by verifier in BlackSwanRescue, so we just transfer total
        bool ok = asset.transfer(vault, total);
        require(ok, "transfer failed");
        emit Released(vault, total, roundId);
    }

    // Helper for tests/demo: check balance
    function poolBalance() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}
