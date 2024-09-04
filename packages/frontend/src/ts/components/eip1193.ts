import $ from 'jquery'
import { addKucoCoinToken, requestAccounts, switchNetworkIfNecessary, getAccounts, getChainId } from '../wrappers/eip1193'
import { popupSuccess, popupError } from './utils'
import { ethereum, globals } from '../shared'
import { walletSelector, refreshWalletInfo } from './wallet'
import { config } from '../config/main'
import type { MetaMaskInpageProvider } from '@metamask/providers'


declare const window: any
const metamaskSelector = '#metamask-connect-header, #metamask-connect-footer'

export async function attachEip1193(): Promise<void> {
  await initialWalletConnectStatus()
  onWalletConnectClick()
  onWalletStatusChange()
  onWalletAddKucoCoin()
}

async function initialWalletConnectStatus(): Promise<void> {
  if (ethereum !== undefined) {
    const chainId = await getChainId(ethereum)
    if (chainId === config.metamask.chainId) {
      const accounts = await getAccounts(ethereum)
      if (accounts?.length) {
        globals.connectedAccount = accounts[0]
        return updateWalletConnectionDisplay(true)
      }
    }
  }
  await updateWalletConnectionDisplay(false)
}

async function onWalletConnectClick(): Promise<void> {
  $(metamaskSelector).on('click', async () => {
    if (globals.connectedAccount !== undefined) {
      return updateWalletConnectionDisplay(true)
    }
    if (ethereum === undefined) {
      window.open('https://metamask.io/', '_blank')
    } else {
      if (await switchNetworkIfNecessary(ethereum)) {
        if (globals.connectedAccount === undefined) {
          const accounts = await requestAccounts(ethereum)
          if (accounts?.length) {
            globals.connectedAccount = accounts[0]
            await updateWalletConnectionDisplay(true)
            popupSuccess('Connected to Metamask')
          } else {
            popupError('Failed to detect Metamask account')
            await updateWalletConnectionDisplay(false)
          }
        } else {
          popupSuccess('Already connected to Metamask')
          await updateWalletConnectionDisplay(false)
        }
      } else {
        popupError('Failed to switch network to Avalanche')
        await updateWalletConnectionDisplay(false)
      }
    }
  })
}

function onWalletStatusChange(): void {
  if (ethereum === undefined) return
  const metamask = ethereum as MetaMaskInpageProvider
  if (metamask.on === undefined) return // EIP-1193 does no guarantee `on`
  metamask.on('accountsChanged', async (accounts) => {
    const chainId = await getChainId(metamask!)
    if (chainId === config.metamask.chainId) {
      globals.connectedAccount = (accounts as string[])[0]
      await updateWalletConnectionDisplay(true)
    } else {
      globals.connectedAccount = undefined
      await updateWalletConnectionDisplay(false)
    }
    await refreshWalletInfo(metamask!)
  })
  metamask.on('chainChanged', async chainId => {
    if (chainId === config.metamask.chainId) {
      const accounts = await getAccounts(metamask!)
      globals.connectedAccount = accounts[0]
      await updateWalletConnectionDisplay(true)
    } else {
      globals.connectedAccount = undefined
      await updateWalletConnectionDisplay(false)
    }
    await refreshWalletInfo(metamask!)
  })
}

function onWalletAddKucoCoin(): void {
  $('#add-kucocoin-button').on('click', async () => {
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
  })
}

async function updateWalletConnectionDisplay(connected: boolean): Promise<void> {
  if (connected) {
    $(walletSelector).show()
    $(metamaskSelector).hide()
  } else {
    $(walletSelector).hide()
    $(metamaskSelector).show()
  }
}