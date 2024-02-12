import { ethers } from "hardhat"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { getFactories } from "./helpers/factories"
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import type { KucoCoin, FakeWNat, BlazeSwapRouter, BlazeSwapFactory, BlazeSwapManager, ERC20 } from '../types'
import type { ContractFactories } from "./helpers/factories"


interface BlazeSwap {
  router: BlazeSwapRouter
  manager: BlazeSwapManager
  factory: BlazeSwapFactory
}

const INITIAL_LIQUIDITY_KUCOCOIN = ethers.parseEther("100000000")
const INITIAL_LIQUIDITY_NATIVE = ethers.parseEther("100")
const INVESTMENT_RETURN_BIPS = 11_000
const INVESTMENT_DURATION = 30 * 24 * 60 * 60 // one month
const RETRACT_DURATION = 7 * 24 * 60 * 60 // one week
const RETRACT_FEE_BIPS = 500 // 5% fee on retracting the investment

async function getTimestampOfBlock(blockNumber: number): Promise<number> {
  const block = await ethers.provider.getBlock(blockNumber)
  return block!.timestamp
}

describe("KucoCoin", () => {
  let factories: ContractFactories
  let signers: HardhatEthersSigner[]
  let admin: HardhatEthersSigner
  let kucocoin: KucoCoin
  let blazeswap: BlazeSwap
  let wNat: FakeWNat

  async function deployBlazeSwap(
    signer: HardhatEthersSigner
  ): Promise<BlazeSwap> {
    const blazeSwap: any = {}
    blazeSwap.manager = await factories.blazeSwapManager.deploy(signer)
    blazeSwap.factory = await factories.blazeSwapFactory.deploy(blazeSwap.manager)
    await blazeSwap.manager.setFactory(blazeSwap.factory)
    blazeSwap.router = await factories.blazeSwapRouter.deploy(blazeSwap.factory, wNat, false)
    return blazeSwap
  }

  async function deployKucoCoin(
    signer: HardhatEthersSigner
  ): Promise<KucoCoin> {
    return factories.kucoCoin.connect(signer).deploy(
      blazeswap.router,
      INITIAL_LIQUIDITY_KUCOCOIN,
      INITIAL_LIQUIDITY_NATIVE,
      INVESTMENT_RETURN_BIPS,
      await time.latest() + INVESTMENT_DURATION,
      RETRACT_DURATION,
      RETRACT_FEE_BIPS
    )
  }

  async function provideInitialLiquidity(
    amountKUCO?: bigint,
    amountNAT?: bigint
  ): Promise<void> {
    if (amountKUCO === undefined || amountNAT === undefined) {
      amountKUCO = INITIAL_LIQUIDITY_KUCOCOIN
      amountNAT = INITIAL_LIQUIDITY_NATIVE
    }
    await kucocoin.connect(admin).addLiquidity(
      amountKUCO,
      amountKUCO,
      amountNAT,
      admin,
      ethers.MaxUint256,
      { value: amountNAT}
    )
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
    admin = signers[0]
    wNat = await factories.fakeWNat.deploy()
    blazeswap = await deployBlazeSwap(admin)
    kucocoin = await deployKucoCoin(admin)
  })

  describe("kucocoin as ERC20", () => {
    it("should test name", async () => {
      expect(await kucocoin.name()).to.equal("KucoCoin")
    })

    it("should test symbol", async () => {
      expect(await kucocoin.symbol()).to.equal("KUCO")
    })

    it("should test decimals", async () => {
      expect(await kucocoin.decimals()).to.equal(18)
    })

    it("should test transfer", async () => {
      const [admin, sender, receiver] = signers
      const amount = BigInt(10) * ethers.WeiPerEther
      await kucocoin.connect(admin).transfer(sender, amount)
      await kucocoin.connect(sender).transfer(receiver, amount)
      expect(await kucocoin.balanceOf(sender)).to.equal(0)
      expect(await kucocoin.balanceOf(receiver)).to.equal(amount)
    })
  })

  describe("uniswap-v2 integration", () => {

    it("should test adding liquidity", async () => {
      const [amountKUCO, amountNAT] = [ethers.parseEther("1"), ethers.parseEther("10")]
      const adminBalanceBefore = await kucocoin.balanceOf(admin)
      await kucocoin.connect(admin).addLiquidity(
        amountKUCO,
        amountKUCO,
        amountNAT,
        admin,
        ethers.MaxUint256,
        { value: amountNAT }
      )
      const adminBalanceAfter = await kucocoin.balanceOf(admin)
      expect(adminBalanceBefore - adminBalanceAfter).to.equal(amountKUCO)
      const { 0: reserveKUCO, 1: reserveNAT } = await blazeswap.router.getReserves(kucocoin, wNat)
      expect(reserveKUCO).to.equal(amountKUCO)
      expect(reserveNAT).to.equal(amountNAT)
    })

    it("should test buying kucocoin", async () => {
      // setup test params
      await provideInitialLiquidity()
      const [, receiver] = signers
      const amountNat = ethers.parseEther("1")
      // execute test
      const amountKuco = await swapOutput(wNat, kucocoin, amountNat)
      const receiverKucoBefore = await kucocoin.balanceOf(receiver)
      await kucocoin.connect(admin).buy(
        receiver,
        amountNat,
        0,
        { value: amountNat }
      )
      const receiverKucoAfter = await kucocoin.balanceOf(receiver)
      expect(receiverKucoAfter - receiverKucoBefore).to.equal(amountKuco)
    })

    it("should test selling kucocoin", async () => {
      // setup test params
      await provideInitialLiquidity()
      const [, receiver] = signers
      const amountKUCO = ethers.parseEther("1")
      const args: [any, bigint, number, bigint] = [
        receiver, amountKUCO, 0, ethers.MaxUint256
      ]
      // execute test
      const expectedOut = await swapOutput(kucocoin, wNat, amountKUCO)
      const adminKucoBefore = await kucocoin.balanceOf(admin)
      const receiverNatBefore = await ethers.provider.getBalance(receiver)
      const adminNatBefore = await ethers.provider.getBalance(admin)
      const estimatedGasUsed = await kucocoin.sell.estimateGas(...args)
      await kucocoin.connect(admin).sell(...args)
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

  describe("investing", () => {

    it("should invest", async () => {
      const [, investor] = signers
      const amount = ethers.parseEther("101.1")
      await kucocoin.connect(investor).invest({ value: amount })
      const invested = await kucocoin.investedBy(investor)
      expect(invested).to.equal(amount)
    })

    it("should invest and receive KUCO", async () => {
      const [, investor] = signers
      const amount = ethers.parseEther("101.1")
      await kucocoin.connect(investor).invest({ value: amount })
      await time.increaseTo(await kucocoin.investmentEndTime())
      const expectedKuco = amount * BigInt(INVESTMENT_RETURN_BIPS) / BigInt(10_000)
      const balanceKuco = await kucocoin.balanceOf(investor)
      expect(balanceKuco).to.equal(expectedKuco)
    })

  })

  describe("kucocoin functionalities", () => {

    it("should log period entry", async () => {
      const [, menseReceiver] = signers
      const resp1 = await kucocoin.connect(menseReceiver).reportPeriod()
      await time.increase(31412)
      const resp2 = await kucocoin.connect(menseReceiver).reportPeriod()
      const resp3 = await kucocoin.connect(menseReceiver).reportPeriod()
      await time.increase(1000)
      const resp4 = await kucocoin.connect(menseReceiver).reportPeriod()
      const entries = await kucocoin.connect(menseReceiver).getPeriodHistory()
      const resps = [resp1, resp2, resp3, resp4]
      const timestamps = await Promise.all(resps.map(resp => getTimestampOfBlock(resp.blockNumber!)))
      expect(entries.map(x => Number(x))).to.have.same.members(timestamps)
    })

    it("should make a trans action", async () => {
      const [, sender, receiver] = signers
      const amount = ethers.WeiPerEther
      const initialSenderAmount = await kucocoin.balanceOf(sender)
      await kucocoin.connect(sender).makeTransAction(receiver, amount)
      const receiverBalanceBefore = await kucocoin.balanceOf(receiver)
      const senderBalanceBefore = await kucocoin.balanceOf(sender)
      expect(receiverBalanceBefore).to.equal(amount)
      expect(senderBalanceBefore).to.equal(initialSenderAmount - amount)
    })
  })
})