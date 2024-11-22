# KucoCoin Contracts

This workspace contains the contracts for the KucoCoin token.

## Testing

Run hardhat tests with
```bash
yarn test test/kucocoin.test.ts
```

## Non-sarcastic KucoCoin economics

KucoCoin investment return interest is set to 5%. This number is chosen because it gives users a chance to profit if they invest and sell up to 4.5% of the total AVAX liquidity on the liquidity pool, otherwise slippage causes negative profits. There is a possibility to sybil small investments with rewards effectively less affected by slippage. Assuming the KucoCoin price does not skyrocket, the amount of small investments would have to be too many to be profitable once avalanche fees are taken into account.