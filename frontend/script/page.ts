import $ from 'jquery'
import { formatUnits, parseEther } from 'ethers'
import { switchNetworkIfNecessary, addKucoCoinToken } from './metamask'
import { network } from './constants'
import { getLiquidityReserves, buyKuco, getKucoBalance } from './contracts'
import type { MetaMaskInpageProvider } from "@metamask/providers"

declare var window: any
declare var alert: any
const ethereum: MetaMaskInpageProvider = window.ethereum

async function setImmediateInterval(func: () => Promise<any>, interval: number): Promise<void> {
  await func()
  setInterval(func, interval)
}

async function updateKucoPrice(): Promise<void> {
  const reserves = await getLiquidityReserves()
  const priceBips = BigInt(10_000) * reserves.NAT / reserves.KUCO
  const formattedPrice = formatUnits(priceBips.toString(), 4)
  $('#kucocoin-price-out').text(`KUCO = ${formattedPrice} ${network.nativeCurrency.symbol}`)
}

async function updateKucoBalance(): Promise<void> {
  try {
    const balance = await getKucoBalance(ethereum)
    const formattedBalance = formatUnits(balance.toString(), 18)
    $('#kucocoin-balance-out').text(`KUCO Balance: ${formattedBalance}`)
  } catch (err: any) {
    $('#kucocoin-balance-out').text(err.message)
  }
}

async function onBuyKuco(): Promise<void> {
  $('#kucocoin-buy-button').on('click', async () => {
    try {
      const amountInput = $('#kucocoin-buy-input').val()!
      const amount = parseEther(amountInput)
      await buyKuco(amount, ethereum)
    } catch (err: any) {
      alert(err.message)
    }
  })
}

$(async () => {
  // transition from type page into kucocoin
  for (const alignment of ['liberal', 'conservative']) {
    const other = alignment === 'liberal' ? 'conservative' : 'liberal'
    $(`#type-${alignment}`).on('mouseenter', 'span', () => {
      $(`#type-${other}`).css('opacity', '.2')
    })
    $(`#type-${alignment}`).on('mouseleave', 'span', () => {
      $(`#type-${other}`).css('opacity', '1')
    })
    $(`#type-${alignment} > span`).on('click', () => {
      $('#type-page').fadeOut(1000, () => {
        $(`#kucocoin-${alignment}-page`).fadeIn(1000)
      })
    })
  }
  // setup metamask handles
  await switchNetworkIfNecessary(ethereum)
  await addKucoCoinToken(ethereum)
  await setImmediateInterval(updateKucoPrice, 10_000)
  await setImmediateInterval(updateKucoBalance, 10_000)
  await onBuyKuco()
})