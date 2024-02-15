import $ from 'jquery'
import { formatUnits, parseUnits, parseEther } from 'ethers'
import { setImmediateInterval, sleep } from './utils'
import { buyKuco, reportPeriod, getKucoBalance, getLiquidityReserves, makeTransAction, getTradingPhaseStart } from './contract'
import { requestAccountsIfNecessary, switchNetworkIfNecessary, addKucoCoinToken } from './metamask'
import { KUCOCOIN } from './config/token'
import {
  POPUP_FADE_IN_MS, POPUP_FADE_OUT_MS, POPUP_SHOW_MS,
  PRICE_UPDATE_INTERVAL_MS, PRICE_PRECISION_DIGITS
} from './config/display'
import type { MetaMaskInpageProvider } from "@metamask/providers"


declare const window: any
const ethereum: MetaMaskInpageProvider | undefined = window.ethereum

const PRICE_PRECISION = BigInt(10) ** BigInt(PRICE_PRECISION_DIGITS)

function popup(text: string, color: string): void {
  $('#popup').text(text).css('color', color).fadeIn(POPUP_FADE_IN_MS, () =>
    sleep(POPUP_SHOW_MS).then(() => $('#popup').fadeOut(POPUP_FADE_OUT_MS))
  )
}
function loadingStart(replaceDivId: string) {
  const $replaceDiv = $('#' + replaceDivId)
  const $loaderDiv = $('#' + replaceDivId + '-loader')
  const replaceDivHeight = $replaceDiv.parent().innerHeight()!
  $replaceDiv.hide().after($loaderDiv.innerHeight(replaceDivHeight).show())
}
function loadingEnd(replaceDivId: string): void {
  $('#' + replaceDivId + '-loader').hide()
  $('#' + replaceDivId).show()
}

function displayKucoStages(): void {
  for (let stage = 1; stage <= 6; stage++) {
    const $stageLayer = $('#kuco-stage-layer')
    const $stageLink = $(`#kuco-stage-${stage}-link`)
    const $stageText = $(`#kuco-stage-${stage}-text`)
    $stageText.hide()
    $stageLink.on('click', () => {
      $('#wrapper').css('filter', 'blur(5px)')
      $stageLayer.fadeIn(1000)
      $stageText.fadeIn(1000)
    })
    $stageLayer.on('click', () => {
      $('#wrapper').css('filter', '')
      $stageLayer.fadeOut(1000)
      $stageText.fadeOut(1000)
    })
  }
}

function onMetaMaskConnect(): void {
  const markMetamaskStatus = (connected: boolean): void => {
    $('#metamask-connect-header > i, #metamask-connect-footer > i')
    .css('color', connected ? '#00FF00' : 'firebrick')
  }
  $('#metamask-connect-header, #metamask-connect-footer, #metamask-connect-button').on('click', async () => {
    if (ethereum === undefined)
      return markMetamaskStatus(false)
    const accounts = await requestAccountsIfNecessary(ethereum)
    if (accounts.length === 0)
      return markMetamaskStatus(false)
    const networkSwitched = await switchNetworkIfNecessary(ethereum)
    if (!networkSwitched)
      return markMetamaskStatus(false)
    markMetamaskStatus(true)
    popup('Connected to Metamask', 'lime')
  })
}

function onAddKucoCoin(): void {
  $('#add-kucocoin-button').on('click', async () => {
    try {
      await addKucoCoinToken(ethereum!)
      popup("KucoCoin added to Metamask", 'lime')
    } catch (err: any) {
      popup("Failed to add KucoCoin to Metamask", 'firebrick')
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
      const minAmountKuco = parseUnits(minAmountKucoInput, KUCOCOIN.decimals)
      await buyKuco(ethereum!, amountEth, minAmountKuco)
      popup('KucoCoin Purchase Successful', 'lime')
    } catch (err: any) {
      popup('KucoCoin Purchase Failed', 'firebrick')
      console.log(err.message)
    }
  })
}

function onMakeTransAction(): void {
  $('#trans-action-button').on('click', async () => {
    try {
      loadingStart('trans-action-interface')
      const to = $('#trans-action-address').val()!
      const amountInput = $('#trans-action-amount').val()!
      const amount = parseUnits(amountInput, KUCOCOIN.decimals)
      await makeTransAction(ethereum!, to, amount)
      popup('Trans Action Successful', 'lime')
    } catch (err: any) {
      popup('Trans Action Failed', 'firebrick')
      console.log(err)
    } finally {
      loadingEnd('trans-action-interface')
    }
  })
}

function onReportPeriod(): void {
  $('#report-period-interface').on('click', async () => {
    try {
      loadingStart('report-period-interface')
      await reportPeriod(ethereum!)
      popup('Period Successfully Reported', 'lime')
    } catch (err: any) {
      popup('Period Report Failed', 'firebrick')
      console.log(err.message)
    } finally {
      loadingEnd('report-period-interface')
    }
  })
}

function attachCountDown(tilUnix: number, contentId: string): void {
  const second = 1000
  const minute = second * 60
  const hour = minute * 60
  const day = hour * 24

  const x = setInterval(() => {
    const countdown = new Date(tilUnix).getTime()
    const now = new Date().getTime()
    const distance = countdown - now
    $('#days').text(Math.floor(distance / day))
    $('#hours').text(Math.floor((distance % day) / hour))
    $('#minutes').text(Math.floor((distance % hour) / minute))
    $('#seconds').text(Math.floor((distance % minute) / second))
    if (distance < 0) {
      clearInterval(x)
      $('#' + contentId).hide()
      $('#content').show()
    }
  }, 0)
}

async function attachTradingPhaseCountDown(): Promise<void> {
  const tradingPhaseStart = await getTradingPhaseStart()
  attachCountDown(1000 * Number(tradingPhaseStart) + 172800000, 'trading-phase-countdown')
}

async function updateKucoBalance(): Promise<void> {
  const balance = await getKucoBalance(ethereum!)
  const formattedBalance = formatUnits(balance, 18)
  //$('#input-kuco-max-price').val(formattedBalance)
}

async function attachKucoCoinPriceUpdater(): Promise<void> {
  await setImmediateInterval(async () => {
    try {
      loadingStart('kuco-price-output')
      const reserves = await getLiquidityReserves()
      const priceBips = PRICE_PRECISION * reserves.NAT / reserves.KUCO
      const formattedPrice = formatUnits(priceBips, PRICE_PRECISION_DIGITS)
      loadingEnd('kuco-price-output')
      $('#kuco-price-output').text(`Price on the KucoCoin DEX: ${formattedPrice} AVAX per KUCO`)
    } catch (err: any) {
      console.log(err.message)
    }
  }, PRICE_UPDATE_INTERVAL_MS)
}

async function adaptToPhase(): Promise<void> {
  const epochs = await getTradingPhaseStart()
}

$(async () => {
  displayKucoStages()
  onMetaMaskConnect()
  onAddKucoCoin()
  onBuyKucoCoin()
  onReportPeriod()
  onMakeTransAction()
  await attachTradingPhaseCountDown()
  //await attachKucoCoinPriceUpdater()
})
