const FUJI_KUCOCOIN_ADDRESS = "0x6424da4c62a3694CF8bE0Ec6cCd4144a9aBE6Ef4"
const FUJI_UNISWAP_ROUTER_ADDRESS = "0xA9992b1Cc07C2338e325870ccFEE73127F3E2b71"

const fuji = {
  metamask: {
    chainName: 'Fuji Network C-Chain',
    chainId: '0xa869',
    nativeCurrency: {
      name: 'FUJI',
      decimals: 18,
      symbol: 'FUJI'
    },
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc']
  },
  kucocoin: FUJI_KUCOCOIN_ADDRESS,
  snowtrace: `https://testnet.snowtrace.io/address/${FUJI_KUCOCOIN_ADDRESS}/contract/43113/writeContract?chainId=43113`,
  uniswap: `https://testnet.snowtrace.io/address/${FUJI_UNISWAP_ROUTER_ADDRESS}/contract/43113/writeContract?chainId=43113#F10`
}

const avalanchefork = {
  metamask: {
    chainName: 'Avalanche Fork',
    chainId: '0x7a69',
    nativeCurrency: {
      name: 'AvalancheFork',
      decimals: 18,
      symbol: 'FAVAX'
    },
    rpcUrls: ['http://127.0.0.1:8545/']
  },
  kucocoin: '0x1780bCf4103D3F501463AD3414c7f4b654bb7aFd',
  snowtrace: '',
  uniswap: ''
}

const avalanche = {
  metamask: {
    chainName: 'Avalanche Network C-Chain',
    chainId: '0xa86a',
    nativeCurrency: {
      name: 'AVAX',
      decimals: 18,
      symbol: 'AVAX'
    },
    rpcUrls: ['https://avalanche-mainnet.infura.io']
  }
}

export const NETWORK = fuji