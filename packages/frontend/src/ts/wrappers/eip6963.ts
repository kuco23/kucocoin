import type { EIP6963AnnounceProviderEvent } from '@metamask/providers'


declare const window: any

export const providers: EIP6963AnnounceProviderEvent[] = []

export function onPageLoad() {

  window.addEventListener(
    "eip6963:announceProvider",
    (event: EIP6963AnnounceProviderEvent) => {
      console.log(event.detail)
    }
  )

  window.dispatchEvent(new Event("eip6963:requestProvider"))
}