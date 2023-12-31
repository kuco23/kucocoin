import { network, kucocoin } from './constants'
import type { MetaMaskInpageProvider } from "@metamask/providers"

export async function switchNetworkIfNecessary(
  ethereum: MetaMaskInpageProvider
): Promise<void> {
  if (ethereum.chainId! !== network.chainId) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: network.chainId }]
      })
    } catch (err: any) {
      // Chain not added to MetaMask
      if (err.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [network]
        })
      }
    }
  }
}

export async function addKucoCoinToken(
  ethereum: MetaMaskInpageProvider
): Promise<boolean> {
  try {
    const wasAdded = await ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: kucocoin.address,
          symbol: kucocoin.symbol,
          decimals: kucocoin.decimals,
          // image: tokenImage, // A string url of the token logo
        }
      }
    }) as boolean
    return wasAdded
  } catch (err) {
    return false
  }
}