import $ from 'jquery'
import { formatUnits } from 'ethers'
import { globals } from '../shared'
import { getInvestedNat, getKucoCoinBalance } from '../wrappers/contract'
import { WALLET_SLIDE_DURATION_MS } from '../config/display'
import type { MetaMaskInpageProvider } from "@metamask/providers"


export async function displayWallet(ethereum: MetaMaskInpageProvider): Promise<void> {
  if (globals.walletDisplayed) {
    $('#wallet').slideUp(WALLET_SLIDE_DURATION_MS)
    globals.walletDisplayed = false
  } else {
    $('#wallet').slideDown(WALLET_SLIDE_DURATION_MS)
    await displayBalance(ethereum)
    await displayInvested(ethereum)
    displayConnectedAccount()
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
  $('#connected-account-output').text(globals.connectedAccount!)
}