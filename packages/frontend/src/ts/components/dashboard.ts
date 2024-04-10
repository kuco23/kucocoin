import $ from 'jquery'
import { formatUnits } from 'ethers'
import { getInvestedNat, getKucoCoinBalance, getStage } from '../contract'
import type { MetaMaskInpageProvider } from "@metamask/providers"


export async function displayDashboard(ethereum: MetaMaskInpageProvider): Promise<void> {
  await displayBalance(ethereum)
  await displayInvested(ethereum)
  await displayStage(ethereum)
}

export async function displayInvested(ethereum: MetaMaskInpageProvider): Promise<void> {
  try {
    const invested = await getInvestedNat(ethereum)
    $('#kuco-invested-output').text(formatUnits(invested, 18))
  } catch (err: any) {
    console.log(err.message)
  }
}

export async function displayBalance(ethereum: MetaMaskInpageProvider): Promise<void> {
  try {
    const balance = await getKucoCoinBalance(ethereum)
    $('#kuco-balance-output').text(formatUnits(balance, 18))
  } catch (err: any) {
    console.log(err.message)
  }
}

export async function displayStage(ethereum: MetaMaskInpageProvider): Promise<void> {
  try {
    const stage = await getStage(ethereum)
    $('#kuco-stage-output').text(stage)
  } catch (err: any) {
    console.log(err.message)
  }
}