import $ from 'jquery'
import { formatUnits } from 'ethers'
import { setImmediateAsyncInterval } from '../utils'
import { getInvestedNat, getKucoCoinBalance } from '../wrappers/contract'
import { globals, ethereum } from '../shared'
import { WALLET_INFO_UPDATE_INTERVAL_MS, WALLET_SLIDE_DURATION_MS } from '../config/display'
import type { MetaMaskInpageProvider } from "@metamask/providers"

export const walletSelector = '#wallet-button-header, #wallet-button-footer'

export function attachWallet(): void {
  $('#wallet').hide()
  $('#wallet-exit-button').on('click', () => {
    $('#wallet').slideUp(WALLET_SLIDE_DURATION_MS)
    globals.walletDisplayed = false
  })
  $(walletSelector).on('click', async () => {
    await toggleWalletDisplay(ethereum!)
  })
}

export async function refreshWalletInfo(ethereum: MetaMaskInpageProvider): Promise<void> {
  if (globals.connectedAccount === undefined) {
    $('#wallet').slideUp(WALLET_SLIDE_DURATION_MS)
  } else {
    displayConnectedAccount()
    await Promise.all([
      displayBalance(ethereum),
      displayInvested(ethereum)
    ])
  }
}

export async function attachWalletInfoRefresher(): Promise<void> {
  await setImmediateAsyncInterval(async () => {
    if (globals.walletDisplayed) {
      await refreshWalletInfo(ethereum!)
    }
  }, WALLET_INFO_UPDATE_INTERVAL_MS)
}

async function toggleWalletDisplay(ethereum: MetaMaskInpageProvider): Promise<void> {
  if (globals.walletDisplayed) {
    $('#wallet').slideUp(WALLET_SLIDE_DURATION_MS)
    globals.walletDisplayed = false
  } else {
    $('#wallet').slideDown(WALLET_SLIDE_DURATION_MS)
    await refreshWalletInfo(ethereum)
    globals.walletDisplayed = true
  }
}

async function displayInvested(ethereum: MetaMaskInpageProvider): Promise<void> {
  try {
    const invested = await getInvestedNat(ethereum)
    $('#kuco-invested-output').text(formatUnits(invested, 18))
  } catch (err: any) {
    console.log(err.message)
  }
}

async function displayBalance(ethereum: MetaMaskInpageProvider): Promise<void> {
  try {
    const balance = await getKucoCoinBalance(ethereum)
    $('#kuco-balance-output').text(formatUnits(balance, 18))
  } catch (err: any) {
    console.log(err.message)
  }
}

function displayConnectedAccount(): void {
  const truncatedStart = globals.connectedAccount!.substring(0,7)
  const truncatedEnd = globals.connectedAccount!.substring(37)
  $('#connected-account-output').text(truncatedStart + '...' + truncatedEnd)
}