import type { MetaMaskInpageProvider } from "@metamask/providers"

declare const window: any

export const ethereum: MetaMaskInpageProvider | undefined = window.ethereum
export const vars: {
  connectedAccount: string | undefined
} = {
  connectedAccount: undefined
}