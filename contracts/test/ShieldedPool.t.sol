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
        // B: hash-only simulation — ONLY hashes in calldata — no amount leak, no Transfer per deposit. Theater but breakdown hidden.
        pool.deposit(C0, bytes32(uint256(11)));
        assertTrue(pool.commitmentRecorded(C0));
        assertTrue(pool.nullifierUsed(bytes32(uint256(11))));
        assertEq(pool.poolBalance(), 1000); // pre-funded only; deposits are hash-only, no token movement per deposit
        bytes memory proof = vm.readFileBinary("../circuits/rescue_circuit/target/proof/proof");
        bytes32[] memory inputs = new bytes32[](8);
        inputs[0] = C0; inputs[1] = C1; inputs[2] = 0x11d2f4a75e9382f6370873b63e1bf75d0e0b8f31b26f5e8fd0c6fa28e6de8d0a; inputs[3] = C3; inputs[4] = C3; inputs[5] = C3;
        inputs[6] = bytes32(uint256(600)); inputs[7] = bytes32(uint256(1));
        bytes32[6] memory nullifiers = [bytes32(uint256(11)), bytes32(uint256(22)), bytes32(uint256(33)), bytes32(0), bytes32(0), bytes32(0)];
        rescue.settle(proof, inputs, nullifiers);
        assertTrue(vault.recapped());
        assertEq(asset.balanceOf(address(vault)), 600);
        assertEq(pool.poolBalance(), 400);
    }

    // A: real escrow — 3 funded wallets depositReal via transferFrom, settle mints shares and aggregates real capital
    function test_RealEscrowDepositRealAndSettleWithShares() public {
        // Reset pool without pre-fund to prove real capital path
        // Re-deploy pool clean for A path isolation
        ShieldedPool poolReal = new ShieldedPool(address(asset));
        // mint to 3 rescuers
        address alice = vm.addr(0xA11CE);
        address bob = vm.addr(0xB0B);
        address carol = vm.addr(0xC4C4);
        asset.mint(alice, 1000);
        asset.mint(bob, 1000);
        asset.mint(carol, 1000);
        // vault/rescue with new pool
        RecapVault vaultReal = new RecapVault(address(asset));
        RecapVerifier verifierReal = new RecapVerifier();
        BlackSwanRescue rescueReal = new BlackSwanRescue(address(vaultReal), address(verifierReal));
        vaultReal.setRescue(address(rescueReal));
        rescueReal.setPool(address(poolReal));
        poolReal.setRescue(address(rescueReal));
        vaultReal.openRound(1, 600);

        // approve + depositReal: Transfer(from,to,amount) WILL leak breakdown on explorer — documented limitation
        vm.prank(alice); asset.approve(address(poolReal), 300);
        vm.prank(alice); poolReal.depositReal(C0, bytes32(uint256(11)), 300);
        vm.prank(bob); asset.approve(address(poolReal), 200);
        vm.prank(bob); poolReal.depositReal(C1, bytes32(uint256(22)), 200);
        // carol uses second commitment? C2
        bytes32 C2 = 0x11d2f4a75e9382f6370873b63e1bf75d0e0b8f31b26f5e8fd0c6fa28e6de8d0a;
        vm.prank(carol); asset.approve(address(poolReal), 100);
        vm.prank(carol); poolReal.depositReal(C2, bytes32(uint256(33)), 100);

        assertEq(poolReal.poolBalance(), 600);
        assertEq(poolReal.getEscrow(bytes32(uint256(11))), 300);
        assertEq(poolReal.getDepositor(bytes32(uint256(11))), alice);
        assertEq(asset.balanceOf(alice), 700);
        // vault has 0 before settle
        assertEq(asset.balanceOf(address(vaultReal)), 0);

        bytes memory proof = vm.readFileBinary("../circuits/rescue_circuit/target/proof/proof");
        bytes32[] memory inputs = new bytes32[](8);
        inputs[0] = C0; inputs[1] = C1; inputs[2] = C2; inputs[3] = C3; inputs[4] = C3; inputs[5] = C3;
        inputs[6] = bytes32(uint256(600)); inputs[7] = bytes32(uint256(1));
        bytes32[6] memory nullifiers = [bytes32(uint256(11)), bytes32(uint256(22)), bytes32(uint256(33)), bytes32(0), bytes32(0), bytes32(0)];

        // expect RescueShareMinted per rescuer
        vm.expectEmit(true, false, false, true); emit RecapVault.RescueShareMinted(alice, 300);
        rescueReal.settle(proof, inputs, nullifiers);

        assertTrue(vaultReal.recapped());
        assertEq(asset.balanceOf(address(vaultReal)), 600);
        assertEq(poolReal.poolBalance(), 0);
        assertEq(vaultReal.rescueShares(alice), 300);
        assertEq(vaultReal.rescueShares(bob), 200);
        assertEq(vaultReal.rescueShares(carol), 100);
        assertEq(vaultReal.totalRescueShares(), 600);
        // escrows cleared
        assertEq(poolReal.getEscrow(bytes32(uint256(11))), 0);
        // depositor still recorded for audit
        assertEq(poolReal.getDepositor(bytes32(uint256(11))), alice);
    }

    function test_DepositRealWithoutAllowanceReverts() public {
        address alice = vm.addr(0xA11CE2);
        asset.mint(alice, 1000);
        vm.prank(alice);
        vm.expectRevert("allowance");
        pool.depositReal(C0, bytes32(uint256(99)), 300);
    }

    function test_DepositRealLeaksTransferButCommitmentRemainsHashOnly() public {
        // Demonstrates ERC20 limitation: depositReal Transfer leaks amount, deposit does not
        address alice = vm.addr(0xA11CE3);
        asset.mint(alice, 1000);
        vm.prank(alice); asset.approve(address(pool), 300);
        vm.recordLogs();
        vm.prank(alice); pool.depositReal(C0, bytes32(uint256(77)), 300);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool foundTransfer = false;
        for (uint i=0;i<logs.length;i++) {
            if (logs[i].topics[0] == keccak256("Transfer(address,address,uint256)")) {
                // Transfer log data is amount
                uint256 amt = abi.decode(logs[i].data, (uint256));
                if (amt==300) foundTransfer = true;
            }
        }
        assertTrue(foundTransfer, "depositReal must emit Transfer(300) breakdown leak documented");
    }
}
