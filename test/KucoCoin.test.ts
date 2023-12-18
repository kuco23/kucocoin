import { ethers } from "hardhat"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"
import { getFactories } from "./helpers/factories"
import type { KucoCoin, WNat, BlazeSwapRouter, BlazeSwapFactory, BlazeSwapManager, ERC20 } from '../types'
import type { ContractFactories } from "./helpers/factories"


interface BlazeSwap {
  router: BlazeSwapRouter
  manager: BlazeSwapManager
  factory: BlazeSwapFactory
}

describe("KucoCoin", () => {
  let factories: ContractFactories
  let signers: HardhatEthersSigner[]
  let kucocoin: KucoCoin
  let blazeswap: BlazeSwap
  let wNat: WNat

  async function deployBlazeSwap(): Promise<BlazeSwap> {
    const blazeSwap: any = {}
    blazeSwap.manager = await factories.blazeSwapManager.deploy(signers[0])
    blazeSwap.factory = await factories.blazeSwapFactory.deploy(blazeSwap.manager)
    await blazeSwap.manager.setFactory(blazeSwap.factory)
    blazeSwap.router = await factories.blazeSwapRouter.deploy(blazeSwap.factory, wNat, false)
    return blazeSwap
  }

  async function deployKucoCoin(): Promise<KucoCoin> {
    const signers = await ethers.getSigners()
    return factories.kucoCoin.connect(signers[0]).deploy(wNat, blazeswap.router)
  }

  async function provideInitialLiquidity(amountKUCO?: bigint, amountNAT?: bigint): Promise<void> {
    if (amountKUCO === undefined || amountNAT === undefined) {
      amountKUCO = ethers.parseEther("10")
      amountNAT = ethers.parseEther("100")
    }
    await kucocoin.connect(signers[0]).addLiquidity(amountKUCO, { value: amountNAT})
  }

  async function swapOutput(
    tokenA: ERC20,
    tokenB: ERC20,
    amountA: bigint
  ): Promise<bigint> {
    const { 0: reserveA, 1: reserveB } = await blazeswap.router.getReserves(tokenA, tokenB)
    const amountAWithFee = BigInt(997) * amountA
    const numerator = amountAWithFee * reserveB
    const denominator = BigInt(1000) * reserveA + amountAWithFee
    return numerator / denominator
  }

  beforeEach(async () => {
    factories = await getFactories()
    signers = await ethers.getSigners()
    wNat = await factories.wNat.deploy()
    blazeswap = await deployBlazeSwap()
    kucocoin = await deployKucoCoin()
  })

  describe("metadata", async () => {
    it("should test name", async () => {
      expect(await kucocoin.name()).to.equal("KucoCoin")
    })

    it("should test symbol", async () => {
      expect(await kucocoin.symbol()).to.equal("KUCO")
    })

    it("should test decimals", async () => {
      expect(await kucocoin.decimals()).to.equal(18)
    })
  })

  it("should test transfer", async () => {
    const [admin, sender, receiver] = signers
    const amount = BigInt(10) * ethers.WeiPerEther
    await kucocoin.connect(admin).transfer(sender, amount)
    await kucocoin.connect(sender).transfer(receiver, amount)
    expect(await kucocoin.balanceOf(sender)).to.equal(0)
    expect(await kucocoin.balanceOf(receiver)).to.equal(amount)
  })

  describe("dex integration", async () => {

    it("should test adding liquidity", async () => {
      const [admin] = signers
      const [amountKUCO, amountNAT] = [ethers.parseEther("1"), ethers.parseEther("10")]
      const adminBalanceBefore = await kucocoin.balanceOf(admin)
      await kucocoin.connect(admin).addLiquidity(amountKUCO, { value: amountNAT})
      const adminBalanceAfter = await kucocoin.balanceOf(admin)
      expect(adminBalanceBefore - adminBalanceAfter).to.equal(amountKUCO)
      const { 0: reserveKUCO, 1: reserveNAT } = await blazeswap.router.getReserves(kucocoin, wNat)
      expect(reserveKUCO).to.equal(amountKUCO)
      expect(reserveNAT).to.equal(amountNAT)
    })

    it("should test buying kucocoin", async () => {
      // setup test params
      await provideInitialLiquidity()
      const [admin, receiver] = signers
      const amountNat = ethers.parseEther("1")
      // execute test
      const amountKuco = await swapOutput(wNat, kucocoin, amountNat)
      const receiverKucoBefore = await kucocoin.balanceOf(receiver)
      await kucocoin.connect(admin).buy(receiver, 0, { value: amountNat })
      const receiverKucoAfter = await kucocoin.balanceOf(receiver)
      expect(receiverKucoAfter - receiverKucoBefore).to.equal(amountKuco)
    })

    it("should test selling kucocoin", async () => {
      // setup test params
      await provideInitialLiquidity()
      const [admin, receiver] = signers
      const amountKUCO = ethers.parseEther("1")
      // execute test
      const expectedOut = await swapOutput(kucocoin, wNat, amountKUCO)
      const adminKucoBefore = await kucocoin.balanceOf(admin)
      const receiverNatBefore = await ethers.provider.getBalance(receiver)
      const adminNatBefore = await ethers.provider.getBalance(admin)
      const estimatedGasUsed = await kucocoin.sell.estimateGas(receiver, amountKUCO, 0)
      await kucocoin.connect(admin).sell(receiver, amountKUCO, 0)
      const adminKucoAfter = await kucocoin.balanceOf(admin)
      const receiverNatAfter = await ethers.provider.getBalance(receiver)
      const adminNatAfter = await ethers.provider.getBalance(admin)
      expect(adminKucoBefore - adminKucoAfter).to.equal(amountKUCO)
      expect(receiverNatAfter - receiverNatBefore).to.equal(expectedOut)
      const feeData = await ethers.provider.getFeeData()
      const maxNatUsedForGas = estimatedGasUsed * feeData.maxFeePerGas!
      expect(adminNatBefore - adminNatAfter).to.be.lessThan(maxNatUsedForGas)
    })

  })
})