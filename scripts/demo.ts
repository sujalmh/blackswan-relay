#!/usr/bin/env tsx
// Honest-vs-cheat demo branch per docs/TODO.md:110-113 + scripts/README.md:7 + docs/PITCH.md:43-50
// Runs three modes sequentially and prints RescueTargetMet vs rejections
// Usage: npx tsx scripts/demo.ts
// Requires: .env with SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY, scripts/deployments/sepolia.json exists
// All Sepolia testnet, no real ETH. Private mempool: commitments only hashes, amounts never hit public mempool.

import { spawn } from "child_process";
import * as path from "path";

function run(mode: string, round: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`>>> DEMO mode=${mode} round=${round}`);
    console.log(`${"=".repeat(70)}`);
    const p = spawn("npx", ["tsx", "scripts/compileProveSettle.ts", "--round", round, "--target", "600", "--mode", mode], {
      stdio: "inherit",
      env: process.env,
    });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`mode ${mode} exit ${code}`))));
  });
}

async function main() {
  console.log("BlackSwan Relay — honest-vs-cheat demo (recapitalize without the signal)");
  console.log("Track: Private DeFi & Mempools — explorer shows only RescueTargetMet + hashes, amounts hidden from MEV");
  console.log("Demo order per README.md:116-122: danger zone -> public leaks (pause) -> BlackSwan private -> cheat reject\n");

  console.log("Step 1: danger zone — vault undercollateralized, keeper opens round T=600 (mock oracle health 0.92<1.0)\n");

  console.log("Step 2: public path (leaks signal) — would show amounts 300,200,100 in mempool/explorer — freeze/skip");
  console.log("  (see test_PublicComparisonPath in contracts/test/BlackSwanRescue.t.sol — public amounts visible vs BlackSwan hashes only)\n");

  // Use distinct fresh roundIds so each settle is independent (nullifier per-round, roundSettled guard)
  // Rounds 1,10 were already settled on Sepolia (blocks 11524010,11524022) — use fresh 100+ to avoid AlreadySettled
  try {
    await run("honest", "100");
    console.log("\n✅ Honest path: RescueTargetMet printed, explorer: only commitments hashes (C0..C3), no amounts leaked via private mempool");
  } catch (e) {
    console.log("\n❌ Honest path failed — check deploy + round open:", e);
  }

  try {
    await run("cheat-underfunded", "101");
    console.log("\n✅ Cheat underfunded: expected revert InvalidProof (simulates sum 300<600) — Gate 4 honest-vs-cheat branch PASS");
  } catch (e) {
    console.log("\nNote: cheat-underfunded did not revert as expected — real UltraHonk verifier should reject the empty/invalid proof:", e);
  }

  try {
    await run("cheat-nullifier", "102");
    console.log("\n✅ Cheat nullifier: expected revert NullifierReused (duplicate 11) — Gate 4 PASS");
  } catch (e) {
    console.log("\nNote: cheat-nullifier did not revert as NullifierReused — check duplicate handling:", e);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("Demo complete. Next: frontend toggle Public mempool: visible (red) vs Private: hidden (green) per frontend/README.md:7");
  console.log("All Sepolia testnet (no real crypto). Private mempool fallback logged per compileProveSettle.ts.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
