export interface NetworkInfo {
  rpc: string
  uniswapV2: string
}

export interface NetworkInfoJson {
  [networkName: string]: {
    [contractName: string]: {
      address: string
    }
  }
}

const networkInfoJson: NetworkInfoJson = require('../network-info.json')

export const networkInfo: {[index: string]: NetworkInfo} = {
  'avalanchefork': {
    rpc: 'https://51.178.88.56:8545/',
    uniswapV2: networkInfoJson['avalanche']['uniswapV2Router'].address
  },
  'fuji': {
    rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
    uniswapV2: networkInfoJson['fuji']['uniswapV2Router'].address
  },
  "avalanche": {
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    uniswapV2: networkInfoJson['avalanche']['uniswapV2Router'].address
  }
}