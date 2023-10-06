import { ethers } from "hardhat"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"
import type { KucoCoin, KucoCoin__factory } from "../types"


export async function deployKucoCoin(): Promise<KucoCoin> {
  const signers = await ethers.getSigners()
  const admin = signers[0]
  const kucocinFactory: KucoCoin__factory = await ethers.getContractFactory("KucoCoin")
  const kucocoin = await kucocinFactory.connect(admin).deploy()
  await kucocoin.waitForDeployment()
  return kucocoin
}

describe("KucoCoin", () => {
  let signers: HardhatEthersSigner[]
  let kucocoin: KucoCoin

  beforeEach(async () => {
    signers = await ethers.getSigners()
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
})