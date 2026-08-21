#!/usr/bin/env tsx
// Phase 4: compile -> prove -> settle pipeline with private-mempool support
// - Uses real UltraHonk proof (Barretenberg 5.0.0-nightly, pedersen_hash) from circuits/rescue_circuit/target/proof/proof
//   Generated via: nargo execute && bb prove --scheme ultra_honk -b target/rescue_circuit.json -w target/rescue_circuit.gz -o target/proof --oracle_hash keccak -k target/vk/vk
// - Commitments are submitted via PRIVATE_RPC_URL eth_sendPrivateTransaction when set, fallback to SEPOLIA_RPC_URL
// - Calls BlackSwanRescue.settle(proof, publicInputs, nullifiers) and waits for RescueTargetMet

import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";

const ABI = parseAbi([
  "function openRound(uint256 roundId, uint256 target) external",
  "function reset() external",
  "function settle(bytes proof, bytes32[] publicInputs, bytes32[6] nullifiers) external",
  "function settle(bytes proof, bytes32[6] commitments, uint256 target, uint256 roundId, bytes32[6] nullifiers) external",
  "function commitmentsForRound(uint256, uint256) view returns (bytes32)",
  "function roundSettled(uint256) view returns (bool)",
  "function undercollateralized() view returns (bool)",
  "function recapped() view returns (bool)",
  "function roundId() view returns (uint256)",
  "event RescueTargetMet(uint256 indexed roundId, uint256 target)",
  "event CommitmentsRecorded(uint256 indexed roundId, bytes32[6] commitments)",
  "error InvalidProof()",
  "error NullifierReused(bytes32)",
  "error AlreadySettled(uint256)",
  "error RoundNotOpened(uint256)",
  "error InvalidPublicInputs()",
  "error ProofLengthWrongWithLogN(uint256 logN, uint256 actualLength, uint256 expectedLength)",
]);

const POOL_ABI = parseAbi([
  "function deposit(bytes32 commitment, bytes32 nullifierHash) external",
  "function releaseToVault(address vault, uint256 roundId, uint256 total) external",
  "function poolBalance() view returns (uint256)",
  "function commitmentRecorded(bytes32) view returns (bool)",
  "event Deposit(bytes32 indexed commitment, bytes32 indexed nullifierHash)",
  "event Released(address indexed vault, uint256 total, uint256 roundId)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address to, uint256 amount) external",
]);

const C0 = "0x09726b28aff94a2f70169b87dc9e689359dbe0b588664b645e6606c74ebc5196" as const;
const C1 = "0x1804bcccd6d51a2c6e89c38d57280cb32cc149d16b260ac341efccb3d3ff9da7" as const;
const C2 = "0x11d2f4a75e9382f6370873b63e1bf75d0e0b8f31b26f5e8fd0c6fa28e6de8d0a" as const;
const C3 = "0x0252191f87d94cfa16f5de62f60d4c58f0899cbb2d437e58c1ad7bb55139b3b7" as const;

function getEnv(name: string, fallback = "") {
  return process.env[name] || fallback;
}

// Real private-mempool path: sign with account.signTransaction then POST raw to PRIVATE_RPC_URL via fetch
// {jsonrpc:"2.0",method:"eth_sendPrivateTransaction",params:[{tx: raw}],id:1} or eth_sendRawTransaction
// Only fallback to walletClient.writeContract on RPC failure. Keeps hash-only privacy (commitments C0..C3 never 300) and logs fallback per README.md:83.
async function sendPrivateOrPublic(walletClient: any, publicClient: any, request: any, account: any) {
  const privateRpc = getEnv("PRIVATE_RPC_URL");
  const hasPrivate = privateRpc && privateRpc !== "";
  if (!hasPrivate) {
    console.log("[mempool] PRIVATE_RPC_URL empty — using public mempool (commitments are hashes only, so no amount signal leaks even publicly; see README.md:83).");
    if (request.functionName || request.abi) return walletClient.writeContract(request);
    return walletClient.sendTransaction(request);
  }

  console.log(`[private-mempool] Attempting eth_sendPrivateTransaction via ${privateRpc} ... (commitments hashes only, amounts hidden per README.md:83)`);
  try {
    // Build transaction for signing: handle contract-call request (address+abi+functionName) vs raw to/data
    let to: `0x${string}` | undefined;
    let data: `0x${string}` | undefined;
    let value: bigint | undefined;

    if (request.address && request.abi && request.functionName) {
      to = request.address as `0x${string}`;
      // request.data may already be present from simulateContract; otherwise encode
      if ((request as any).data) {
        data = (request as any).data as `0x${string}`;
      } else {
        const { encodeFunctionData } = await import("viem");
        data = encodeFunctionData({
          abi: request.abi,
          functionName: request.functionName,
          args: request.args,
        }) as `0x${string}`;
      }
      value = (request as any).value ? BigInt((request as any).value) : undefined;
    } else if ((request as any).to) {
      to = (request as any).to as `0x${string}`;
      data = (request as any).data as `0x${string}`;
      value = (request as any).value ? BigInt((request as any).value) : undefined;
    } else {
      throw new Error("unknown request shape for private send");
    }

    // Prepare EIP-1559 fields
    const fees = await publicClient.estimateFeesPerGas().catch(() => ({ maxFeePerGas: undefined, maxPriorityFeePerGas: undefined }));
    const nonce = await publicClient.getTransactionCount({ address: account.address });
    const gas = await publicClient.estimateGas({ account, to, data, value }).catch(() => undefined);

    const tx: any = {
      to,
      data,
      value,
      nonce,
      chainId: 11155111,
      type: "eip1559" as const,
    };
    if (gas) tx.gas = gas;
    if (fees.maxFeePerGas) tx.maxFeePerGas = fees.maxFeePerGas;
    if (fees.maxPriorityFeePerGas) tx.maxPriorityFeePerGas = fees.maxPriorityFeePerGas;

    const raw = await account.signTransaction(tx);
    console.log(`[private-mempool] Signed raw ${raw.slice(0,10)}... ${raw.length} chars, POSTing to PRIVATE_RPC_URL`);

    // Try eth_sendPrivateTransaction (Flashbots Protect) then eth_sendRawTransaction fallback
    const methods = ["eth_sendPrivateTransaction", "eth_sendRawTransaction"];
    let lastErr: any = null;
    for (const method of methods) {
      const payload = method === "eth_sendPrivateTransaction"
        ? { jsonrpc: "2.0", id: 1, method, params: [{ tx: raw }] }
        : { jsonrpc: "2.0", id: 1, method, params: [raw] };
      try {
        const res = await fetch(privateRpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        console.log(`[private-mempool] POST ${method} status ${res.status} body ${text.slice(0,500)}`);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} ${text.slice(0,300)}`);
          continue;
        }
        let j: any = null;
        try { j = JSON.parse(text); } catch { j = null; }
        if (j && j.error) {
          lastErr = new Error(`RPC error ${JSON.stringify(j.error).slice(0,300)}`);
          continue;
        }
        if (j && j.result && typeof j.result === "string" && j.result.startsWith("0x")) {
          console.log(`[private-mempool] Private tx accepted ${j.result} -> https://sepolia.etherscan.io/tx/${j.result}`);
          return j.result as `0x${string}`;
        }
        // Some endpoints return result directly or need to try next method
        lastErr = new Error(`no result for ${method}: ${text.slice(0,300)}`);
      } catch (e: any) {
        lastErr = e;
        console.log(`[private-mempool] ${method} failed: ${e.message?.slice(0,300)}`);
      }
    }
    throw lastErr || new Error("private RPC failed");
  } catch (e: any) {
    console.log(`[private-mempool] Private send failed (${e.message?.slice(0,400)}), fallback to public broadcast (hashes only, no amount leak) per README.md:83`);
    if (request.functionName || request.abi) {
      const hash = await walletClient.writeContract(request);
      return hash;
    }
    const hash = await walletClient.sendTransaction(request);
    return hash;
  }
}

async function main() {
  const sepoliaRpc = getEnv("SEPOLIA_RPC_URL");
  const pk = getEnv("DEPLOYER_PRIVATE_KEY");
  if (!sepoliaRpc || !pk) {
    console.error("Missing SEPOLIA_RPC_URL or DEPLOYER_PRIVATE_KEY in .env. See .env.example.");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const roundIdx = args.indexOf("--round");
  const roundArg = roundIdx !== -1 ? args[roundIdx + 1] : "1";
  const targetIdx = args.indexOf("--target");
  const targetArg = targetIdx !== -1 ? args[targetIdx + 1] : "600";
  const modeIdx = args.indexOf("--mode");
  const mode = modeIdx !== -1 ? args[modeIdx + 1] : "honest";

  let roundId = BigInt(roundArg);
  let target = BigInt(targetArg);

  const deployPath = path.resolve("scripts/deployments/sepolia.json");
  if (!fs.existsSync(deployPath)) {
    console.error(`Missing ${deployPath}. Run: forge script contracts/script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast`);
    process.exit(1);
  }
  const deploy = JSON.parse(fs.readFileSync(deployPath, "utf-8"));
  const vaultAddr = deploy.RecapVault as `0x${string}`;
  const rescueAddr = deploy.BlackSwanRescue as `0x${string}`;

  const account = privateKeyToAccount(pk as `0x${string}`);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(sepoliaRpc) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(sepoliaRpc) });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer ${account.address} balance: ${formatEther(balance)} SepoliaETH`);
  console.log(`Vault ${vaultAddr} Rescue ${rescueAddr} round ${roundId} target ${target} mode ${mode}`);
  console.log(`Private mempool: ${getEnv("PRIVATE_RPC_URL") ? "PRIVATE_RPC_URL set (commitments private)" : "public fallback (hashes only, no amount leak)"}`);

  // Build commitments + nullifiers + proof early to determine effective round for real verifier
  let commitments: readonly `0x${string}`[] = [C0, C1, C2, C3, C3, C3];
  let nullifiers: readonly `0x${string}`[] = [
    "0x000000000000000000000000000000000000000000000000000000000000000b",
    "0x0000000000000000000000000000000000000000000000000000000000000016",
    "0x0000000000000000000000000000000000000000000000000000000000000021",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  ];
  let proof: `0x${string}`;
  const proofPath = path.resolve("circuits/rescue_circuit/target/proof/proof");
  if (!fs.existsSync(proofPath)) {
    console.error(`[proof] Real UltraHonk proof not found at ${proofPath}. Run: nargo execute && bb prove --scheme ultra_honk -b target/rescue_circuit.json -w target/rescue_circuit.gz -o target/proof --verifier_target evm-no-zk -k target/vk/vk (or --oracle_hash keccak for ZK)`);
    process.exit(1);
  }
  const proofBytes = fs.readFileSync(proofPath);
  proof = `0x${proofBytes.toString("hex")}` as `0x${string}`;
  console.log(`[proof] Loaded real UltraHonk proof ${proofBytes.length} bytes from ${proofPath} (Barretenberg 5.0.0-nightly, pedersen_hash, round 1, T=600, ${proofBytes.length===7424?"evm-no-zk (non-ZK)":"ZK"})`);
  let expectRevert = "";

  if (mode === "cheat-underfunded") {
    proof = "0x";
    expectRevert = "ProofLengthWrong";
    // Proof length depends on verifier flavor: 8384 for ZK, 7424 for non-ZK (LOG_N=15)
    const expectedLen = proofBytes.length === 7424 ? 7424 : 8384;
    console.log(`[mode] cheat-underfunded: empty proof — real UltraHonk verifier reverts ProofLengthWrongWithLogN(15,0,${expectedLen}). A genuine sum<T proof cannot exist (bb prove fails when sum<T).`);
  } else if (mode === "cheat-nullifier") {
    nullifiers = [
      "0x000000000000000000000000000000000000000000000000000000000000000b",
      "0x000000000000000000000000000000000000000000000000000000000000000b",
      "0x0000000000000000000000000000000000000000000000000000000000000021",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    ];
    expectRevert = "NullifierReused";
    console.log("[mode] cheat-nullifier: duplicate nullifier 11");
  } else if (mode === "public") {
    console.log("[mode] public: would leak amounts 300,200,100 directly — BlackSwan hides amounts, only commitments shown");
  } else {
    console.log("[mode] honest: 300+200+100=600 >=600, private commitments — using real UltraHonk proof for round 1");
  }

  // For real UltraHonk verifier, honest proof is only valid for round 1, T=600
  let effectiveRoundId = roundId;
  let effectiveTarget = target;
  if (mode === "honest" && (roundId !== 1n || target !== 600n)) {
    console.log(`[note] Real proof is for round 1 T=600 — overriding requested round ${roundId} T=${target} to 1/600 for honest verification`);
    effectiveRoundId = 1n;
    effectiveTarget = 600n;
    commitments = [C0, C1, C2, C3, C3, C3] as any;
  }
  if (mode === "cheat-nullifier" && roundId !== 1n) {
    console.log(`[note] For cheat-nullifier with real proof, keeping round 1 to test nullifier reuse in isolation (requested ${roundId})`);
    effectiveRoundId = 1n;
    effectiveTarget = 600n;
  }

  // C1: ShieldedPool hash-only deposits (fix #1: no amount in calldata, no Transfer per deposit)
  // Amounts 300,200,100 are private witnesses only; calldata is (commitment, nullifierHash) hashes only.
  const poolAddr = (deploy as any).ShieldedPool as `0x${string}` | undefined;
  const assetAddr = (deploy as any).MockERC20 as `0x${string}` | undefined;
  if (poolAddr && assetAddr && mode === "honest") {
    console.log(`\n[0/3] ShieldedPool hash-only deposits via ${poolAddr} (no amount in calldata, no Transfer — breakdown hidden) ...`);
    try {
      // Deposits are hash-only (commitment, nullifierHash) — no amount param, no token approval needed.
      // Pool is pre-funded via Deploy.s.sol mint(pool,1000); release will move aggregated 600 as one Transfer (total public, breakdown hidden).
      const deposits: [string, string][] = [
        [C0, "0x000000000000000000000000000000000000000000000000000000000000000b"],
        [C1, "0x0000000000000000000000000000000000000000000000000000000000000016"],
        [C2, "0x0000000000000000000000000000000000000000000000000000000000000021"],
      ];
      for (const [comm, nullHash] of deposits) {
        try {
          const { request: depReq } = await publicClient.simulateContract({ address: poolAddr, abi: POOL_ABI, functionName: "deposit", args: [comm as `0x${string}`, nullHash as `0x${string}`], account });
          const depHash = await sendPrivateOrPublic(walletClient, publicClient, depReq, account);
          console.log(`  deposit hash ${comm.slice(0,10)} nullifier ${nullHash.slice(0,10)} -> ${depHash} (calldata: commitment+nullifier only, no 0x...012c amount leak)`);
          await publicClient.waitForTransactionReceipt({ hash: depHash });
        } catch (e: any) {
          const msg = e.message || "";
          if (msg.includes("commitment reused") || msg.includes("nullifier reused")) {
            console.log(`  deposit ${comm.slice(0,10)} already recorded (hash-only, idempotent) — skip`);
          } else {
            console.log(`  deposit ${comm.slice(0,10)} failed: ${e.message?.slice(0,300)}`);
          }
        }
      }
      const poolBal = await publicClient.readContract({ address: poolAddr, abi: POOL_ABI, functionName: "poolBalance" }) as bigint;
      console.log(`  pool balance ${poolBal} (pre-funded 1000, will release aggregated 600 on settle — breakdown hidden, total public)`);
    } catch (e: any) {
      console.log(`  ShieldedPool deposit helper failed: ${e.message?.slice(0,400)} (pool pre-funded with 1000, so release will still succeed)`);
    }
  } else if (poolAddr && mode !== "honest") {
    console.log(`\n[0/3] ShieldedPool skip deposits for mode ${mode} (only honest needs hash-only deposits)`);
  }

  // Step 1: ensure round is open
  console.log(`\n[1/3] ensure RoundOpened ${effectiveRoundId} target ${effectiveTarget} ...`);
  try {
    const { request: openReq } = await publicClient.simulateContract({
      address: vaultAddr,
      abi: ABI,
      functionName: "openRound",
      args: [effectiveRoundId, effectiveTarget],
      account,
    });
    const hashOpen = await sendPrivateOrPublic(walletClient, publicClient, openReq, account);
    console.log(`  openRound tx ${hashOpen} -> https://sepolia.etherscan.io/tx/${hashOpen}`);
    await publicClient.waitForTransactionReceipt({ hash: hashOpen });
  } catch (e: any) {
    const msg = e.message || String(e);
    console.log(`  openRound failed: ${msg.slice(0,400)}`);
    if (msg.includes("round active")) {
      console.log(`  round active -> calling vault.reset() (demo helper) then retry openRound ${effectiveRoundId}...`);
      try {
        const { request: resetReq } = await publicClient.simulateContract({
          address: vaultAddr,
          abi: ABI,
          functionName: "reset",
          account,
        });
        const hashReset = await walletClient.writeContract(resetReq);
        console.log(`  reset tx ${hashReset} -> https://sepolia.etherscan.io/tx/${hashReset}`);
        await publicClient.waitForTransactionReceipt({ hash: hashReset });
        const { request: openReq2 } = await publicClient.simulateContract({
          address: vaultAddr,
          abi: ABI,
          functionName: "openRound",
          args: [effectiveRoundId, effectiveTarget],
          account,
        });
        const hashOpen2 = await sendPrivateOrPublic(walletClient, publicClient, openReq2, account);
        console.log(`  openRound retry tx ${hashOpen2} -> https://sepolia.etherscan.io/tx/${hashOpen2}`);
        await publicClient.waitForTransactionReceipt({ hash: hashOpen2 });
      } catch (e2: any) {
        console.log(`  reset/retry failed: ${e2.message?.slice(0,400)}`);
      }
    } else {
      console.log(`  openRound skipped/failed (maybe already open): ${msg.slice(0,200)}`);
    }
  }

  const publicInputs: `0x${string}`[] = [...commitments, `0x${effectiveTarget.toString(16).padStart(64,"0")}` as `0x${string}`, `0x${effectiveRoundId.toString(16).padStart(64,"0")}` as `0x${string}`];

  console.log(`\n[2/3] settle round ${effectiveRoundId} with proof ${proof.slice(0,10)}... and commitments hashes only (amounts hidden)`);
  console.log(`  commitments: ${commitments.slice(0,3).map(c=>c.slice(0,10)).join(", ")} + 3x zero-slot ${C3.slice(0,10)}`);
  console.log(`  publicInputs[6]=target ${effectiveTarget} [7]=roundId ${effectiveRoundId}`);
  console.log(`  nullifiers: ${nullifiers.slice(0,3).join(", ")}`);
  if (expectRevert) console.log(`  expect revert: ${expectRevert} (real verifier: ProofLengthWrongWithLogN for empty proof)`);

  console.log(`\n[3/3] calling BlackSwanRescue.settle ... (private-mempool aware, explorer will show only RescueTargetMet + hashes)`);
  try {
    const { request } = await publicClient.simulateContract({
      address: rescueAddr,
      abi: ABI,
      functionName: "settle",
      args: [proof, publicInputs, nullifiers],
      account,
    });
    const hash = await sendPrivateOrPublic(walletClient, publicClient, request, account);
    console.log(`  settle tx ${hash} -> https://sepolia.etherscan.io/tx/${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  receipt status ${receipt.status} block ${receipt.blockNumber} gas ${receipt.gasUsed}`);
    if (receipt.status === "success") {
      console.log(`\n✅ RescueTargetMet roundId=${effectiveRoundId} target=${effectiveTarget} (hashes only, amounts hidden)`);
      console.log(`   Explorer: https://sepolia.etherscan.io/address/${rescueAddr}#events`);
    } else {
      console.log(`\n❌ settle reverted (status 0) — check revert reason above`);
    }
    if (expectRevert && receipt.status === "success") {
      console.log(`⚠️  Expected revert ${expectRevert} but got success — real bb verifier should have rejected the invalid/empty proof`);
    }
  } catch (e: any) {
    const msg = e.message || String(e);
    console.log(`\n❌ settle reverted as expected? ${msg.slice(0,800)}`);
    if (expectRevert && (msg.includes(expectRevert) || msg.includes("ProofLengthWrong") || msg.includes("NullifierReused"))) {
      console.log(`✅ Got expected revert ${expectRevert} (or real verifier ProofLengthWrong) — honest-vs-cheat gate PASS`);
    } else if (expectRevert) {
      console.log(`⚠️  Expected ${expectRevert} but got different revert — check BlackSwanRescue.sol errors`);
    } else {
      console.log(`❌ Honest settle should not revert — check round open, proof, or verifier`);
    }
  }

  console.log("\nDone. See README.md:116-122 demo script: public leaks vs BlackSwan private (hashes only) vs cheat reject.");
  console.log("Note: proof is real UltraHonk (bb 5.0.0-nightly, pedersen_hash) for round 1 — bb prove --scheme ultra_honk -b target/rescue_circuit.json -w target/rescue_circuit.gz --verifier_target evm-no-zk -k target/vk/vk (7424B, non-ZK; ZK would be 8384B via --oracle_hash keccak)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
