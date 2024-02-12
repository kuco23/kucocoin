import { ethers } from "hardhat"
import { expect } from "chai"
import { getFactories } from "./helpers/factories"
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import type { WNat, BlazeSwapRouter, BlazeSwapFactory, BlazeSwapManager, FakeERC20 } from '../types'
import type { ContractFactories } from "./helpers/factories"


interface BlazeSwap {
  router: BlazeSwapRouter
  manager: BlazeSwapManager
  factory: BlazeSwapFactory
}

describe("UniswapV2", () => {
  let factories: ContractFactories
  let signers: HardhatEthersSigner[]
  let blazeswap: BlazeSwap
  let wrappedNativeToken: WNat
  let tokenA: FakeERC20
  let tokenB: FakeERC20

  async function deployBlazeSwap(signer: HardhatEthersSigner): Promise<BlazeSwap> {
    const blazeSwap: any = {}
    blazeSwap.manager = await factories.blazeSwapManager.deploy(signer)
    blazeSwap.factory = await factories.blazeSwapFactory.deploy(blazeSwap.manager)
    await blazeSwap.manager.setFactory(blazeSwap.factory)
    blazeSwap.router = await factories.blazeSwapRouter.deploy(blazeSwap.factory, wrappedNativeToken, false)
    return blazeSwap
  }

  beforeEach(async () => {
    factories = await getFactories()
    signers = await ethers.getSigners()
    wrappedNativeToken = await factories.wNat.deploy()
    blazeswap = await deployBlazeSwap(signers[0])
    tokenA = await factories.fakeERC20.deploy("TokenA", "TKA", 18)
    tokenB = await factories.fakeERC20.deploy("TokenB", "TKB", 18)
  })

  it("should use tokenA / wrappedNativeToken pair when using addLiquidityNat", async () => {
    const amountTokenA = ethers.parseEther("100")
    const amountNative = ethers.parseEther("1")
    const [signer] = signers
    console.log("wrapped native", await wrappedNativeToken.getAddress())
    await tokenA.mint(signer, amountTokenA)
    await tokenA.connect(signer).approve(blazeswap.router, amountTokenA)
    await blazeswap.router.connect(signer).addLiquidityNAT(
      tokenA, amountTokenA, amountTokenA, amountNative, 0, signer, ethers.MaxUint256,
      { value: amountNative }
    )
    const pair = await blazeswap.factory.getPair(tokenA, wrappedNativeToken)
    expect(pair).to.not.equal(ethers.ZeroAddress)
    const pairBalanceTokenA = await tokenA.balanceOf(pair)
    const pairBalanceWNat = await wrappedNativeToken.balanceOf(pair)
    expect(pairBalanceTokenA).to.equal(amountTokenA)
    expect(pairBalanceWNat).to.equal(amountNative)
  })

})