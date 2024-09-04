import $ from 'jquery'
import { formatUnitsTruncate, setImmediateAsyncInterval } from '../utils'
import { getInvestedNat, getKucoCoinBalance } from '../wrappers/contract'
import { globals, ethereum } from '../shared'
import { KUCOCOIN_DECIMALS } from '../config/token'
import {
  MAX_AVAX_DECIMALS_DISPLAY, MAX_KUCOCOIN_DECIMALS_DISPLAY,
  WALLET_INFO_UPDATE_INTERVAL_MS, WALLET_INFO_UPDATE_OFFSET_S, WALLET_SLIDE_DURATION_MS
} from '../config/display'
import type { Eip1193Provider } from 'ethers'


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

export async function refreshWalletInfo(ethereum: Eip1193Provider): Promise<void> {
  if (!globals.walletDisplayed) return
  if (globals.connectedAccount === undefined) {
    $('#wallet').slideUp(WALLET_SLIDE_DURATION_MS)
    return
  }
  const now = Date.now()
  const sinceLastRefresh = now - globals.walletLastRefresh
  if (sinceLastRefresh >= WALLET_INFO_UPDATE_OFFSET_S) {
    displayConnectedAccount()
    await Promise.all([
      displayBalance(ethereum),
      displayInvested(ethereum)
    ])
    globals.walletLastRefresh = now
  }
}

export async function attachWalletInfoRefresher(): Promise<void> {
  await setImmediateAsyncInterval(async () => refreshWalletInfo(ethereum!), WALLET_INFO_UPDATE_INTERVAL_MS)
}

async function toggleWalletDisplay(ethereum: Eip1193Provider): Promise<void> {
  if (globals.walletDisplayed) {
    $('#wallet').slideUp(WALLET_SLIDE_DURATION_MS)
    globals.walletDisplayed = false
  } else {
    $('#wallet').slideDown(WALLET_SLIDE_DURATION_MS)
    globals.walletDisplayed = true
    await refreshWalletInfo(ethereum)
  }
}

async function displayInvested(ethereum: Eip1193Provider): Promise<void> {
  try {
    const invested = await getInvestedNat(ethereum)
    const formatted = formatUnitsTruncate(invested, 18, MAX_AVAX_DECIMALS_DISPLAY)
    $('#kuco-invested-output').text(formatted)
  } catch (err: any) {
    console.log(err.message)
  }
}

async function displayBalance(ethereum: Eip1193Provider): Promise<void> {
  try {
    const balance = await getKucoCoinBalance(ethereum)
    const formatted = formatUnitsTruncate(balance, KUCOCOIN_DECIMALS, MAX_KUCOCOIN_DECIMALS_DISPLAY)
    $('#kuco-balance-output').text(formatted)
  } catch (err: any) {
    console.log(err.message)
  }
}

function displayConnectedAccount(): void {
  const truncatedStart = globals.connectedAccount!.substring(0,7)
  const truncatedEnd = globals.connectedAccount!.substring(37)
  $('#connected-account-output').text(truncatedStart + '...' + truncatedEnd)
}