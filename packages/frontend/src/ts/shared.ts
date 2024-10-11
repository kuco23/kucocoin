import type { EIP6963ProviderDetail } from "@metamask/providers"

export const providers: EIP6963ProviderDetail[] = []

export const globals: {
  connectedAccount: string | undefined
  walletDisplayed: boolean
  walletLastRefresh: number
  connectedWallet: EIP6963ProviderDetail | undefined
} = {
  connectedAccount: undefined,
  walletDisplayed: false,
  walletLastRefresh: 0,
  connectedWallet: undefined
}