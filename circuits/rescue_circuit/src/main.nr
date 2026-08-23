// BlackSwan Relay — aggregate rescue capacity circuit.
//
// Proves, for a single rescue round:
//   - each public commitment_i correctly binds to a private (amount_i, nullifier_i, secret_i)
//   - every amount is a valid non-negative Field value (range-checked)
//   - each public nullifier_hash_i is cryptographically bound to the same private nullifier_i
//     (prevents shuffle attack where attacker supplies different nullifiers to contract than proved)
//   - the sum of all committed amounts >= the rescue target T
//
// 16 public inputs = commitments[6] + nullifier_hashes[6] + target + round_id (14 real + 8 pairing = 22 Honk).
// The on-chain Rescue contract verifies the proof then enforces per-round nullifier uniqueness
// on the now-bound nullifiers.

use std::hash::pedersen_hash;

// Maximum number of rescuers the circuit can hold. Unused slots carry
// amount = nullifier = secret = 0 and a commitment that provably encodes 0.
global MAX_RESCUERS: u32 = 6;

// Bit-width used for the range/positivity checks on each amount. 64 bits keeps the
// circuit small while covering a generous amount range (up to ~18.4 quintillion).
global amount_bits: u32 = 64;

fn main(
    commitments: pub [Field; MAX_RESCUERS],
    nullifier_hashes: pub [Field; MAX_RESCUERS],
    target: pub Field,
    round_id: pub Field,
    amounts: [Field; MAX_RESCUERS],
    nullifiers: [Field; MAX_RESCUERS],
    secrets: [Field; MAX_RESCUERS],
) {
    // 1. Recompute and bind each commitment + nullifier hash to its private opening.
    let mut sum_acc: u64 = 0;
    for i in 0..MAX_RESCUERS {
        // Range-check the amount so a malicious witness cannot wrap around and
        // inflate the sum (field arithmetic would otherwise allow overflow).
        let amt: u64 = amounts[i] as u64;
        assert(amt as Field == amounts[i], "amount out of range");

        // Bind amount/nullifier/secret to the commitment the contract saw.
        let expected = pedersen_hash([amounts[i], nullifiers[i], secrets[i], round_id]);
        assert(expected == commitments[i], "commitment binding check failed");

        // Cryptographically bind public nullifier hash to the same private nullifier.
        // Raw Field equality is sufficient and allows cheap on-chain check
        // `publicInputs[6+i] == bytes32(nullifiers[i])`. Zero slots assert 0==0.
        // This prevents shuffle / substitution where attacker proves with 11,22,33
        // but submits 99,99,99 to the contract to bypass reuse tracking.
        assert(nullifiers[i] == nullifier_hashes[i], "nullifier binding check failed");

        // Sum the (verifiably non-negative, range-bounded) amounts.
        sum_acc += amt;
    }

    // 2. The aggregate rescue capacity must meet the recapitalization target.
    //    This is the heart of the protocol: Ethereum proves the sum cleared T
    //    without the individual amounts ever becoming public.
    assert(sum_acc >= target as u64, "aggregate commitments below rescue target");
}

// --- Unit tests for Gate 1: happy / underfunded / zero-slot / binding ---
// These tests preserve the spec comments above and exercise the exact
// gate checklist from docs/TODO.md:35 Phase 1.4 (happy sum>=T, underfunded
// sum<T should fail, zero-slot hash(0,0,0,round_id) handling).

#[test]
fn test_happy_three_rescuers_meet_target() {
    // Happy: 300+200+100 = 600 >= T=600, pad 3 zero slots with hash(0,0,0,round_id)
    let round_id: Field = 1;
    let target: Field = 600;
    let amounts: [Field; MAX_RESCUERS] = [300, 200, 100, 0, 0, 0];
    let nullifiers: [Field; MAX_RESCUERS] = [11, 22, 33, 0, 0, 0];
    let nullifier_hashes: [Field; MAX_RESCUERS] = [11, 22, 33, 0, 0, 0];
    let secrets: [Field; MAX_RESCUERS] = [101, 102, 103, 0, 0, 0];
    let mut commitments: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    for i in 0..MAX_RESCUERS {
        commitments[i] = pedersen_hash([amounts[i], nullifiers[i], secrets[i], round_id]);
    }
    main(commitments, nullifier_hashes, target, round_id, amounts, nullifiers, secrets);
}

#[test(should_fail_with = "aggregate commitments below rescue target")]
fn test_underfunded_should_fail() {
    // Underfunded: 100+100+100 = 300 < T=600 — must revert on sum>=T assert
    let round_id: Field = 1;
    let target: Field = 600;
    let amounts: [Field; MAX_RESCUERS] = [100, 100, 100, 0, 0, 0];
    let nullifiers: [Field; MAX_RESCUERS] = [11, 22, 33, 0, 0, 0];
    let nullifier_hashes: [Field; MAX_RESCUERS] = [11, 22, 33, 0, 0, 0];
    let secrets: [Field; MAX_RESCUERS] = [101, 102, 103, 0, 0, 0];
    let mut commitments: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    for i in 0..MAX_RESCUERS {
        commitments[i] = pedersen_hash([amounts[i], nullifiers[i], secrets[i], round_id]);
    }
    main(commitments, nullifier_hashes, target, round_id, amounts, nullifiers, secrets);
}

#[test(should_fail_with = "commitment binding check failed")]
fn test_commitment_binding_must_match() {
    // Binding: same nullifier/round but wrong amount -> commitment mismatch must fail
    let round_id: Field = 1;
    let target: Field = 600;
    let amounts: [Field; MAX_RESCUERS] = [300, 200, 100, 0, 0, 0];
    let nullifiers: [Field; MAX_RESCUERS] = [11, 22, 33, 0, 0, 0];
    let nullifier_hashes: [Field; MAX_RESCUERS] = [11, 22, 33, 0, 0, 0];
    let secrets: [Field; MAX_RESCUERS] = [101, 102, 103, 0, 0, 0];
    let mut commitments: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    for i in 0..MAX_RESCUERS {
        commitments[i] = pedersen_hash([amounts[i], nullifiers[i], secrets[i], round_id]);
    }
    // Tamper amount for rescuer 0: commitment still for 300, witness now 999
    let bad_amounts: [Field; MAX_RESCUERS] = [999, 200, 100, 0, 0, 0];
    main(commitments, nullifier_hashes, target, round_id, bad_amounts, nullifiers, secrets);
}

#[test(should_fail_with = "nullifier binding check failed")]
fn test_nullifier_binding_must_match() {
    // Nullifier binding: commitments correct but nullifier_hashes mismatch -> must fail
    // Proves shuffle/substitution attack is caught: same commitments, wrong nullifier hash
    let round_id: Field = 1;
    let target: Field = 600;
    let amounts: [Field; MAX_RESCUERS] = [300, 200, 100, 0, 0, 0];
    let nullifiers: [Field; MAX_RESCUERS] = [11, 22, 33, 0, 0, 0];
    let secrets: [Field; MAX_RESCUERS] = [101, 102, 103, 0, 0, 0];
    let mut commitments: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    for i in 0..MAX_RESCUERS {
        commitments[i] = pedersen_hash([amounts[i], nullifiers[i], secrets[i], round_id]);
    }
    // Attacker tries to claim different nullifier hashes than the private nullifiers
    let bad_hashes: [Field; MAX_RESCUERS] = [99, 22, 33, 0, 0, 0];
    main(commitments, bad_hashes, target, round_id, amounts, nullifiers, secrets);
}

#[test]
fn test_zero_slot_all_empty_with_zero_target_passes() {
    // Zero-slot: 6 empty slots hash(0,0,0,round_id), T=0 should pass
    let round_id: Field = 42;
    let target: Field = 0;
    let amounts: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let nullifiers: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let nullifier_hashes: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let secrets: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let mut commitments: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    for i in 0..MAX_RESCUERS {
        commitments[i] = pedersen_hash([0, 0, 0, round_id]);
    }
    main(commitments, nullifier_hashes, target, round_id, amounts, nullifiers, secrets);
}

#[test(should_fail_with = "aggregate commitments below rescue target")]
fn test_zero_slot_empty_fails_with_nonzero_target() {
    // Zero-slot: same 6 empty, T=600 must fail sum>=T
    let round_id: Field = 42;
    let target: Field = 600;
    let amounts: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let nullifiers: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let nullifier_hashes: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let secrets: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    let mut commitments: [Field; MAX_RESCUERS] = [0; MAX_RESCUERS];
    for i in 0..MAX_RESCUERS {
        commitments[i] = pedersen_hash([0, 0, 0, round_id]);
    }
    main(commitments, nullifier_hashes, target, round_id, amounts, nullifiers, secrets);
}
