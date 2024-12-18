# Kuco Coin

This is an implementation of a non-meme token on Avalanche. It has real world functionalities, like things and such, so it's definitely not a pyramid scheme. The code has been audited by the author during implementation.

## Thanks to
- Avalanche for honestly being the best chain,
- Uniswap for deploying their V2 on Avalanche,
- People that developed [Namari](https://onepagelove.com/namari) for their free template hacked into KucoCoin frontend,
- To tis guy for [this awesome pen](https://codepen.io/Rplus/pen/abPLGx),
- To this guy for the [spiral animation](https://jsfiddle.net/j08691/CKWrN/),
- To this guy for the [windows95 error tab in css](https://codepen.io/jkantner/pen/oNypPOZ),
- To this guy that updated [UniwapV2 for Solidity 0.8.4](https://github.com/islishude/uniswapv2-solc0.8).

## Deploying contracts + frontend

To deploy the contract and frontend, do the following:

1. Obtain an account funded with enough AVAX (or test AVAX), then copy the private key inside `packages/contracts/.env` under the name `SIGNER_PRIVATE_KEY`,
1. Move to `packages/contracts` and do:
    - `yarn install`,
    - `yarn compile`,
    - `yarn cli deploy <investmentInterestBips> <investmentPhaseStartUnix> <retractFeeBips> <retractPhaseEndUnix> --network <avalanche|fuji>`,
    - `yarn cli init <liquidityKUCO> <liquidityAVAX> --network <avalanche|fuji>`,
    - `yarn hardhat verify <kucocoin-address> <uniswap-address> <investmentInterestBips> <investmentPhaseStartUnix> <retractFeeBips> <retractPhaseEndUnix> --network <avalanche|fuji>`,
    - replace `network-info.json` with relevant information about your deploy.
1. Move to `packages/frontend` and do:
    - `yarn install`,
    - navigate to `src/ts/config/network.ts` and update `network` to the network you deployed on,
    - `yarn serve` to see frontend on `localhost:1234`,
    - `yarn deploy` to deploy frontend on `gh-pages` (need to set that up on github tho).

> **Note**
> If you change `<investmentInterestBips>` or `<retractFeeBips>` you have to manually find the sections in `packages/frontend/index.html` where those values are directly referenced (in `kuconomics` section).

## Testing on forked avalanche mainnet

You can test the frontend on a locally run avalanche fork, which comes with a funded account specified by the private key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`, which we'll refer to as `PRIVATE_KEY` in the following steps.

1. Setup the `contracts` workspace and:
    - open `.env` and fill in `SIGNER_PRIVATE_KEY=<PRIVATE_KEY>`.
    - run `yarn fork-avalanche`,
    - run `yarn kucocoin-deploy -n avalanchefork`,
    - run `yarn kucocoin-init -n avalanchefork`.

1. Set up Metamask and import the `PRIVATE_KEY`. You may need to delete metamask nonce cache to avoid some future errors.
1. In frontend workspace:
    - navigate to `src/ts/config/network.ts` and update `NETWORK` to `avalanchefork`,
    - run `yarn serve`.

To configure investment and retract periods, you have to also navigate to `src/ts/config/token.ts` and update `START_TRADING_TIME_UNIX` and `END_RETRACT_PERIOD_UNIX` to the values obtained by running
- `yarn cli get tradingPhaseStart -n avalanchefork`,
- `yarn cli get retractPhaseEnd -n avalanchefork`,

inside `contracts` workspace.

## To do
- [x] Modal for wallet balance;
- [x] Button for period data fetching;
- [x] KucoCoin freeze implementation;
- [x] Disable retract button if it is overdue (and show a tooltip);
- [x] Better error display;
- [ ] Format error display;
- [x] Get svg links for metamask and avalanche;
- [ ] Error display "can't read properties of undefined" when metamask is not installed;
- [ ] Copy kucocoin address to clipboard.