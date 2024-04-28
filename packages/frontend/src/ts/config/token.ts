import { abi } from '@kucocoin/contracts/artifacts/src/interface/IKucoCoin.sol/IKucoCoin.json' // hardcode when done testing

export const SYMBOL = "KUCO"
export const DECIMALS = 18
export const ABI = abi

// change this if necessary
export const START_TRADING_TIME_UNIX = 1722099696
export const END_RETRACT_PERIOD_UNIX = 1724691696
export const START_TRADING_TIME_UNIX_MS = START_TRADING_TIME_UNIX * 1000
export const END_RETRACT_PERIOD_UNIX_MS = END_RETRACT_PERIOD_UNIX * 1000