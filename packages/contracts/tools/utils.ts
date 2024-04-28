import { readFileSync, writeFileSync, existsSync } from 'fs'
import { Contract } from 'ethers'
import { abi as kucocoinAbi } from '../artifacts/src/KucoCoin.sol/KucoCoin.json'
import { abi as uniswapV2RouterAbi } from "../artifacts/src/uniswapV2/UniswapV2Router.sol/UniswapV2Router.json"
import type { Signer, JsonRpcApiProvider } from 'ethers'
import type { KucoCoin, UniswapV2Router } from '../types'


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

export async function readKucocoin(
  kucocoinAddress: string,
  property: string,
  provider: JsonRpcApiProvider
): Promise<bigint> {
  const kucocoin = new Contract(kucocoinAddress, kucocoinAbi, provider) as unknown as KucoCoin
  if (property === "investmentReturnBips") {
    return kucocoin.investmentReturnBips()
  } else if (property === "tradingPhaseStart") {
    return kucocoin.tradingPhaseStart()
  } else if (property === "retractFeeBips") {
    return kucocoin.retractFeeBips()
  } else if (property === "retractPhaseEnd") {
    const tradingStart = await kucocoin.tradingPhaseStart()
    const retractDuration = await kucocoin.retractDuration()
    return tradingStart + retractDuration
  } else {
    throw new Error("unknown property")
  }
}

export async function getUniswapV2Factory(
  routerAddress: string,
  signer: Signer
): Promise<string> {
  const router = new Contract(routerAddress, uniswapV2RouterAbi, signer) as any as UniswapV2Router
  return router.factory()
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