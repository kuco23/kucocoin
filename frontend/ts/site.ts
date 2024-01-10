import $ from 'jquery'
import { formatUnits, parseEther } from 'ethers'
import { getLiquidityReserves, buyKuco, getKucoBalance, getMenses } from './contract'
import { requestAccountsIfNecessary, switchNetworkIfNecessary } from './metamask'
import type { MetaMaskInpageProvider } from "@metamask/providers"

declare const window: any
declare const alert: any
const ethereum: MetaMaskInpageProvider | undefined = window.ethereum

declare const document: any


async function setImmediateInterval(func: () => Promise<any>, interval: number): Promise<void> {
  await func()
  setInterval(func, interval)
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

function onBuyKuco(): void {
  $('#button-buy-kuco').on('click', async () => {
    try {
      const amountEthInput = $('#input-kuco-buy-amount').val()!
      const minAmountKucoInput = $('#input-kuco-min-swap').val()!
      const amountEth = parseEther(amountEthInput)
      const minAmountKuco = parseEther(minAmountKucoInput)
      await buyKuco(ethereum!, amountEth, minAmountKuco)
    } catch (err: any) {
      alert(err.message)
    }
  })
}

async function updateKucoPrice(): Promise<void> {
  const reserves = await getLiquidityReserves()
  const priceBips = BigInt(100_000_000) * reserves.NAT / reserves.KUCO
  const formattedPrice = formatUnits(priceBips.toString(), 8)
  $('#kuco-price-output').text(formattedPrice)
}

async function updateKucoBalance(): Promise<void> {
  const balance = await getKucoBalance(ethereum!)
  const formattedBalance = formatUnits(balance.toString(), 18)
  //$('#input-kuco-max-price').val(formattedBalance)
}

async function onGetMenses(): Promise<void> {
  const account = await requestAccountsIfNecessary(ethereum!)
  const menses = await getMenses(account[0])
  
}

$(async () => {
  // kucocoin stage display
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
  // kucocoin web3 interface
  //$('#button-add-kucocoin').on('click', () => addKucoCoinToken(ethereum))
  onMetaMaskConnect()
  onBuyKuco()
  await setImmediateInterval(updateKucoPrice, 10_000)
})
