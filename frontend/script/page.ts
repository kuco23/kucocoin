import $ from 'jquery'
import { formatUnits, parseEther } from 'ethers';
import { costwo, costwoId } from './constants';
import { getKucocoinReserves, buyKucocoin } from './contracts'
import type { MetaMaskInpageProvider } from "@metamask/providers";

declare var window: any
const ethereum: MetaMaskInpageProvider = window.ethereum

async function switchMetamaskNetworkIfNecessary() {
  if (ethereum.networkVersion! !== costwoId.toString()) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: costwo.chainId }]
      })
    } catch (err: any) {
      if (err.code === 4902) { // Chain not added to MetaMask
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [costwo]
        })
      }
    }
  }
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

  // setup metamask network
  await switchMetamaskNetworkIfNecessary()
  // show KUCO price in NAT
  const { 0: reserveKUCO, 1: reserveNAT } = await getKucocoinReserves(ethereum)
  const priceBips = BigInt(10_000) * reserveNAT / reserveKUCO
  const formattedPrice = formatUnits(priceBips.toString(), 4)
  $('#kucocoin-price').text(`KUCO = ${formattedPrice} C2FLR`)
  // implement buy
  $('#kucocoin-buy-button').on('click', async () => {
    const amountInput = $('#kucocoin-buy-input').val()!
    const amount = parseEther(amountInput)
    await buyKucocoin(amount, ethereum)
  })
})