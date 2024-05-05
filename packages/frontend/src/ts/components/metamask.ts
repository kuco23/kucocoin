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
  if (ethereum !== undefined) {
    const chainId = await getChainId(ethereum)
    if (chainId === NETWORK.metamask.chainId) {
      const accounts = await getAccounts(ethereum)
      if (accounts?.length) {
        vars.connectedAccount = accounts[0]
      }
    }
  }
  await updateMetaMaskConnectionStatus()
}

async function onRequestMetaMaskConnect(): Promise<void> {
  if (ethereum === undefined) {
    window.open('https://metamask.io/', '_blank')
  } else {
    if (await switchNetworkIfNecessary(ethereum)) {
      if (vars.connectedAccount === undefined) {
        const accounts = await requestAccounts(ethereum)
        if (accounts?.length)
          vars.connectedAccount = accounts[0]
      }
    }
  }
  await updateMetaMaskConnectionStatus()
  popup('Connected to Metamask', 'lime')
}

function onMetaMaskChange(): void {
  if (ethereum === undefined) return
  ethereum.on('accountsChanged', async (accounts) => {
    vars.connectedAccount = (accounts as string[])[0]
    await updateMetaMaskConnectionStatus()
  })
  ethereum.on('chainChanged', async chainId => {
    if (chainId !== NETWORK.metamask.chainId) {
      vars.connectedAccount = undefined
    } else {
      const accounts = await getAccounts(ethereum!)
      vars.connectedAccount = accounts[0]
    }
    await updateMetaMaskConnectionStatus()
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

async function updateMetaMaskConnectionStatus(): Promise<void> {
  const connected = vars.connectedAccount !== undefined
  $('#metamask-connect-header > i, #metamask-connect-footer > i')
    .css('color', connected ? '#00FF00' : 'firebrick')
  if (connected) await displayWallet(ethereum!)
}