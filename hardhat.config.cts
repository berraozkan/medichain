require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition-ethers");
try { require("dotenv").config(); } catch {}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  mocha: {
    require: ["ts-node/register"],
    spec: "test/**/*.ts",
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...(process.env.SEPOLIA_RPC_URL && process.env.PRIVATE_KEY
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
          },
        }
      : {}),
  },
};
