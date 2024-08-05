import { abi } from '@kucocoin/contracts/artifacts/src/interface/IKucoCoin.sol/IKucoCoin.json' // hardcode when done testing

export const KUCOCOIN_SYMBOL = "KUCO"
export const KUCOCOIN_DECIMALS = 18
export const KUCOCOIN_LOGO_URL = 'https://github.com/kuco23/kucocoin/blob/monorepo/logo.png'
export const KUCOCOIN_ABI = abi

// change this if necessary
export const START_TRADING_TIME_UNIX = 1723303532
export const END_RETRACT_PERIOD_UNIX = 1723519532
export const START_TRADING_TIME_UNIX_MS = START_TRADING_TIME_UNIX * 1000
export const END_RETRACT_PERIOD_UNIX_MS = END_RETRACT_PERIOD_UNIX * 1000