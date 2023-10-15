import { BrowserProvider, Contract } from "ethers"
import { kucocoinAbi, kucocoinAddress } from "./constants"
import type { MetaMaskInpageProvider } from "@metamask/providers";


export async function getKucocoinReserves(ethereum: MetaMaskInpageProvider): Promise<[bigint, bigint]> {
  const provider = new BrowserProvider(ethereum)
  const contract = new Contract(kucocoinAddress, kucocoinAbi, provider)
  const reserves = await contract.getPoolReserves()
  return reserves
}

export async function buyKucocoin(amount: bigint, ethereum: MetaMaskInpageProvider): Promise<void> {
  const provider = new BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const contract = new Contract(kucocoinAddress, kucocoinAbi) as any
  await contract.connect(signer).buy({ value: amount })
}