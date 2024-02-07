const costwo = {
  chainName: 'Coston2',
  chainId: "0x72",
  nativeCurrency: {
    name: 'C2FLR',
    decimals: 18,
    symbol: 'C2FLR'
  },
  rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
  blockExplorerUrls: ['https://coston2-explorer.flare.network']
}

const flarefork = {
  chainName: 'Flare Fork',
  chainId: '0x7a69',
  nativeCurrency: {
    name: 'FlareFork',
    decimals: 18,
    symbol: 'FLORK'
  },
  rpcUrls: ['http://127.0.0.1:8545']
}

export const NETWORK = flarefork