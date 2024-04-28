import "dotenv/config"
import "@nomicfoundation/hardhat-toolbox"
import type { HardhatUserConfig } from "hardhat/config"


const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      chainId: 43113,
      gasPrice: 225000000000
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      chainId: 43114,
      gasPrice: 225000000000
    }
  },
  etherscan: {
    apiKey: "0000"
  },
  sourcify: {
    enabled: true
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./src",
    tests: "./test"
  },
  solidity: {
    version: '0.8.19',
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
      evmVersion: 'london',
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  }
}

export default config
