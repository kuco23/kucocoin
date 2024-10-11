import type { EIP6963AnnounceProviderEvent } from '@metamask/providers'


declare const window: any

export function eip6963OnPageLoad(fn: (x: EIP6963AnnounceProviderEvent) => Promise<void>): void {

  window.addEventListener(
    "eip6963:announceProvider",
    async (event: EIP6963AnnounceProviderEvent) => {
      await fn(event)
    }
  )

  window.dispatchEvent(new Event("eip6963:requestProvider"))
}