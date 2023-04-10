import hre from "hardhat"
require("dotenv").config();

const { SAFE_ADDRESS } = process.env;

async function main() {
  const posManager = await hre.ethers.getContractFactory("sonnePositionManager");
  if (SAFE_ADDRESS){
    const contract = await posManager.deploy(SAFE_ADDRESS); 
    await contract.deployed();  
    console.log("Module deployed to address: ", contract.address);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// npx hardhat run .\scripts\deploy.ts