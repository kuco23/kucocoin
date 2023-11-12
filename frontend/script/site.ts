import $ from 'jquery'
import { formatUnits, parseEther } from 'ethers'
import { getLiquidityReserves, buyKuco, getKucoBalance } from './contracts'
import { addKucoCoinToken } from './metamask'
import type { MetaMaskInpageProvider } from "@metamask/providers"

declare const document: any
declare const window: any
declare const alert: any
declare const MutationObserver: any
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

function featherlightAfterContent(imgNode: any): void {
  $(imgNode).css('filter', 'blur(10px)')
  const content = $('#kuco-stage-one-content').html()
  $(content).insertAfter(imgNode)
}

// this is needed because I couldn't find a way to obtain the image
// element at featherlight's afterContent call
function featherlightHook(): void {
  const observer = new MutationObserver(function(mutations: any) {
    mutations.forEach(function(mutation: any) {
      mutation.addedNodes.forEach(function(node: any) {
        if (node.tagName === 'IMG' && $(node).hasClass('featherlight-image'))
          featherlightAfterContent(node)
      })
    })
  })
  observer.observe(document.body, { childList: true, subtree: true });
}

$(async () => {
  $('#button-add-kucocoin').on('click', () => addKucoCoinToken(ethereum))
  featherlightHook()
  await setImmediateInterval(updateKucoPrice, 10_000)
  await onBuyKuco()
})