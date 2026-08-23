// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Minimal ERC20 for Phase 2 — one token, fixed denominations for demo.
// No upgrade, no fee, just mint + transfer for vault funding.
// V1: gated mint (onlyOwner) to prevent open-mint theater; owner is deployer.
contract MockERC20 {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // EIP-2612 permit mock — for shielded pool private deposits via permit (no separate approve tx)
    // In production, verify EIP-712 signature; for mock, just set allowance (demo privacy via permit)
    mapping(address => uint256) public nonces;
    bytes32 public DOMAIN_SEPARATOR = keccak256("MockERC20");

    function permit(address owner_, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(deadline >= block.timestamp, "permit expired");
        // Mock: skip ecrecover check for demo — just set allowance, emit Approval
        // Real FHEERC20 would verify Zama/Fhenix permit; here we keep private via off-chain signature not gossiped as separate tx
        allowance[owner_][spender] = value;
        emit Approval(owner_, spender, value);
        nonces[owner_]++;
        // silence unused warnings
        v; r; s;
    }

    constructor() {
        owner = msg.sender;
    }
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
