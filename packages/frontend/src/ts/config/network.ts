const coston = {
  chainName: 'Coston',
  chainId: '0x10',
  nativeCurrency: {
    name: 'CFLR',
    decimals: 18,
    symbol: 'CFLR'
  },
  rpcUrls: ['https://coston-api.flare.network/ext/C/rpc'],
  blockExplorerUrls: ['https://coston-explorer.flare.network']
}

const flare = {
  chainName: 'Flare',
  chainId: '0xe',
  nativeCurrency: {
    name: 'FLR',
    decimals: 18,
    symbol: 'FLR'
  },
  rpcUrls: ['https://flare.space/frpc1', 'https://flare-api.flare.network/ext/C/rpc'],
  blockExplorerUrls: ['https://flare-explorer.flare.network/']
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

export const NETWORK = coston