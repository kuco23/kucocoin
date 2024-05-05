import $ from 'jquery'
import { addKucoCoinToken, requestAccounts, switchNetworkIfNecessary, getAccounts, getChainId } from '../wrappers/metamask'
import { popup } from './utils'
import { ethereum, vars } from '../shared'
import { displayWallet } from './wallet'
import { NETWORK } from '../config/network'


declare const window: any

export function attachMetaMask(): void {
  initialMetaMaskStatus()
  onMetaMaskChange()
  $('#metamask-connect-header, #metamask-connect-footer').on('click', async () => {
    await onRequestMetaMaskConnect()
  })
  $('#add-kucocoin-button').on('click', async () => {
    await onMetaMaskAddKucoCoin()
  })
}

async function initialMetaMaskStatus(): Promise<void> {
  if (ethereum === undefined) return
  const chainId = await getChainId(ethereum)
  if (chainId !== NETWORK.metamask.chainId) return
  const accounts = await getAccounts(ethereum)
  if (accounts.length === 0) return
  vars.connectedAccount = accounts[0]
  await markMetaMaskConnected()
}

async function onRequestMetaMaskConnect(): Promise<void> {
  if (ethereum === undefined) {
    window.open('https://metamask.io/', '_blank')
    return await markMetaMaskConnected()
  }
  if (!await switchNetworkIfNecessary(ethereum))
    return await markMetaMaskConnected()
  if (vars.connectedAccount === undefined) {
    const accounts = await requestAccounts(ethereum)
    if (!accounts?.length)
      return await markMetaMaskConnected()
    vars.connectedAccount = accounts[0]
  }
  // execute on-metamask-connect changes
  await markMetaMaskConnected()
  popup('Connected to Metamask', 'lime')
}

function onMetaMaskChange(): void {
  ethereum?.on('accountsChanged', async (accounts) => {
    vars.connectedAccount = (accounts as string[])[0]
    await markMetaMaskConnected()
  })
  ethereum?.on('chainChanged', async chainId => {
    if (chainId !== NETWORK.metamask.chainId) {
      vars.connectedAccount = undefined
      await markMetaMaskConnected()
    } else {
      const accounts = await getAccounts(ethereum!)
      vars.connectedAccount = accounts[0]
      await markMetaMaskConnected()
    }
  })
}

async function onMetaMaskAddKucoCoin(): Promise<void> {
  try {
    await switchNetworkIfNecessary(ethereum!)
    await addKucoCoinToken(ethereum!)
    popup("KucoCoin added to Metamask", 'lime')
  } catch (err: any) {
    popup("Failed to add KucoCoin to Metamask", 'firebrick')
    console.log(err.message)
  }
}

async function markMetaMaskConnected(): Promise<void> {
  const connected = vars.connectedAccount !== undefined
  $('#metamask-connect-header > i, #metamask-connect-footer > i')
    .css('color', connected ? '#00FF00' : 'firebrick')
  if (connected) await displayWallet(ethereum!)

}