import { KUCOCOIN_SYMBOL, KUCOCOIN_DECIMALS, KUCOCOIN_LOGO_URL } from '../config/token'
import { config } from '../config/main'
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
  if (await getChainId(ethereum) !== config.metamask.chainId) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{
          chainId: config.metamask.chainId
        }]
      })
    } catch (err: any) {
      // Chain not added to MetaMask
      if (err.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              ...config.metamask,
              blockExplorerUrls: null
            }],
          })
        } catch (err: any) {
          return false
        }
      } else {
        return false
      }
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
          address: config.token.kucocoin,
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