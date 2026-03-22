// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AfriToken -- Loyalty & Governance Token for AfriPay Protocol
/// @notice Users earn AFRI tokens for using the remittance protocol, redeemable for fee discounts
contract AfriToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M tokens
    uint256 public constant REWARD_PER_REMITTANCE = 10 * 1e18; // 10 AFRI per remittance

    mapping(address => bool) public minters; // RemittanceVault can mint rewards

    error NotMinter();
    error ExceedsMaxSupply();

    modifier onlyMinter() {
        if (!minters[msg.sender]) revert NotMinter();
        _;
    }

    constructor(address initialOwner) ERC20("AfriPay Token", "AFRI") Ownable(initialOwner) {
        // Mint 10% to treasury for liquidity & ecosystem
        _mint(initialOwner, 10_000_000 * 1e18);
    }

    function setMinter(address minter, bool status) external onlyOwner {
        minters[minter] = status;
    }

    /// @notice Mint reward tokens to a user for completing a remittance
    function mintReward(address to) external onlyMinter {
        if (totalSupply() + REWARD_PER_REMITTANCE > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, REWARD_PER_REMITTANCE);
    }

    /// @notice Mint arbitrary amount (for special rewards, airdrops)
    function mint(address to, uint256 amount) external onlyMinter {
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }
}
