import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";


const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    costwo: {
      url: "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
    },
    flare: {
      url: "https://flare-api.flare.network/ext/C/rpc",
      chainId: 14,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./src",
    tests: "./test"
  },
  solidity: {
    version: '0.8.20',
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

export default config;
