import $ from 'jquery'
import { parseUnits, parseEther, formatUnits } from 'ethers'
import { getUnixNow, setImmediateSyncInterval, insideViewport, setImmediateAsyncInterval, swapOutput, formatUnitsTruncate, mulBips } from './utils'
import { investInKucoCoin, claimKucoCoin, retractKucoCoin, buyKucoCoin, reportPeriod, makeTransAction, getLiquidityReserves } from './contract'
import { requestAccountsIfNecessary, switchNetworkIfNecessary, addKucoCoinToken } from './metamask'
import { popup, loadingStart, loadingEnd } from './components/shared'
import { displayDashboard } from './components/dashboard'
import { DECIMALS, START_TRADING_TIME_UNIX_MS } from './config/token'
import { MAX_ALLOWED_BUY_DURATION_MS as MAX_ALLOWED_BUY_DURATION_S, MAX_ALLOWED_SLIPPAGE, MAX_KUCOCOIN_DECIMALS_DISPLAY, PRICE_PRECISION, PRICE_PRECISION_DIGITS, PRICE_UPDATE_INTERVAL_MS, UNDERLINE_CHECK_INTERVAL_MS } from './config/display'
import type { MetaMaskInpageProvider } from "@metamask/providers"


declare const window: any
const ethereum: MetaMaskInpageProvider | undefined = window.ethereum

let reserveNat: bigint, reserveKuco: bigint
let nonunderlined: any[]

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

function onConnectMetaMask(): void {
  $('connected-to-metamask').hide()
  const markMetaMaskStatus = (connected: boolean): void => {
    $('#metamask-connect-header > i, #metamask-connect-footer > i')
    .css('color', connected ? '#00FF00' : 'firebrick')
  }
  $('#metamask-connect-header, #metamask-connect-footer, #dashboard-connect-to-metamask',).on('click', async () => {
    if (ethereum === undefined) {
      window.open('https://metamask.io/', '_blank')
      return markMetaMaskStatus(false)
    }
    const accounts = await requestAccountsIfNecessary(ethereum)
    if (accounts.length === 0)
      return markMetaMaskStatus(false)
    const networkSwitched = await switchNetworkIfNecessary(ethereum)
    if (!networkSwitched)
      return markMetaMaskStatus(false)
    // execute on-metamask-connect changes
    markMetaMaskStatus(true)
    popup('Connected to Metamask', 'lime')
    await displayDashboard(ethereum)
    $('connected-to-metamask').show()
    $('connect-to-metamask').hide()
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
      loadingStart('invest-interface')
      const amountInput = $('#invest-amount').val()!
      const amount = parseEther(amountInput)
      await switchNetworkIfNecessary(ethereum!)
      const accounts = await requestAccountsIfNecessary(ethereum!)
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
      const accounts = await requestAccountsIfNecessary(ethereum!)
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
  $('#kuco-buy-amount').on('input', () => {
    $('#kuco-buy-max-time').val(getUnixNow(MAX_ALLOWED_BUY_DURATION_S))
    if (reserveKuco !== undefined && reserveNat !== undefined) {
      const amountAvax = $('#kuco-buy-amount').val()!
      if (amountAvax !== '') {
        const amountKuco = swapOutput(parseEther(amountAvax), reserveNat, reserveKuco)
        const minAmountKuco = mulBips(amountKuco, 1 - MAX_ALLOWED_SLIPPAGE)
        $('#kuco-buy-min-out').val(formatUnitsTruncate(minAmountKuco, DECIMALS, MAX_KUCOCOIN_DECIMALS_DISPLAY))
      } else {
        $('#kuco-buy-min-out').val('')
      }
    }
  })
  $('#kuco-buy-submit').on('click', async () => {
    try {
      const amountAvax = $('#kuco-buy-amount').val()!
      const minAmountKuco = $('#kuco-buy-min-out').val()!
      const maxBuyTime = $('#kuco-buy-max-time').val()!
      await switchNetworkIfNecessary(ethereum!)
      await buyKucoCoin(ethereum!, parseEther(amountAvax), parseUnits(minAmountKuco, DECIMALS), Number(maxBuyTime))
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

async function priceUpdater(): Promise<void> {
  await setImmediateAsyncInterval(async () => {
    try {
      loadingStart('kuco-price-output')
      ;({ reserveNat, reserveKuco } = await getLiquidityReserves())
      const priceBips = PRICE_PRECISION * reserveNat / reserveKuco
      loadingEnd('kuco-price-output')
      $('#kuco-price-output').text(formatUnits(priceBips, PRICE_PRECISION_DIGITS))
    } catch (err: any) {
      console.log(err.message)
      loadingEnd('kuco-price-output')
    }
  }, PRICE_UPDATE_INTERVAL_MS)
}

$(async () => {
  displayKucoStages()
  displayPhaseBasedContent()
  attachScrollUnderlining()
  onConnectMetaMask()
  onMetaMaskAddKucoCoin()
  onInvestInKucoCoin()
  onClaimKucoCoin()
  onRetractKucoCoin()
  onBuyKucoCoin()
  onReportPeriod()
  onMakeTransAction()
  displayCountdown(START_TRADING_TIME_UNIX_MS)
  await priceUpdater()
})
