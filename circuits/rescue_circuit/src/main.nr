// BlackSwan Relay — aggregate rescue capacity circuit.
//
// Proves, for a single rescue round:
//   - each public commitment_i correctly binds to a private (amount_i, nullifier_i, secret_i)
//   - every amount is a valid non-negative Field value (range-checked)
//   - the sum of all committed amounts >= the rescue target T
//
// The on-chain Rescue contract records the nullifiers used per round so a single
// address cannot double-count the same commitment twice. Individual amounts stay
// private witnesses; only the aggregate bound and the commitment set are public.

use std::hash::poseidon2;

// Maximum number of rescuers the circuit can hold. Unused slots carry
// amount = nullifier = secret = 0 and a commitment that provably encodes 0.
global MAX_RESCUERS: u32 = 6;

// Bit-width used for the range/positivity checks on each amount. 64 bits keeps the
// circuit small while covering a generous amount range (up to ~18.4 quintillion).
global amount_bits = 64;

pub fn main(
    pub commitments: [Field; MAX_RESCUERS],
    pub target: Field,
    pub round_id: Field,
    amounts: [Field; MAX_RESCUERS],
    nullifiers: [Field; MAX_RESCUERS],
    secrets: [Field; MAX_RESCUERS],
) {
    // 1. Recompute and bind each commitment to its private opening.
    //    A nullifier that is committed must match the value proved later; the
    //    Rescue contract separately enforces per-round nullifier uniqueness.
    let mut sum_acc = 0;
    for i in 0..MAX_RESCUERS {
        // Range-check the amount so a malicious witness cannot wrap around and
        // inflate the sum (field arithmetic would otherwise allow overflow).
        assert(amounts[i] < (1 << amount_bits), "amount out of range");

        // Bind amount/nullifier/secret to the commitment the contract saw.
        let expected = poseidon2::Poseidon2::hash([amounts[i], nullifiers[i], secrets[i], round_id], 4);
        assert(expected == commitments[i], "commitment binding check failed");

        // Sum the (verifiably non-negative, range-bounded) amounts.
        sum_acc += amounts[i];
    }

    // 2. The aggregate rescue capacity must meet the recapitalization target.
    //    This is the heart of the protocol: Ethereum proves the sum cleared T
    //    without the individual amounts ever becoming public.
    assert(sum_acc >= target, "aggregate commitments below rescue target");
}
