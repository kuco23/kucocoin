import { keccak256 } from '@ethersproject/keccak256'

const BlazeSwapBasePair = require('../artifacts/src/uniswapV2/UniswapV2Pair.sol/UniswapV2Pair.json')
console.log(keccak256(BlazeSwapBasePair.bytecode).slice(2))