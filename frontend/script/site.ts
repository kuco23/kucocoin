import $ from 'jquery'
import { formatUnits, parseEther } from 'ethers'
import { getLiquidityReserves, buyKuco, getKucoBalance } from './contracts'
import { addKucoCoinToken } from './metamask'
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
  const priceBips = BigInt(100_000_000) * reserves.NAT / reserves.KUCO
  const formattedPrice = formatUnits(priceBips.toString(), 8)
  $('#kuco-price-output').text(formattedPrice)
}

async function onBuyKuco(): Promise<void> {
  $('#button-buy-kuco').on('click', async () => {
    try {
      const amountEthInput = $('#input-kuco-buy-amount').val()!
      const minAmountKucoInput = $('#input-kuco-min-swap').val()!
      const amountEth = parseEther(amountEthInput)
      const minAmountKuco = parseEther(minAmountKucoInput)
      await buyKuco(ethereum, amountEth, minAmountKuco)
    } catch (err: any) {
      alert(err.message)
    }
  })
}

async function updateKucoBalance(): Promise<void> {
  console.log('balance updating')
  const balance = await getKucoBalance(ethereum)
  const formattedBalance = formatUnits(balance.toString(), 18)
  //$('#input-kuco-max-price').val(formattedBalance)
}

$(async () => {
  $('#button-add-kucocoin').on('click', () => addKucoCoinToken(ethereum))
  //await setImmediateInterval(updateKucoBalance, 10_000)
  await setImmediateInterval(updateKucoPrice, 10_000)
  await onBuyKuco()
})