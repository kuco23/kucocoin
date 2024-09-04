import { providers } from '../shared'
import type { EIP6963AnnounceProviderEvent } from '@metamask/providers'


declare const window: any

export function eip6963OnPageLoad() {

  window.addEventListener(
    "eip6963:announceProvider",
    (event: EIP6963AnnounceProviderEvent) => {
      providers.push(event)
    }
  )

  window.dispatchEvent(new Event("eip6963:requestProvider"))
}