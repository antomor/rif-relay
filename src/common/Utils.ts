import BN from 'bn.js'
import abi from 'web3-eth-abi'
import ethUtils from 'ethereumjs-util'
import web3Utils, { toWei } from 'web3-utils'
import { EventData } from 'web3-eth-contract'
import { JsonRpcResponse } from 'web3-core-helpers'
import { PrefixedHexString } from 'ethereumjs-tx'

import { Address } from '../relayclient/types/Aliases'
import { ServerConfigParams } from '../relayserver/ServerConfigParams'

import TypedRequestData from './EIP712/TypedRequestData'
import chalk from 'chalk'

import sigUtil from 'eth-sig-util'

export function removeHexPrefix (hex: string): string {
  if (hex == null || typeof hex.replace !== 'function') {
    throw new Error('Cannot remove hex prefix')
  }
  return hex.replace(/^0x/, '')
}

const zeroPad = '0000000000000000000000000000000000000000000000000000000000000000'

export function padTo64 (hex: string): string {
  if (hex.length < 64) {
    hex = (zeroPad + hex).slice(-64)
  }
  return hex
}

export function event2topic (contract: any, names: string[]): any {
  // for testing: don't crash on mockup..
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!contract.options || !contract.options.jsonInterface) { return names }
  if (typeof names === 'string') {
    return event2topic(contract, [names])[0]
  }
  return contract.options.jsonInterface
    .filter((e: any) => names.includes(e.name))
    // @ts-ignore
    .map(abi.encodeEventSignature)
}

export function addresses2topics (addresses: string[]): string[] {
  return addresses.map(address2topic)
}

export function address2topic (address: string): string {
  return '0x' + '0'.repeat(24) + address.toLowerCase().slice(2)
}

// extract revert reason from a revert bytes array.
export function decodeRevertReason (revertBytes: PrefixedHexString, throwOnError = false): string | null {
  if (revertBytes == null) { return null }
  if (!revertBytes.startsWith('0x08c379a0')) {
    if (throwOnError) {
      throw new Error('invalid revert bytes: ' + revertBytes)
    }
    return revertBytes
  }
  // @ts-ignore
  return abi.decodeParameter('string', '0x' + revertBytes.slice(10)) as any
}

export function getLocalEip712Signature (
  typedRequestData: TypedRequestData,
  privateKey: Buffer,
  jsonStringifyRequest = false
): PrefixedHexString {
  let dataToSign: TypedRequestData | string
  if (jsonStringifyRequest) {
    dataToSign = JSON.stringify(typedRequestData)
  } else {
    dataToSign = typedRequestData
  }

  // @ts-ignore
  return sigUtil.signTypedData_v4(privateKey, { data: dataToSign })
}

export async function getEip712Signature (
  web3: Web3,
  typedRequestData: TypedRequestData,
  methodSuffix = '',
  jsonStringifyRequest = false
): Promise<PrefixedHexString> {
  const senderAddress = typedRequestData.message.from
  let dataToSign: TypedRequestData | string
  if (jsonStringifyRequest) {
    dataToSign = JSON.stringify(typedRequestData)
  } else {
    dataToSign = typedRequestData
  }
  return await new Promise((resolve, reject) => {
    let method
    // @ts-ignore (the entire web3 typing is fucked up)
    if (typeof web3.currentProvider.sendAsync === 'function') {
      // @ts-ignore
      method = web3.currentProvider.sendAsync
    } else {
      // @ts-ignore
      method = web3.currentProvider.send
    }
    method.bind(web3.currentProvider)({
      method: 'eth_signTypedData' + methodSuffix,
      params: [senderAddress, dataToSign],
      from: senderAddress,
      id: Date.now()
    }, (error: Error | string | null, result?: JsonRpcResponse) => {
      if (result?.error != null) {
        error = result.error
      }
      if (error != null || result == null) {
        reject((error as any).message ?? error)
      } else {
        resolve(result.result)
      }
    })
  })
}

/**
 * @returns maximum possible gas consumption by this relayed call
 */
export function calculateTransactionMaxPossibleGas (

  hubOverhead: number,
  relayCallGasLimit: string,
  cushion: number
): number {
  return hubOverhead +
    parseInt(relayCallGasLimit) + cushion
}

export function getEcRecoverMeta (message: PrefixedHexString, signature: string | Signature): PrefixedHexString {
  if (typeof signature === 'string') {
    const r = parseHexString(signature.substr(2, 65))
    const s = parseHexString(signature.substr(66, 65))
    const v = parseHexString(signature.substr(130, 2))

    signature = {
      v: v,
      r: r,
      s: s
    }
  }
  const msg = Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n32'), Buffer.from(removeHexPrefix(message), 'hex')])
  const signed = web3Utils.sha3('0x' + msg.toString('hex'))
  if (signed == null) {
    throw new Error('web3Utils.sha3 failed somehow')
  }
  const bufSigned = Buffer.from(removeHexPrefix(signed), 'hex')
  const recoveredPubKey = ethUtils.ecrecover(bufSigned, signature.v[0], Buffer.from(signature.r), Buffer.from(signature.s))
  return ethUtils.bufferToHex(ethUtils.pubToAddress(recoveredPubKey))
}

export function parseHexString (str: string): number[] {
  const result = []
  while (str.length >= 2) {
    result.push(parseInt(str.substring(0, 2), 16))

    str = str.substring(2, str.length)
  }

  return result
}

export function isSameAddress (address1: Address, address2: Address): boolean {
  return address1.toLowerCase() === address2.toLowerCase()
}

export async function sleep (ms: number): Promise<void> {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

export function ether (n: string): BN {
  return new BN(toWei(n, 'ether'))
}

export function randomInRange (min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min)
}

export function isSecondEventLater (a: EventData, b: EventData): boolean {
  if (a.blockNumber === b.blockNumber) {
    return b.transactionIndex > a.transactionIndex
  }
  return b.blockNumber > a.blockNumber
}

export function getLatestEventData (events: EventData[]): EventData | undefined {
  if (events.length === 0) {
    return
  }
  const eventDataSorted = events.sort(
    (a: EventData, b: EventData) => {
      if (a.blockNumber === b.blockNumber) {
        return b.transactionIndex - a.transactionIndex
      }
      return b.blockNumber - a.blockNumber
    })
  return eventDataSorted[0]
}

export function isRegistrationValid (registerEvent: EventData | undefined, config: ServerConfigParams, managerAddress: Address): boolean {
  const portIncluded: boolean = config.url.indexOf(':') > 0
  return registerEvent != null &&
    isSameAddress(registerEvent.returnValues.relayManager, managerAddress) &&
    registerEvent.returnValues.baseRelayFee.toString() === config.baseRelayFee.toString() &&
    registerEvent.returnValues.pctRelayFee.toString() === config.pctRelayFee.toString() &&
    registerEvent.returnValues.relayUrl.toString() === (config.url.toString() + ((!portIncluded && config.port > 0) ? ':' + config.port.toString() : ''))
}

/**
 * @param gasLimits
 * @param hubOverhead
 * @param relayCallGasLimit
 * @param calldataSize
 * @param gtxdatanonzero
 */
interface TransactionGasComponents {
  gasLimits: VerifierGasLimits
  hubOverhead: number
  relayCallGasLimit: string
}

export interface VerifierGasLimits {
  acceptanceBudget: string
  preRelayedCallGasLimit: string
  postRelayedCallGasLimit: string
}

interface Signature {
  v: number[]
  r: number[]
  s: number[]
}

export function boolString (bool: boolean): string {
  return bool ? chalk.green('good'.padEnd(14)) : chalk.red('wrong'.padEnd(14))
}
