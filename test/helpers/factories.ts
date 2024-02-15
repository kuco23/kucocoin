import { ethers } from 'hardhat'
import type {
  KucoCoin__factory, FakeWNat__factory, BlazeSwapRouter__factory,
  BlazeSwapManager__factory, BlazeSwapFactory__factory,
  BlazeSwapPair__factory, FakeERC20__factory
} from '../../types'


export interface ContractFactories {
  // kucocoin
  kucoCoin: KucoCoin__factory
  // blaze-swap
  blazeSwapManager: BlazeSwapManager__factory
  blazeSwapRouter: BlazeSwapRouter__factory
  blazeSwapFactory: BlazeSwapFactory__factory
  blazeSwapPair: BlazeSwapPair__factory
  // aux tokens
  fakeWNat: FakeWNat__factory
  fakeERC20: FakeERC20__factory
}

export async function getFactories(): Promise<ContractFactories> {
  return {
    kucoCoin: await ethers.getContractFactory("KucoCoin"),
    blazeSwapManager: await ethers.getContractFactory("BlazeSwapManager"),
    blazeSwapFactory: await ethers.getContractFactory("BlazeSwapBaseFactory"),
    blazeSwapRouter: await ethers.getContractFactory("BlazeSwapRouter"),
    blazeSwapPair: await ethers.getContractFactory("BlazeSwapPair"),
    fakeWNat: await ethers.getContractFactory("FakeWNat"),
    fakeERC20: await ethers.getContractFactory("FakeERC20"),
  }
}