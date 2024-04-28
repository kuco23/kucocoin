import { NETWORK } from './config/network'
import { SYMBOL, DECIMALS } from './config/token'
import type { MetaMaskInpageProvider } from "@metamask/providers"

export async function getChainId(
  ethereum: MetaMaskInpageProvider
): Promise<string> {
  const chainId = await ethereum.request({
    "method": "eth_chainId",
    "params": []
  })
  return chainId! as string
}

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

  if (await getChainId(ethereum) !== NETWORK.metamask.chainId) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK.metamask.chainId }]
      })
    } catch (err: any) {
      // Chain not added to MetaMask
      if (err.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK.metamask]
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
          address: NETWORK.kucocoin,
          symbol: SYMBOL,
          decimals: DECIMALS,
          // image: tokenImage, // A string url of the token logo
        }
      }
    }) as boolean
    return wasAdded
  } catch (err) {
    return false
  }
}