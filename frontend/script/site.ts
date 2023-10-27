import $ from 'jquery'
import { formatUnits, parseEther } from 'ethers'
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
  $('#kuco-price-out').text(formattedPrice)
}

async function updateKucoBalance(): Promise<void> {
  try {
    const balance = await getKucoBalance()
    const formattedBalance = formatUnits(balance.toString(), 18)
    $('#kuco-balance-out').text(`KUCO Balance: ${formattedBalance}`)
  } catch (err: any) {
    $('#kucocoin-balance-out').text(err.message)
  }
}

async function onBuyKuco(): Promise<void> {
  $('#buy-kuco-button').on('click', async () => {
    try {
      const amountInput = $('#buy-kuco-input').val()!
      const amount = parseEther(amountInput)
      await buyKuco(amount, ethereum)
    } catch (err: any) {
      alert(err.message)
    }
  })
}

$(async () => {
  //await addKucoCoinToken(ethereum)
  await setImmediateInterval(updateKucoPrice, 10_000)
  await setImmediateInterval(updateKucoBalance, 10_000)
  await onBuyKuco()
})