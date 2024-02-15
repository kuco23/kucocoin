import { BrowserProvider, Contract, JsonRpcProvider } from "ethers"
import { NETWORK } from "./config/network"
import { KUCOCOIN } from "./config/token"
import { switchNetworkIfNecessary } from "./metamask"
import type { MetaMaskInpageProvider } from "@metamask/providers"
import type { AddressLike } from "ethers"


export async function getLiquidityReserves(): Promise<{ KUCO: bigint, NAT: bigint }> {
  const provider = new JsonRpcProvider(NETWORK.rpcUrls[0])
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi, provider)
  const { 0: reserveKUCO, 1: reserveNAT } = await contract.getPoolReserves()
  return { KUCO: reserveKUCO, NAT: reserveNAT }
}

export async function buyKuco(
  ethereum: MetaMaskInpageProvider,
  amount: bigint, minKuco: bigint
): Promise<void> {
  await switchNetworkIfNecessary(ethereum)
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi) as any
  await contract.connect(signer).buy(signer, minKuco, { value: amount })
}

export async function makeTransAction(ethereum: MetaMaskInpageProvider, to: AddressLike, amount: bigint): Promise<void> {
  await switchNetworkIfNecessary(ethereum)
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi) as any
  await contract.connect(signer).makeTransAction(to, amount)
}

export async function reportPeriod(ethereum: MetaMaskInpageProvider): Promise<void> {
  await switchNetworkIfNecessary(ethereum)
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi) as any
  await contract.connect(signer).reportPeriod()
}

export async function getKucoBalance(ethereum: MetaMaskInpageProvider): Promise<bigint> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi, provider)
  const balance = await contract.balanceOf(signer.getAddress())
  return balance
}

export async function getPeriodHistory(address: AddressLike): Promise<bigint[]> {
  const provider = new JsonRpcProvider(NETWORK.rpcUrls[0])
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi, provider)
  const periodHistory = await contract.getPeriodHistory(address)
  return periodHistory
}

export async function getStage(address: AddressLike): Promise<bigint> {
  const provider = new JsonRpcProvider(NETWORK.rpcUrls[0])
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi, provider)
  const stage = await contract.getStageOf(address)
  return stage
}

export async function getTradingPhaseStart(): Promise<bigint> {
  const provider = new JsonRpcProvider(NETWORK.rpcUrls[0])
  const contract = new Contract(KUCOCOIN.address, KUCOCOIN.abi, provider)
  return contract.tradingPhaseStart()
}