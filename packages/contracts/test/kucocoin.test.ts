import { ethers } from "hardhat"
import { time, reset } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { swapOutput, optimalAddedLiquidity, rewardKucoFromInvestedNat, retractedNatFromInvestedNat } from "./utils/calculations"
import { getFactories } from "./utils/factories"
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import type { ERC20, KucoCoin, FakeWNat, UniswapV2Router, UniswapV2Factory, UniswapV2Pair } from '../types'
import type { ContractFactories } from "./utils/factories"


const SUNDAY = 1722117600
const MAX_GAS_COST = BigInt(1e9) * BigInt(1e6) // price to cover million gas
const KUCOCOIN_FEATURE_FEE = ethers.parseEther("1")

const DEFAULT_INITIAL_LIQUIDITY_KUCO = ethers.parseEther("100000000")
const DEFAULT_INITIAL_LIQUIDITY_NAT = ethers.parseEther("100")
const INVESTMENT_INTEREST_BIPS = 500
const INVESTMENT_FACTOR_BIPS = 10_000 + INVESTMENT_INTEREST_BIPS
const TRADING_STARTS_AT = 7258114800
const RETRACT_FEE_BIPS = 1000 // 10% fee on retracting the investment
const RETRACT_ENDS_AT = TRADING_STARTS_AT + 24 * 60 * 60 * 14

async function getTimestampOfBlock(blockNumber: number): Promise<number> {
  const block = await ethers.provider.getBlock(blockNumber)
  return block!.timestamp
}

function secondsTilMonday(unix: number): number {
  const day = 60 * 60 * 24
  const week = day * 7
  const secondsAfterMonday = (unix - SUNDAY - day) % week
  return unix + (week - secondsAfterMonday)
}

async function moveToMonday(): Promise<void> {
  const now = await time.latest()
  await time.increaseTo(secondsTilMonday(Number(now)))
}

async function moveToSunday(): Promise<void> {
  await moveToMonday()
  await time.increase(60 * 60 * 24 * 6)
}

describe("KucoCoin", () => {
  let factories: ContractFactories
  let signers: HardhatEthersSigner[]
  let admin: HardhatEthersSigner
  let kucocoin: KucoCoin
  let uniswapV2Factory: UniswapV2Factory
  let uniswapV2Router: UniswapV2Router
  let wNat: FakeWNat

  async function getReserves(tokenA: ERC20, tokenB: ERC20): Promise<[bigint, bigint]> {
    const pair = await getPairFor(tokenA, tokenB)
    const [reserveA, reserveB] = await pair.getReserves()
    const addressA = await tokenA.getAddress()
    const addressB = await tokenB.getAddress()
    const AlessThanB = BigInt(addressA) < parseInt(addressB)
    return AlessThanB ? [reserveA, reserveB] : [reserveB, reserveA]
  }

  async function getPairFor(tokenA: ERC20, tokenB: ERC20): Promise<UniswapV2Pair> {
    const pairAddress = await uniswapV2Factory.getPair(tokenA, tokenB)
    return factories.uniswapV2Pair.attach(pairAddress) as UniswapV2Pair
  }

  async function deployKucoCoin(
    signer: HardhatEthersSigner
  ): Promise<KucoCoin> {
    return factories.kucoCoin.connect(signer).deploy(
      uniswapV2Router,
      INVESTMENT_INTEREST_BIPS,
      TRADING_STARTS_AT,
      RETRACT_FEE_BIPS,
      RETRACT_ENDS_AT
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
    await time.increaseTo(skipRetract ? RETRACT_ENDS_AT : TRADING_STARTS_AT)
  }

  async function fundAccountWithKuco(
    account: HardhatEthersSigner,
    investmentNat: bigint
  ): Promise<void> {
    await kucocoin.connect(account).invest(account, { value: investmentNat })
    await moveToTradingPhase()
    await kucocoin.connect(account).claim(account)
  }

  before(async () => {
    factories = await getFactories()
    signers = await ethers.getSigners()
    admin = signers[0]
  })

  beforeEach(async () => {
    await reset() // need for time correction
    await moveToMonday()
    wNat = await factories.fakeWNat.connect(admin).deploy()
    uniswapV2Factory = await factories.uniswapV2Factory.connect(admin).deploy(ethers.ZeroAddress)
    uniswapV2Router = await factories.uniswapV2Router.connect(admin).deploy(uniswapV2Factory, wNat)
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

    it("should update liquidity pool reserves on a made investment", async () => {
      // params
      const investor = signers[1]
      const initialLiquidityKuco = ethers.parseEther("100000000")
      const initialLiquidityNat = ethers.parseEther("100")
      const investedNat = ethers.parseEther("420.24515101")
      // test
      await initKucoCoin(admin, initialLiquidityKuco, initialLiquidityNat)
      const { reserveKuco: reserveKucoBefore, reserveNat: reserveNatBefore } = await kucocoin.getPoolReserves()
      expect(reserveKucoBefore).to.equal(initialLiquidityKuco)
      expect(reserveNatBefore).to.equal(initialLiquidityNat)
      await kucocoin.connect(investor).invest(investor, { value: investedNat })
      const { reserveKuco: reserveKucoAfter, reserveNat: reserveNatAfter } = await kucocoin.getPoolReserves()
      expect(reserveNatAfter).to.equal(reserveNatBefore + investedNat)
      expect(reserveKucoAfter).to.equal(reserveKucoBefore)
    })

    it("should invest and claim KUCO", async () => {
      // params
      const [, investor1, investor2] = signers
      const investedNat1 = ethers.parseEther("101.1132")
      const investedNat2 = ethers.parseEther("1032.1")
      // test
      await initKucoCoin(admin)
      // test simple investment
      await kucocoin.connect(investor1).invest(investor1, { value: investedNat1 })
      await kucocoin.connect(investor2).invest(investor2, { value: investedNat2 })
      expect(await kucocoin.getInvestedNatOf(investor1)).to.equal(investedNat1)
      expect(await kucocoin.getInvestedNatOf(investor2)).to.equal(investedNat2)
      await moveToSunday() // additional test
      await moveToTradingPhase(false)
      const { reserveKuco, reserveNat } = await kucocoin.getPoolReserves()
      await kucocoin.connect(investor1).claim(investor1)
      const balanceKuco1 = await kucocoin.balanceOf(investor1)
      const expectedRewardKuco1 = rewardKucoFromInvestedNat(
        investedNat1, reserveKuco, reserveNat, INVESTMENT_FACTOR_BIPS)
      expect(balanceKuco1).to.be.greaterThan(0)
      expect(balanceKuco1).to.equal(expectedRewardKuco1)
      // test investment reward when liquidity pool is altered
      await kucocoin.connect(investor1).sell(balanceKuco1, 0, investor1, ethers.MaxUint256)
      const { reserveKuco: reserveKucoAfter, reserveNat: reserveNatAfter } = await kucocoin.getPoolReserves()
      await moveToSunday() // additional test
      await kucocoin.connect(investor2).claim(investor2)
      const balanceKuco2 = await kucocoin.balanceOf(investor2)
      const expectedRewardKuco2 = rewardKucoFromInvestedNat(
        investedNat2, reserveKucoAfter, reserveNatAfter, INVESTMENT_FACTOR_BIPS)
      expect(balanceKuco2).to.be.greaterThan(0)
      expect(balanceKuco2).to.equal(expectedRewardKuco2)
    })

    it("should invest and retract", async () => {
      // params
      const [, investor, retractee] = signers
      const investedNat = ethers.parseEther("101.1132")
      // test
      await initKucoCoin(admin)
      const investorNatBefore = await ethers.provider.getBalance(investor)
      await moveToSunday() // additional test
      await kucocoin.connect(investor).invest(investor, { value: investedNat })
      const investorNatMiddle = await ethers.provider.getBalance(investor)
      expect(investorNatMiddle).to.be.above(investorNatBefore - investedNat - MAX_GAS_COST)
      expect(investorNatMiddle).to.be.below(investorNatBefore - investedNat)
      const invested = await kucocoin.getInvestedNatOf(investor)
      expect(invested).to.equal(investedNat)
      await moveToTradingPhase(false)
      const retracteeNatBefore = await ethers.provider.getBalance(retractee)
      const { reserveKuco: reserveKucoBefore, reserveNat: reserveNatBefore } = await kucocoin.getPoolReserves()
      await moveToSunday() // additional test
      await kucocoin.connect(investor).retract(retractee)
      const { reserveKuco: reserveKucoAfter, reserveNat: reserveNatAfter } = await kucocoin.getPoolReserves()
      // check that retraction gave NAT to the retractee
      const retracteeNatAfter = await ethers.provider.getBalance(retractee)
      const investorNatAfter = await ethers.provider.getBalance(investor)
      const expectedRetractedNat = retractedNatFromInvestedNat(investedNat, RETRACT_FEE_BIPS)
      expect(investorNatAfter).to.be.below(investorNatMiddle)
      expect(investorNatAfter).to.be.above(investorNatMiddle - MAX_GAS_COST)
      expect(retracteeNatAfter).to.equal(retracteeNatBefore + expectedRetractedNat)
      // check that retraction took only NAT from the dex
      expect(reserveKucoAfter).to.equal(reserveKucoBefore)
      expect(reserveNatAfter).to.equal(reserveNatBefore - expectedRetractedNat)
    })

  })

  describe("uniswap-v2 integration", () => {
    const initialLiquidityKuco = ethers.parseEther("100000000")
    const initialLiquidityNat = ethers.parseEther("100")

    it("should test fetching reserves", async () => {
      await initKucoCoin(admin, initialLiquidityKuco, initialLiquidityNat)
      const { reserveKuco, reserveNat } = await kucocoin.getPoolReserves()
      const [dexReserveKuco, dexReserveNat] = await getReserves(kucocoin, wNat)
      expect(reserveKuco).to.equal(dexReserveKuco)
      expect(reserveNat).to.equal(dexReserveNat)
    })

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
        .to.be.reverted
    })

    it("should not allow buying KucoCoin before trading starts", async () => {
      const [, buyer] = signers
      await expect(kucocoin.connect(buyer).buy(0, buyer, ethers.MaxUint256, { value: 100 })).to.be.reverted
      await initKucoCoin(admin)
      await expect(kucocoin.connect(buyer).buy(0, buyer, ethers.MaxUint256, { value: 100 })).to.be.reverted
    })

    it("should not allow claiming KucoCoin twice", async () => {
      const [, investor] = signers
      await initKucoCoin(admin)
      await kucocoin.connect(investor).invest(investor, { value: 100 })
      await moveToTradingPhase()
      await kucocoin.connect(investor).claim(investor)
      await expect(kucocoin.connect(investor).claim(investor))
        .to.be.revertedWith("KucoCoin: no investment to claim")
    })

    it.skip("should not allow selling too much KucoCoin inside the retraction period", async () => {
      const [, seller, other] = signers
      const initialLiquidityKuco = ethers.parseEther("1000")
      const initialLiquidityNat = ethers.parseEther("10")
      const investedNatSeller = ethers.parseEther("10")
      const investedNatOther = ethers.parseEther("800.166193719106")
      await initKucoCoin(admin, initialLiquidityKuco, initialLiquidityNat)
      await kucocoin.connect(seller).invest(seller, { value: investedNatSeller })
      await kucocoin.connect(other).invest(other, { value: investedNatOther })
      await moveToTradingPhase(false)
      // now `investedNatOther` is protected by the retraction period
      // which means `seller` cannot sell more than `investedNatSeller` worth of KUCO
      // (note that they got more because of kuconomics)
      await kucocoin.connect(seller).claim(seller)
      const sellerKuco = await kucocoin.balanceOf(seller)
      await expect(kucocoin.connect(seller).sell(sellerKuco, 0, seller, ethers.MaxUint256))
        .to.be.revertedWith("KucoCoin: retraction period")
      // wait for retract period to end
      await time.increaseTo(RETRACT_ENDS_AT)
      await kucocoin.connect(seller).sell(sellerKuco, 0, seller, ethers.MaxUint256)
      const sellerKucoAfter = await kucocoin.balanceOf(seller)
      expect(sellerKucoAfter).to.equal(0)
    })

  })

  describe("kucocoin specific", () => {

    it("should not allow reporting period with too low KUCO balance at trading stage", async () => {
      const [, reporter] = signers
      await initKucoCoin(admin)
      await fundAccountWithKuco(reporter, BigInt(1))
      await expect(kucocoin.connect(reporter).reportPeriod())
        .to.be.revertedWith("KucoCoin: not enough funds for feature fee")
    })

    it("should log period entry", async () => {
      const periodLogFee = ethers.parseEther("1")
      const [, periodReporter] = signers
      // uninitialized phase
      const kucoBalance1 = await kucocoin.balanceOf(periodReporter)
      const resp1 = await kucocoin.connect(periodReporter).reportPeriod()
      const kucoBalance2 = await kucocoin.balanceOf(periodReporter)
      expect(kucoBalance2).to.equal(kucoBalance1)
      await time.increase(31412)
      // investment phase
      await initKucoCoin(admin)
      const resp2 = await kucocoin.connect(periodReporter).reportPeriod()
      const kucoBalance3 = await kucocoin.balanceOf(periodReporter)
      expect(kucoBalance2).to.equal(kucoBalance3)
      // trading phase
      await fundAccountWithKuco(periodReporter, BigInt(2) * periodLogFee)
      const kucoBalance4 = await kucocoin.balanceOf(periodReporter)
      const resp3 = await kucocoin.connect(periodReporter).reportPeriod()
      const kucoBalance5 = await kucocoin.balanceOf(periodReporter)
      expect(kucoBalance4 - kucoBalance5).to.equal(periodLogFee)
      await time.increase(1000)
      const resp4 = await kucocoin.connect(periodReporter).reportPeriod()
      const kucoBalance6 = await kucocoin.balanceOf(periodReporter)
      expect(kucoBalance5 - kucoBalance6).to.equal(periodLogFee)
      const entries = await kucocoin.connect(periodReporter).periodHistory()
      const resps = [resp1, resp2, resp3, resp4]
      const timestamps = await Promise.all(resps.map(resp => getTimestampOfBlock(resp.blockNumber!)))
      expect(entries.map(x => Number(x))).to.have.same.members(timestamps)
    })

    it("should not transfer on sundays", async () => {
      const [, sender, receiver] = signers
      await initKucoCoin(admin)
      await fundAccountWithKuco(sender, ethers.parseEther("100"))
      await moveToSunday()
      await expect(kucocoin.connect(sender).transfer(receiver, 1))
        .to.be.revertedWith('KucoCoin: token not working on Sundays')
    })

    it("should not trade on sundays", async () => {
      const [, trader] = signers
      await initKucoCoin(admin)
      await fundAccountWithKuco(trader, ethers.parseEther("100"))
      await moveToSunday()
      await expect(kucocoin.connect(trader).buy(0, trader, ethers.MaxUint256, { value: 100 })).to.be.reverted
      await expect(kucocoin.connect(trader).sell(KUCOCOIN_FEATURE_FEE, 0, trader, ethers.MaxUint256)).to.be.reverted
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
      const amountTransActedKuco = senderKucoBalance - KUCOCOIN_FEATURE_FEE
      await kucocoin.connect(sender).makeTransAction(receiver, amountTransActedKuco)
      expect(await kucocoin.balanceOf(sender)).to.equal(senderKucoBalance - amountTransActedKuco - KUCOCOIN_FEATURE_FEE)
      expect(await kucocoin.balanceOf(receiver)).to.equal(amountTransActedKuco)
    })
  })
})