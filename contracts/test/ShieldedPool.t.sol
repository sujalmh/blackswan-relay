// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {ShieldedPool} from "../src/ShieldedPool.sol";
import {RecapVault} from "../src/RecapVault.sol";
import {RecapVerifier} from "../src/RecapVerifier.sol";
import {BlackSwanRescue} from "../src/BlackSwanRescue.sol";

contract ShieldedPoolTest is Test {
    MockERC20 asset;
    RecapVault vault;
    RecapVerifier verifier;
    BlackSwanRescue rescue;
    ShieldedPool pool;

    bytes32 constant C0 = 0x09726b28aff94a2f70169b87dc9e689359dbe0b588664b645e6606c74ebc5196;
    bytes32 constant C1 = 0x1804bcccd6d51a2c6e89c38d57280cb32cc149d16b260ac341efccb3d3ff9da7;
    bytes32 constant C3 = 0x0252191f87d94cfa16f5de62f60d4c58f0899cbb2d437e58c1ad7bb55139b3b7;

    function setUp() public {
        asset = new MockERC20();
        vault = new RecapVault(address(asset));
        verifier = new RecapVerifier();
        rescue = new BlackSwanRescue(address(vault), address(verifier));
        pool = new ShieldedPool(address(asset));
        vault.setRescue(address(rescue));
        rescue.setPool(address(pool));
        pool.setRescue(address(rescue));
        // Mint to test rescuers and pool (use plain 600 scale for MVP, not 1e6)
        asset.mint(address(this), 1000);
        asset.mint(address(pool), 1000);
        vault.openRound(1, 600);
    }

    function test_ShieldedDepositAndRelease() public {
        // Deposit via pool: ONLY hashes in calldata — no amount leak (fix #1). Deposit emits hash only, no Transfer.
        pool.deposit(C0, bytes32(uint256(11)));
        assertTrue(pool.commitmentRecorded(C0));
        assertTrue(pool.nullifierUsed(bytes32(uint256(11))));
        assertEq(pool.poolBalance(), 1000); // pre-funded only; deposits are hash-only, no token movement per deposit
        // Now settle via rescue (valid proof) should trigger pool release of 600 as ONE aggregated Transfer (total public, breakdown hidden)
        bytes memory proof = vm.readFileBinary("../circuits/rescue_circuit/target/proof/proof");
        bytes32[] memory inputs = new bytes32[](8);
        inputs[0] = C0; inputs[1] = C1; inputs[2] = 0x11d2f4a75e9382f6370873b63e1bf75d0e0b8f31b26f5e8fd0c6fa28e6de8d0a; inputs[3] = C3; inputs[4] = C3; inputs[5] = C3;
        inputs[6] = bytes32(uint256(600)); inputs[7] = bytes32(uint256(1));
        bytes32[6] memory nullifiers = [bytes32(uint256(11)), bytes32(uint256(22)), bytes32(uint256(33)), bytes32(0), bytes32(0), bytes32(0)];
        // Pool has 1000 pre-funded, will release 600
        rescue.settle(proof, inputs, nullifiers);
        assertTrue(vault.recapped());
        // Pool should have released 600 to vault, so pool balance = 1000 - 600 = 400, vault balance = 600
        assertEq(asset.balanceOf(address(vault)), 600);
        assertEq(pool.poolBalance(), 400);
    }
}
