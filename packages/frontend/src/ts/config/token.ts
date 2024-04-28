import { abi } from '@kucocoin/contracts/artifacts/src/interface/IKucoCoin.sol/IKucoCoin.json' // hardcode when done testing

export const ADDRESS = "0x6f587509C96c619D74454E8aE1734fB70DF62715"
export const SYMBOL = "KUCO"
export const DECIMALS = 18
export const ABI = abi

export const START_TRADING_TIME_UNIX = 1721936268
export const END_RETRACT_PERIOD_UNIX = 1724528268
export const START_TRADING_TIME_UNIX_MS = START_TRADING_TIME_UNIX * 1000
export const END_RETRACT_PERIOD_UNIX_MS = END_RETRACT_PERIOD_UNIX * 1000