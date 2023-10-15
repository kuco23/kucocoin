import { ethers } from "hardhat"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"
import { getFactories } from "./helpers/factories"
import type { KucoCoin, WNat, BlazeSwapRouter, BlazeSwapFactory, BlazeSwapManager } from '../types'
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

  beforeEach(async () => {
    factories = await getFactories()
    signers = await ethers.getSigners()
    wNat = await factories.wNat.deploy()
    blazeswap = await deployBlazeSwap()
    kucocoin = await deployKucoCoin()
  })

  it("should test transfer", async () => {
    const [admin, sender, receiver] = signers
    const amount = BigInt(10) * ethers.WeiPerEther
    await kucocoin.connect(admin).transfer(sender.address, amount)
    await kucocoin.connect(sender).transfer(receiver.address, amount)
    expect(await kucocoin.balanceOf(sender.address)).to.equal(0)
    expect(await kucocoin.balanceOf(receiver.address)).to.equal(amount)
  })

  it("should test adding liquidity and fetching reserves", async () => {
    const [admin] = signers
    const [amountKUCO, amountNAT] = [ethers.parseEther("1"), ethers.parseEther("10")]
    const adminBalanceBefore = await kucocoin.balanceOf(admin.address)
    await kucocoin.connect(admin).addLiquidity(amountKUCO, { value: amountNAT})
    const adminBalanceAfter = await kucocoin.balanceOf(admin.address)
    expect(adminBalanceBefore - adminBalanceAfter).to.equal(amountKUCO)
  })

  it("should test fetching reserves", async () => {
    const [admin] = signers
    const [amountKUCO, amountNAT] = [ethers.parseEther("1"), ethers.parseEther("10")]
    const reservesBeforeLiquidity = kucocoin.getPoolReserves()
    expect(reservesBeforeLiquidity).to.be.revertedWith("")
    await kucocoin.connect(admin).addLiquidity(amountKUCO, { value: amountNAT})
    const reserves = await kucocoin.getPoolReserves()
    expect(reserves[0]).to.equal(amountKUCO)
    expect(reserves[1]).to.equal(amountNAT)
  })
})