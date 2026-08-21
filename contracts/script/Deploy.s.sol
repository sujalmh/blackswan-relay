// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {RecapVault} from "../src/RecapVault.sol";
import {RecapVerifier} from "../src/RecapVerifier.sol";
import {BlackSwanRescue} from "../src/BlackSwanRescue.sol";
import {ShieldedPool} from "../src/ShieldedPool.sol";

// Phase 4 Sepolia deploy — one deploy per AGENTS.md:43
// Usage (from blackswan/ root):
//   source .env
//   forge script contracts/script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY -vvvv
// Private mempool (commitments) is NOT used for deployment — deployment is public.
// Commitments via private mempool happen in scripts/compileProveSettle.ts (eth_sendPrivateTransaction fallback).
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);

        MockERC20 asset = new MockERC20();
        RecapVault vault = new RecapVault(address(asset));
        RecapVerifier verifier = new RecapVerifier();
        BlackSwanRescue rescue = new BlackSwanRescue(address(vault), address(verifier));
        ShieldedPool pool = new ShieldedPool(address(asset));
        vault.setRescue(address(rescue));
        rescue.setPool(address(pool));
        pool.setRescue(address(rescue));
        // Pre-fund pool with 1000 mUSDC for aggregated release (600) — individual deposits would be via private mempool in production
        // For MVP, pool holds total, release moves 600 as one Transfer leaking total not individual per C1
        asset.mint(address(pool), 1000 * 1e6);
        // Also mint to deployer for deposit demo (optional)
        asset.mint(vm.addr(pk), 1000 * 1e6);

        vm.stopBroadcast();

        // Explorer-friendly logs (hashes only later — no amounts)
        console2.log("=== BlackSwan Relay Sepolia Deploy ===");
        console2.log("MockERC20 (mUSDC)", address(asset));
        console2.log("RecapVault", address(vault));
        console2.log("RecapVerifier (Barretenberg 5.0.0-nightly UltraHonk, evm-no-zk 7424B)", address(verifier));
        console2.log("BlackSwanRescue", address(rescue));
        console2.log("ShieldedPool (C1 capital pool, one aggregated Transfer)", address(pool));
        console2.log("Deployer", vm.addr(pk));
        console2.log("Vault rescue set to", address(rescue));
        console2.log("Pool rescue set to", address(rescue));

        // Save for scripts/demo.ts — JSON also logged for manual save to scripts/deployments/sepolia.json
        string memory json = string.concat(
            '{"MockERC20":"', vm.toString(address(asset)), '",',
            '"RecapVault":"', vm.toString(address(vault)), '",',
            '"RecapVerifier":"', vm.toString(address(verifier)), '",',
            '"BlackSwanRescue":"', vm.toString(address(rescue)), '",',
            '"ShieldedPool":"', vm.toString(address(pool)), '",',
            '"deployer":"', vm.toString(vm.addr(pk)), '",',
            '"chainId":11155111}'
        );
        console2.log("JSON for scripts/deployments/sepolia.json:");
        console2.log(json);
    }
}
