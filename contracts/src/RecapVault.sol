// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {MockERC20} from "./MockERC20.sol";

// Simplified undercollateralized vault for Phase 2.
// - Mock oracle health < threshold -> keeper opens round T
// - recap() only callable by BlackSwanRescue, atomically settles and mints pro-rata RescueShare (yield leg)
// - RescueShare is internal balance (not separate ERC20) for minimal scope; can be wrapped later.
contract RecapVault {
    MockERC20 public immutable asset;
    address public rescue; // BlackSwanRescue
    address public owner;

    uint256 public roundId;
    uint256 public target; // T for current round
    bool public undercollateralized;
    bool public recapped;

    // RescueShare: discounted premium = yield (per docs/PITCH.md bridge)
    mapping(address => uint256) public rescueShares;
    uint256 public totalRescueShares;

    event RoundOpened(uint256 indexed roundId, uint256 target);
    event VaultRecapped(uint256 indexed roundId, uint256 target);
    event RescueShareMinted(address indexed to, uint256 shares);

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
    }

    // Keeper opens rescue round when health < threshold (agreed trigger, not malicious oracle per README.md:27)
    function openRound(uint256 _roundId, uint256 _target) external onlyOwner {
        require(_roundId != 0, "invalid round");
        require(_target > 0, "invalid target");
        require(!undercollateralized || recapped, "round active");
        roundId = _roundId;
        target = _target;
        undercollateralized = true;
        recapped = false;
        emit RoundOpened(_roundId, _target);
    }

    // Called atomically by BlackSwanRescue after verifier + nullifier checks (README.md:34-36)
    function recap(uint256 _roundId, address[] calldata rescuers, uint256[] calldata shares) external onlyRescue {
        require(undercollateralized, "not undercollateralized");
        require(!recapped, "already recapped");
        require(_roundId == roundId, "round mismatch");
        require(rescuers.length == shares.length, "length mismatch");
        recapped = true;
        undercollateralized = false;
        for (uint256 i = 0; i < rescuers.length; i++) {
            if (shares[i] == 0) continue;
            rescueShares[rescuers[i]] += shares[i];
            totalRescueShares += shares[i];
            emit RescueShareMinted(rescuers[i], shares[i]);
        }
        emit VaultRecapped(_roundId, target);
    }

    // Simple overload for demo: recap without per-rescuer shares (keeper mints to rescue contract, distribution off-chain)
    function recap(uint256 _roundId) external onlyRescue {
        require(undercollateralized, "not undercollateralized");
        require(!recapped, "already recapped");
        require(_roundId == roundId, "round mismatch");
        recapped = true;
        undercollateralized = false;
        emit VaultRecapped(_roundId, target);
    }

    // Mock health check: always returns `undercollateralized` flag for demo
    function isUndercollateralized() external view returns (bool) {
        return undercollateralized;
    }

    // For Phase 3 tests: allow owner to reset for next round (not in production)
    function reset() external onlyOwner {
        recapped = false;
        undercollateralized = false;
        roundId = 0;
        target = 0;
    }
}
