import $ from 'jquery'
import { parseUnits, parseEther, formatUnits } from 'ethers'
import {
  getMsUnixNow, setImmediateSyncInterval, insideViewport,
  setImmediateAsyncInterval, formatUnitsTruncate,
  formatUnixDate, mobileAndTabletCheck,
  scrollTo
} from './utils'
import {
  investInKucoCoin, claimKucoCoin, retractKucoCoin, reportPeriod,
  makeTransAction, getLiquidityReserves, getNextPeriod
} from './wrappers/contract'
import { requestAccounts, requireWalletOnAvalanche } from './wrappers/eip1193'
import { popupSuccess, popupError, loadingStart, loadingEnd } from './components/utils'
import { attachEip6963, ensureOrForceEip1193 } from './components/eip6963'
import { attachWallet, attachWalletInfoRefresher } from './components/wallet'
import { KUCOCOIN_DECIMALS } from './config/token'
import { config } from './config/main'
import {
  MAX_AVAX_DECIMALS_DISPLAY, MAX_KUCOCOIN_DECIMALS_DISPLAY, PRICE_PRECISION,
  PRICE_PRECISION_DIGITS, PRICE_UPDATE_INTERVAL_MS, UNDERLINE_CHECK_INTERVAL_MS
} from './config/display'


declare const window: any
let reserveNat: bigint, reserveKuco: bigint
let nonunderlined: any[]

function adjustForMobile(): void {
  if (mobileAndTabletCheck()) {
    $('.tooltip').removeClass('tooltip')
  }
}

function setPopup(): void {
  $('#windows95-error button').on('click', () => {
    $('#windows95-error').hide()
  })
}

function setLinks(): void {
  $('a[data-title="Snowtrace"]').attr('href', config.token.snowtrace)
  $('a[title="Snowtrace"]').attr('href', config.token.snowtrace)
  $('a[data-title="Uniswap"]').attr('href', config.token.uniswap)
  $('a[title="Uniswap"]').attr('href', config.token.uniswap)
  $('.buy-kucocoin-link').attr('href', config.token.uniswap)
}

function displayKucoStages(): void {
  for (let stage = 1; stage <= 6; stage++) {
    const $stageLayer = $('#kuco-stage-layer')
    const $stageLink = $(`#kuco-stage-${stage}-link`)
    const $stageText = $(`#kuco-stage-${stage}-text`)
    $stageText.hide()
    $stageLink.on('click', () => {
      $('#wrapper').css('filter', 'blur(1.5px)')
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
  const trading = getMsUnixNow() >= config.token.startTradingTimeUnixMs
  switchPhaseBaseContent(trading)
}

function switchPhaseBaseContent(trading: boolean, fade = 0): void {
  $(trading ? 'investment' : 'trading').fadeOut(fade)
  $(trading ? 'trading' : 'investment').fadeIn(fade)
  if (trading) {
    $('#buy-kucocoin').text('Trade KUCO')
    $('#buy-kucocoin').on('click', () => window.open(config.token.uniswap, '_blank'))
  } else {
    $('#buy-kucocoin').text('Invest in KUCO')
    $('#scroll-to-investment, #buy-kucocoin').on('click', () => scrollTo('#invest-claim-retract'))
  }
}

function displayCountdown(tilUnix: number): void {
  const second = 1000
  const minute = second * 60
  const hour = minute * 60
  const day = hour * 24
  let lastUpdated = 0
  const x = setInterval(() => {
    const countdown = new Date(tilUnix).getTime()
    const now = new Date().getTime()
    const distance = countdown - now
    if (distance < 0) {
      clearInterval(x)
      switchPhaseBaseContent(true, 500)
    }
    const seconds = Math.floor((distance % minute) / second)
    $('#countdown-seconds').text(seconds.toString().padStart(2, '0'))
    if (seconds === 59 || now - lastUpdated >= second) {
      const minutes = Math.floor((distance % hour) / minute)
      $('#countdown-minutes').text(minutes.toString().padStart(2, '0'))
      const hours = Math.floor((distance % day) / hour)
      $('#countdown-hours').text(hours.toString().padStart(2, '0'))
      const days = Math.floor(distance / day)
      $('#countdown-days').text(days.toString().padStart(2, '0'))
    }
    lastUpdated = now
  }, second)
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

function onInvestInKucoCoin(): void {
  $('#invest-submit').on('click', async () => {
    try {
      const wallet = await ensureOrForceEip1193()
      loadingStart('invest-claim-retract-interface')
      const amountInput = $('#invest-amount').val()!
      const amount = parseEther(amountInput)
      await requireWalletOnAvalanche(wallet.provider)
      const accounts = await requestAccounts(wallet.provider)
      await investInKucoCoin(wallet.provider, amount, accounts[0])
      popupSuccess('Investment Successful')
    } catch (err: any) {
      popupError("Investment failed", err.message.toString())
    } finally {
      loadingEnd('invest-claim-retract-interface')
    }
  })
}

function onClaimKucoCoin(): void {
  $('#claim-submit').on('click', async () => {
    try {
      const wallet = await ensureOrForceEip1193()
      loadingStart('invest-claim-retract-interface')
      await requireWalletOnAvalanche(wallet.provider)
      const accounts = await requestAccounts(wallet.provider)
      await claimKucoCoin(wallet.provider, accounts[0])
      popupSuccess('Claim was successful')
    } catch (err: any) {
      popupError("Claim failed", err.message)
    } finally {
      loadingEnd('invest-claim-retract-interface')
    }
  })
}

function onRetractKucoCoin(): void {
  function handleRetractEnd(): boolean {
    const retractPhaseEnded = getMsUnixNow() >= config.token.endRetractPeriodUnixMs
    if (retractPhaseEnded) {
      $('#retract-submit-container')
        .attr('data-title', 'Retract period ended')
        .addClass('tooltip fade')
      $('#retract-submit')
        .off('click')
        .css('cursor', 'not-allowed')
    }
    return retractPhaseEnded
  }
  if (handleRetractEnd()) return
  $('#retract-submit').on('click', async () => {
    if (handleRetractEnd()) return
    try {
      const wallet = await ensureOrForceEip1193()
      loadingStart('invest-claim-retract-interface')
      await requireWalletOnAvalanche(wallet.provider)
      const accounts = await requestAccounts(wallet.provider)
      await retractKucoCoin(wallet.provider, accounts[0])
      popupSuccess('Retract was successful')
    } catch (err: any) {
      popupError("Retract failed", err.message)
    } finally {
      loadingEnd('invest-claim-retract-interface')
    }
  })
}

function onMakeTransAction(): void {
  $('#trans-action-button').on('click', async () => {
    try {
      const wallet = await ensureOrForceEip1193()
      loadingStart('trans-action-interface')
      const to = $('#trans-action-address').val()!
      const amountInput = $('#trans-action-amount').val()!
      const amount = parseUnits(amountInput, KUCOCOIN_DECIMALS)
      await requireWalletOnAvalanche(wallet.provider)
      await makeTransAction(wallet.provider, to, amount)
      popupSuccess('Trans Action Successful')
    } catch (err: any) {
      popupError("Trans Action Failed", err.message)
    } finally {
      loadingEnd('trans-action-interface')
    }
  })
}

function onReportPeriod(): void {
  $('#report-period-interface').on('click', async () => {
    try {
      const wallet = await ensureOrForceEip1193()
      loadingStart('report-period-interface')
      await requireWalletOnAvalanche(wallet.provider)
      await reportPeriod(wallet.provider)
      popupSuccess('Period Successfully Reported')
    } catch (err: any) {
      popupError("Period report failed", err.message)
    } finally {
      loadingEnd('report-period-interface')
    }
  })
}

function onGetNextPeriod(): void {
  $('#get-next-period-interface').on('click', async () => {
    try {
      const wallet = await ensureOrForceEip1193()
      loadingStart('get-next-period-interface')
      await requireWalletOnAvalanche(wallet.provider)
      const nextPeriodUnix = await getNextPeriod(wallet.provider)
      const nextPeriod = formatUnixDate(Number(nextPeriodUnix))
      popupSuccess(nextPeriod)
    } catch (err: any) {
      popupError("Period fetching failed", err.message)
    } finally {
      loadingEnd('get-next-period-interface')
    }
  })
}

async function attachPriceUpdater(): Promise<void> {
  await setImmediateAsyncInterval(async () => {
    try {
      loadingStart('price-interface')
      ;({ reserveNat, reserveKuco } = await getLiquidityReserves())
      const priceBips = PRICE_PRECISION * reserveNat / reserveKuco
      loadingEnd('price-interface')
      $('#price-output').text(formatUnits(priceBips, PRICE_PRECISION_DIGITS))
      $('#reserve-output-nat').text(formatUnitsTruncate(reserveNat, config.eip1193.nativeCurrency.decimals, MAX_AVAX_DECIMALS_DISPLAY))
      $('#reserve-output-kuco').text(formatUnitsTruncate(reserveKuco, KUCOCOIN_DECIMALS, MAX_KUCOCOIN_DECIMALS_DISPLAY))
    } catch (err: any) {
      loadingEnd('price-interface')
    }
  }, PRICE_UPDATE_INTERVAL_MS)
}

$(() => {
  adjustForMobile()
  setPopup()
  setLinks()
  attachWallet()
  void attachEip6963()
  displayKucoStages()
  displayPhaseBasedContent()
  attachScrollUnderlining()
  onInvestInKucoCoin()
  onClaimKucoCoin()
  onRetractKucoCoin()
  onReportPeriod()
  onGetNextPeriod()
  onMakeTransAction()
  displayCountdown(config.token.startTradingTimeUnixMs)
  void attachPriceUpdater()
  void attachWalletInfoRefresher()
})
