import $ from 'jquery'
import { parseUnits, parseEther, formatUnits } from 'ethers'
import { getMsUnixNow, setImmediateSyncInterval, insideViewport, setImmediateAsyncInterval, formatUnitsTruncate, formatUnixDate } from './utils'
import { investInKucoCoin, claimKucoCoin, retractKucoCoin, reportPeriod, makeTransAction, getLiquidityReserves, getNextPeriod } from './wrappers/contract'
import { requestAccounts, switchNetworkIfNecessary } from './wrappers/metamask'
import { popup, loadingStart, loadingEnd } from './components/utils'
import { attachMetaMask } from './components/metamask'
import { NETWORK } from './config/network'
import { DECIMALS, START_TRADING_TIME_UNIX_MS , END_RETRACT_PERIOD_UNIX_MS } from './config/token'
import { ethereum } from './shared'
import {
  MAX_AVAX_DECIMALS_DISPLAY, MAX_KUCOCOIN_DECIMALS_DISPLAY, PRICE_PRECISION,
  PRICE_PRECISION_DIGITS, PRICE_UPDATE_INTERVAL_MS, UNDERLINE_CHECK_INTERVAL_MS
} from './config/display'


declare const window: any
let reserveNat: bigint, reserveKuco: bigint
let nonunderlined: any[]

function setLinks(): void {
  $('a[title="Snowtrace"]').attr('href', NETWORK.snowtrace)
  $('a[title="Uniswap"]').attr('href', NETWORK.uniswap)
  $('#buy-kucocoin').on('click', () => window.open(NETWORK.uniswap, '_blank'))
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
  getMsUnixNow() >= START_TRADING_TIME_UNIX_MS
    ? $('investment').hide() : $('trading').hide()
}

function displayCountdown(tilUnix: number): void {
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
      $('investment').hide(500)
      $('trading').show(500)
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

function onInvestInKucoCoin(): void {
  $('#invest-submit').on('click', async () => {
    try {
      loadingStart('invest-interface')
      const amountInput = $('#invest-amount').val()!
      const amount = parseEther(amountInput)
      await switchNetworkIfNecessary(ethereum!)
      const accounts = await requestAccounts(ethereum!)
      await investInKucoCoin(ethereum!, amount, accounts[0])
      popup('Investment Successful', 'lime')
    } catch (err: any) {
      popup('Investment Failed', 'firebrick')
      console.log(err.message)
    } finally {
      loadingEnd('invest-interface')
    }
  })
}

function onClaimKucoCoin(): void {
  $('#claim-submit').on('click', async () => {
    try {
      loadingStart('claim-interface')
      await switchNetworkIfNecessary(ethereum!)
      const accounts = await requestAccounts(ethereum!)
      await claimKucoCoin(ethereum!, accounts[0])
      popup('Claim was successful', 'lime')
    } catch (err: any) {
      popup('Claim failed', 'firebrick')
      console.log(err.message)
    } finally {
      loadingEnd('claim-interface')
    }
  })
}

function onRetractKucoCoin(): void {
  function handleRetractEnd(): boolean {
    const retractPhaseEnded = getMsUnixNow() >= END_RETRACT_PERIOD_UNIX_MS
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
      loadingStart('claim-interface')
      await switchNetworkIfNecessary(ethereum!)
      const accounts = await requestAccounts(ethereum!)
      await retractKucoCoin(ethereum!, accounts[0])
      popup('Retract was successful', 'lime')
    } catch (err: any) {
      popup('Retract failed', 'firebrick')
      console.log(err.message)
    } finally {
      loadingEnd('claim-interface')
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

function onGetNextPeriod(): void {
  $('#next-period-date-display').fadeOut()
  $('#get-next-period-interface').on('click', async () => {
    try {
      loadingStart('get-next-period-interface')
      await switchNetworkIfNecessary(ethereum!)
      const nextPeriodUnix = await getNextPeriod(ethereum!)
      const nextPeriod = formatUnixDate(Number(nextPeriodUnix))
      $('#next-period-date-display').fadeIn().text(nextPeriod)
    } catch (err: any) {
      popup('Failed to get next period', 'firebrick')
      console.log(err.message)
    } finally {
      loadingEnd('get-next-period-interface')
    }
  })
}

async function priceUpdater(): Promise<void> {
  await setImmediateAsyncInterval(async () => {
    try {
      loadingStart('price-interface')
      ;({ reserveNat, reserveKuco } = await getLiquidityReserves())
      const priceBips = PRICE_PRECISION * reserveNat / reserveKuco
      loadingEnd('price-interface')
      $('#price-output').text(formatUnits(priceBips, PRICE_PRECISION_DIGITS))
      $('#reserve-output-nat').text(formatUnitsTruncate(reserveNat, NETWORK.metamask.nativeCurrency.decimals, MAX_AVAX_DECIMALS_DISPLAY))
      $('#reserve-output-kuco').text(formatUnitsTruncate(reserveKuco, DECIMALS, MAX_KUCOCOIN_DECIMALS_DISPLAY))
    } catch (err: any) {
      console.log(err.message)
      loadingEnd('price-interface')
    }
  }, PRICE_UPDATE_INTERVAL_MS)
}

$(async () => {
  setLinks()
  displayKucoStages()
  displayPhaseBasedContent()
  attachScrollUnderlining()
  attachMetaMask()
  onInvestInKucoCoin()
  onClaimKucoCoin()
  onRetractKucoCoin()
  onReportPeriod()
  onGetNextPeriod()
  onMakeTransAction()
  displayCountdown(START_TRADING_TIME_UNIX_MS)
  await priceUpdater()
})
