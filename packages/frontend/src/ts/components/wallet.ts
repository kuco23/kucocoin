import $ from 'jquery'
import { formatUnits } from 'ethers'
import { vars } from '../shared'
import { getInvestedNat, getKucoCoinBalance } from '../wrappers/contract'
import type { MetaMaskInpageProvider } from "@metamask/providers"


export async function displayWallet(ethereum: MetaMaskInpageProvider): Promise<void> {
  await displayBalance(ethereum)
  await displayInvested(ethereum)
  displayConnectedAccount()
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
  $('#connected-account-output').text(vars.connectedAccount!)
}