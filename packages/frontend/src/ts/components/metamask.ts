import $ from 'jquery'
import { addKucoCoinToken, requestAccounts, switchNetworkIfNecessary, getAccounts, getChainId } from '../wrappers/metamask'
import { popupSuccess, popupError } from './utils'
import { ethereum, globals } from '../shared'
import { displayWallet, refreshWallet } from './wallet'
import { NETWORK } from '../config/network'


declare const window: any

export function attachMetaMask(): void {
  initialMetaMaskStatus()
  onMetaMaskChange()
  $('#metamask-connect-header, #metamask-connect-footer').on('click', async () => {
    if (globals.connectedAccount === undefined) {
      await onRequestMetaMaskConnect()
    } else {
      await displayWallet(ethereum!)
    }
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
        globals.connectedAccount = accounts[0]
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
      if (globals.connectedAccount === undefined) {
        const accounts = await requestAccounts(ethereum)
        if (accounts?.length) {
          globals.connectedAccount = accounts[0]
          popupSuccess('Connected to Metamask')
        }
      } else {
        popupSuccess('Already connected to Metamask')
      }
    } else {
      popupError('Failed to switch network to Avalanche')
    }
  }
  await refreshWallet(ethereum!)
  await updateMetaMaskConnectionStatus()
}

function onMetaMaskChange(): void {
  if (ethereum === undefined) return
  ethereum.on('accountsChanged', async (accounts) => {
    const chainId = await getChainId(ethereum!)
    if (chainId === NETWORK.metamask.chainId) {
      globals.connectedAccount = (accounts as string[])[0]
    } else {
      globals.connectedAccount = undefined
    }
    await refreshWallet(ethereum!)
    await updateMetaMaskConnectionStatus()
  })
  ethereum.on('chainChanged', async chainId => {
    if (chainId !== NETWORK.metamask.chainId) {
      globals.connectedAccount = undefined
    } else {
      const accounts = await getAccounts(ethereum!)
      globals.connectedAccount = accounts[0]
    }
    await refreshWallet(ethereum!)
    await updateMetaMaskConnectionStatus()
  })
}

async function onMetaMaskAddKucoCoin(): Promise<void> {
  try {
    const switched = await switchNetworkIfNecessary(ethereum!)
    if (switched) {
      const added = await addKucoCoinToken(ethereum!)
      if (added) {
        popupSuccess("KucoCoin added to Metamask")
      } else {
        popupError("Failed to add KucoCoin to Metamask")
      }
    } else {
      popupError("Failed to switch network to Avalanche")
    }
  } catch (err: any) {
    popupError("Failed to add KucoCoin to Metamask")
    console.log(err.message)
  }
}

async function updateMetaMaskConnectionStatus(): Promise<void> {
  const connected = globals.connectedAccount !== undefined
  $('span.icon-metamask').css({
    'box-shadow': '0px 0px 20px 5px ' + (connected ? '#00FF00' : 'firebrick'),
    'background-color': connected ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'
  })
}