import $ from 'jquery'
import { formatUnits, parseUnits, parseEther } from 'ethers'
import { getUnixNow, sleep, setImmediateAsyncInterval, setImmediateSyncInterval, insideViewport } from './utils'
import {
  investInKucoCoin, claimKucoCoin, retractKucoCoin, buyKuco,
  reportPeriod, getLiquidityReserves, makeTransAction
} from './contract'
import { requestAccountsIfNecessary, switchNetworkIfNecessary, addKucoCoinToken } from './metamask'
import { DECIMALS, START_TRADING_TIME_UNIX_MS } from './config/token'
import {
  POPUP_FADE_IN_MS, POPUP_FADE_OUT_MS, POPUP_SHOW_MS, UNDERLINE_CHECK_INTERVAL_MS,
  PRICE_UPDATE_INTERVAL_MS, PRICE_PRECISION, PRICE_PRECISION_DIGITS
} from './config/display'
import type { MetaMaskInpageProvider } from "@metamask/providers"


declare const window: any
const ethereum: MetaMaskInpageProvider | undefined = window.ethereum

let nonunderlined: any[]

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

function displayPhaseBasedContent(): void {
  getUnixNow() >= START_TRADING_TIME_UNIX_MS
    ? $('investment').hide() : $('trading').hide()
}

function displayCountdown(tilUnix: number, contentId: string): void {
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
      $('investment').hide()
      $('trading').show()
    }
  }, 0)
}

function attachScrollUnderlining(): void {
  nonunderlined = $('.underline').toArray()
  const timeout = setImmediateSyncInterval(() => {
    for (let i = 0; i < nonunderlined.length; i++) {
      const elt = $(nonunderlined[i])
      if (insideViewport(elt)) {
        elt.addClass('underline-active')
        nonunderlined.splice(i, 1)
      }
    }
    if (nonunderlined.length === 0)
      clearInterval(timeout)
  }, UNDERLINE_CHECK_INTERVAL_MS)
}

function onMetaMaskConnect(): void {
  const markMetaMaskStatus = (connected: boolean): void => {
    $('#metamask-connect-header > i, #metamask-connect-footer > i')
    .css('color', connected ? '#00FF00' : 'firebrick')
  }
  $('#metamask-connect-header, #metamask-connect-footer, #metamask-connect-button').on('click', async () => {
    if (ethereum === undefined)
      return markMetaMaskStatus(false)
    const accounts = await requestAccountsIfNecessary(ethereum)
    if (accounts.length === 0)
      return markMetaMaskStatus(false)
    const networkSwitched = await switchNetworkIfNecessary(ethereum)
    if (!networkSwitched)
      return markMetaMaskStatus(false)
    markMetaMaskStatus(true)
    popup('Connected to Metamask', 'lime')
  })
}

function onMetaMaskAddKucoCoin(): void {
  $('#add-kucocoin-button').on('click', async () => {
    try {
      await switchNetworkIfNecessary(ethereum!)
      await addKucoCoinToken(ethereum!)
      popup("KucoCoin added to Metamask", 'lime')
    } catch (err: any) {
      popup("Failed to add KucoCoin to Metamask", 'firebrick')
      console.log(err.message)
    }
  })
}

function onInvestInKucoCoin(): void {
  $('#invest-submit').on('click', async () => {
    try {
      const amountInput = $('#invest-amount').val()!
      const amount = parseEther(amountInput)
      await switchNetworkIfNecessary(ethereum!)
      const accounts = await requestAccountsIfNecessary(ethereum!)
      await investInKucoCoin(ethereum!, amount, accounts[0])
      popup('Investment Successful', 'lime')
    } catch (err: any) {
      popup('Investment Failed', 'firebrick')
      console.log(err.message)
    }
  })
}

function onClaimKucoCoin(): void {
  $('#claim-submit').on('click', async () => {
    try {
      await switchNetworkIfNecessary(ethereum!)
      const accounts = await requestAccountsIfNecessary(ethereum!)
      await claimKucoCoin(ethereum!, accounts[0])
      popup('Claim was successful', 'lime')
    } catch (err: any) {
      popup('Claim failed', 'firebrick')
      console.log(err.message)
    }
  })
}

function onRetractKucoCoin(): void {
  $('#retract-submit').on('click', async () => {
    try {
      await switchNetworkIfNecessary(ethereum!)
      const accounts = await requestAccountsIfNecessary(ethereum!)
      await retractKucoCoin(ethereum!, accounts[0])
      popup('Retract was successful', 'lime')
    } catch (err: any) {
      popup('Retract failed', 'firebrick')
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
      const minAmountKuco = parseUnits(minAmountKucoInput, DECIMALS)
      await switchNetworkIfNecessary(ethereum!)
      await buyKuco(ethereum!, amountEth, minAmountKuco, getUnixNow())
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
      const amount = parseUnits(amountInput, DECIMALS)
      await switchNetworkIfNecessary(ethereum!)
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
      await switchNetworkIfNecessary(ethereum!)
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

async function attachKucoCoinPriceUpdater(): Promise<void> {
  await setImmediateAsyncInterval(async () => {
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

$(async () => {
  displayKucoStages()
  displayPhaseBasedContent()
  attachScrollUnderlining()
  onMetaMaskConnect()
  onMetaMaskAddKucoCoin()
  onInvestInKucoCoin()
  onClaimKucoCoin()
  onRetractKucoCoin()
  onBuyKucoCoin()
  onReportPeriod()
  onMakeTransAction()
  displayCountdown(START_TRADING_TIME_UNIX_MS, 'trading-phase-countdown')
  //await attachKucoCoinPriceUpdater()
})
