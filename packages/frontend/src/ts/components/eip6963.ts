import $ from 'jquery'
import { eip6963OnPageLoad } from '../wrappers/eip6963'
import { addKucoCoinToken, requestAccounts, switchNetworkIfNecessary, getAccounts, getChainId } from '../wrappers/eip1193'
import { popupSuccess, popupError } from './utils'
import { globals, providers } from '../shared'
import { refreshWalletInfo } from './wallet'
import { config } from '../config/main'
import type { EIP6963AnnounceProviderEvent, EIP6963ProviderDetail, MetaMaskInpageProvider } from '@metamask/providers'


declare const window: any

export async function ensureOrForceEip1193(): Promise<EIP6963ProviderDetail> {
  if (globals.connectedAccount === undefined && providers.length > 0) {
    await onWalletConnectClick(providers[0], false)
  }
  if (globals.connectedAccount !== undefined) {
    return globals.connectedWallet!
  }
  throw new Error('Failed to connect wallet.')
}

export async function attachEip6963() {
  onWalletAddKucoCoin()
  attachMouseEvents()
  eip6963OnPageLoad(onAddedEip6963)
}

async function onAddedEip6963(walletAnnouncment: EIP6963AnnounceProviderEvent) {
  const wallet = walletAnnouncment.detail
  providers.push(wallet)
  addNewWalletOption(wallet)
  onWalletStatusChange(wallet)
  await tryAutomaticallyConnectFirstWallet(wallet)
}

function attachMouseEvents() {
  $('#eip6963-wallet-choice').hide()
  $('#chosen-wallet-header').on({
    mouseenter: () => {
      if (providers.length > 1) {
        $('#eip6963-wallet-choice').slideDown()
      }
    },
    click: () => {
      if (providers.length > 1) {
       $('#eip6963-wallet-choice').slideDown()
      } else if (providers.length === 0) {
        window.open('https://metamask.io/', '_blank')
      } else if (globals.connectedWallet === undefined) {
        onWalletConnectClick(providers[0])
      }
    }
  })
  $('#social-icons-container').on({
    mouseleave: () => $('#eip6963-wallet-choice').slideUp()
  })
}

function addNewWalletOption(wallet: EIP6963ProviderDetail) {
  const eltId = getWalletChoiceElementId(wallet)
  $('#eip6963-wallet-choice').append(`<a id="${eltId}"><img src="${wallet.info.icon}" /></a>`)
  $('#' + eltId).on('click', () => onWalletConnectClick(wallet))
}

async function tryAutomaticallyConnectFirstWallet(wallet: EIP6963ProviderDetail) {
  if (globals.connectedWallet === undefined) {
    const chainId = await getChainId(wallet.provider)
    if (chainId === config.eip1193.chainId) {
      const accounts = await getAccounts(wallet.provider)
      if (accounts?.length) {
        await updateWalletConnectionDisplay(wallet)
        globals.connectedWallet = wallet
        globals.connectedAccount = accounts[0]
        return
      }
    }
  }
}

async function onWalletConnectClick(wallet: EIP6963ProviderDetail, popup = true) {
  if (await switchNetworkIfNecessary(wallet.provider)) {
    if (!isCurrentWallet(wallet) || globals.connectedAccount === undefined) {
      const accounts = await requestAccounts(wallet.provider)
      if (accounts?.length) {
        await updateWalletConnectionDisplay(wallet)
        popup && popupSuccess(`Connected to ${wallet.info.name}`)
        globals.connectedAccount = accounts[0]
        globals.connectedWallet = wallet
      } else {
        popup && popupError(`Failed to detect ${wallet.info.name} account`)
        await updateWalletConnectionDisplay()
      }
    } else {
      popup && popupSuccess(`Already connected to ${wallet.info.name}`)
      await updateWalletConnectionDisplay(wallet)
    }
  } else {
    popup && popupError(`Failed to switch ${wallet.info.name} network to Avalanche`)
    await updateWalletConnectionDisplay()
  }
}

function onWalletStatusChange(wallet: EIP6963ProviderDetail): void {
  const metamask = wallet.provider as MetaMaskInpageProvider
  if (metamask.on === undefined) return // EIP-1193 does no guarantee `on`
  metamask.on('accountsChanged', async (accounts) => {
    if (!isCurrentWallet(wallet)) return
    const chainId = await getChainId(metamask!)
    if (chainId === config.eip1193.chainId) {
      await updateWalletConnectionDisplay(wallet)
      globals.connectedAccount = (accounts as string[])[0]
    } else {
      await updateWalletConnectionDisplay()
      globals.connectedAccount = undefined
      globals.connectedWallet = undefined
    }
    await refreshWalletInfo(metamask!)
  })
  metamask.on('chainChanged', async chainId => {
    if (!isCurrentWallet(wallet)) return
    if (chainId === config.eip1193.chainId) {
      const accounts = await getAccounts(metamask!)
      await updateWalletConnectionDisplay(wallet)
      globals.connectedAccount = accounts[0]
    } else {
      await updateWalletConnectionDisplay()
      globals.connectedAccount = undefined
      globals.connectedWallet = undefined
    }
    await refreshWalletInfo(metamask!)
  })
}

function onWalletAddKucoCoin(): void {
  $('#add-kucocoin-button').on('click', async () => {
    const wallet = globals.connectedWallet!
    try {
      const switched = await switchNetworkIfNecessary(wallet.provider)
      if (switched) {
        const added = await addKucoCoinToken(wallet.provider)
        if (added) {
          popupSuccess(`KucoCoin added to ${wallet.info.name}`)
        } else {
          popupError(`Failed to add KucoCoin to ${wallet.info.name}`)
        }
      } else {
        popupError(`Failed to switch ${wallet.info.name} network to Avalanche`)
      }
    } catch (err: any) {
      popupError(`Failed to add KucoCoin to ${wallet.info.name}`)
      console.log(err.message)
    }
  })
}

async function updateWalletConnectionDisplay(wallet?: EIP6963ProviderDetail) {
  if (wallet === undefined) {
    $('#chosen-icon-wallet-header, #chosen-icon-wallet-footer').hide()
    $('#default-icon-wallet-header, #default-icon-wallet-footer').show()
  } else {
    $('#wallet-name').text(wallet.info.name)
    $('#default-icon-wallet-header, #default-icon-wallet-footer').hide()
    $('#chosen-icon-wallet-header, #chosen-icon-wallet-footer').attr('src', wallet.info.icon).show()
    $('#' + getWalletChoiceElementId(wallet)).hide()
  }
  const previousWallet = globals.connectedWallet
  if (previousWallet !== undefined && (wallet === undefined || !isCurrentWallet(wallet))) {
    $('#' + getWalletChoiceElementId(previousWallet)).show()
  }
}

function isCurrentWallet(wallet: EIP6963ProviderDetail) {
  return globals.connectedWallet?.info.name === wallet.info.name
}

function getWalletChoiceElementId(wallet: EIP6963ProviderDetail) {
  return 'eip6963-wallet-' + wallet.info.name.replace(/\s+/g, '-').toLowerCase()
}