import { BrowserProvider, Contract, JsonRpcProvider } from "ethers"
import { KUCOCOIN_ABI } from "../config/token"
import { config } from "../config/main"
import { globals } from "../shared"
import type { AddressLike, JsonRpcApiProvider, Eip1193Provider } from "ethers"
import type { IKucoCoin } from "@kucocoin/contracts/types"


function getKucoCoin(provider: JsonRpcApiProvider): IKucoCoin {
  return new Contract(config.token.kucocoin, KUCOCOIN_ABI, provider) as unknown as IKucoCoin
}

export async function investInKucoCoin(
  ethereum: Eip1193Provider,
  amount: bigint,
  receiver: string,
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).invest(receiver, { value: amount })
}

export async function claimKucoCoin(
  ethereum: Eip1193Provider,
  receiver: string
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).claim(receiver)
}

export async function retractKucoCoin(
  ethereum: Eip1193Provider,
  receiver: string
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).retract(receiver)
}

export async function buyKucoCoin(
  ethereum: Eip1193Provider,
  amount: bigint,
  minKuco: bigint,
  deadline: number
): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).buy(minKuco, signer, deadline, { value: amount })
}

export async function makeTransAction(ethereum: Eip1193Provider, to: AddressLike, amount: bigint): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).makeTransAction(to, amount)
}

export async function reportPeriod(ethereum: Eip1193Provider): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  await kucocoin.connect(signer).reportPeriod()
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// getters

export async function getLiquidityReserves(): Promise<{ reserveKuco: bigint, reserveNat: bigint }> {
  const provider = new JsonRpcProvider(config.metamask.rpcUrls[0])
  const contract = getKucoCoin(provider)
  return contract.getPoolReserves()
}

export async function getInvestedNat(ethereum: Eip1193Provider): Promise<bigint> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  return kucocoin.getInvestedNatOf(signer)
}

export async function getKucoCoinBalance(ethereum: Eip1193Provider): Promise<bigint> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner(globals.connectedAccount)
  const kucocoin = getKucoCoin(provider)
  return kucocoin.balanceOf(signer)
}

export async function getNextPeriod(ethereum: Eip1193Provider): Promise<bigint> {
  const provider = new BrowserProvider(ethereum)
  const kucocoin = getKucoCoin(provider)
  const signer = await provider.getSigner(globals.connectedAccount)
  return kucocoin.connect(signer).nextPeriod()
}