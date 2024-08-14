import { NETWORK } from '../config/network'
import { KUCOCOIN_SYMBOL, KUCOCOIN_DECIMALS, KUCOCOIN_LOGO_URL } from '../config/token'
import type { MetaMaskInpageProvider } from "@metamask/providers"

export async function getChainId(
  ethereum: MetaMaskInpageProvider
): Promise<string> {
  try {
    const chainId = await ethereum.request({
      "method": "eth_chainId",
      "params": []
    })
    return chainId! as string
  } catch (err: any) {
    return ''
  }
}

export async function getAccounts(
  ethereum: MetaMaskInpageProvider
): Promise<string[]> {
  try {
    const accounts = await ethereum.request({
      method: 'eth_accounts',
      params: []
    })
    return accounts as string[]
  } catch (err: any) {
    return []
  }
}

export async function requestAccounts(
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

export async function requireMetamaskNetwork(ethereum: MetaMaskInpageProvider): Promise<void> {
  if (!await switchNetworkIfNecessary(ethereum)) {
    throw new Error('Failed to switch network to Avalanche')
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
          address: NETWORK.kucocoin,
          symbol: KUCOCOIN_SYMBOL,
          decimals: KUCOCOIN_DECIMALS,
          image: KUCOCOIN_LOGO_URL
        }
      }
    }) as boolean
    return wasAdded
  } catch (err) {
    return false
  }
}