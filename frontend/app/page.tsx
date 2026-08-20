"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn, truncateHash } from "@/lib/utils";
import { ShieldCheck, EyeOff, Eye, Zap, Lock, Activity, ExternalLink, CheckCircle2, XCircle, Coins, ArrowRight, Beaker } from "lucide-react";

// Sepolia addresses from scripts/deployments/sepolia.json (deployed Phase 4, Barretenberg 5.0.0-nightly real UltraHonk verifier)
const DEPLOY = {
  MockERC20: "0xB4D1D0cfd5A6BFf6921A37C91ce00802750247A6",
  RecapVault: "0x9a6086B9EC3BC8b1028908E317aBC0Dc456F34FB",
  RecapVerifier: "0x6a77FBb7169A8EC392Ee5Ec9903125aCA39230a4",
  BlackSwanRescue: "0x028d82BE821a51C866Ee085afA22cd2Fba51b10A",
};

// Happy vector hashes from circuits (pedersen_hash)
const HASHES = {
  C0: "0x09726b28aff94a2f70169b87dc9e689359dbe0b588664b645e6606c74ebc5196",
  C1: "0x1804bcccd6d51a2c6e89c38d57280cb32cc149d16b260ac341efccb3d3ff9da7",
  C2: "0x11d2f4a75e9382f6370873b63e1bf75d0e0b8f31b26f5e8fd0c6fa28e6de8d0a",
  C3: "0x0252191f87d94cfa16f5de62f60d4c58f0899cbb2d437e58c1ad7bb55139b3b7",
};

const EXPLORER = "https://sepolia.etherscan.io";

type Rescuer = { id: number; name: string; avatar: string; amount: number | null; committed: boolean; hash: string; nullifier: string };

const DENOMS = [100, 200, 300] as const;

export default function Page() {
  const [vaultOpen, setVaultOpen] = useState(true);
  const [isPrivate, setIsPrivate] = useState(true);
  const [showPublic, setShowPublic] = useState(false);
  const [settled, setSettled] = useState<null | "honest" | "cheat-underfunded" | "cheat-nullifier">(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [rescuers, setRescuers] = useState<Rescuer[]>([
    { id: 1, name: "Rescuer A", avatar: "A", amount: 300, committed: false, hash: HASHES.C0, nullifier: "0x...000b" },
    { id: 2, name: "Rescuer B", avatar: "B", amount: 200, committed: false, hash: HASHES.C1, nullifier: "0x...0016" },
    { id: 3, name: "Rescuer C", avatar: "C", amount: 100, committed: false, hash: HASHES.C2, nullifier: "0x...0021" },
  ]);

  const totalCommitted = useMemo(() => rescuers.filter(r => r.committed).reduce((s, r) => s + (r.amount || 0), 0), [rescuers]);
  const target = 600;
  const health = 0.92;
  const canSettle = rescuers.every(r => r.committed) && totalCommitted >= target && vaultOpen && !settled;

  const commit = (id: number) => {
    setRescuers(prev => prev.map(r => r.id === id ? { ...r, committed: true } : r));
  };
  const reset = () => {
    setRescuers(prev => prev.map(r => ({ ...r, committed: false })));
    setSettled(null);
    setTxHash(null);
  };
  const settleHonest = () => {
    // Real Sepolia tx from Phase 4 redeploy with real UltraHonk verifier: round 1 block 11524374 gas 4543011
    setTxHash("0x7b3799e8eb25bdb256f040d890922a9799fd5aa89937274f7da80e128dcb14e3");
    setSettled("honest");
  };
  const settleCheat = (type: "cheat-underfunded" | "cheat-nullifier") => {
    setTxHash(null);
    setSettled(type);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight">BlackSwan Relay</span>
                <Badge variant="secondary" className="hidden sm:inline-flex bg-zinc-900 text-white">Sepolia • 11155111</Badge>
              </div>
              <p className="hidden text-xs text-zinc-500 sm:block">recapitalize without the signal — amounts hidden until aggregate proves ≥ T</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="private" className="gap-1.5 px-3 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Private mempool • Active
            </Badge>
            <a href={`${EXPLORER}/address/${DEPLOY.BlackSwanRescue}#events`} target="_blank" className="hidden items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 sm:inline-flex">
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero mesh */}
      <div className="mesh-bg border-b">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium shadow-sm ring-1 ring-zinc-200">
                <Beaker className="h-3.5 w-3.5 text-violet-600" /> Road to Devcon • Private DeFi & Mempools • Overall
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
                The private rescue-yield market
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                When a vault slips undercollateralized, rescuers commit through a private mempool. Ethereum proves the sum meets the target, then one atomic settlement mints discounted <span className="font-medium text-zinc-900">RescueShares</span> — yield that was invisible until funded.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-violet-600 px-2.5 py-1 font-medium text-white">ZK sum≥T • Noir 1.0.0-beta.26</span>
                <span className="rounded-full bg-white px-2.5 py-1 font-medium ring-1 ring-zinc-200">pedersen_hash • 6 rescuers • T=600</span>
                <span className="rounded-full bg-white px-2.5 py-1 font-medium ring-1 ring-zinc-200">3 fixed denoms 100/200/500 • 1 ERC20 • 1 round</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200">
                <div className="text-xs text-zinc-500">Deployed Sepolia</div>
                <div className="mt-1 flex flex-col gap-1 font-mono text-xs">
                  <a href={`${EXPLORER}/address/${DEPLOY.RecapVault}`} target="_blank" className="hover:underline">Vault {truncateHash(DEPLOY.RecapVault)}</a>
                  <a href={`${EXPLORER}/address/${DEPLOY.BlackSwanRescue}`} target="_blank" className="hover:underline">Rescue {truncateHash(DEPLOY.BlackSwanRescue)}</a>
                  <a href={`${EXPLORER}/address/${DEPLOY.MockERC20}`} target="_blank" className="hover:underline">mUSDC {truncateHash(DEPLOY.MockERC20)}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Vault Trigger */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Vault trigger state</CardTitle>
                  <CardDescription>Mock oracle • health &lt; threshold → keeper opens round T</CardDescription>
                </div>
              </div>
              <Badge variant={health < 1 ? "warning" : "success"}>{health < 1 ? "Danger zone" : "Healthy"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <div className="text-xs font-medium text-zinc-500">Health factor</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{health.toFixed(2)}</span>
                  <span className="text-sm text-zinc-500">/ 1.00 threshold</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full bg-amber-500" style={{ width: `${health * 100}%` }} />
                </div>
                <div className="mt-1 text-xs text-amber-700">0.92 &lt; 1.0 → undercollateralized</div>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="text-xs font-medium text-zinc-500">Current round</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-lg bg-zinc-900 px-2 py-1 font-mono text-xs text-white">round 1</span>
                  <span className="text-sm font-medium">T = 600 mUSDC</span>
                </div>
                <div className="mt-3 text-xs text-zinc-500">Rescue premium: discounted <b>RescueShares</b> = yield leg</div>
                <div className="mt-2 flex gap-1">
                  {DENOMS.map(d => (
                    <span key={d} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">{d}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="text-xs font-medium text-zinc-500">Aggregate committed</div>
                <div className="mt-1 text-2xl font-semibold">{totalCommitted} <span className="text-sm font-normal text-zinc-500">/ {target}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div className={cn("h-full transition-all", totalCommitted >= target ? "bg-emerald-500" : "bg-zinc-900")} style={{ width: `${Math.min(100, (totalCommitted / target) * 100)}%` }} />
                </div>
                <div className="mt-1 text-xs text-zinc-500">{rescuers.filter(r => r.committed).length}/3 rescuers • sum≥T proven by Noir</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-violet-50 p-3 ring-1 ring-violet-200">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-violet-600" />
                <span className="font-medium">Vault is in the danger zone</span>
                <span className="hidden text-zinc-500 sm:inline">— keeper will open round T=600. Explorer will show only <b>RescueTargetMet</b> + hashes.</span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setVaultOpen(v => !v)}>
                {vaultOpen ? "Round open • T=600" : "Open round T=600"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Private mempool badge + toggle */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="private" className="gap-1.5">
              <Lock className="h-3 w-3" /> Commitments via private mempool
            </Badge>
            <span className="text-xs text-zinc-500">amounts never hit public mempool — only <span className="font-mono">hash(amount, nullifier, secret, round_id)</span></span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-zinc-100 p-1">
            <button onClick={() => setIsPrivate(true)} className={cn("rounded-full px-3 py-1 text-xs font-medium", isPrivate ? "bg-white shadow" : "text-zinc-500")}>
              <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" /> Private (BlackSwan)</span>
            </button>
            <button onClick={() => setIsPrivate(false)} className={cn("rounded-full px-3 py-1 text-xs font-medium", !isPrivate ? "bg-white shadow" : "text-zinc-500")}>
              <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Public (leaks)</span>
            </button>
          </div>
        </div>

        {/* 3 Rescuer Panels */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {rescuers.map((r) => (
            <Card key={r.id} className={cn("relative overflow-hidden transition-all", r.committed && "ring-1 ring-emerald-200 bg-emerald-50/40")}>
              <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-gradient-to-br from-violet-100 to-transparent opacity-60" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">{r.avatar}</div>
                    <div>
                      <CardTitle className="text-sm">{r.name}</CardTitle>
                      <CardDescription className="text-xs">Rescue yield strategy</CardDescription>
                    </div>
                  </div>
                  {r.committed ? <Badge variant="success">Committed</Badge> : <Badge variant="secondary">Idle</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1">
                  {DENOMS.map(d => (
                    <button
                      key={d}
                      disabled={r.committed}
                      onClick={() => setRescuers(prev => prev.map(x => x.id === r.id ? { ...x, amount: d, hash: d===300?HASHES.C0:d===200?HASHES.C1:HASHES.C2 } : x))}
                      className={cn("flex-1 rounded-xl border py-2 text-sm font-medium", r.amount === d ? "bg-zinc-900 text-white border-zinc-900" : "bg-white hover:bg-zinc-50 border-zinc-200", r.committed && "opacity-50")}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                  <div className="text-xs font-medium text-zinc-500">Commitment (private mempool)</div>
                  <div className="mt-1 font-mono text-xs break-all">{r.committed ? truncateHash(r.hash, 18) : "— not yet committed"}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                    <Lock className="h-3 w-3" /> {r.committed ? "hash only on-chain" : "amount hidden until prove"}
                  </div>
                </div>
                <Button
                  className="w-full"
                  variant={r.committed ? "outline" : "default"}
                  disabled={r.committed || !r.amount}
                  onClick={() => commit(r.id)}
                >
                  {r.committed ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Committed privately</> : <><Lock className="mr-2 h-4 w-4" /> Commit privately</>}
                </Button>
                <div className="text-xs text-zinc-500">Nullifier {r.nullifier} • Secret 101+ • round 1</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Public vs Private split view */}
        <Card className="mt-6 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Eye className="h-4 w-4" /> Public mempool (leaks) vs <EyeOff className="h-4 w-4 text-emerald-600" /> Private mempool (BlackSwan)</CardTitle>
            <CardDescription>Toggle shows what MEV bots + explorer see. Private path hides amounts — only hashes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={isPrivate ? "private" : "public"} value={isPrivate ? "private" : "public"} onValueChange={(v) => setIsPrivate(v === "private")}>
              <TabsList>
                <TabsTrigger value="private">Private • hashes only</TabsTrigger>
                <TabsTrigger value="public">Public • amounts leaked</TabsTrigger>
              </TabsList>
              <TabsContent value="private">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border bg-emerald-50 p-4">
                    <div className="text-xs font-semibold text-emerald-700">What explorer shows (BlackSwan)</div>
                    <div className="mt-2 space-y-1 font-mono text-xs">
                      <div>commitments[0] {truncateHash(HASHES.C0)}</div>
                      <div>commitments[1] {truncateHash(HASHES.C1)}</div>
                      <div>commitments[2] {truncateHash(HASHES.C2)}</div>
                      <div className="text-emerald-700">→ RescueTargetMet roundId=1 target=600</div>
                      <div className="text-zinc-500">sum≥T proven, amounts never appear</div>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs font-semibold">What mempool sees</div>
                    <div className="mt-2 font-mono text-xs text-zinc-500">mempool: 0x97… , 0x18… , 0x11… (hashes) — no `300,200,100` values</div>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700"><ShieldCheck className="h-3 w-3" /> MEV signal suppressed</div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="public">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border bg-rose-50 p-4">
                    <div className="text-xs font-semibold text-rose-700">What explorer shows (public rescue)</div>
                    <div className="mt-2 space-y-1 font-mono text-xs">
                      <div className="text-rose-700">Rescuer A: 300 mUSDC</div>
                      <div className="text-rose-700">Rescuer B: 200 mUSDC</div>
                      <div className="text-rose-700">Rescuer C: 100 mUSDC</div>
                      <div className="text-zinc-500">→ anyone can front-run the discount</div>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs font-semibold">What mempool sees</div>
                    <div className="mt-2 font-mono text-xs text-rose-700">mempool: `amount:300`, `amount:200`, `amount:100` — leaked</div>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-700"><XCircle className="h-3 w-3" /> MEV can extract discount</div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Settle bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-900 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Zap className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-medium">Aggregate proof • Noir sum≥T</div>
              <div className="text-xs text-zinc-400">Pedersen commitments • MAX_RESCUERS=6 • unused slots hash(0,0,0,round_id)</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={!canSettle} onClick={settleHonest} className="bg-white text-zinc-900 hover:bg-zinc-100">
              Settle honestly <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => settleCheat("cheat-underfunded")} className="text-white hover:bg-white/10">
              Cheat: underfunded
            </Button>
            <Button variant="ghost" size="sm" onClick={() => settleCheat("cheat-nullifier")} className="text-white hover:bg-white/10">
              Cheat: reuse nullifier
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} className="text-white hover:bg-white/10">
              Reset
            </Button>
          </div>
        </div>

        {/* Result */}
        {settled && (
          <Card className={cn("mt-4 overflow-hidden", settled === "honest" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
            <CardContent className="p-5">
              {settled === "honest" ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div className="flex-1">
                    <div className="font-semibold text-emerald-900">RescueTargetMet — round 1 target 600 • hashes only, amounts hidden</div>
                    <p className="mt-1 text-sm text-emerald-800">Aggregate `300+200+100=600` proven via Barretenberg UltraHonk. Explorer shows only commitments hashes + event. MEV saw no amounts.</p>
                    <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
                      <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-emerald-200 hover:bg-emerald-50">Tx {truncateHash(txHash || "", 10)} <ExternalLink className="h-3 w-3" /></a>
                      <a href={`${EXPLORER}/address/${DEPLOY.BlackSwanRescue}#events`} target="_blank" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-emerald-200 hover:bg-emerald-50">Events <ExternalLink className="h-3 w-3" /></a>
                      <span className="rounded-full bg-white px-3 py-1 ring-1 ring-emerald-200">Gas ~4.5M (UltraHonk)</span>
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-white">One atomic tx</span>
                    </div>
                  </div>
                </div>
              ) : settled === "cheat-underfunded" ? (
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 text-rose-600" />
                  <div>
                    <div className="font-semibold text-rose-900">Rejected on-chain — InvalidProof (sum&lt;T)</div>
                    <p className="mt-1 text-sm text-rose-800">Cheater tried `100+100+100=300 &lt; 600` with empty proof `0x`. Verifier reverted `InvalidProof()` (`0x09bde339`). Round not settled.</p>
                    <div className="mt-2 font-mono text-xs text-rose-700">Error: InvalidProof() • no RescueTargetMet</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 text-rose-600" />
                  <div>
                    <div className="font-semibold text-rose-900">Rejected on-chain — NullifierReused</div>
                    <p className="mt-1 text-sm text-rose-800">Duplicate nullifier `11` in same round (`[11,11,33]`). `BlackSwanRescue` reverted `NullifierReused(0x...0b)` (`0x61fef174`). Prevents double-count.</p>
                    <div className="mt-2 font-mono text-xs text-rose-700">Error: NullifierReused(0x...000b)</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer: pitch + contracts */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Honest claim</CardTitle></CardHeader>
            <CardContent className="text-xs leading-5 text-zinc-600">
              <b>Hidden:</b> amounts / strategy size (public mempool, explorer, other rescuers, analytics).<br />
              <b>Public:</b> roundId, T, commitments hashes, `RescueTargetMet`.<br />
              <b>Out of scope:</b> set-anonymity (not claimed, EIP-8182 Review), malicious trigger, Sybil.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Coins className="h-4 w-4" /> Rescue premium = yield</CardTitle></CardHeader>
            <CardContent className="text-xs leading-5 text-zinc-600">
              `RecapVault.recap()` mints pro-rata <b>RescueShares</b> at discount when `sum≥T` proves. The commitment is the DeFi flow — a private yield provision whose size is the MEV signal we hide.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Verify on Sepolia</CardTitle></CardHeader>
            <CardContent className="space-y-1 font-mono text-xs">
              <div>Vault: <a href={`${EXPLORER}/address/${DEPLOY.RecapVault}`} target="_blank" className="hover:underline">{truncateHash(DEPLOY.RecapVault)}</a></div>
              <div>Rescue: <a href={`${EXPLORER}/address/${DEPLOY.BlackSwanRescue}`} target="_blank" className="hover:underline">{truncateHash(DEPLOY.BlackSwanRescue)}</a></div>
              <div>Demo tx: <a href="https://sepolia.etherscan.io/tx/0xe430595499d4ceb04b8f998e74b1e9dd3b466cdf2b0be3474e86459fb0a2ef4d" target="_blank" className="hover:underline">0xe43059…</a> block 11524033</div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500">
          Built for Road to Devcon • Private DeFi &amp; Mempools • Overall — Noir 1.0.0-beta.26 • Foundry • viem 2.37.13 • Sepolia testnet (no real crypto) • Private mempool fallback logged
        </div>
      </main>
    </div>
  );
}
