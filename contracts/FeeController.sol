// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title FeeController -- Dynamic fee calculation for AfriPay
/// @notice Implements tiered fees: 0.5% base, reduced for high-volume senders
///         Compare to traditional remittance fees of 8-9% across Africa
contract FeeController is Ownable {
    uint256 public constant FEE_DENOMINATOR = 10_000; // basis points
    uint256 public baseFee = 50; // 0.50% -- 17x cheaper than Western Union
    uint256 public minFee = 25; // 0.25% floor
    uint256 public maxFee = 100; // 1.00% ceiling

    // Volume-based discounts: send more, pay less
    uint256 public tierOneThreshold = 1_000 * 1e18; // $1,000 cumulative
    uint256 public tierTwoThreshold = 10_000 * 1e18; // $10,000 cumulative
    uint256 public tierOneDiscount = 10; // 0.10% discount
    uint256 public tierTwoDiscount = 20; // 0.20% discount

    // Corridor-specific fee overrides (some corridors are cheaper to serve)
    mapping(bytes4 => uint256) public corridorFees; // fromCountry+toCountry => fee in bps

    mapping(address => uint256) public senderVolume;

    address public vault; // only vault can record volume

    error OnlyVault();
    error InvalidFee();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    function setBaseFee(uint256 _fee) external onlyOwner {
        if (_fee > maxFee) revert InvalidFee();
        baseFee = _fee;
    }

    /// @notice Set a corridor-specific fee (e.g., NG->KE might be cheaper)
    function setCorridorFee(bytes2 from, bytes2 to, uint256 fee) external onlyOwner {
        if (fee > maxFee) revert InvalidFee();
        corridorFees[bytes4(abi.encodePacked(from, to))] = fee;
    }

    /// @notice Calculate fee for a given sender, amount, and corridor
    function calculateFee(
        address sender,
        uint256 amount,
        bytes2 fromCountry,
        bytes2 toCountry
    ) external view returns (uint256 feeAmount, uint256 feeRate) {
        // Check corridor-specific fee first
        bytes4 corridor = bytes4(abi.encodePacked(fromCountry, toCountry));
        feeRate = corridorFees[corridor];

        if (feeRate == 0) {
            feeRate = baseFee;
        }

        // Apply volume discount
        uint256 volume = senderVolume[sender];
        if (volume >= tierTwoThreshold && feeRate > tierTwoDiscount) {
            feeRate -= tierTwoDiscount;
        } else if (volume >= tierOneThreshold && feeRate > tierOneDiscount) {
            feeRate -= tierOneDiscount;
        }

        // Enforce floor
        if (feeRate < minFee) {
            feeRate = minFee;
        }

        feeAmount = (amount * feeRate) / FEE_DENOMINATOR;
    }

    /// @notice Record volume for a sender (called by vault after order creation)
    function recordVolume(address sender, uint256 amount) external onlyVault {
        senderVolume[sender] += amount;
    }
}
