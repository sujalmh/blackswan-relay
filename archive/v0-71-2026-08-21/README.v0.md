# BlackSwan Relay

**Recapitalize without the signal.** No one sees who put in how much until Ethereum verifies the round is funded.

> A private rescue-yield market on Sepolia: 3 rescuers lock `hash(amount, nullifier, secret, round)` through a private mempool, a Noir circuit proves `sum ≥ 600`, and one atomic transaction settles the rescue. Explorer shows only `RescueTargetMet` + hashes + one aggregated `Transfer(600)` — individual `300/200/100` never appear in mempool or breakdown.

[![Sepolia](https://img.shields.io/badge/network-Sepolia%20%7C%2011155111-3B82F6)](https://sepolia.etherscan.io/address/0xDD8BB798E9A7128F92D18dD9DF63bA05A5893ae6)
[![Noir](https://img.shields.io/badge/Noir-1.0.0--beta.26-7C3AED)](https://noir-lang.org)
[![Barretenberg](https://img.shields.io/badge/Barretenberg-5.0.0--nightly-0F172A)](https://github.com/AztecProtocol/barretenberg)
[![Foundry](https://img.shields.io/badge/Foundry-1.7.1-000000)](https://getfoundry.sh)
[![Next.js](https://img.shields.io/badge/Next.js-15.4.6-000000)](https://nextjs.org)

**Track:** Road to Devcon — NITK Surathkal · **Private DeFi & Mempools** · aiming for **Overall**  
**Repo:** `blackswan-relay` (formerly `proj-1`) · **Demo:** `http://localhost:3000` · **Video:** [`docs/demo-90s.mp4`](docs/demo-90s.mp4)

---

## 1 — Overview in 30s

A lending vault slips to **health 0.92** (92¢ collateral per $1 debt) and needs **600 mUSDC** to survive. Three rescuers each want the discounted `RescueShare` yield, but publishing `300` on a public mempool lets MEV bots copy the trade and kill the discount.

BlackSwan fixes it:

1. Keeper opens `Round 1, T=600` on-chain.
2. Rescuers commit **privately** as `cᵢ = pedersen_hash(amountᵢ, nullifierᵢ, secretᵢ, roundId)` — only hashes hit the chain.
3. Browser proves `300+200+100 ≥ 600` in ZK (Barretenberg UltraHonk, `7424B`, `N=32768`).
4. `BlackSwanRescue` verifies the proof, checks nullifier uniqueness, then atomically `vault.recap()` + `ShieldedPool.releaseToVault(600)` — one `Transfer(600)`.
5. Underfunded (`sum < 600`) or double-spend (`nullifierReuse`) reverts on-chain: `ProofLengthWrong(15,0,7424)` / `NullifierReused`.

```mermaid
flowchart LR
  A[Vault health 0.92<br/>needs 600] --> B[Keeper: openRound 1,600]
  B --> C[Rescuers pick 100/200/300<br/>hash locally]
  C --> D[Private mempool<br/>Deposit hash only]
  D --> E[Noir prove<br/>sum ≥ 600]
  E --> F[Sepolia verify<br/>7424B UltraHonk]
  F --> G{Valid?}
  G -->|yes| H[RescueTargetMet<br/>Transfer 600]
  G -->|no| I[Revert<br/>InvalidProof / NullifierReused]
  style D fill:#ECFDF5,stroke:#10B981
  style H fill:#ECFDF5,stroke:#065F46
  style I fill:#FEF2F2,stroke:#DC2626
```

**What is hidden vs public**

```mermaid
flowchart LR
  subgraph Private["BlackSwan — hash only ✅"]
    P1[Commit 300 → 0x0972…]
    P2[On-chain: Deposit hash]
    P3[Explorer: hashes + RescueTargetMet + Transfer 600 total]
    P4[MEV: nothing to price]
    P1 --> P2 --> P3 --> P4
  end
  subgraph Public["Public rescue — leaks ❌"]
    Q1[Commit 300]
    Q2[On-chain: amount 300 exposed]
    Q3[Explorer: 300/200/100 breakdown]
    Q4[MEV: front-run discount]
    Q1 --> Q2 --> Q3 --> Q4
  end
  style Private fill:#ECFDF5,stroke:#10B981
  style Public fill:#FEF2F2,stroke:#DC2626
```

| Hidden | Public | Not claimed |
|---|---|---|
| individual `amount` / strategy size (mempool calldata, explorer breakdown, analytics) | `roundId`, `T=600`, `commitments[6]` hashes, `RescueTargetMet`, aggregated `Transfer(600)` total | participant set anonymity (addresses visible) |

---

## 2 — Architecture

```mermaid
flowchart TB
  subgraph FE["Frontend — Next.js 15 + shadcn / light theme"]
    UI[3 Rescuer Panels<br/>Danger / Commit / Reveal / Settle / Verify]
    NoirLib[lib/noir.ts<br/>pedersen_hash]
    ViemLib[lib/contracts.ts<br/>viem + private mempool]
  end
  subgraph Circuits["Circuits — Noir 1.0.0-beta.26"]
    CKT[src/main.nr<br/>sum ≥ T, 261 ACIR]
    VK[VK 1.8K]
    PRF[Proof 7424B<br/>evm-no-zk]
  end
  subgraph Chain["Contracts — Sepolia 11155111"]
    ERC[MockERC20 mUSDC]
    VAULT[RecapVault<br/>health < 1.0 → recap]
    RESCUE[BlackSwanRescue<br/>settle + nullifier]
    POOL[ShieldedPool<br/>hash-only Deposit]
    VERIF[RecapVerifier<br/>BaseHonk 46515B]
  end

  UI --> NoirLib
  UI --> ViemLib
  NoirLib --> CKT
  CKT --> VK --> PRF
  PRF --> VERIF --> RESCUE
  ViemLib --> RESCUE
  ViemLib --> POOL
  RESCUE --> VAULT
  RESCUE --> POOL --> VAULT

  style FE fill:#FFFBEB,stroke:#D97706
  style Circuits fill:#F5F3FF,stroke:#7C3AED
  style Chain fill:#EFF6FF,stroke:#2563EB
```

**Repo layout**

```
blackswan-relay/
├── circuits/rescue_circuit/   # Noir circuit + Prover.toml + target/proof
├── contracts/src/             # RecapVault · BlackSwanRescue · ShieldedPool · RecapVerifier
│   └── test/                  # 12 Foundry tests (valid / underfunded / nullifier / pool)
├── scripts/                   # compileProveSettle.ts + demo.ts + deployments/sepolia.json
├── frontend/                  # Next.js app (6 slides: Thesis → Danger → Commit → Reveal → Settle → Verify)
│   ├── app/page.tsx           # SLIDES:38-45, 25.9kB
│   └── lib/{noir,contracts,proofs}.ts
└── docs/demo-90s.mp4          # 90s walkthrough (optional)
```

---

## 3 — How it works (end-to-end)

```mermaid
sequenceDiagram
  participant Keeper
  participant Rescuer as Rescuer A/B/C
  participant PM as Private Mempool<br/>Flashbots Protect
  participant Pool as ShieldedPool
  participant Rescue as BlackSwanRescue
  participant BB as Noir + Barretenberg
  participant Verifier as RecapVerifier
  participant Vault as RecapVault

  Keeper->>Vault: openRound(1, 600)
  Rescuer->>Rescuer: hash = pedersen_hash(300, 11, 101, 1) = 0x0972…
  Rescuer->>PM: eth_sendPrivateTransaction(deposit(hash, nullifierHash))
  PM->>Pool: deposit(hash, nullifierHash) # no amount in calldata
  Note over PM,Pool: explorer: Deposit hash only

  Rescuer->>BB: proveRescue(witnesses)
  BB->>BB: nargo execute → witness 992B
  BB->>BB: bb prove --verifier_target evm-no-zk → 7424B
  BB->>BB: bb verify → Proof verified

  Rescuer->>Rescue: settle(proof, publicInputs[8], nullifiers[6])
  Rescue->>Verifier: verify(proof, commitments[6]+T+roundId)
  Verifier-->>Rescue: true
  Rescue->>Rescue: nullifier uniqueness check
  Rescue->>Vault: recap(1)
  Rescue->>Pool: releaseToVault(vault, 1, 600)
  Pool->>Vault: Transfer 600 (one aggregated)
  Rescue->>Rescue: emit RescueTargetMet(1, 600)
```

**Circuit — `circuits/rescue_circuit/src/main.nr`**

```mermaid
flowchart TD
  subgraph PublicInputs["Public Inputs [8] = 256B"]
    C0[C0 0x0972… 300]
    C1[C1 0x1804… 200]
    C2[C2 0x11d2… 100]
    C3[C3 0x0252… 0]
    C4[C3]
    C5[C3]
    TGT[T 600]
    RID[roundId 1]
  end
  subgraph Private["Private Witnesses"]
    AMT[amounts 300/200/100/0/0/0]
    NUL[nullifiers 11/22/33/0/0/0]
    SEC[secrets 101/102/103/0/0/0]
  end
  AMT -->|range check u64| SUM
  NUL -->|pedersen_hash| CHK
  SEC --> CHK
  RID --> CHK
  CHK -->|assert ==| PublicInputs
  SUM[sum_acc 600] -->|assert ≥| TGT
  style Private fill:#FEF3C7,stroke:#D97706
  style PublicInputs fill:#DBEAFE,stroke:#2563EB
```

- `MAX_RESCUERS=6` (3 used + 3 zero-slots `hash(0,0,0,roundId)`)
- `pedersen_hash([amount, nullifier, secret, roundId])` per slot
- `sum_acc` range-checked `< 2⁶⁴`, then `sum_acc ≥ T`

**Contracts — `contracts/src/`**

```mermaid
flowchart LR
  Rescue -->|verify| Verifier
  Rescue -->|recap| Vault
  Rescue -->|release 600| Pool
  Pool -->|Transfer 600| Vault
  Pool -.->|Deposit hash| Explorer
  Rescue -.->|CommitmentsRecorded<br/>RescueTargetMet| Explorer
  Vault -.->|VaultRecapped| Explorer
  style Rescue fill:#1F2937,color:#fff
  style Explorer fill:#F3F4F6,stroke:#9CA3AF
```

| Contract | Purpose | Key guard |
|---|---|---|
| `RecapVault` | Mock undercollateralized vault (`health 0.92`) | `onlyRescue` on `recap` |
| `BlackSwanRescue` | Orchestrates round, verifies proof, nullifier check | `AlreadySettled`, `NullifierReused`, `InvalidProof` |
| `ShieldedPool` | Hash-only deposits, one aggregated release | `Deposit(hash, nullifierHash)` — no `uint256 amount` |
| `RecapVerifier` | Barretenberg UltraHonk `evm-no-zk` (`46515B` deployed) | `ProofLengthWrongWithLogN(15,0,7424)` |

---

## 4 — Live deployment (Sepolia 11155111)

| Contract | Address | Etherscan |
|---|---|---|
| `MockERC20` mUSDC | `0x491106810FB442Ec0C8071B76dEE3e17c8A9E9D5` | [view](https://sepolia.etherscan.io/address/0x491106810FB442Ec0C8071B76dEE3e17c8A9E9D5) |
| `RecapVault` | `0x62447c4574576283277528A327630033d2897c58` | [view](https://sepolia.etherscan.io/address/0x62447c4574576283277528A327630033d2897c58) |
| `RecapVerifier` | `0xc8367A0f210EC10D146ae915871B5B52A78deA4b` · `46515B` · `N=32768` | [view](https://sepolia.etherscan.io/address/0xc8367A0f210EC10D146ae915871B5B52A78deA4b) |
| `BlackSwanRescue` | `0xDD8BB798E9A7128F92D18dD9DF63bA05A5893ae6` | [view](https://sepolia.etherscan.io/address/0xDD8BB798E9A7128F92D18dD9DF63bA05A5893ae6) |
| `ShieldedPool` | `0x2Fdd2Af239AD7D92c613562003191c0b125f5882` | [view](https://sepolia.etherscan.io/address/0x2Fdd2Af239AD7D92c613562003191c0b125f5882) |

**Honest round 1** `300+200+100=600` → [`0xc03068e3ff9e2fdfcb73383290ab1eb41c76195e2293e83493bada2396cfd7fb`](https://sepolia.etherscan.io/tx/0xc03068e3ff9e2fdfcb73383290ab1eb41c76195e2293e83493bada2396cfd7fb) `block 11537134` `gas 2575830` `RescueTargetMet(1,600)` — logs: `NullifierUsed ×3` + `CommitmentsRecorded` + `VaultRecapped` + `Deposit(hash)×3` + `Transfer(600)` (no `300/200/100` breakdown).

**Cheats**

- Underfunded `sum 300 < 600` → empty `0x` proof → `ProofLengthWrongWithLogN(15,0,7424)` `0x59895a53` (real `bb prove` fails for `sum<T`, so no valid-length cheat proof exists)
- Nullifier reuse `[11,11,33]` → `NullifierReused(0x…000b)` `0x61fef174` (forge `2056104` gas; on Sepolia after honest round is `AlreadySettled` — guard before nullifier, both are correct rejections)

---

## 5 — Quick start

```bash
# 0 — clone
git clone https://github.com/sujalmh/blackswan-relay.git && cd blackswan-relay

# 1 — toolchains (pinned)
nargo --version  # 1.0.0-beta.26
forge --version  # 1.7.1
node --version   # >=20
~/.bb/bb --version # 5.0.0-nightly.20260522

# 2 — env (Sepolia, no real ETH)
cp .env.example .env  # then set SEPOLIA_RPC_URL / PRIVATE_RPC_URL / DEPLOYER_PRIVATE_KEY / ETHERSCAN_API_KEY
set -a; source .env; set +a

# 3 — circuit
cd circuits/rescue_circuit
nargo check          # only warning: unused global amount_bits
nargo test           # 5/5
nargo execute        # → target/rescue_circuit.gz
~/.bb/bb write_vk --scheme ultra_honk --verifier_target evm-no-zk -b target/rescue_circuit.json -o target/vk --oracle_hash keccak
~/.bb/bb write_solidity_verifier --verifier_target evm-no-zk -k target/vk/vk -o target/Verifier.sol
python3 -c "import pathlib; p=pathlib.Path('target/Verifier.sol'); t=p.read_text().replace('contract HonkVerifier','contract RecapVerifier'); pathlib.Path('../../contracts/src/RecapVerifier.sol').write_text(t)"
~/.bb/bb prove --scheme ultra_honk --verifier_target evm-no-zk -b target/rescue_circuit.json -w target/rescue_circuit.gz -o target/proof -k target/vk/vk  # → 7424B
~/.bb/bb verify --scheme ultra_honk --verifier_target evm-no-zk -k target/vk/vk -p target/proof/proof -i target/proof/public_inputs  # Proof verified
cd ../..

# 4 — contracts
cd contracts && forge build && forge test --match-path "test/*" -vv  # 12/12: Valid 2292253, ShieldedPool 1788547
cd ..

# 5 — Sepolia deploy (one shot)
forge script contracts/script/Deploy.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL" --broadcast --verify --etherscan-api-key "$ETHERSCAN_API_KEY"

# 6 — settle (hash-only, private mempool attempted + fallback logged)
npm --prefix scripts install
npx --prefix scripts tsx scripts/compileProveSettle.ts --round 1 --target 600 --mode honest       # → 0xf373… 2575830 RescueTargetMet
npx --prefix scripts tsx scripts/compileProveSettle.ts --round 2 --target 600 --mode cheat-underfunded  # → ProofLengthWrong
npx --prefix scripts tsx scripts/compileProveSettle.ts --round 3 --target 600 --mode cheat-nullifier    # → NullifierReused

# 7 — frontend (6 slides: Thesis → Danger → Commit → Reveal → Settle → Verify)
npm --prefix frontend install
npm --prefix frontend run build  # 25.9kB / 126kB
npm --prefix frontend run dev    # http://localhost:3000
# capture: node frontend/capture-deck.mjs  # chromium 1280×800 → frontend/screenshots/
```

---

## 6 — Demo script (90s, 6 slides — `frontend/app/page.tsx:216-600`)

| Slide | Title | What the judge does |
|---|---|---|
| **00** | A rescue that doesn't leak the price | Vault needs 600, `publish 300 → MEV copies`. Live box: *“Each amount stays on device, on-chain only `0x0972…` until `300+200+100 ≥600` proves.”* |
| **01** | A vault slips under · 0.92 | Keeper clicks **Open round — need 600** → `● Round open` · `RoundOpened(1,600)` on Etherscan |
| **02** | You commit in private | Pick `100/200/300` → **Commit privately** → `0x0972…` `Deposit hash only` · `600/600 3/3` after 3 commits |
| **03** | If you were a bot, what would you see? | Toggle **Private • hashes only** (green `0x97…`) vs **Public • amounts leaked** (red `300`) |
| **04** | We prove the locks add up | **Settle — prove & save vault** → `RescueTargetMet` `0xf373…` · cheats: `ProofLengthWrong` / `NullifierReused` |
| **05** | Check it yourself on Etherscan | 30-sec checklist: `CommitmentRecorded 0x0972…` → `settle 0xf373…` → search log for `300` — not there, only hashes + `0x258` |

Walkthrough: `node frontend/capture-deck.mjs` (`chromium 1280×800`) reproduces all 11 screenshots — no terminal needed, Etherscan is the proof. Video: `docs/demo-90s.mp4`.

---

## 7 — Verification

```bash
nargo check                              # warning: unused global amount_bits only
nargo test                               # 5/5
forge test --match-path "test/*"         # 12/12
npm --prefix frontend run build          # 25.9kB
~/.bb/bb verify --scheme ultra_honk --verifier_target evm-no-zk -k circuits/rescue_circuit/target/vk/vk -p circuits/rescue_circuit/target/proof/proof -i circuits/rescue_circuit/target/proof/public_inputs
cast code 0xc8367A0f210EC10D146ae915871B5B52A78deA4b --rpc-url "$SEPOLIA_RPC_URL" | wc -c  # 46515
cast receipt 0xc03068e3ff9e2fdfcb73383290ab1eb41c76195e2293e83493bada2396cfd7fb --rpc-url "$SEPOLIA_RPC_URL" | grep -E "gasUsed|status"
```

**Honest limitations (not hidden)**

- Underfunded cheat uses empty `0x` proof → `ProofLengthWrong` — no valid-length `sum<T` proof can be generated (`bb prove` fails at circuit `assert(sum≥T)`).
- Private mempool `eth_sendPrivateTransaction` via `https://protect.flashbots.net` returns HTML `200` in this env, so we `sign + POST` then fallback to public `writeContract` — commitments are hash-only, so even public broadcast leaks no amount (calldata `0x9844b73f 0972… 000b` has no `012c`).
- Capital moves via pre-funded `ShieldedPool` → one aggregated `Transfer(600)` (total public, breakdown hidden). `RescueShare` mint is still a state flip; full shielded amount would need confidential transfer.
- Single prover holds all witnesses — privacy holds vs public mempool/explorer/analytics, not vs aggregator.

---

## 8 — Why not something else?

| Alternative | Delta |
|---|---|
| Nexus / Cover / HorizonCover | Pay *claims*, don't *recapitalize* |
| ZK Proof-of-Reserves | Proves *solvency*, raises no capital |
| Fhenix confidential lending | Originates *new* credit, not rescue of existing vault |
| Umbra / VeilDAO treasury | Manages *existing* funds, no aggregate gate |

No verified project does **private liability-side recapitalization with ZK aggregate-capacity proof**. See prior `docs/novel-use-case-research.md` (archived) for full evidence.

---

*Built in 3–4 days by autonomous agents — 1 circuit, 1 vault + 1 rescue + 1 verifier + 1 pool helper, 3 rescuers, `T=600`, 1 ERC-20, 1 round, Sepolia non-simulated. No swap-hider re-derive.*

