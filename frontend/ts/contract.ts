import { BrowserProvider, Contract, JsonRpcProvider } from "ethers"
import { NETWORK } from "./config/network"
import { ADDRESS, ABI } from "./config/token"
import type { MetaMaskInpageProvider } from "@metamask/providers"
import type { AddressLike, JsonRpcApiProvider } from "ethers"
import type { IKucoCoin } from "../../types"


function getKucoCoin(provider: JsonRpcApiProvider): IKucoCoin {
  return new Contract(ADDRESS, ABI, provider) as unknown as IKucoCoin
}

export async function investInKucoCoin(
  ethereum: MetaMaskInpageProvider,
  amount: bigint,
  receiver: string,
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).invest(receiver, { value: amount })
}

export async function claimKucoCoin(
  ethereum: MetaMaskInpageProvider,
  receiver: string
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).claim(receiver)
}

export async function retractKucoCoin(
  ethereum: MetaMaskInpageProvider,
  receiver: string
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).retract(receiver)
}

export async function buyKuco(
  ethereum: MetaMaskInpageProvider,
  amount: bigint,
  minKuco: bigint,
  deadline: number
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).buy(minKuco, signer, deadline, { value: amount })
}

export async function makeTransAction(ethereum: MetaMaskInpageProvider, to: AddressLike, amount: bigint): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).makeTransAction(to, amount)
}

export async function reportPeriod(ethereum: MetaMaskInpageProvider): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).reportPeriod()
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// getters

export async function getLiquidityReserves(): Promise<{ reserveKuco: bigint, reserveNat: bigint }> {
  const provider = new JsonRpcProvider(NETWORK.rpcUrls[0])
  const contract = getKucoCoin(provider)
  return contract.getPoolReserves()
}

export async function getInvestedNat(ethereum: MetaMaskInpageProvider): Promise<bigint> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  const invested =await kucocoin.getInvestedNatOf(signer)
  return invested
}

export async function getKucoBalance(ethereum: MetaMaskInpageProvider): Promise<bigint> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const kucocoin = getKucoCoin(provider)
  return kucocoin.balanceOf(signer)
}

export async function getStage(ethereum: MetaMaskInpageProvider): Promise<string> {
  const provider = new BrowserProvider(ethereum)
  const kucocoin = getKucoCoin(provider)
  return kucocoin.stage()
}