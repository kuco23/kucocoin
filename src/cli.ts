import { Command } from 'commander'
import { Contract, Wallet, ethers } from 'ethers'
import { abi as kucocoinAbi, bytecode as kucocoinBytecode } from '../artifacts/contracts/KucoCoin.sol/KucoCoin.json'
import { networkInfo } from './config'
import type { OptionValues } from 'commander'
import type { KucoCoin__factory, KucoCoin } from '../types'


let provider: ethers.JsonRpcApiProvider
let signer: ethers.Wallet

const program = new Command("KucoCoin CLI")
program
  .option("-n, --network <costwo|flare|flarefork>", "network to use", "costwo")
  .option("-e, --env-file <env>", "env file to use", ".env")
  .hook("preAction", (cmd: Command) => {
    const options = cmd.opts()
    require('dotenv').config({ path: options.envFile })
    const ninfo = networkInfo[options.network]
    provider = new ethers.JsonRpcProvider(ninfo.rpc)
    signer = new Wallet(process.env.SIGNER_PRIVATE_KEY!, provider)
  })
program
  .command("deploy").description("deploy KucoCoin")
  .argument("investment return (bips)", "factor at which to return the investment value")
  .argument("investment duration (seconds)", "duration of the investment phase")
  .argument("retract fee (bips)", "fee to be paid when retracting the investment")
  .argument("retract duration (seconds)", "duration of the retract phase")
  .action(async (
    investmentReturnBips: number,
    investmentDuration: string,
    retractFeeBips: number,
    retractDuration: string,
    _options: OptionValues
  ) => {
    const options = { ...program.opts(), ..._options }
    const ninfo = networkInfo[options.network]
    const kucocoinAddress = await deployKucocoin(
      ninfo.dex,
      investmentReturnBips,
      BigInt(investmentDuration),
      retractFeeBips,
      BigInt(retractDuration)
    )
    console.log(`KucoCoin deployed at ${kucocoinAddress}`)
  })
program
  .command("init").description("initialize KucoCoin")
  .argument("kucocoin", "KucoCoin contract address")
  .argument("liquidity kuco", "amount of Kuco to provide as liquidity")
  .argument("liquidity nat", "amount of NAT to provide as liquidity")
  .action(async (kucocoin: string, liquidityKuco: string, liquidityNat: string, _options: OptionValues) => {
    const kucocoinAddress = await initKucocoin(kucocoin, BigInt(liquidityKuco), BigInt(liquidityNat))
    console.log(`KucoCoin initialized at ${kucocoinAddress}`)
  })

program.parseAsync(process.argv).catch(err => {
  if (err instanceof Error) {
    console.log(`Error: ${err.message}`)
  }
})

async function deployKucocoin(
  dex: string,
  investmentReturnBips: number,
  investmentDuration: bigint,
  retractFeeBips: number,
  retractDuration: bigint
): Promise<string> {
  const factory = new ethers.ContractFactory(kucocoinAbi, kucocoinBytecode) as KucoCoin__factory
  const kucocoin = await factory.connect(signer).deploy(
    dex, investmentReturnBips, investmentDuration, retractFeeBips, retractDuration
  )
  await kucocoin.waitForDeployment()
  return kucocoin.getAddress()
}

async function initKucocoin(
  kucocoinAddress: string,
  liquidityKuco: bigint,
  liquidityNat: bigint
): Promise<KucoCoin> {
  const kucocoin = new Contract(kucocoinAddress, kucocoinAbi, signer) as unknown as KucoCoin
  await kucocoin.connect(signer).initialize(liquidityKuco, { value: liquidityNat })
  return kucocoin
}