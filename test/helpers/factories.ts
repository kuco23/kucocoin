import { ethers } from 'hardhat'
import type {
  KucoCoin__factory,
  FakeWNat__factory, FakeERC20__factory,
  UniswapV2Router__factory, UniswapV2Pair__factory
} from '../../types'


export interface ContractFactories {
  // kucocoin
  kucoCoin: KucoCoin__factory
  // uniswap-v2
  uniswapV2Router: UniswapV2Router__factory
  uniswapV2Pair: UniswapV2Pair__factory
  // aux tokens
  fakeWNat: FakeWNat__factory
  fakeERC20: FakeERC20__factory
}

export async function getFactories(): Promise<ContractFactories> {
  return {
    kucoCoin: await ethers.getContractFactory("KucoCoin"),
    uniswapV2Router: await ethers.getContractFactory("UniswapV2Router"),
    uniswapV2Pair: await ethers.getContractFactory("UniswapV2Pair"),
    fakeWNat: await ethers.getContractFactory("FakeWNat"),
    fakeERC20: await ethers.getContractFactory("FakeERC20"),
  }
}