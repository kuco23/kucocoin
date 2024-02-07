import { NETWORK } from './config/network'
import { KUCOCOIN } from './config/token'
import type { MetaMaskInpageProvider } from "@metamask/providers"


export async function requestAccountsIfNecessary(
  ethereum: MetaMaskInpageProvider
): Promise<string[]> {
  try {
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts',
      params: []
    })
    return accounts as string[]
  } catch (err: any) {
    return []
  }
}

export async function switchNetworkIfNecessary(
  ethereum: MetaMaskInpageProvider
): Promise<boolean> {
  if (ethereum.chainId! !== NETWORK.chainId) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK.chainId }]
      })
    } catch (err: any) {
      // Chain not added to MetaMask
      if (err.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK]
          })
        } catch (err: any) {
          return false
        }
      }
      return false
    }
  }
  return true
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
          address: KUCOCOIN.address,
          symbol: KUCOCOIN.symbol,
          decimals: KUCOCOIN.decimals,
          // image: tokenImage, // A string url of the token logo
        }
      }
    }) as boolean
    return wasAdded
  } catch (err) {
    return false
  }
}