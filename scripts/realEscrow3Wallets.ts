#!/usr/bin/env tsx
// Real escrow LIVE with 3 distinct wallets (alice/bob/carol) — addresses from above
// Shows 3x Transfer(alice->pool 300) etc, then rescueShares minted, pool 0

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";

const deploy = JSON.parse(fs.readFileSync(path.resolve("scripts/deployments/sepolia.json"), "utf-8"));
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL!;
const DEPLOYER_PK = process.env.DEPLOYER_PRIVATE_KEY! as `0x${string}`;

const ALICE_PK = "0x61508e85f2a8ad607e4443b31be039a3fa659b1799ef24f49dc345125cfd6c79" as const;
const BOB_PK = "0xbca5878341f7aa82b2ede2fd2852ee7b8da20de8a7cb52a89e54da9a446349d8" as const;
const CAROL_PK = "0x012be07fa67087270cf0016fb1a13b2eaac663fed9b3a76239cab1ba6fd12e23" as const;

const C0 = "0x09726b28aff94a2f70169b87dc9e689359dbe0b588664b645e6606c74ebc5196" as const;
const C1 = "0x1804bcccd6d51a2c6e89c38d57280cb32cc149d16b260ac341efccb3d3ff9da7" as const;
const C2 = "0x11d2f4a75e9382f6370873b63e1bf75d0e0b8f31b26f5e8fd0c6fa28e6de8d0a" as const;
const C3 = "0x0252191f87d94cfa16f5de62f60d4c58f0899cbb2d437e58c1ad7bb55139b3b7" as const;

const ERC20_ABI = parseAbi([
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
]);
const POOL_ABI = parseAbi([
  "function depositReal(bytes32 commitment, bytes32 nullifierHash, uint256 amount) external",
  "function poolBalance() view returns (uint256)",
  "function escrow(bytes32) view returns (uint256)",
  "function getDepositor(bytes32) view returns (address)",
]);
const VAULT_ABI = parseAbi([
  "function openRound(uint256 roundId, uint256 target) external",
  "function rescueShares(address) view returns (uint256)",
  "function totalRescueShares() view returns (uint256)",
]);
const RESCUE_ABI = parseAbi([
  "function settle(bytes proof, bytes32[] publicInputs, bytes32[6] nullifiers) external",
]);

async function main() {
  const publicClient = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
  const deployer = privateKeyToAccount(DEPLOYER_PK);
  const alice = privateKeyToAccount(ALICE_PK);
  const bob = privateKeyToAccount(BOB_PK);
  const carol = privateKeyToAccount(CAROL_PK);
  const deployerClient = createWalletClient({ account: deployer, chain: sepolia, transport: http(SEPOLIA_RPC) });
  const aliceClient = createWalletClient({ account: alice, chain: sepolia, transport: http(SEPOLIA_RPC) });
  const bobClient = createWalletClient({ account: bob, chain: sepolia, transport: http(SEPOLIA_RPC) });
  const carolClient = createWalletClient({ account: carol, chain: sepolia, transport: http(SEPOLIA_RPC) });

  const asset = deploy.MockERC20 as `0x${string}`;
  const pool = deploy.ShieldedPool as `0x${string}`;
  const vault = deploy.RecapVault as `0x${string}`;
  const rescue = deploy.BlackSwanRescue as `0x${string}`;

  console.log("Deployer", deployer.address);
  console.log("Alice", alice.address, "300");
  console.log("Bob", bob.address, "200");
  console.log("Carol", carol.address, "100");
  console.log("Asset", asset, "Pool", pool, "Vault", vault, "Rescue", rescue);

  // Fund wallets with SepoliaETH for gas (0.02 ETH each)
  for (const w of [alice, bob, carol]) {
    const bal = await publicClient.getBalance({ address: w.address });
    console.log(`${w.address} ETH bal ${bal}`);
    if (bal < 5000000000000000n) {
      const hash = await deployerClient.sendTransaction({ to: w.address, value: 20000000000000000n }); // 0.02 ETH
      console.log(`  sent 0.02 ETH -> ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }

  // Mint mUSDC to each rescuer (1000 each) via deployer (onlyOwner)
  for (const [addr, name] of [[alice.address, "alice"], [bob.address, "bob"], [carol.address, "carol"]] as const) {
    const bal = await publicClient.readContract({ address: asset, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }) as bigint;
    console.log(`${name} mUSDC bal ${bal}`);
    if (bal < 500_000000n) {
      const { request } = await publicClient.simulateContract({ address: asset, abi: ERC20_ABI, functionName: "mint", args: [addr, 1000000000n], account: deployer });
      const hash = await deployerClient.writeContract(request);
      console.log(`  mint 1000 to ${name} -> ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }

  // Open round 1, 600 if not already
  try {
    const { request } = await publicClient.simulateContract({ address: vault, abi: VAULT_ABI, functionName: "openRound", args: [1n, 600n], account: deployer });
    const hash = await deployerClient.writeContract(request);
    console.log(`openRound 1,600 -> ${hash} https://sepolia.etherscan.io/tx/${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
  } catch (e: any) {
    console.log(`openRound failed (maybe already open): ${e.message?.slice(0,200)}`);
  }

  // Each rescuer approves + depositReal
  const deposits: Array<{ client: any, account: any, commitment: string, nullifier: string, amount: bigint, name: string }> = [
    { client: aliceClient, account: alice, commitment: C0, nullifier: "0x000000000000000000000000000000000000000000000000000000000000000b", amount: 300000000n, name: "alice 300" },
    { client: bobClient, account: bob, commitment: C1, nullifier: "0x0000000000000000000000000000000000000000000000000000000000000016", amount: 200000000n, name: "bob 200" },
    { client: carolClient, account: carol, commitment: C2, nullifier: "0x0000000000000000000000000000000000000000000000000000000000000021", amount: 100000000n, name: "carol 100" },
  ];
  for (const d of deposits) {
    // approve
    const { request: appr } = await publicClient.simulateContract({ address: asset, abi: ERC20_ABI, functionName: "approve", args: [pool, d.amount], account: d.account });
    const h1 = await d.client.writeContract(appr);
    console.log(`${d.name} approve ${d.amount} -> ${h1}`);
    await publicClient.waitForTransactionReceipt({ hash: h1 });
    // depositReal
    const { request: dep } = await publicClient.simulateContract({ address: pool, abi: POOL_ABI, functionName: "depositReal", args: [d.commitment as `0x${string}`, d.nullifier as `0x${string}`, d.amount], account: d.account });
    const h2 = await d.client.writeContract(dep);
    console.log(`${d.name} depositReal ${d.commitment.slice(0,10)} -> ${h2} https://sepolia.etherscan.io/tx/${h2}`);
    await publicClient.waitForTransactionReceipt({ hash: h2 });
    // check escrow
    const esc = await publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: "escrow", args: [d.nullifier as `0x${string}`] }) as bigint;
    console.log(`  escrow ${d.nullifier.slice(0,10)} = ${esc}`);
  }

  const poolBal = await publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: "poolBalance" }) as bigint;
  console.log(`poolBalance after deposits: ${poolBal} (should 600_000000 + 1000 pre-funded = 1600? Wait fresh pool 1000 pre-funded + 600 =1600)`);

  // Load proof
  const proofPath = path.resolve("circuits/rescue_circuit/target/proof/proof");
  const proofBytes = fs.readFileSync(proofPath);
  const proof = `0x${proofBytes.toString("hex")}` as `0x${string}`;
  console.log(`proof ${proofBytes.length} bytes`);
  const commitments = [C0, C1, C2, C3, C3, C3] as `0x${string}`[];
  const nullifiers = [
    "0x000000000000000000000000000000000000000000000000000000000000000b",
    "0x0000000000000000000000000000000000000000000000000000000000000016",
    "0x0000000000000000000000000000000000000000000000000000000000000021",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  ] as `0x${string}`[];
  // 14-input circuit: commitments[6] + nullifier_hashes[6] + target + roundId, where nullifier_hashes == nullifiers (binding check)
  const nullifier_hashes = [...nullifiers] as `0x${string}`[];
  const publicInputs = [...commitments, ...nullifier_hashes, `0x${(600n).toString(16).padStart(64,"0")}` as `0x${string}`, `0x${(1n).toString(16).padStart(64,"0")}` as `0x${string}`];
  console.log(`publicInputs len ${publicInputs.length} (14 =6+6+1+1), proof 8384B ZK 14-input bound`);

  // Settle (deployer can call)
  const { request: settleReq } = await publicClient.simulateContract({ address: rescue, abi: RESCUE_ABI, functionName: "settle", args: [proof, publicInputs, nullifiers], account: deployer });
  const settleHash = await deployerClient.writeContract(settleReq);
  console.log(`settle -> ${settleHash} https://sepolia.etherscan.io/tx/${settleHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: settleHash });
  console.log(`settle receipt status ${receipt.status} block ${receipt.blockNumber} gas ${receipt.gasUsed}`);

  // Check rescueShares
  for (const [addr, name] of [[alice.address, "alice"], [bob.address, "bob"], [carol.address, "carol"]] as const) {
    const shares = await publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "rescueShares", args: [addr] }) as bigint;
    console.log(`${name} rescueShares ${shares}`);
  }
  const total = await publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "totalRescueShares" }) as bigint;
  console.log(`totalRescueShares ${total}`);
  const poolBalAfter = await publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: "poolBalance" }) as bigint;
  console.log(`poolBalance after settle ${poolBalAfter} (should 1000 pre-funded left)`);
  const vaultBal = await publicClient.readContract({ address: asset, abi: ERC20_ABI, functionName: "balanceOf", args: [vault] }) as bigint;
  console.log(`vault mUSDC balance ${vaultBal}`);

  console.log("Done — check Etherscan for 3x Transfer(alice->pool 300) etc plus RescueTargetMet");
}

main().catch(e=>{ console.error(e); process.exit(1); });
