# KucoCoin Front End

This workspace contains the frontend for KucoCoin.

## Testing

To test the frontend locally, follow below steps:

1. In contracts workspace:
    - Run `yarn fork-avalanche`,
    - Run `yarn kucocoin-deploy`,
    - Run `yarn kucocoin-init`.
2. In frontend workspace:
    - Navigate to `src/ts/config/token.ts` and update `ADDRESS` to the one displayed after completing step `2`,
    - Run `yarn serve`.
