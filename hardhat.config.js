require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-gas-reporter");
require("dotenv").config();

const { ALCHEMY_OP, WALLET_SECRET } = process.env;


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.0",
        version: "0.8.17",
      },
    ],
  },
  defaultNetwork: "optimism",
  networks: {
    hardhat: {
      forking: {
        url: ALCHEMY_OP,
        blockNumber: 83903457
      }
    },
    optimism: {
      url: ALCHEMY_OP,
      accounts: [`0x${WALLET_SECRET}`]
    },
    local: {
      url: 'http://127.0.0.1:8545/',
    }
  },
  // etherscan: {
  //   apiKey: 'https://optimistic.etherscan.io/'
  // },
  gasReporter: {
    enabled:  true,
    // gasPrice: 1,
    showTimeSpent: true,
    showMethodSig: true,
    onlyCalledMethods: false,
    currency: 'USD',
    coinmarketcap: 'd8f6f86a-4110-4191-ab5a-6b3708ca3504',
    },
};
