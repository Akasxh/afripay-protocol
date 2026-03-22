# AfriPay -- Cross-Border Remittance Protocol for Africa

Stablecoin-based remittance protocol on Ethereum L2s (Base) targeting Africa's $48B remittance market. Cuts fees from 8.9% average to 0.5% using USDC/USDT with a local agent cash-out network. Built for EthCapeTown 2026.

## Quick Start

```bash
npm install && npx hardhat compile && npx hardhat test
```

## Running Locally

```bash
# Terminal 1: Start local Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Frontend (static HTML, no build step)
python3 -m http.server 8080 -d frontend/
# or just: open frontend/index.html
```

## Key Contracts

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| `RemittanceVault.sol` | Core vault: deposits, order lifecycle, agent payouts | `createOrder`, `claimOrder`, `completeOrder`, `cancelOrder` |
| `FeeController.sol` | Dynamic fees: 0.5% base, volume discounts, corridor pricing | `calculateFee`, `setCorridorFee`, `recordVolume` |
| `AgentRegistry.sol` | Agent onboarding, reputation, country-based discovery | `registerAgent`, `recordCompletion`, `isActiveAgent` |
| `AfriToken.sol` | ERC-20 loyalty/governance token (100M supply, 10 AFRI/remittance) | `mintReward`, `setMinter` |

## Architecture

**Deploy order**: AfriToken -> FeeController -> AgentRegistry -> RemittanceVault

**Permissions**: Vault is set as minter on AfriToken, and as authorized vault on both FeeController and AgentRegistry.

**Order flow**: Pending -> Claimed -> Completed (or Cancelled by sender, or Expired after 72h)

## Testing

```bash
npx hardhat test          # 21 tests covering all contracts
make test                 # Same via Makefile
```

Tests cover: fee calculation (base, corridor-specific, volume discounts, min fee floor), agent registration/management/suspension, full remittance flow (create->claim->complete), order cancellation/refunds, protocol stats, access control, edge cases (zero amount, double-claim, unclaimed complete).

## Project Structure

```
contracts/              -- Solidity source
  interfaces/           -- IRemittanceVault interface
scripts/deploy.js       -- Deployment + configuration script
test/                   -- Hardhat test suite (21 tests)
frontend/               -- Static HTML demo dashboard
  index.html            -- Multi-view tabbed UI
  style.css             -- Custom styling
  app.js                -- Frontend logic with simulated data
```

## Stack

- Solidity ^0.8.20 with optimizer (200 runs)
- Hardhat + ethers.js + @nomicfoundation/hardhat-toolbox
- OpenZeppelin v5 (ERC20, SafeERC20, Ownable, ReentrancyGuard)
- Target network: Base / Base Sepolia
- Frontend: Pure HTML/CSS/JS (no framework)

## Common Issues

- **"Cannot find module '@openzeppelin/contracts'"**: Run `npm install`
- **Tests fail with "nonce too high"**: Restart hardhat node (`npx hardhat node`)
- **Deploy fails on testnet**: Ensure `PRIVATE_KEY` env var is set and funded
