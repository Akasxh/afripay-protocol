const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AfriPay Protocol", function () {
  let deployer, sender, agent, recipient;
  let afriToken, feeController, agentRegistry, vault;
  let mockUSDC;

  beforeEach(async function () {
    [deployer, sender, agent, recipient] = await ethers.getSigners();

    // Deploy mock USDC (ERC20)
    const MockToken = await ethers.getContractFactory("AfriToken");
    mockUSDC = await MockToken.deploy(deployer.address);
    await mockUSDC.waitForDeployment();

    // Deploy protocol
    const AfriToken = await ethers.getContractFactory("AfriToken");
    afriToken = await AfriToken.deploy(deployer.address);
    await afriToken.waitForDeployment();

    const FeeController = await ethers.getContractFactory("FeeController");
    feeController = await FeeController.deploy(deployer.address);
    await feeController.waitForDeployment();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistry.deploy(deployer.address, await afriToken.getAddress());
    await agentRegistry.waitForDeployment();

    const RemittanceVault = await ethers.getContractFactory("RemittanceVault");
    vault = await RemittanceVault.deploy(
      deployer.address,
      await feeController.getAddress(),
      await agentRegistry.getAddress(),
      await afriToken.getAddress(),
      deployer.address
    );
    await vault.waitForDeployment();

    // Configure
    await afriToken.setMinter(await vault.getAddress(), true);
    await feeController.setVault(await vault.getAddress());
    await agentRegistry.setVault(await vault.getAddress());
    await vault.setSupportedToken(await mockUSDC.getAddress(), true);

    // Fund sender with mock USDC
    await mockUSDC.setMinter(deployer.address, true);
    await mockUSDC.mint(sender.address, ethers.parseEther("10000"));
  });

  describe("FeeController", function () {
    it("should calculate base fee correctly", async function () {
      const amount = ethers.parseEther("1000");
      const fromCountry = ethers.encodeBytes32String("NG").slice(0, 6);
      const toCountry = ethers.encodeBytes32String("GH").slice(0, 6);

      const [feeAmount, feeRate] = await feeController.calculateFee(
        sender.address, amount, fromCountry, toCountry
      );

      // Base fee is 50 bps = 0.5%
      expect(feeRate).to.equal(50);
      expect(feeAmount).to.equal(ethers.parseEther("5")); // 0.5% of 1000
    });

    it("should apply corridor-specific fees", async function () {
      const fromCountry = ethers.encodeBytes32String("NG").slice(0, 6);
      const toCountry = ethers.encodeBytes32String("KE").slice(0, 6);
      await feeController.setCorridorFee(fromCountry, toCountry, 40);

      const amount = ethers.parseEther("1000");
      const [feeAmount, feeRate] = await feeController.calculateFee(
        sender.address, amount, fromCountry, toCountry
      );

      expect(feeRate).to.equal(40);
      expect(feeAmount).to.equal(ethers.parseEther("4")); // 0.4% of 1000
    });

    it("should apply tier 1 volume discount for $1000+ senders", async function () {
      const fromCountry = ethers.encodeBytes32String("NG").slice(0, 6);
      const toCountry = ethers.encodeBytes32String("GH").slice(0, 6);

      // Record $1000 volume via the vault (set deployer as vault temporarily)
      await feeController.setVault(deployer.address);
      await feeController.recordVolume(sender.address, ethers.parseEther("1000"));
      await feeController.setVault(await vault.getAddress());

      const amount = ethers.parseEther("500");
      const [feeAmount, feeRate] = await feeController.calculateFee(
        sender.address, amount, fromCountry, toCountry
      );

      // Base 50 bps - 10 bps tier1 discount = 40 bps
      expect(feeRate).to.equal(40);
      expect(feeAmount).to.equal(ethers.parseEther("2")); // 0.4% of 500
    });

    it("should apply tier 2 volume discount for $10000+ senders", async function () {
      const fromCountry = ethers.encodeBytes32String("NG").slice(0, 6);
      const toCountry = ethers.encodeBytes32String("GH").slice(0, 6);

      await feeController.setVault(deployer.address);
      await feeController.recordVolume(sender.address, ethers.parseEther("10000"));
      await feeController.setVault(await vault.getAddress());

      const amount = ethers.parseEther("500");
      const [feeAmount, feeRate] = await feeController.calculateFee(
        sender.address, amount, fromCountry, toCountry
      );

      // Base 50 bps - 20 bps tier2 discount = 30 bps
      expect(feeRate).to.equal(30);
      expect(feeAmount).to.equal(ethers.parseEther("1.5")); // 0.3% of 500
    });

    it("should enforce minimum fee floor of 0.25%", async function () {
      const fromCountry = ethers.encodeBytes32String("NG").slice(0, 6);
      const toCountry = ethers.encodeBytes32String("KE").slice(0, 6);

      // Set corridor fee to 26 bps, then apply tier2 discount (-20 bps) = 6 bps, should floor to 25 bps
      await feeController.setCorridorFee(fromCountry, toCountry, 26);

      await feeController.setVault(deployer.address);
      await feeController.recordVolume(sender.address, ethers.parseEther("10000"));
      await feeController.setVault(await vault.getAddress());

      const amount = ethers.parseEther("1000");
      const [feeAmount, feeRate] = await feeController.calculateFee(
        sender.address, amount, fromCountry, toCountry
      );

      // 26 - 20 = 6, but floor is 25
      expect(feeRate).to.equal(25);
      expect(feeAmount).to.equal(ethers.parseEther("2.5")); // 0.25% of 1000
    });
  });

  describe("AgentRegistry", function () {
    it("should register an agent", async function () {
      const country = ethers.encodeBytes32String("KE").slice(0, 6);
      await agentRegistry.connect(agent).registerAgent(country, "John's Agency", "Nairobi");

      const agentData = await agentRegistry.getAgent(agent.address);
      expect(agentData.wallet).to.equal(agent.address);
      expect(agentData.name).to.equal("John's Agency");
      expect(agentData.status).to.equal(1); // Active
    });

    it("should prevent duplicate registration", async function () {
      const country = ethers.encodeBytes32String("KE").slice(0, 6);
      await agentRegistry.connect(agent).registerAgent(country, "Agent 1", "Nairobi");

      await expect(
        agentRegistry.connect(agent).registerAgent(country, "Agent 2", "Mombasa")
      ).to.be.revertedWithCustomError(agentRegistry, "AlreadyRegistered");
    });

    it("should list agents by country", async function () {
      const country = ethers.encodeBytes32String("KE").slice(0, 6);
      await agentRegistry.connect(agent).registerAgent(country, "Agent 1", "Nairobi");

      const agents = await agentRegistry.getAgentsByCountry(country);
      expect(agents).to.have.lengthOf(1);
      expect(agents[0]).to.equal(agent.address);
    });

    it("should suspend and reactivate an agent", async function () {
      const country = ethers.encodeBytes32String("KE").slice(0, 6);
      await agentRegistry.connect(agent).registerAgent(country, "Agent 1", "Nairobi");

      // Suspend
      await agentRegistry.suspendAgent(agent.address);
      let agentData = await agentRegistry.getAgent(agent.address);
      expect(agentData.status).to.equal(2); // Suspended
      expect(await agentRegistry.isActiveAgent(agent.address)).to.equal(false);

      // Reactivate
      await agentRegistry.reactivateAgent(agent.address);
      agentData = await agentRegistry.getAgent(agent.address);
      expect(agentData.status).to.equal(1); // Active
      expect(await agentRegistry.isActiveAgent(agent.address)).to.equal(true);
    });

    it("should track agent count correctly", async function () {
      expect(await agentRegistry.getAgentCount()).to.equal(0);

      const country = ethers.encodeBytes32String("KE").slice(0, 6);
      await agentRegistry.connect(agent).registerAgent(country, "Agent 1", "Nairobi");
      expect(await agentRegistry.getAgentCount()).to.equal(1);

      // Register a second agent
      await agentRegistry.connect(recipient).registerAgent(country, "Agent 2", "Mombasa");
      expect(await agentRegistry.getAgentCount()).to.equal(2);
    });
  });

  describe("RemittanceVault", function () {
    const amount = ethers.parseEther("100");
    let fromCountry, toCountry, recipientHash;

    beforeEach(async function () {
      fromCountry = ethers.encodeBytes32String("NG").slice(0, 6);
      toCountry = ethers.encodeBytes32String("KE").slice(0, 6);
      recipientHash = ethers.keccak256(ethers.toUtf8Bytes("+254712345678"));

      // Register agent
      await agentRegistry.connect(agent).registerAgent(toCountry, "Nairobi Agent", "Nairobi");

      // Approve vault
      await mockUSDC.connect(sender).approve(
        await vault.getAddress(),
        ethers.parseEther("10000")
      );
    });

    it("should create a remittance order", async function () {
      const tx = await vault.connect(sender).createOrder(
        await mockUSDC.getAddress(),
        amount,
        recipientHash,
        fromCountry,
        toCountry
      );

      const order = await vault.getOrder(1);
      expect(order.sender).to.equal(sender.address);
      expect(order.amount).to.equal(amount);
      expect(order.status).to.equal(0); // Pending

      await expect(tx).to.emit(vault, "OrderCreated");
    });

    it("should reject unsupported tokens", async function () {
      await expect(
        vault.connect(sender).createOrder(
          ethers.ZeroAddress,
          amount,
          recipientHash,
          fromCountry,
          toCountry
        )
      ).to.be.revertedWithCustomError(vault, "UnsupportedToken");
    });

    it("should complete full remittance flow", async function () {
      // 1. Sender creates order
      await vault.connect(sender).createOrder(
        await mockUSDC.getAddress(),
        amount,
        recipientHash,
        fromCountry,
        toCountry
      );

      // 2. Agent claims order
      await vault.connect(agent).claimOrder(1);
      let order = await vault.getOrder(1);
      expect(order.status).to.equal(1); // Claimed
      expect(order.claimedByAgent).to.equal(agent.address);

      // 3. Agent completes order (after delivering cash)
      const agentBalanceBefore = await mockUSDC.balanceOf(agent.address);
      await vault.connect(agent).completeOrder(1);

      order = await vault.getOrder(1);
      expect(order.status).to.equal(2); // Completed

      // Agent received the stablecoins
      const agentBalanceAfter = await mockUSDC.balanceOf(agent.address);
      expect(agentBalanceAfter - agentBalanceBefore).to.equal(amount);

      // Sender earned AFRI reward tokens
      const afriBalance = await afriToken.balanceOf(sender.address);
      expect(afriBalance).to.equal(ethers.parseEther("10")); // REWARD_PER_REMITTANCE
    });

    it("should allow sender to cancel pending order", async function () {
      await vault.connect(sender).createOrder(
        await mockUSDC.getAddress(),
        amount,
        recipientHash,
        fromCountry,
        toCountry
      );

      const balanceBefore = await mockUSDC.balanceOf(sender.address);
      await vault.connect(sender).cancelOrder(1);
      const balanceAfter = await mockUSDC.balanceOf(sender.address);

      // Sender gets amount back (fee is not refunded)
      expect(balanceAfter - balanceBefore).to.equal(amount);

      const order = await vault.getOrder(1);
      expect(order.status).to.equal(3); // Cancelled
    });

    it("should track protocol stats", async function () {
      await vault.connect(sender).createOrder(
        await mockUSDC.getAddress(),
        amount,
        recipientHash,
        fromCountry,
        toCountry
      );

      const [totalOrders, totalVolume, totalFees] = await vault.getProtocolStats();
      expect(totalOrders).to.equal(1);
      expect(totalVolume).to.equal(amount);
      expect(totalFees).to.be.gt(0);
    });

    it("should prevent non-agents from claiming", async function () {
      await vault.connect(sender).createOrder(
        await mockUSDC.getAddress(),
        amount,
        recipientHash,
        fromCountry,
        toCountry
      );

      await expect(
        vault.connect(sender).claimOrder(1)
      ).to.be.revertedWithCustomError(vault, "AgentNotActive");
    });

    it("should reject zero amount orders", async function () {
      await expect(
        vault.connect(sender).createOrder(
          await mockUSDC.getAddress(),
          0,
          recipientHash,
          fromCountry,
          toCountry
        )
      ).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("should reject claiming an already-claimed order", async function () {
      await vault.connect(sender).createOrder(
        await mockUSDC.getAddress(),
        amount,
        recipientHash,
        fromCountry,
        toCountry
      );

      // Agent claims the order
      await vault.connect(agent).claimOrder(1);

      // Register a second agent and try to claim the same order
      await agentRegistry.connect(recipient).registerAgent(toCountry, "Agent 2", "Mombasa");
      await expect(
        vault.connect(recipient).claimOrder(1)
      ).to.be.revertedWithCustomError(vault, "OrderNotPending");
    });

    it("should reject completing an unclaimed order", async function () {
      await vault.connect(sender).createOrder(
        await mockUSDC.getAddress(),
        amount,
        recipientHash,
        fromCountry,
        toCountry
      );

      // Try to complete without claiming first
      await expect(
        vault.connect(agent).completeOrder(1)
      ).to.be.revertedWithCustomError(vault, "OrderNotClaimed");
    });
  });

  describe("AfriToken", function () {
    it("should have correct initial supply", async function () {
      const balance = await afriToken.balanceOf(deployer.address);
      expect(balance).to.equal(ethers.parseEther("10000000")); // 10M
    });

    it("should only allow minters to mint", async function () {
      await expect(
        afriToken.connect(sender).mintReward(sender.address)
      ).to.be.revertedWithCustomError(afriToken, "NotMinter");
    });
  });
});
