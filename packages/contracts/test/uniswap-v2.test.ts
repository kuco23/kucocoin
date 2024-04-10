import { ethers } from "hardhat"
import { expect } from "chai"
import { optimalAddedLiquidity } from "./utils/calculations"
import { getFactories } from "./utils/factories"
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import type { ERC20, FakeERC20, FakeWNat, UniswapV2Router, UniswapV2Pair } from '../types'
import type { ContractFactories } from "./utils/factories"


describe("UniswapV2", () => {
  let factories: ContractFactories
  let admin: HardhatEthersSigner
  let uniswapV2: UniswapV2Router
  let wrappedNativeToken: FakeWNat
  let tokenA: FakeERC20
  let tokenB: FakeERC20

  async function getPairFor(tokenA: ERC20, tokenB: ERC20): Promise<UniswapV2Pair> {
    const pairAddress = await uniswapV2.pairFor(tokenA, tokenB)
    return factories.uniswapV2Pair.attach(pairAddress) as UniswapV2Pair
  }

  async function addLiquidity(
    signer: HardhatEthersSigner,
    tokenA: FakeERC20,
    tokenB: FakeERC20,
    amountA: bigint,
    amountB: bigint
  ) {
    await tokenA.connect(admin).mint(signer, amountA)
    await tokenB.connect(admin).mint(signer, amountB)
    await tokenA.connect(signer).approve(uniswapV2, amountA)
    await tokenB.connect(signer).approve(uniswapV2, amountB)
    await uniswapV2.connect(signer).addLiquidity(
      tokenA, tokenB, amountA, amountB,
      0, 0, 0, 0, signer, ethers.MaxUint256)
    const balanceA = await tokenA.balanceOf(signer)
    const balanceB = await tokenB.balanceOf(signer)
    await tokenA.connect(admin).burn(signer, balanceA)
    await tokenB.connect(admin).burn(signer, balanceB)
  }

  beforeEach(async () => {
    factories = await getFactories()
    const signers = await ethers.getSigners()
    admin = signers[0]
    wrappedNativeToken = await factories.fakeWNat.deploy()
    uniswapV2 = await factories.uniswapV2Router.connect(admin).deploy(wrappedNativeToken)
    tokenA = await factories.fakeERC20.deploy("TokenA", "TKA", 18)
    tokenB = await factories.fakeERC20.deploy("TokenB", "TKB", 18)
  })

  it("should provide liquidity with tokenA / tokenB pair", async () => {
    // set params
    const initialReserveA = ethers.parseEther("1000")
    const initialReserveB = ethers.parseEther("31.1")
    const addedLiquidityA = ethers.parseEther("10000")
    const addedLiquidityB = ethers.parseEther("400")
    // deposit initial and added liquidity
    await addLiquidity(admin, tokenA, tokenB, initialReserveA, initialReserveB)
    await addLiquidity(admin, tokenA, tokenB, addedLiquidityA, addedLiquidityB)
    // check reserves
    const [reserveA, reserveB] = await uniswapV2.getReserves(tokenA, tokenB)
    const [optimalAddedA, optimalAddedB] = optimalAddedLiquidity(
      addedLiquidityA, addedLiquidityB, initialReserveA, initialReserveB)
    expect(reserveA).to.equal(initialReserveA + optimalAddedA)
    expect(reserveB).to.equal(initialReserveB + optimalAddedB)
  })

  it("should remove liquidity with tokenA / tokenB pair", async () => {
    // set params
    const initialReserveA = ethers.parseEther("4100.4141")
    const initialReserveB = ethers.parseEther("31131.1")
    const removedReserveA = ethers.parseEther("100")
    const [,provider] = await ethers.getSigners()
    // execute test
    await addLiquidity(provider, tokenA, tokenB, initialReserveA, initialReserveB)
    const pairAB = await getPairFor(tokenA, tokenB)
    const totalLiquidity = await pairAB.totalSupply()
    const liquidity = totalLiquidity * removedReserveA / initialReserveA
    const amountA = liquidity * initialReserveA / totalLiquidity
    const amountB = liquidity * initialReserveB / totalLiquidity
    await pairAB.connect(provider).approve(uniswapV2, liquidity)
    await uniswapV2.connect(provider).removeLiquidity(
      tokenA, tokenB, liquidity, amountA, amountB, provider, ethers.MaxUint256)
    // check reserves
    const [reserveA, reserveB] = await uniswapV2.getReserves(tokenA, tokenB)
    expect(reserveA).to.equal(initialReserveA - amountA)
    expect(reserveB).to.equal(initialReserveB - amountB)
    // check user balance
    const balanceA = await tokenA.balanceOf(provider)
    const balanceB = await tokenB.balanceOf(provider)
    expect(balanceA).to.equal(amountA)
    expect(balanceB).to.equal(amountB)
  })

  it("should use tokenA / wrappedNativeToken pair when using addLiquidityNat", async () => {
    // set params
    const amountTokenA = ethers.parseEther("100")
    const amountNative = ethers.parseEther("1")
    // execute test
    await tokenA.mint(admin, amountTokenA)
    await tokenA.connect(admin).approve(uniswapV2, amountTokenA)
    await uniswapV2.connect(admin).addLiquidityNAT(
      tokenA, amountTokenA, amountTokenA, amountNative, 0, admin, ethers.MaxUint256,
      { value: amountNative }
    )
    const pair = await uniswapV2.pairFor(tokenA, wrappedNativeToken)
    expect(pair).to.not.equal(ethers.ZeroAddress)
    const pairBalanceTokenA = await tokenA.balanceOf(pair)
    const pairBalanceWNat = await wrappedNativeToken.balanceOf(pair)
    expect(pairBalanceTokenA).to.equal(amountTokenA)
    expect(pairBalanceWNat).to.equal(amountNative)
  })

  it("should sync the pair contract's reserves", async () => {
    const initialLiquidityTokenA = ethers.parseEther("415")
    const initialLiquidityTokenB = ethers.parseEther("10000")
    const burnedLiquidityTokenA = ethers.parseEther("100")
    const burnedLiquidityTokenB = ethers.parseEther("1093")
    await addLiquidity(admin, tokenA, tokenB, initialLiquidityTokenA, initialLiquidityTokenB)
    const pair = await getPairFor(tokenA, tokenB)
    await tokenA.burn(pair, burnedLiquidityTokenA)
    await tokenB.burn(pair, burnedLiquidityTokenB)
    await pair.sync()
    const [reserveA, reserveB] = await uniswapV2.getReserves(tokenA, tokenB)
    expect(reserveA).to.equal(initialLiquidityTokenA - burnedLiquidityTokenA)
    expect(reserveB).to.equal(initialLiquidityTokenB - burnedLiquidityTokenB)
  })

})