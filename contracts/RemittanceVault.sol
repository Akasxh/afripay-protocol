// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRemittanceVault.sol";
import "./FeeController.sol";
import "./AgentRegistry.sol";
import "./AfriToken.sol";

/// @title RemittanceVault -- Core remittance protocol for AfriPay
/// @notice Handles deposits, order creation, agent claims, and payouts
///         Enables cross-border remittances at 0.5-1% fees vs 8-9% traditional
contract RemittanceVault is IRemittanceVault, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public nextOrderId = 1;
    uint256 public constant ORDER_EXPIRY = 72 hours;

    FeeController public feeController;
    AgentRegistry public agentRegistry;
    AfriToken public afriToken;
    address public treasury;

    mapping(uint256 => RemittanceOrder) public orders;
    mapping(address => uint256[]) public senderOrders;
    mapping(address => bool) public supportedTokens;

    // Protocol stats
    uint256 public totalOrders;
    uint256 public totalVolume;
    uint256 public totalFeesCollected;

    error UnsupportedToken();
    error ZeroAmount();
    error OrderNotPending();
    error OrderNotClaimed();
    error NotOrderSender();
    error NotClaimingAgent();
    error AgentNotActive();
    error OrderExpired();

    constructor(
        address initialOwner,
        address _feeController,
        address _agentRegistry,
        address _afriToken,
        address _treasury
    ) Ownable(initialOwner) {
        feeController = FeeController(_feeController);
        agentRegistry = AgentRegistry(_agentRegistry);
        afriToken = AfriToken(_afriToken);
        treasury = _treasury;
    }

    function setSupportedToken(address token, bool status) external onlyOwner {
        supportedTokens[token] = status;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    /// @notice Create a remittance order by depositing stablecoins
    /// @param token The stablecoin address (USDC, USDT, DAI)
    /// @param amount The amount to send (before fees)
    /// @param recipientHash Hash of recipient's phone/ID for privacy
    /// @param fromCountry Sender's country (ISO 3166-1 alpha-2)
    /// @param toCountry Recipient's country
    function createOrder(
        address token,
        uint256 amount,
        bytes32 recipientHash,
        bytes2 fromCountry,
        bytes2 toCountry
    ) external nonReentrant returns (uint256 orderId) {
        if (!supportedTokens[token]) revert UnsupportedToken();
        if (amount == 0) revert ZeroAmount();

        // Calculate fee
        (uint256 feeAmount, ) = feeController.calculateFee(
            msg.sender, amount, fromCountry, toCountry
        );

        uint256 totalDeposit = amount + feeAmount;

        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalDeposit);

        // Send fee to treasury
        if (feeAmount > 0) {
            IERC20(token).safeTransfer(treasury, feeAmount);
        }

        orderId = nextOrderId++;

        orders[orderId] = RemittanceOrder({
            id: orderId,
            sender: msg.sender,
            token: token,
            amount: amount,
            fee: feeAmount,
            recipientHash: recipientHash,
            fromCountry: fromCountry,
            toCountry: toCountry,
            claimedByAgent: address(0),
            createdAt: block.timestamp,
            expiresAt: block.timestamp + ORDER_EXPIRY,
            status: OrderStatus.Pending
        });

        senderOrders[msg.sender].push(orderId);

        // Record volume for fee tier calculation
        feeController.recordVolume(msg.sender, amount);

        // Update protocol stats
        totalOrders++;
        totalVolume += amount;
        totalFeesCollected += feeAmount;

        emit OrderCreated(orderId, msg.sender, token, amount, feeAmount, fromCountry, toCountry);
    }

    /// @notice Agent claims an order to fulfill (deliver cash to recipient)
    function claimOrder(uint256 orderId) external nonReentrant {
        RemittanceOrder storage order = orders[orderId];
        if (order.status != OrderStatus.Pending) revert OrderNotPending();
        if (block.timestamp > order.expiresAt) revert OrderExpired();
        if (!agentRegistry.isActiveAgent(msg.sender)) revert AgentNotActive();

        order.status = OrderStatus.Claimed;
        order.claimedByAgent = msg.sender;

        emit OrderClaimed(orderId, msg.sender);
    }

    /// @notice Agent confirms cash delivery, receives stablecoins
    function completeOrder(uint256 orderId) external nonReentrant {
        RemittanceOrder storage order = orders[orderId];
        if (order.status != OrderStatus.Claimed) revert OrderNotClaimed();
        if (msg.sender != order.claimedByAgent) revert NotClaimingAgent();

        order.status = OrderStatus.Completed;

        // Transfer stablecoins to agent
        IERC20(order.token).safeTransfer(msg.sender, order.amount);

        // Update agent stats
        agentRegistry.recordCompletion(msg.sender, order.amount);

        // Reward sender with AFRI tokens
        try afriToken.mintReward(order.sender) {} catch {}

        emit OrderCompleted(orderId, msg.sender);
    }

    /// @notice Sender cancels a pending order and gets refund
    function cancelOrder(uint256 orderId) external nonReentrant {
        RemittanceOrder storage order = orders[orderId];
        if (order.sender != msg.sender) revert NotOrderSender();
        if (order.status != OrderStatus.Pending) revert OrderNotPending();

        order.status = OrderStatus.Cancelled;

        // Refund the amount (fee is not refunded -- already sent to treasury)
        IERC20(order.token).safeTransfer(msg.sender, order.amount);

        emit OrderCancelled(orderId);
    }

    function getOrder(uint256 orderId) external view returns (RemittanceOrder memory) {
        return orders[orderId];
    }

    function getSenderOrders(address sender) external view returns (uint256[] memory) {
        return senderOrders[sender];
    }

    function getProtocolStats() external view returns (
        uint256 _totalOrders,
        uint256 _totalVolume,
        uint256 _totalFeesCollected
    ) {
        return (totalOrders, totalVolume, totalFeesCollected);
    }
}
