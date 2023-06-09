const { ethers } = require("hardhat")
require("dotenv").config();

const { SAFE_ADDRESS, COMPTROLLER_ADDRESS, VELO_ROUTER_ADDRESS, UNITROLLER_ADDRESS, SONNE_ADDRESS, SAFE_ADDRESS_0 } = process.env;

async function main() {
  const c = await ethers.getContractFactory("WhitelistingModuleV2");
  const contract = await c.deploy(SAFE_ADDRESS_0); 
  await contract.deployed();
  console.log("Contract deployed to address: ", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// npx hardhat run .\scripts\deploy.ts