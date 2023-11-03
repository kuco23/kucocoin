require('dotenv').config()
import fs from 'fs'
import { ethers } from 'ethers'
import { abi as kucocoinAbi, bytecode as kucocoinBytecode } from '../artifacts/contracts/KucoCoin.sol/KucoCoin.json'
import type { KucoCoin } from '../types'

const signerPvk = process.env.SIGNER_PRIVATE_KEY!
const providerRpc = process.env.PROVIDER_RPC!
const network = process.env.NETWORK!

const addresses = JSON.parse(fs.readFileSync('./addresses.json').toString())[network]

const provider = new ethers.JsonRpcProvider(providerRpc)
const signer = new ethers.Wallet(signerPvk, provider)

async function deployKucocoin(): Promise<ethers.BaseContract> {
  const kucocoinFactory = new ethers.ContractFactory(kucocoinAbi, kucocoinBytecode)
  const kucocoin = await kucocoinFactory.connect(signer).deploy(addresses.WNat, addresses.BlazeSwapRouter)
  await kucocoin.waitForDeployment()
  const kucocoinAddress = await kucocoin.getAddress()
  console.log(`KucoCoin deployed at ${kucocoinAddress}`)
  return kucocoin
}

async function addLiquidity(amountKucocoin: bigint, amountNAT: bigint): Promise<void> {
  const kucocoin = new ethers.Contract(addresses.KucoCoin, kucocoinAbi) as unknown as KucoCoin
  await kucocoin.connect(signer).addLiquidity(amountKucocoin, { value: amountNAT })
}

async function buyKucocoin(amountNAT: bigint, minKuco: bigint): Promise<void> {
  const kucocoin = new ethers.Contract(addresses.KucoCoin, kucocoinAbi) as unknown as KucoCoin
  await kucocoin.connect(signer).buy(signer, minKuco, { value: amountNAT })
}



//deployKucocoin()
addLiquidity(ethers.parseEther("100"), ethers.parseEther("10"))
//buyKucocoin(ethers.parseEther("0.0001"), BigInt(0))