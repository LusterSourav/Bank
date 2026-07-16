// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AgeHonkVerifier} from "./verifiers/AgeVerifier.sol";
import {CountryHonkVerifier} from "./verifiers/CountryVerifier.sol";

contract ZKVerifier {
    AgeHonkVerifier public immutable ageVerifier;
    CountryHonkVerifier public immutable countryVerifier;

    address public admin;
    uint256 public ageThreshold; // Unix timestamp cutoff for 18+

    mapping(address => bytes32) public commitments;
    mapping(address => bool) public ageVerified;
    bytes32 public allowedCountryHash;

    event CommitmentStored(address indexed user, bytes32 commitment);
    event AgeVerified(address indexed user, uint256 threshold);
    event CountryVerified(address indexed user, bytes32 countryHash);
    event ThresholdUpdated(uint256 newThreshold);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor(bytes32 _allowedCountryHash) {
        ageVerifier = new AgeHonkVerifier();
        countryVerifier = new CountryHonkVerifier();
        admin = msg.sender;
        allowedCountryHash = _allowedCountryHash;
    }

    function setThreshold(uint256 _threshold) external onlyAdmin {
        ageThreshold = _threshold;
        emit ThresholdUpdated(_threshold);
    }

    function setAllowedCountry(bytes32 _hash) external onlyAdmin {
        allowedCountryHash = _hash;
    }

    function storeCommitment(bytes32 commitment) external onlyAdmin {
        // ponytail: no per-user commitment in MVP, stored for everyone as default
        // this is called after KYC completes, with hash = pedersen(dob, salt)
        commitments[address(0)] = commitment;
    }

    function storeUserCommitment(address user, bytes32 commitment) external onlyAdmin {
        commitments[user] = commitment;
        emit CommitmentStored(user, commitment);
    }

    function verifyAge(bytes calldata proof, bytes32[] calldata publicInputs) external returns (bool) {
        require(ageThreshold != 0, "threshold not set");
        require(commitments[address(0)] != bytes32(0) || commitments[msg.sender] != bytes32(0), "no commitment");

        // publicInputs layout from age circuit:
        // [0] = threshold (u64 as bytes32)
        // [1] = commitment (Field as bytes32)
        // [2..] = padding/return
        require(publicInputs.length >= 2, "bad pub inputs");

        // Verify threshold matches current
        uint256 proofThreshold = uint256(publicInputs[0]);
        require(proofThreshold >= ageThreshold, "threshold too low");

        // Verify commitment matches stored
        bytes32 stored = commitments[msg.sender] != bytes32(0) ? commitments[msg.sender] : commitments[address(0)];
        require(publicInputs[1] == stored, "commitment mismatch");

        // Verify proof
        bool ok = ageVerifier.verify(proof, publicInputs);
        require(ok, "invalid proof");

        ageVerified[msg.sender] = true;
        emit AgeVerified(msg.sender, ageThreshold);
        return true;
    }

    function verifyCountry(bytes calldata proof, bytes32[] calldata publicInputs) external returns (bool) {
        require(allowedCountryHash != bytes32(0), "country hash not set");

        // publicInputs layout from country circuit:
        // [0] = allowed_hash (Field as bytes32)
        // [1..] = padding/return
        require(publicInputs.length >= 1, "bad pub inputs");

        // Verify country matches allowed
        require(publicInputs[0] == allowedCountryHash, "country not allowed");

        // Verify proof
        bool ok = countryVerifier.verify(proof, publicInputs);
        require(ok, "invalid proof");

        emit CountryVerified(msg.sender, allowedCountryHash);
        return true;
    }

    function isAgeVerified(address user) external view returns (bool) {
        return ageVerified[user];
    }
}
