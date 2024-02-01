
export interface NetworkConfig {
  protocol: string,
  ip: string,
  port?: number,
  networkID: number,
  hrp: string
}

export interface NetworkInfo {
  config: NetworkConfig,
  rpc: string,
  wNat: string,
  dex: string
}

// hardhat flare fork
const flarefork: NetworkConfig = {
  protocol: 'http',
  ip: 'localhost',
  port: 8545,
  networkID: 31337,
  hrp: 'flarefork'
}

const costwo: NetworkConfig = {
  protocol: 'https',
  ip: 'coston2-api.flare.network',
  networkID: 114,
  hrp: 'costwo'
}

const flare: NetworkConfig = {
  protocol: 'https',
  ip: 'flare-api.flare.network',
  networkID: 14,
  hrp: 'flare'
}

function rpcUrlFromConfig(config: NetworkConfig): string {
  const { protocol, ip, port } = config
  const path = '/ext/bc/C/rpc'
  const iport = port ? `${ip}:${port}` : `${ip}`
  const rpcurl = `${protocol}://${iport}`
  return `${rpcurl}${path}`
}

export const networkInfo: {[index: string]: NetworkInfo} = {
  "costwo": {
    config: costwo,
    rpc: rpcUrlFromConfig(costwo),
    wNat: "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273",
    dex: "0x8D29b61C41CF318d15d031BE2928F79630e068e6"
  },
  "flare": {
    config: flare,
    rpc: rpcUrlFromConfig(flare),
    wNat: "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",
    dex: "0xe3A1b355ca63abCBC9589334B5e609583C7BAa06"
  },
  "flarefork": {
    config: flarefork,
    rpc: rpcUrlFromConfig(flarefork),
    wNat: "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",
    dex: "0xe3A1b355ca63abCBC9589334B5e609583C7BAa06"
  },
}