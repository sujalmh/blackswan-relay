// frontend/lib/contracts.ts — lightweight ABIs and viem helpers (no top-level viem import to keep bundle small)
// Uses window.ethereum if available, fallback to privateKey from .env for demo via viem privateKeyToAccount

export const DEPLOY = {
  MockERC20: "0x491106810FB442Ec0C8071B76dEE3e17c8A9E9D5" as const,
  RecapVault: "0x62447c4574576283277528A327630033d2897c58" as const,
  RecapVerifier: "0xc8367A0f210EC10D146ae915871B5B52A78deA4b" as const,
  BlackSwanRescue: "0xDD8BB798E9A7128F92D18dD9DF63bA05A5893ae6" as const,
  ShieldedPool: "0x2Fdd2Af239AD7D92c613562003191c0b125f5882" as const,
};

export const EXPLORER = "https://sepolia.etherscan.io";
export const PRIVATE_RPC_URL = (typeof process !== "undefined" && ((process.env as any).NEXT_PUBLIC_PRIVATE_RPC_URL || (process.env as any).PRIVATE_RPC_URL)) || "https://protect.flashbots.net";
export const SEPOLIA_RPC_URL = (typeof process !== "undefined" && ((process.env as any).NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env as any).SEPOLIA_RPC_URL)) || "https://eth-sepolia.g.alchemy.com/v2/demo";

// ABIs as const without parseAbi to avoid pulling viem into bundle (viem imported dynamically in helpers)
export const RECAP_VAULT_ABI = [
  { type: "function", name: "openRound", inputs: [{ name: "roundId", type: "uint256" }, { name: "target", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "reset", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "roundId", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "target", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

export const RESCUE_ABI = [
  { type: "function", name: "recordCommitments", inputs: [{ name: "roundId", type: "uint256" }, { name: "commitments", type: "bytes32[6]" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "settle", inputs: [{ name: "proof", type: "bytes" }, { name: "publicInputs", type: "bytes32[]" }, { name: "nullifiers", type: "bytes32[6]" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "commitmentsForRound", inputs: [{ name: "", type: "uint256" }, { name: "", type: "uint256" }], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  { type: "function", name: "roundSettled", inputs: [{ name: "", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "event", name: "CommitmentsRecorded", inputs: [{ indexed: true, name: "roundId", type: "uint256" }, { name: "commitments", type: "bytes32[6]" }] },
  { type: "event", name: "RescueTargetMet", inputs: [{ indexed: true, name: "roundId", type: "uint256" }, { name: "target", type: "uint256" }] },
  { type: "error", name: "InvalidProof", inputs: [] },
  { type: "error", name: "NullifierReused", inputs: [{ name: "nullifier", type: "bytes32" }] },
  { type: "error", name: "AlreadySettled", inputs: [{ name: "roundId", type: "uint256" }] },
  { type: "error", name: "ProofLengthWrongWithLogN", inputs: [{ name: "logN", type: "uint256" }, { name: "actualLength", type: "uint256" }, { name: "expectedLength", type: "uint256" }] },
  { type: "error", name: "InvalidPublicInputs", inputs: [] },
] as const;

export const SHIELDED_POOL_ABI = [
  { type: "function", name: "deposit", inputs: [{ name: "commitment", type: "bytes32" }, { name: "nullifierHash", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "releaseToVault", inputs: [{ name: "vault", type: "address" }, { name: "roundId", type: "uint256" }, { name: "total", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "poolBalance", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "event", name: "Deposit", inputs: [{ indexed: true, name: "commitment", type: "bytes32" }, { indexed: true, name: "nullifierHash", type: "bytes32" }] },
] as const;

export async function getPublicClient() {
  const { createPublicClient, http } = await import("viem");
  const { sepolia } = await import("viem/chains");
  return createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL) });
}

export async function getWalletClient() {
  const { createWalletClient, http } = await import("viem");
  const { sepolia } = await import("viem/chains");
  const { privateKeyToAccount } = await import("viem/accounts");
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const { custom } = await import("viem");
    return createWalletClient({ chain: sepolia, transport: custom((window as any).ethereum) });
  }
  const pk = (typeof process !== "undefined" && ((process.env as any).NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY || (process.env as any).DEPLOYER_PRIVATE_KEY)) as `0x${string}` | undefined;
  if (pk && pk.startsWith("0x") && pk.length === 66) {
    const account = privateKeyToAccount(pk);
    return createWalletClient({ account, chain: sepolia, transport: http(SEPOLIA_RPC_URL) });
  }
  try {
    const dummy = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`);
    return createWalletClient({ account: dummy, chain: sepolia, transport: http(SEPOLIA_RPC_URL) });
  } catch {
    return null;
  }
}

export async function sendPrivateTransaction(request: any, publicClient: any, walletClient: any): Promise<string> {
  const hasPrivate = PRIVATE_RPC_URL && PRIVATE_RPC_URL !== "";
  if (!hasPrivate) {
    console.log("[mempool] PRIVATE_RPC_URL empty — using public mempool (hashes only)");
    return walletClient.writeContract(request);
  }
  try {
    console.log(`[private-mempool] eth_sendPrivateTransaction via ${PRIVATE_RPC_URL} — amounts hidden, hash only`);
    const account = (walletClient as any)?.account;
    if (account && typeof account.signTransaction === "function") {
      try {
        const { encodeFunctionData } = await import("viem");
        let to = request.address as `0x${string}`;
        let data = (request as any).data as `0x${string}` | undefined;
        if (!data && request.abi && request.functionName) {
          data = encodeFunctionData({ abi: request.abi, functionName: request.functionName, args: request.args }) as `0x${string}`;
        }
        if (to && data) {
          const fees = await publicClient.estimateFeesPerGas().catch(() => ({ maxFeePerGas: undefined, maxPriorityFeePerGas: undefined }));
          const nonce = await publicClient.getTransactionCount({ address: account.address }).catch(() => 0);
          const gas = await publicClient.estimateGas({ account, to, data }).catch(() => undefined);
          const tx: any = { to, data, nonce, chainId: 11155111, type: "eip1559" as const };
          if (gas) tx.gas = gas;
          if ((fees as any).maxFeePerGas) tx.maxFeePerGas = (fees as any).maxFeePerGas;
          if ((fees as any).maxPriorityFeePerGas) tx.maxPriorityFeePerGas = (fees as any).maxPriorityFeePerGas;
          const raw = await account.signTransaction(tx);
          console.log(`[private-mempool] signed ${raw.slice(0, 10)}... ${raw.length} chars`);
          const payload = { jsonrpc: "2.0", id: 1, method: "eth_sendPrivateTransaction", params: [{ tx: raw }] };
          try {
            const res = await fetch(PRIVATE_RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const text = await res.text();
            console.log(`[private-mempool] POST status ${res.status} ${text.slice(0, 300)}`);
            if (res.ok) {
              try {
                const j = JSON.parse(text);
                if (j.result && typeof j.result === "string" && j.result.startsWith("0x")) {
                  console.log(`[private-mempool] accepted ${j.result}`);
                  return j.result as `0x${string}`;
                }
                if (j.error) throw new Error(JSON.stringify(j.error));
              } catch {}
            }
          } catch (e: any) {
            console.log(`[private-mempool] fetch failed ${e.message?.slice(0, 200)}, fallback to public`);
          }
        }
      } catch (e: any) {
        console.log(`[private-mempool] sign failed ${e.message?.slice(0, 200)}, fallback`);
      }
    }
    throw new Error("private RPC fallback");
  } catch (e: any) {
    console.log(`[private-mempool] fallback to public writeContract (hashes only) — ${e.message?.slice(0, 200)}`);
    // FIX #2: no fake-tx fallback — surface real error so UI can label demo vs live.
    // If writeContract fails (e.g., demo RPC https://.../demo blocked by CORS), caller will handle and show demo-mode notice.
    return await walletClient.writeContract(request);
  }
}
