import type { MetaMaskInpageProvider } from "@metamask/providers"

declare const window: any

export const ethereum: MetaMaskInpageProvider | undefined = window.ethereum
export const globals: {
  connectedAccount: string | undefined
  walletDisplayed: boolean,
  walletLastRefresh: number
} = {
  connectedAccount: undefined,
  walletDisplayed: false,
  walletLastRefresh: 0
}