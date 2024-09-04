import type { EIP6963ProviderDetail } from "@metamask/providers"
import type { Eip1193Provider } from "ethers"

declare const window: any

export const providers: EIP6963ProviderDetail[] = []
export let ethereum: Eip1193Provider | undefined = window.ethereum
export const globals: {
  connectedAccount: string | undefined
  walletDisplayed: boolean,
  walletLastRefresh: number
} = {
  connectedAccount: undefined,
  walletDisplayed: false,
  walletLastRefresh: 0
}