import { Command, type OptionValues } from 'commander'
import { Wallet, JsonRpcProvider, type JsonRpcApiProvider } from 'ethers'
import { deployKucocoin, initKucocoin, storeKucoCoinDeploy, readKucoCoinDeploy, readKucocoin } from './utils'
import { networkInfo, type NetworkInfo } from './config'


let provider: JsonRpcApiProvider
let signer: Wallet
let info: NetworkInfo

const program = new Command("KucoCoin CLI")
program
  .option("-n, --network <coston|flare|costonfork|flarefork>", "network to use", "coston")
  .option("-e, --env-file <env>", "env file to use", ".env")
  .hook("preAction", (cmd: Command) => {
    const options = cmd.opts()
    require('dotenv').config({ path: options.envFile })
    info = networkInfo[options.network]
    provider = new JsonRpcProvider(info.rpc)
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
    const kucocoinAddress = await deployKucocoin(
      info.uniswapV2,
      investmentReturnBips,
      BigInt(investmentDuration),
      retractFeeBips,
      BigInt(retractDuration),
      signer
    )
    console.log(`KucoCoin deployed at ${kucocoinAddress}`)
    storeKucoCoinDeploy(kucocoinAddress, program.opts().network)
  })
program
  .command("init").description("initialize KucoCoin")
  .argument("liquidity kuco", "amount of Kuco to provide as liquidity")
  .argument("liquidity nat", "amount of NAT to provide as liquidity")
  .action(async (liquidityKuco: string, liquidityNat: string, _options: OptionValues) => {
    const kucocoin = readKucoCoinDeploy(program.opts().network)
    await initKucocoin(kucocoin, BigInt(liquidityKuco), BigInt(liquidityNat), signer)
  })
program
  .command("get").description("get kucoocin property")
  .argument("<investmentReturnBips|tradingPhaseStart|retractFeeBips|retractPhaseEnd>", "property")
  .action(async (propertyName: string, _options: OptionValues) => {
    const kucocoin = readKucoCoinDeploy(program.opts().network)
    const property = await readKucocoin(kucocoin, propertyName, provider)
    console.log(`${propertyName}: ${property}`)
  })

program.parseAsync(process.argv).catch(err => {
  if (err instanceof Error) {
    console.log(`Error: ${err.message}`)
  }
})