import { ethers } from 'hardhat'
import type {
  KucoCoin__factory, WNat__factory, BlazeSwapRouter__factory,
  BlazeSwapManager__factory, BlazeSwapFactory__factory,
} from '../../types'


export interface ContractFactories {
  // kucocoin
  kucoCoin: KucoCoin__factory
  // blaze-swap
  blazeSwapManager: BlazeSwapManager__factory
  blazeSwapRouter: BlazeSwapRouter__factory
  blazeSwapFactory: BlazeSwapFactory__factory
  // aux tokens
  wNat: WNat__factory
}

export async function getFactories(): Promise<ContractFactories> {
  return {
    kucoCoin: await ethers.getContractFactory("KucoCoin"),
    blazeSwapManager: await ethers.getContractFactory("BlazeSwapManager"),
    blazeSwapFactory: await ethers.getContractFactory("BlazeSwapBaseFactory"),
    blazeSwapRouter: await ethers.getContractFactory("BlazeSwapRouter"),
    wNat: await ethers.getContractFactory("WNat")
  }
}