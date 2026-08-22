# V0 71/100 — Sepolia Snapshot (Devfolio submission, 2026-08-21)

**Do NOT modify — preserved for Devfolio verification.**

## Deployed addresses (chain 11155111)
- MockERC20 mUSDC: `0x491106810FB442Ec0C8071B76dEE3e17c8A9E9D5` https://sepolia.etherscan.io/address/0x491106810FB442Ec0C8071B76dEE3e17c8A9E9D5
- RecapVault: `0x62447c4574576283277528A327630033d2897c58` https://sepolia.etherscan.io/address/0x62447c4574576283277528A327630033d2897c58
- RecapVerifier (non-ZK evm-no-zk 7424B, N=32768, 8 inputs but constant says 16 stale): `0xc8367A0f210EC10D146ae915871B5B52A78deA4b` https://sepolia.etherscan.io/address/0xc8367A0f210EC10D146ae915871B5B52A78deA4b code 46515B
- BlackSwanRescue: `0xDD8BB798E9A7128F92D18dD9DF63bA05A5893ae6` https://sepolia.etherscan.io/address/0xDD8BB798E9A7128F92D18dD9DF63bA05A5893ae6
- ShieldedPool (B simulation, pre-funded 1000 → Transfer 600): `0x2Fdd2Af239AD7D92c613562003191c0b125f5882` https://sepolia.etherscan.io/address/0x2Fdd2Af239AD7D92c613562003191c0b125f5882

## Honest round 1 (300+200+100=600)
- Settle tx: `0xc03068e3ff9e2fdfcb73383290ab1eb41c76195e2293e83493bada2396cfd7fb` block 11537134 gas 2575830 https://sepolia.etherscan.io/tx/0xc03068e3ff9e2fdfcb73383290ab1eb41c76195e2293e83493bada2396cfd7fb
- Logs: NullifierUsed×3 + CommitmentsRecorded + VaultRecapped + Transfer(600) aggregated + Released + RescueTargetMet(1,600)
- Proof: 7424B evm-no-zk (non-ZK, witness-hiding) circuits/rescue_circuit/target/proof/proof
- Deposits: 0xe8e11435... 0x3d72539a... 0xa2b06c0a... (hash-only Deposit(commitment,nullifierHash), no 012c)

## OpenRound
- 0x29fc8c25b1f86aa359100a8793c832d7828442b008db8d77fd5c1de74bf4c13c block 11537132

## Verification
```
cast code 0xc8367A0f210EC10D146ae915871B5B52A78deA4b --rpc-url $SEPOLIA_RPC_URL | wc -c # 46515
cast receipt 0xc03068e3ff9e2fdfcb73383290ab1eb41c76195e2293e83493bada2396cfd7fb --rpc-url $SEPOLIA_RPC_URL
~/.bb/bb verify --scheme ultra_honk --verifier_target evm-no-zk -k circuits/rescue_circuit/target/vk/vk -p circuits/rescue_circuit/target/proof/proof -i circuits/rescue_circuit/target/proof/public_inputs # Proof verified
nargo test # 5/5
forge test # 12/12
next build # 26kB/126kB
```

## Known V0 flaws (for judge)
- Economic theater: ShieldedPool pre-funded 1000, releaseToVault Transfer(600) is not rescuer capital; RecapVault.recap(uint256) stub never mints rescueShares.
- Privacy: nullifiers NOT bound to public inputs (BlackSwanRescue.sol:50-52), evm-no-zk non-ZK, single prover holds witnesses.
- Mempool: fallback to public (private RPC returns HTML 200).
- Verifier constant drift: NUMBER_OF_PUBLIC_INPUTS=16 vs circuit 8.

Preserved: sepolia.json, RecapVerifier.v0-7424-nonZK.sol, proof.7424, public_inputs.8, vk.8, proofs.ts, README.v0.md
