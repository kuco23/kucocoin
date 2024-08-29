import { network } from "./network"
import { avalancheforkMetamask, fujiMetamask, avalancheMetamask } from "./metamask"
import { avalancheforkToken, fujiToken, avalancheToken } from "./token"

let metamask = avalancheMetamask
if (network === "fuji") {
  metamask = fujiMetamask
} else if (network === "avalanchefork") {
  metamask = avalancheforkMetamask
}

let token = avalancheToken
if (network === "fuji") {
  token = fujiToken
} else if (network === "avalanchefork") {
  token = avalancheforkToken
}

export const config = {
  metamask: metamask,
  token: token
}