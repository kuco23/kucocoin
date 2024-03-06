import $ from 'jquery'
import { formatUnits } from 'ethers'
import { getInvestedNat, getKucoBalance, getLiquidityReserves, getStage } from '../contract'
import { loadingStart, loadingEnd } from './shared'
import { PRICE_PRECISION, PRICE_PRECISION_DIGITS } from '../config/display'
import type { MetaMaskInpageProvider } from "@metamask/providers"


export async function displayDashboard(ethereum: MetaMaskInpageProvider): Promise<void> {
  await displayPrice()
  await displayBalance(ethereum)
  await displayInvested(ethereum)
  await displayStage(ethereum)
}

export async function displayPrice(): Promise<void> {
  try {
    loadingStart('kuco-price-output')
    const { reserveNat, reserveKuco } = await getLiquidityReserves()
    const priceBips = PRICE_PRECISION * reserveNat / reserveKuco
    loadingEnd('kuco-price-output')
    $('#kuco-price-output').text(formatUnits(priceBips, PRICE_PRECISION_DIGITS))
  } catch (err: any) {
    console.log(err.message)
    loadingEnd('kuco-price-output')
  }
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
    const balance = await getKucoBalance(ethereum)
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