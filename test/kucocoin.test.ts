import { ethers } from "hardhat"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { swapOutput, optimalAddedLiquidity, rewardKucoFromInvestedNat, retractedNatFromInvestedNat } from "./helpers/calculations"
import { getFactories } from "./helpers/factories"
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import type { KucoCoin, FakeWNat, BlazeSwapRouter, BlazeSwapFactory, BlazeSwapManager } from '../types'
import type { ContractFactories } from "./helpers/factories"


interface BlazeSwap {
  router: BlazeSwapRouter
  manager: BlazeSwapManager
  factory: BlazeSwapFactory
}

const DEFAULT_INITIAL_LIQUIDITY_KUCO = ethers.parseEther("100000000")
const DEFAULT_INITIAL_LIQUIDITY_NAT = ethers.parseEther("100")
const INVESTMENT_RETURN_BIPS = 11_000
const INVESTMENT_DURATION = 30 * 24 * 60 * 60 // one month
const RETRACT_DURATION = 7 * 24 * 60 * 60 // one week
const RETRACT_FEE_BIPS = 500 // 5% fee on retracting the investment

const MAX_GAS_COST = BigInt(1e9) * BigInt(1e6) // price to cover million gas

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
      INVESTMENT_RETURN_BIPS,
      INVESTMENT_DURATION,
      RETRACT_FEE_BIPS,
      RETRACT_DURATION
    )
  }

  async function initKucoCoin(
    signer: HardhatEthersSigner,
    initialLiquidityKuco?: bigint,
    initialLiquidityNat?: bigint
  ): Promise<void> {
    initialLiquidityKuco = initialLiquidityKuco ?? DEFAULT_INITIAL_LIQUIDITY_KUCO
    initialLiquidityNat = initialLiquidityNat ?? DEFAULT_INITIAL_LIQUIDITY_NAT
    await kucocoin.connect(signer).initialize(
      initialLiquidityKuco,
      { value: initialLiquidityNat }
    )
  }

  async function moveToTradingPhase(skipRetract = true): Promise<void> {
    const startTradingAt = await kucocoin.tradingPhaseStart()
    const retractDuration = await kucocoin.retractDuration()
    await time.increaseTo(startTradingAt + (skipRetract ? retractDuration : BigInt(0)))
  }

  async function fundAccountWithKuco(
    account: HardhatEthersSigner,
    investmentNat: bigint
  ): Promise<void> {
    await kucocoin.connect(account).invest(account, { value: investmentNat })
    await moveToTradingPhase()
    await kucocoin.connect(account).claim()
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
      // params
      const [, sender, receiver] = signers
      const invested = ethers.parseEther("100")
      // fund sender with KUCO
      await initKucoCoin(admin)
      await fundAccountWithKuco(sender, invested)
      // execute transfer
      const senderKucoBalance = await kucocoin.balanceOf(sender)
      const amountSentKuco = senderKucoBalance / BigInt(2)
      await kucocoin.connect(sender).transfer(receiver, amountSentKuco)
      expect(await kucocoin.balanceOf(sender)).to.equal(senderKucoBalance - amountSentKuco)
      expect(await kucocoin.balanceOf(receiver)).to.equal(amountSentKuco)
    })
  })

  describe("investing", () => {

    it("should invest and claim KUCO", async () => {
      // params
      const investor = signers[1]
      const investedNat = ethers.parseEther("101.1132")
      // test
      await initKucoCoin(admin)
      await kucocoin.connect(investor).invest(investor, { value: investedNat })
      const invested = await kucocoin.investedBy(investor)
      expect(invested).to.equal(investedNat)
      await moveToTradingPhase(false)
      await kucocoin.connect(investor).claim()
      const { reserveKuco, reserveNat } = await kucocoin.getPoolReserves()
      const balanceKuco = await kucocoin.balanceOf(investor)
      const expectedRewardKuco = rewardKucoFromInvestedNat(
        investedNat, reserveKuco, reserveNat, INVESTMENT_RETURN_BIPS)
      expect(balanceKuco).to.equal(expectedRewardKuco)
    })

    it("should invest and retract", async () => {
      // params
      const investor = signers[1]
      const investedNat = ethers.parseEther("101.1132")
      // test
      await initKucoCoin(admin)
      const investorNatBefore = await ethers.provider.getBalance(investor)
      await kucocoin.connect(investor).invest(investor, { value: investedNat })
      const investorNatMiddle = await ethers.provider.getBalance(investor)
      expect(investorNatMiddle).to.be.above(investorNatBefore - investedNat - MAX_GAS_COST)
      expect(investorNatMiddle).to.be.below(investorNatBefore - investedNat)
      const invested = await kucocoin.investedBy(investor)
      expect(invested).to.equal(investedNat)
      await moveToTradingPhase(false)
      await kucocoin.connect(investor).retract()
      const investorNatAfter = await ethers.provider.getBalance(investor)
      const expectedRetractedNat = retractedNatFromInvestedNat(investedNat, RETRACT_FEE_BIPS)
      expect(investorNatAfter).to.be.above(investorNatMiddle + expectedRetractedNat - MAX_GAS_COST)
      expect(investorNatAfter).to.be.below(investorNatMiddle + expectedRetractedNat)
    })

  })

  describe("uniswap-v2 integration", () => {
    const initialLiquidityKuco = ethers.parseEther("100000000")
    const initialLiquidityNat = ethers.parseEther("100")

    it("should test buying kucocoin (swapping NAT for KUCO)", async () => {
      // params
      const [, buyer, receiver] = signers
      const amountInNat = ethers.parseEther("100")
      // initialize and move to trading phase
      await initKucoCoin(admin, initialLiquidityKuco, initialLiquidityNat)
      await moveToTradingPhase()
      // execute test
      const { reserveKuco, reserveNat } = await kucocoin.getPoolReserves()
      const amountOutKuco = swapOutput(reserveNat, reserveKuco, amountInNat)
      const buyerKucoBefore = await kucocoin.balanceOf(buyer)
      const receiverKucoBefore = await kucocoin.balanceOf(receiver)
      const buyerNatBefore = await ethers.provider.getBalance(buyer)
      const receiverNatBefore = await ethers.provider.getBalance(receiver)
      await kucocoin.connect(buyer).buy(
        amountInNat,
        receiver,
        ethers.MaxUint256,
        { value: amountInNat }
      )
      const buyerKucoAfter = await kucocoin.balanceOf(buyer)
      const receiverKucoAfter = await kucocoin.balanceOf(receiver)
      const buyerNatAfter = await ethers.provider.getBalance(buyer)
      const receiverNatAfter = await ethers.provider.getBalance(receiver)
      expect(buyerKucoAfter).to.equal(buyerKucoBefore)
      expect(buyerNatAfter).to.be.above(buyerNatBefore - amountInNat - MAX_GAS_COST)
      expect(buyerNatAfter).to.be.below(buyerNatBefore - amountInNat)
      expect(receiverKucoAfter).to.equal(receiverKucoBefore + amountOutKuco)
      expect(receiverNatAfter).to.equal(receiverNatBefore)
    })

    it("should test selling kucocoin", async () => {
      // params
      const [, seller, receiver] = signers
      const sellerInvestmentNat = ethers.parseEther("100")
      // fund seller with some KUCO
      await initKucoCoin(admin, initialLiquidityKuco, initialLiquidityNat)
      await fundAccountWithKuco(seller, sellerInvestmentNat)
      const sellerKucoBefore = await kucocoin.balanceOf(seller)
      const amountKucoIn = sellerKucoBefore / BigInt(2)
      expect(amountKucoIn).to.be.greaterThan(0)
      // execute test
      const { reserveKuco, reserveNat } = await kucocoin.getPoolReserves()
      const amountOutNat = swapOutput(reserveKuco, reserveNat, amountKucoIn)
      const receiverKucoBefore = await kucocoin.balanceOf(receiver)
      const sellerNatBefore = await ethers.provider.getBalance(seller)
      const receiverNatBefore = await ethers.provider.getBalance(receiver)
      await kucocoin.connect(seller).sell(
        amountKucoIn,
        amountOutNat,
        receiver,
        ethers.MaxUint256
        )
      const sellerKucoAfter = await kucocoin.balanceOf(seller)
      const sellerNatAfter = await ethers.provider.getBalance(seller)
      const receiverKucoAfter = await kucocoin.balanceOf(receiver)
      const receiverNatAfter = await ethers.provider.getBalance(receiver)
      expect(sellerKucoAfter).to.equal(sellerKucoBefore - amountKucoIn)
      expect(sellerNatAfter).to.be.above(sellerNatBefore - MAX_GAS_COST)
      expect(sellerNatAfter).to.be.below(sellerNatBefore)
      expect(receiverKucoAfter).to.equal(receiverKucoBefore)
      expect(receiverNatAfter).to.equal(receiverNatBefore + amountOutNat)
    })

    it("should test adding liquidity", async () => {
      // params
      const provider = signers[1]
      const receiver = signers[2]
      const providerInvestmentNat = ethers.parseEther("100")
      const providedLiquidityNat = ethers.parseEther("10")
      // fund user with KucoCoin
      await initKucoCoin(admin, initialLiquidityKuco, initialLiquidityNat)
      await fundAccountWithKuco(provider, providerInvestmentNat)
      const providerKucoBefore = await kucocoin.balanceOf(provider)
      const providedLiquidityKuco = providerKucoBefore / BigInt(2)
      expect(providedLiquidityKuco).to.be.greaterThan(0)
      // test adding liquidity
      const { reserveKuco: reserveKucoBefore, reserveNat: reserveNatBefore } = await kucocoin.getPoolReserves()
      const [optimalAmountNat, optimalAmountKuco] = optimalAddedLiquidity(
        providedLiquidityNat, providedLiquidityKuco, reserveNatBefore, reserveKucoBefore)
      const providerNatBefore = await ethers.provider.getBalance(provider)
      const receiverKucoBefore = await kucocoin.balanceOf(receiver)
      const receiverNatBefore = await ethers.provider.getBalance(receiver)
      await kucocoin.connect(provider).addLiquidity(
        optimalAmountKuco,
        0,
        0,
        receiver,
        ethers.MaxUint256,
        { value: optimalAmountNat }
      )
      // check that KUCO and NAT balances were reduced appropriately
      const providerKucoAfter = await kucocoin.balanceOf(provider)
      const providerNatAfter = await ethers.provider.getBalance(provider)
      const receiverKucoAfter = await kucocoin.balanceOf(receiver)
      const receiverNatAfter = await ethers.provider.getBalance(receiver)
      expect(providerKucoAfter).to.be.approximately(providerKucoBefore - optimalAmountKuco, 1)
      expect(providerNatAfter).to.be.above(providerNatBefore - optimalAmountNat - MAX_GAS_COST)
      expect(providerNatAfter).to.be.below(providerNatBefore - optimalAmountNat)
      expect(receiverKucoAfter).to.equal(receiverKucoBefore)
      expect(receiverNatAfter).to.equal(receiverNatBefore)
      // check that reserves were updated
      const { reserveKuco: reserveKucoAfter, reserveNat: reserveNatAfter } = await kucocoin.getPoolReserves()
      expect(reserveKucoAfter).to.be.approximately(reserveKucoBefore + optimalAmountKuco, 1)
      expect(reserveNatAfter).to.be.approximately(reserveNatBefore + optimalAmountNat, 1)
      // check that LP tokens were minted
      const lpBalance = await kucocoin.liquidityOf(receiver)
      expect(lpBalance).to.be.greaterThan(0)
    })
  })

  describe("security", () => {

    it("should not allow investing before initialization", async () => {
      const [, investor] = signers
      await expect(kucocoin.connect(investor).invest(investor, { value: 100 }))
        .to.revertedWith("KucoCoin: not inside investment phase")
    })

    it.skip("should not allow buying KucoCoin before trading starts", async () => {
      const [, trader] = signers
      await expect(kucocoin.connect(trader).buy(0, trader, ethers.MaxUint256, { value: 100 }))
        .to.revertedWith("KucoCoin: trading not yet allowed")
      await initKucoCoin(admin)
      await expect(kucocoin.connect(trader).buy(0, trader, ethers.MaxUint256, { value: 100 }))
        .to.revertedWith("KucoCoin: trading not yet allowed")
    })

    //it("should not allow selling too much KucoCoin in the retraction period", async () => {})

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
      // params
      const [, sender, receiver] = signers
      const invested = ethers.parseEther("100")
      // fund sender with KUCO
      await initKucoCoin(admin)
      await fundAccountWithKuco(sender, invested)
      // execute transfer
      const senderKucoBalance = await kucocoin.balanceOf(sender)
      const amountTransActedKuco = senderKucoBalance / BigInt(2)
      await kucocoin.connect(sender).makeTransAction(receiver, amountTransActedKuco)
      expect(await kucocoin.balanceOf(sender)).to.equal(senderKucoBalance - amountTransActedKuco)
      expect(await kucocoin.balanceOf(receiver)).to.equal(amountTransActedKuco)
    })
  })
})