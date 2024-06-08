import $ from 'jquery'
import { addKucoCoinToken, requestAccounts, switchNetworkIfNecessary, getAccounts, getChainId } from '../wrappers/metamask'
import { popupSuccess, popupError } from './utils'
import { ethereum, globals } from '../shared'
import { walletSelector, refreshWalletInfo } from './wallet'
import { NETWORK } from '../config/network'


declare const window: any
const metamaskSelector = '#metamask-connect-header, #metamask-connect-footer'

export async function attachMetaMask(): Promise<void> {
  await initialMetaMaskStatus()
  onMetaMaskClick()
  onMetaMaskChange()
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
        return updateConnectionDisplay(true)
      }
    }
  }
  await updateConnectionDisplay(false)
}

async function onMetaMaskClick(): Promise<void> {
  $(metamaskSelector).on('click', async () => {
    if (globals.connectedAccount !== undefined) {
      return updateConnectionDisplay(true)
    }
    if (ethereum === undefined) {
      window.open('https://metamask.io/', '_blank')
    } else {
      if (await switchNetworkIfNecessary(ethereum)) {
        if (globals.connectedAccount === undefined) {
          const accounts = await requestAccounts(ethereum)
          if (accounts?.length) {
            globals.connectedAccount = accounts[0]
            await updateConnectionDisplay(true)
            popupSuccess('Connected to Metamask')
          } else {
            popupError('Failed to detect Metamask account')
            await updateConnectionDisplay(false)
          }
        } else {
          popupSuccess('Already connected to Metamask')
          await updateConnectionDisplay(false)
        }
      } else {
        popupError('Failed to switch network to Avalanche')
        await updateConnectionDisplay(false)
      }
    }
  })
}

function onMetaMaskChange(): void {
  if (ethereum === undefined) return
  ethereum.on('accountsChanged', async (accounts) => {
    const chainId = await getChainId(ethereum!)
    if (chainId === NETWORK.metamask.chainId) {
      globals.connectedAccount = (accounts as string[])[0]
      await updateConnectionDisplay(true)
    } else {
      globals.connectedAccount = undefined
      await updateConnectionDisplay(false)
    }
    await refreshWalletInfo(ethereum!)
  })
  ethereum.on('chainChanged', async chainId => {
    if (chainId === NETWORK.metamask.chainId) {
      const accounts = await getAccounts(ethereum!)
      globals.connectedAccount = accounts[0]
      await updateConnectionDisplay(true)
    } else {
      globals.connectedAccount = undefined
      await updateConnectionDisplay(false)
    }
    await refreshWalletInfo(ethereum!)
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

async function updateConnectionDisplay(connected: boolean): Promise<void> {
  if (connected) {
    $(walletSelector).show()
    $(metamaskSelector).hide()
  } else {
    $(walletSelector).hide()
    $(metamaskSelector).show()
  }
}