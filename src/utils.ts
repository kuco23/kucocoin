import { readFileSync, writeFileSync, existsSync } from 'fs'
import { Contract, ethers } from 'ethers'
import { abi as kucocoinAbi, bytecode as kucocoinBytecode } from '../artifacts/contracts/KucoCoin.sol/KucoCoin.json'
import type { Signer } from 'ethers'
import type { KucoCoin, KucoCoin__factory } from '../types'


export async function deployKucocoin(
  uniswapV2: string,
  investmentReturnBips: number,
  investmentDuration: bigint,
  retractFeeBips: number,
  retractDuration: bigint,
  signer: Signer
): Promise<string> {
  const factory = new ethers.ContractFactory(kucocoinAbi, kucocoinBytecode) as KucoCoin__factory
  const kucocoin = await factory.connect(signer).deploy(
    uniswapV2, investmentReturnBips, investmentDuration, retractFeeBips, retractDuration)
  await kucocoin.waitForDeployment()
  return kucocoin.getAddress()
}

export async function initKucocoin(
  kucocoinAddress: string,
  liquidityKuco: bigint,
  liquidityNat: bigint,
  signer: Signer
): Promise<KucoCoin> {
  const kucocoin = new Contract(kucocoinAddress, kucocoinAbi, signer) as unknown as KucoCoin
  await kucocoin.connect(signer).initialize(liquidityKuco, { value: liquidityNat })
  return kucocoin
}

export function storeKucoCoinDeploy(address: string, network: string): void {
  if (!existsSync('deploys.json')) {
      writeFileSync('deploys.json', JSON.stringify({}))
  }
  const addresses = JSON.parse(readFileSync('deploys.json', 'utf8'))
  addresses[network] = address
  writeFileSync('deploys.json', JSON.stringify(addresses, null, 2))
}

export function readKucoCoinDeploy(network: string): string {
  const addresses = JSON.parse(readFileSync('deploys.json', 'utf8'))
  return addresses[network]
}