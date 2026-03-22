// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRemittanceVault {
    enum OrderStatus {
        Pending,
        Claimed,
        Completed,
        Cancelled,
        Expired
    }

    struct RemittanceOrder {
        uint256 id;
        address sender;
        address token;
        uint256 amount;
        uint256 fee;
        bytes32 recipientHash; // keccak256(phone number or ID)
        bytes2 fromCountry; // ISO 3166-1 alpha-2
        bytes2 toCountry;
        address claimedByAgent;
        uint256 createdAt;
        uint256 expiresAt;
        OrderStatus status;
    }

    event OrderCreated(
        uint256 indexed orderId,
        address indexed sender,
        address token,
        uint256 amount,
        uint256 fee,
        bytes2 fromCountry,
        bytes2 toCountry
    );

    event OrderClaimed(uint256 indexed orderId, address indexed agent);
    event OrderCompleted(uint256 indexed orderId, address indexed agent);
    event OrderCancelled(uint256 indexed orderId);

    function createOrder(
        address token,
        uint256 amount,
        bytes32 recipientHash,
        bytes2 fromCountry,
        bytes2 toCountry
    ) external returns (uint256 orderId);

    function claimOrder(uint256 orderId) external;
    function completeOrder(uint256 orderId) external;
    function cancelOrder(uint256 orderId) external;
    function getOrder(uint256 orderId) external view returns (RemittanceOrder memory);
}
