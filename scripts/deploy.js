const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AfriPay Protocol with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // 1. Deploy AfriToken
  const AfriToken = await ethers.getContractFactory("AfriToken");
  const afriToken = await AfriToken.deploy(deployer.address);
  await afriToken.waitForDeployment();
  console.log("AfriToken deployed to:", await afriToken.getAddress());

  // 2. Deploy FeeController
  const FeeController = await ethers.getContractFactory("FeeController");
  const feeController = await FeeController.deploy(deployer.address);
  await feeController.waitForDeployment();
  console.log("FeeController deployed to:", await feeController.getAddress());

  // 3. Deploy AgentRegistry
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy(deployer.address, await afriToken.getAddress());
  await agentRegistry.waitForDeployment();
  console.log("AgentRegistry deployed to:", await agentRegistry.getAddress());

  // 4. Deploy RemittanceVault
  const RemittanceVault = await ethers.getContractFactory("RemittanceVault");
  const vault = await RemittanceVault.deploy(
    deployer.address,
    await feeController.getAddress(),
    await agentRegistry.getAddress(),
    await afriToken.getAddress(),
    deployer.address // treasury
  );
  await vault.waitForDeployment();
  console.log("RemittanceVault deployed to:", await vault.getAddress());

  // 5. Configure permissions
  // Set vault as minter on AfriToken
  await afriToken.setMinter(await vault.getAddress(), true);
  console.log("Set RemittanceVault as AfriToken minter");

  // Set vault on FeeController
  await feeController.setVault(await vault.getAddress());
  console.log("Set RemittanceVault on FeeController");

  // Set vault on AgentRegistry
  await agentRegistry.setVault(await vault.getAddress());
  console.log("Set RemittanceVault on AgentRegistry");

  // Set corridor fees for common African corridors
  const corridors = [
    { from: "NG", to: "KE", fee: 40 }, // Nigeria -> Kenya: 0.40%
    { from: "NG", to: "GH", fee: 35 }, // Nigeria -> Ghana: 0.35%
    { from: "ZA", to: "ZW", fee: 45 }, // South Africa -> Zimbabwe: 0.45%
    { from: "KE", to: "UG", fee: 30 }, // Kenya -> Uganda: 0.30%
    { from: "KE", to: "TZ", fee: 30 }, // Kenya -> Tanzania: 0.30%
  ];

  for (const c of corridors) {
    const fromBytes = ethers.encodeBytes32String(c.from).slice(0, 6);
    const toBytes = ethers.encodeBytes32String(c.to).slice(0, 6);
    await feeController.setCorridorFee(fromBytes, toBytes, c.fee);
    console.log(`Set corridor fee ${c.from}->${c.to}: ${c.fee / 100}%`);
  }

  console.log("\n--- AfriPay Protocol Deployed ---");
  console.log({
    AfriToken: await afriToken.getAddress(),
    FeeController: await feeController.getAddress(),
    AgentRegistry: await agentRegistry.getAddress(),
    RemittanceVault: await vault.getAddress(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
