// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {RecapVault} from "../src/RecapVault.sol";

contract RecapVaultTest is Test {
    MockERC20 asset;
    RecapVault vault;

    event RoundOpened(uint256 indexed roundId, uint256 target);
    event VaultRecapped(uint256 indexed roundId, uint256 target);

    function setUp() public {
        asset = new MockERC20();
        vault = new RecapVault(address(asset));
    }

    function test_OpenRoundAndRecap() public {
        vault.openRound(1, 600);
        assertEq(vault.roundId(), 1);
        assertEq(vault.target(), 600);
        assertTrue(vault.undercollateralized());
        assertFalse(vault.recapped());

        // Set rescue to this test contract to allow recap
        vault.setRescue(address(this));
        vm.expectEmit(true, false, false, true);
        emit VaultRecapped(1, 600);
        vault.recap(1);
        assertTrue(vault.recapped());
        assertFalse(vault.undercollateralized());
    }

    function test_OnlyRescueCanRecap() public {
        vault.openRound(1, 600);
        vault.setRescue(address(0xBEEF));
        vm.expectRevert("not rescue");
        vault.recap(1);
    }

    function test_RevertWhenNotUndercollateralized() public {
        vault.setRescue(address(this));
        vm.expectRevert("not undercollateralized");
        vault.recap(1);
    }

    function test_MockERC20Mint() public {
        asset.mint(address(this), 1000e6);
        assertEq(asset.balanceOf(address(this)), 1000e6);
    }
}
