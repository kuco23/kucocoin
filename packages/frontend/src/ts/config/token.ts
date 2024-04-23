import { abi } from '@kucocoin/contracts/artifacts/src/interface/IKucoCoin.sol/IKucoCoin.json' // hardcode when done testing

export const ADDRESS = "0x02df3a3F960393F5B349E40A599FEda91a7cc1A7"
export const SYMBOL = "KUCO"
export const DECIMALS = 18
export const ABI = abi

export const START_TRADING_TIME_UNIX = 1717694210
export const END_RETRACT_PERIOD_UNIX = 1720286214
export const START_TRADING_TIME_UNIX_MS = START_TRADING_TIME_UNIX * 1000
export const END_RETRACT_PERIOD_UNIX_MS = END_RETRACT_PERIOD_UNIX * 1000