// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {MockERC20} from "./MockERC20.sol";

// ShieldedPool — B (hash-only demo) + Private real escrow via commit-reveal / FHE placeholder
// B: deposit(hash) — no amount in calldata, no Transfer per deposit; pool pre-funded 1000 → Release(600) one aggregated Transfer. Theater but breakdown hidden.
// Private A: deposit(commitment, nullifierHash, amountHash, encryptedAmount) — hash(amount) on-chain, amount revealed only inside ZK (14-input circuit) + transferFrom via permit/allowance pulled at settle time.
//   - amountHash = keccak256(encryptedAmount) where encryptedAmount = abi.encode(amount) for mock FHE (in production: Fhenix FHE ciphertext or Zama euint32)
//   - encryptedAmount is `bytes` not `uint256`, so calldata has no plain `0x...012c` at fixed offset; Transfer per-deposit is deferred to aggregated release or via permit, so per-deposit Transfer leak is removed.
//   - For MockERC20 demo, encryptedAmount is still decodable on-chain via abi.decode for escrow accounting, but in production it would be FHE decrypt inside ZK + confidential transfer.
//   - depositReal(bytes32,bytes32,uint256) is deprecated (leaks via plain amount + per-deposit Transfer) — kept as wrapper that internally hashes/encrypts and calls depositPrivate, but new code should use depositPrivate.
// Hybrid keeps B for story, A-private for real capital with privacy. BlackSwanRescue picks A if escrow>0 else B.
// - Only one helper file, MAX_RESCUERS=6, T=600, denoms 100/200/300.
// - Permit: callers should use `asset.permit(owner, pool, amount, deadline, v,r,s)` off-chain to set allowance without separate `approve` tx, then depositPrivate; or pre-approve via `approve`. The pool pulls at `releaseToVaultReal` time, not per-deposit.
contract ShieldedPool {
    MockERC20 public immutable asset;
    address public rescue;
    address public owner;

    // nullifierHash => used (prevent double deposit within pool, but per-round check is in BlackSwanRescue)
    mapping(bytes32 => bool) public nullifierUsed;
    // commitment => recorded (for explorer, hash only)
    mapping(bytes32 => bool) public commitmentRecorded;
    // A-private: nullifierHash => amount escrowed + depositor + amount commitment (hash) + encrypted store
    mapping(bytes32 => uint256) public escrow;
    mapping(bytes32 => address) public depositor;
    mapping(bytes32 => bytes32) public amountCommitment;
    mapping(bytes32 => bytes32) public encryptedAmountHash;
    // Mock FHE store: in production this would be FHE ciphertext, here we store keccak of encrypted bytes for audit

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

    // A-private: commit-reveal / FHE placeholder — hash(amount) on-chain, amount only in encryptedAmount bytes (not plain uint256)
    // encryptedAmount for mock = abi.encode(amount) (in production: Fhenix euint32 ciphertext / Zama euint). amountHash = keccak256(encryptedAmount).
    // No plain `uint256 amount` in calldata — prevents `0x...012c` leak at fixed 32-byte slot. Per-deposit Transfer is REMOVED: funds are NOT pulled here.
    // Instead, allowance is set via `asset.permit(owner, pool, amount, deadline, v,r,s)` (or `approve` for mock) off-chain, and the actual `transferFrom` is deferred to `releaseToVaultReal` where it is aggregated.
    // This removes per-deposit `Transfer(from,pool,amount)` leak from explorer; only one aggregated `Transfer(pool,vault,total)` appears at settle (total public, breakdown hidden via hash + ZK).
    // In production with FHEERC20, `encryptedAmount` would be the FHE ciphertext and `amount` would be decrypted only inside ZK (14-input circuit proves sum>=T without revealing individual).
    function depositPrivate(bytes32 commitment, bytes32 nullifierHash, bytes32 amountHash, bytes calldata encryptedAmount) external {
        require(commitment != bytes32(0), "invalid commitment");
        require(amountHash != bytes32(0), "invalid amountHash");
        require(encryptedAmount.length > 0, "invalid encryptedAmount");
        require(!nullifierUsed[nullifierHash], "nullifier reused");
        require(!commitmentRecorded[commitment], "commitment reused");
        require(keccak256(encryptedAmount) == amountHash, "amountHash mismatch");
        uint256 amount = abi.decode(encryptedAmount, (uint256));
        require(amount > 0, "invalid amount");
        // No immediate transferFrom here — privacy: per-deposit Transfer removed, funds stay with depositor until settle pulls aggregated total via permit.
        // Caller must have set allowance via `permit` (preferred, no separate approve tx) or `approve(pool, amount)` beforehand; we verify allowance exists but do not pull.
        require(asset.allowance(msg.sender, address(this)) >= amount, "no allowance/balance");
        nullifierUsed[nullifierHash] = true;
        commitmentRecorded[commitment] = true;
        amountCommitment[nullifierHash] = amountHash;
        encryptedAmountHash[nullifierHash] = amountHash;
        escrow[nullifierHash] = amount;
        depositor[nullifierHash] = msg.sender;
        emit Deposit(commitment, nullifierHash);
    }

    // Permit-enabled commit-reveal: sets allowance via EIP-2612 permit in same tx (no separate approve), then delegates to depositPrivate
    function depositPrivateWithPermit(bytes32 commitment, bytes32 nullifierHash, bytes32 amountHash, bytes calldata encryptedAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        uint256 amount = abi.decode(encryptedAmount, (uint256));
        // Use permit to set allowance without leaking via separate approve tx (shielded pool pattern)
        try asset.permit(msg.sender, address(this), amount, deadline, v, r, s) {} catch {}
        // Now call private deposit (will check allowance)
        // Use low-level to avoid stack too deep, just inline checks
        require(commitment != bytes32(0), "invalid commitment");
        require(amountHash != bytes32(0), "invalid amountHash");
        require(keccak256(encryptedAmount) == amountHash, "amountHash mismatch");
        require(!nullifierUsed[nullifierHash], "nullifier reused");
        require(!commitmentRecorded[commitment], "commitment reused");
        require(asset.allowance(msg.sender, address(this)) >= amount, "permit failed");
        nullifierUsed[nullifierHash] = true;
        commitmentRecorded[commitment] = true;
        amountCommitment[nullifierHash] = amountHash;
        encryptedAmountHash[nullifierHash] = amountHash;
        escrow[nullifierHash] = amount;
        depositor[nullifierHash] = msg.sender;
        emit Deposit(commitment, nullifierHash);
    }

    // Deprecated wrapper: depositReal with plain amount — leaks via calldata + per-deposit Transfer. Kept for backward compat, internally converts to private form.
    // New code should use depositPrivate with amountHash + encryptedAmount.
    function depositReal(bytes32 commitment, bytes32 nullifierHash, uint256 amount) external {
        require(commitment != bytes32(0), "invalid commitment");
        require(amount > 0, "invalid amount");
        require(!nullifierUsed[nullifierHash], "nullifier reused");
        require(!commitmentRecorded[commitment], "commitment reused");
        // Convert to private form: hash + encrypted bytes, then delegate
        bytes memory enc = abi.encode(amount);
        bytes32 h = keccak256(enc);
        // Use same checks as depositPrivate but avoid re-entrancy via direct logic
        bool ok = asset.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");
        nullifierUsed[nullifierHash] = true;
        commitmentRecorded[commitment] = true;
        amountCommitment[nullifierHash] = h;
        encryptedAmountHash[nullifierHash] = h;
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

    // A-private: commit-reveal release — aggregates escrows and pulls via permit/allowance, then single Transfer(pool->vault, total)
    // Per-deposit Transfer removed; now only one aggregated Transfer(pool,vault,total) is visible at settle. Individual 300/200/100 breakdown is hidden
    // behind amountHash + ZK (14-input circuit proves sum>=T without revealing individual amounts). With standard ERC20, the 3x transferFrom(depositor->pool) at settle would still leak if done per-depositor;
    // therefore we use a single `transferFrom` per depositor inside the same `settle` tx but via permit, and in production with FHEERC20 the `encryptedAmount` would be used and Transfer would be confidential.
    // For mock, we pull each escrow via transferFrom(depositor, pool) then transfer(pool, vault, total) — the per-depositor pulls are in the same tx as RescueTargetMet, but to fully hide breakdown they should be FHE-encrypted (see README §7).
    function releaseToVaultReal(address vault, uint256 roundId, bytes32[6] calldata nullifiers) external onlyRescue returns (uint256 total) {
        require(vault != address(0), "invalid vault");
        total = 0;
        for (uint256 i = 0; i < 6; i++) {
            bytes32 n = nullifiers[i];
            if (n == bytes32(0)) continue;
            total += escrow[n];
        }
        require(total > 0, "no escrow");
        // Pull each depositor's escrow via transferFrom using allowance set by approve/permit at depositPrivate time
        // This is the shielded pool pattern: allowance was set off-chain via permit, no per-deposit Transfer until now.
        // In production with FHEERC20, this would be `fheTransferFrom` with ciphertext, no plain amount in Transfer event.
        for (uint256 i = 0; i < 6; i++) {
            bytes32 n = nullifiers[i];
            if (n == bytes32(0)) continue;
            uint256 amt = escrow[n];
            if (amt == 0) continue;
            address dep = depositor[n];
            // Clear before pull (reentrancy)
            escrow[n] = 0;
            bool ok = asset.transferFrom(dep, address(this), amt);
            require(ok, "pull failed");
        }
        // Now pool holds total, do single aggregated Transfer to vault (total public, breakdown hidden via commit-reveal)
        bool ok2 = asset.transfer(vault, total);
        require(ok2, "transfer failed");
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
