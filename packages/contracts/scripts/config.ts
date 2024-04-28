export interface NetworkInfo {
  rpc: string
  wNat: string
  uniswapV2: string
}

const addresses: {[network: string]: {
  wNat: string
  uniswapV2: string
}} = require('../addresses.json')

export const networkInfo: {[index: string]: NetworkInfo} = {
  'coston': {
    rpc: 'https://coston-api.flare.network/ext/bc/C/rpc',
    wNat: addresses['coston'].wNat,
    uniswapV2: addresses['coston'].uniswapV2
  },
  'flare': {
    rpc: 'https://flare-api.flare.network/ext/bc/C/rpc',
    wNat: addresses['flare'].wNat,
    uniswapV2: addresses['flare'].uniswapV2
  },
  'costonfork': {
    rpc: 'http://localhost:8545/',
    wNat: addresses['coston'].wNat,
    uniswapV2: addresses['coston'].uniswapV2
  },
  'flarefork': {
    rpc: 'http://localhost:8545/',
    wNat: addresses['flare'].wNat,
    uniswapV2: addresses['flare'].uniswapV2
  },
  'fuji': {
    rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
    wNat: addresses['fuji'].wNat,
    uniswapV2: addresses['fuji'].uniswapV2
  },
  "avalanche": {
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    wNat: addresses['avalanche'].wNat,
    uniswapV2: addresses['avalanche'].uniswapV2
  },
  'avalanchefork': {
    rpc: 'http://localhost:8545/',
    wNat: addresses['avalanche'].wNat,
    uniswapV2: addresses['avalanche'].uniswapV2
  }
}