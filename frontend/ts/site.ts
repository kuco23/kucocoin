import $ from 'jquery'
import { formatUnits, parseEther } from 'ethers'
import { POPUP_FADE_IN_MS, POPUP_FADE_OUT_MS, POPUP_SHOW_MS } from './config/display'
import { setImmediateInterval, sleep } from './utils'
import { buyKuco, reportPeriod, getKucoBalance, getLiquidityReserves } from './contract'
import { requestAccountsIfNecessary, switchNetworkIfNecessary, addKucoCoinToken } from './metamask'
import type { MetaMaskInpageProvider } from "@metamask/providers"


declare const window: any
const ethereum: MetaMaskInpageProvider | undefined = window.ethereum

function setKucocoinStageDisplay(): void {
  for (let stage = 1; stage <= 6; stage++) {
    const stageLayer = $('#kuco-stage-layer')
    const stageLink = $(`#kuco-stage-${stage}-link`)
    const stageText = $(`#kuco-stage-${stage}-text`)
    stageText.hide()
    stageLink.on('click', () => {
      $('#wrapper').css('filter', 'blur(5px)')
      stageLayer.fadeIn(1000)
      stageText.fadeIn(1000)
    })
    stageLayer.on('click', () => {
      $('#wrapper').css('filter', '')
      stageLayer.fadeOut(1000)
      stageText.fadeOut(1000)
    })
  }
}

function popup(text: string, color: string): void {
  $('#popup').text(text).css('color', color).fadeIn(POPUP_FADE_IN_MS, () => {
    sleep(POPUP_SHOW_MS).then(() => {
      $('#popup').fadeOut(POPUP_FADE_OUT_MS)
    })
  })
}

function markMetamaskStatus(connected: boolean): void {
  const color = connected ? '#00FF00' : 'firebrick'
  $('#metamask-connect-header > i, #metamask-connect-footer > i').css('color', color)
}

function onMetaMaskConnect(): void {
  const selector = $('#metamask-connect-header, #metamask-connect-footer, #metamask-connect-button')
  selector.on('click', async (): Promise<void> => {
    if (ethereum === undefined) return markMetamaskStatus(false)
    const accounts = await requestAccountsIfNecessary(ethereum)
    if (accounts.length === 0) return markMetamaskStatus(false)
    const networkSwitched = await switchNetworkIfNecessary(ethereum)
    if (!networkSwitched) return markMetamaskStatus(false)
    markMetamaskStatus(true)
  })
}

function onAddKucoCoin(): void {
  $('#add-kucocoin-button').on('click', async () => {
    try {
      await addKucoCoinToken(ethereum!)
    } catch (err: any) {
      console.log(err.message)
    }
  })
}

function onBuyKucoCoin(): void {
  $('#button-buy-kuco').on('click', async () => {
    try {
      const amountEthInput = $('#input-kuco-buy-amount').val()!
      const minAmountKucoInput = $('#input-kuco-min-swap').val()!
      const amountEth = parseEther(amountEthInput)
      const minAmountKuco = parseEther(minAmountKucoInput)
      await buyKuco(ethereum!, amountEth, minAmountKuco)
    } catch (err: any) {
      console.log(err.message)
    }
  })
}

function onReportPeriod(): void {
  $('#report-period-button').on('click', async () => {
    try {
      $('#report-period-button').css('display', 'none')
      $('#report-period-loading').css('display', 'inline-block')
      await reportPeriod(ethereum!)
      $('#report-period-loading').css('display', 'none')
      $('#report-period-button').css('display', 'inline-block')
      popup('Period Successfully Reported', 'lime')
    } catch (err: any) {
      $('#report-period-button').css('display', 'inline-block')
      $('#report-period-loading').css('display', 'none')
      popup('Period Report Failed', 'firebrick')
      console.log(err.message)
    }
  })
}

async function updateKucoPrice(): Promise<void> {
  try {
    const reserves = await getLiquidityReserves()
    const priceBips = BigInt(100_000_000) * reserves.NAT / reserves.KUCO
    const formattedPrice = formatUnits(priceBips.toString(), 8)
    $('#kuco-price-output').text(formattedPrice)
  } catch (err: any) {
    console.log(err.message)
  }
}

async function updateKucoBalance(): Promise<void> {
  const balance = await getKucoBalance(ethereum!)
  const formattedBalance = formatUnits(balance.toString(), 18)
  //$('#input-kuco-max-price').val(formattedBalance)
}

$(async () => {
  setKucocoinStageDisplay()
  onMetaMaskConnect()
  onAddKucoCoin()
  onBuyKucoCoin()
  onReportPeriod()
  await setImmediateInterval(updateKucoPrice, 10_000)
})
