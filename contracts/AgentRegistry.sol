// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistry -- Register and manage local cash-out agents
/// @notice Agents are local operators (like M-Pesa agents) who handle the last-mile
///         cash delivery to remittance recipients in their country
contract AgentRegistry is Ownable {
    enum AgentStatus {
        Inactive,
        Active,
        Suspended
    }

    struct Agent {
        address wallet;
        bytes2 country; // ISO 3166-1 alpha-2
        string name;
        string location; // city/region
        uint256 completedOrders;
        uint256 totalVolume;
        uint256 stakedAmount; // agents stake tokens as collateral
        uint256 registeredAt;
        AgentStatus status;
    }

    uint256 public minStake = 100 * 1e18; // minimum stake to become agent
    address public stakeToken; // token used for staking (e.g., USDC or AFRI)

    mapping(address => Agent) public agents;
    mapping(bytes2 => address[]) public agentsByCountry;
    address[] public allAgents;

    address public vault; // only vault can record completions

    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientStake();
    error AgentNotActive();
    error OnlyVault();

    event AgentRegistered(address indexed agent, bytes2 country, string name);
    event AgentSuspended(address indexed agent);
    event AgentReactivated(address indexed agent);
    event AgentStatsUpdated(address indexed agent, uint256 completedOrders, uint256 totalVolume);

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(address initialOwner, address _stakeToken) Ownable(initialOwner) {
        stakeToken = _stakeToken;
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
    }

    /// @notice Register as a cash-out agent in a specific country
    function registerAgent(
        bytes2 country,
        string calldata name,
        string calldata location
    ) external {
        if (agents[msg.sender].wallet != address(0)) revert AlreadyRegistered();

        agents[msg.sender] = Agent({
            wallet: msg.sender,
            country: country,
            name: name,
            location: location,
            completedOrders: 0,
            totalVolume: 0,
            stakedAmount: 0,
            registeredAt: block.timestamp,
            status: AgentStatus.Active
        });

        agentsByCountry[country].push(msg.sender);
        allAgents.push(msg.sender);

        emit AgentRegistered(msg.sender, country, name);
    }

    function suspendAgent(address agent) external onlyOwner {
        if (agents[agent].wallet == address(0)) revert NotRegistered();
        agents[agent].status = AgentStatus.Suspended;
        emit AgentSuspended(agent);
    }

    function reactivateAgent(address agent) external onlyOwner {
        if (agents[agent].wallet == address(0)) revert NotRegistered();
        agents[agent].status = AgentStatus.Active;
        emit AgentReactivated(agent);
    }

    /// @notice Update agent stats after completing an order (called by vault)
    function recordCompletion(address agent, uint256 amount) external onlyVault {
        Agent storage a = agents[agent];
        if (a.wallet == address(0)) revert NotRegistered();
        a.completedOrders += 1;
        a.totalVolume += amount;
        emit AgentStatsUpdated(agent, a.completedOrders, a.totalVolume);
    }

    function isActiveAgent(address agent) external view returns (bool) {
        return agents[agent].status == AgentStatus.Active;
    }

    function getAgentsByCountry(bytes2 country) external view returns (address[] memory) {
        return agentsByCountry[country];
    }

    function getAgentCount() external view returns (uint256) {
        return allAgents.length;
    }

    function getAgent(address agent) external view returns (Agent memory) {
        return agents[agent];
    }
}
