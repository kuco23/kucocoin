import { BrowserProvider, Contract, JsonRpcProvider } from "ethers"
import { kucocoin, network } from "./constants"
import { switchNetworkIfNecessary } from "./metamask"
import type { MetaMaskInpageProvider } from "@metamask/providers"


export async function getLiquidityReserves(): Promise<{ "KUCO": bigint, "NAT": bigint }> {
  const provider = new JsonRpcProvider(network.rpcUrls[0])
  const contract = new Contract(kucocoin.address, kucocoin.abi, provider)
  const { 0: reserveKUCO, 1: reserveNAT } = await contract.getPoolReserves()
  return { "KUCO": reserveKUCO, "NAT": reserveNAT }
}

export async function buyKuco(amount: bigint, ethereum: MetaMaskInpageProvider): Promise<void> {
  await switchNetworkIfNecessary(ethereum)
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const contract = new Contract(kucocoin.address, kucocoin.abi) as any
  await contract.connect(signer).buy({ value: amount })
}

export async function getKucoBalance(): Promise<bigint> {
  const provider = new JsonRpcProvider(network.rpcUrls[0])
  const signer = await provider.getSigner()
  const contract = new Contract(kucocoin.address, kucocoin.abi, provider) as any
  const balance = await contract.balanceOf(signer.getAddress())
  return balance
}