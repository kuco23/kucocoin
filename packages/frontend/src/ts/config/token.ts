import { avalanchefork, avalanche, fuji } from '@kucocoin/contracts/network-info.json'
import { KUCOCOIN_ABI as _KUCOCOIN_ABI } from './abi'

export const KUCOCOIN_ABI = _KUCOCOIN_ABI
export const KUCOCOIN_SYMBOL = "KUCO"
export const KUCOCOIN_DECIMALS = 18
export const KUCOCOIN_LOGO_URL = 'https://github.com/kuco23/kucocoin/blob/monorepo/logo.png'

export const avalancheforkToken = {
  kucocoin: avalanchefork.kucocoin.address,
  uniswap: '',
  snowtrace: '',
  startTradingTimeUnixMs: Number(avalanchefork.kucocoin.params[2]) * 1000,
  endRetractPeriodUnixMs: Number(avalanchefork.kucocoin.params[4]) * 1000
}

export const fujiToken = {
  kucocoin: fuji.kucocoin.address,
  uniswap: `https://testnet.snowtrace.io/address/${fuji.uniswapV2Router.address}/contract/43113/writeContract?chainId=43113#F10`,
  snowtrace: `https://testnet.snowtrace.io/address/${fuji.kucocoin.address}/contract/43113/writeContract?chainId=43113`,
  startTradingTimeUnixMs: Number(fuji.kucocoin.params[2]) * 1000,
  endRetractPeriodUnixMs: Number(fuji.kucocoin.params[4]) * 1000
}

export const avalancheToken = {
  kucocoin: avalanche.kucocoin.address,
  uniswap: `https://app.uniswap.org/explore/tokens/avalanche/${avalanche.kucocoin.address}`,
  snowtrace: `https://snowtrace.io/address/${avalanche.kucocoin.address}/contract/43114/writeContract?chainid=43114`,
  startTradingTimeUnixMs: Number(avalanche.kucocoin.params[2]) * 1000,
  endRetractPeriodUnixMs: Number(avalanche.kucocoin.params[4]) * 1000
}