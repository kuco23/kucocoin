# KucoCoin Frontend

This workspace contains the frontend for KucoCoin.

## Icons

Icon library was generated with [icomoon](https://icomoon.io/), see the [stackoverflow answer](https://stackoverflow.com/a/41288167/8456253).

## Testing

You can test the frontend on a locally run avalanche fork, which comes with a funded account specified by the private key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`, which we'll refer to as `PRIVATE_KEY` in the following steps.

1. Setup the `contracts` workspace and:
    - open `.env` and fill in `SIGNER_PRIVATE_KEY=<PRIVATE_KEY>`.
    - run `yarn fork-avalanche`,
    - run `yarn kucocoin-deploy -n avalanchefork`,
    - run `yarn kucocoin-init -n avalanchefork`.

1. Set up Metamask and import the `PRIVATE_KEY`. You may need to delete metamask nonce cache to avoid some future errors.
1. In frontend workspace:
    - navigate to `src/ts/config/network.ts` and update `NETWORK` to `avalanchefork`,
    - navigate to `src/ts/config/token.ts` and update `ADDRESS` to the one displayed after deploying `kucocoin` in step 1,
    - run `yarn serve`.

To configure investment and retract periods, you have to also navigate to `src/ts/config/token.ts` and update `START_TRADING_TIME_UNIX` and `END_RETRACT_PERIOD_UNIX` to the values obtained by running
- `yarn cli get tradingPhaseStart -n avalanchefork`,
- `yarn cli get retractPhaseEnd -n avalanchefork`,

inside `contracts` workspace.