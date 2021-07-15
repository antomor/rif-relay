import log from 'loglevel'
import { PrefixedHexString, Transaction } from 'ethereumjs-tx'
import { bufferToHex } from 'ethereumjs-util'
import {
  isSameAddress,
  ContractInteractor,
  DeployTransactionRequest,
  RelayTransactionRequest,
  EnvelopingConfig
} from '@rsksmart/rif-relay-common'

export default class RelayedTransactionValidator {
  private readonly contractInteractor: ContractInteractor
  private readonly config: EnvelopingConfig

  constructor (contractInteractor: ContractInteractor, config: EnvelopingConfig) {
    this.contractInteractor = contractInteractor
    this.config = config
  }

  /**
   * Decode the signed transaction returned from the Relay Server, compare it to the
   * requested transaction and validate its signature.
   * @returns a signed {@link Transaction} instance for broadcasting, or null if returned
   * transaction is not valid.
   */
  validateRelayResponse (
    request: RelayTransactionRequest | DeployTransactionRequest,
    returnedTx: PrefixedHexString
  ): boolean {
    const transaction = new Transaction(returnedTx, this.contractInteractor.getRawTxOptions())

    log.info('returnedTx is', transaction.v, transaction.r, transaction.s, transaction.to, transaction.data, transaction.gasLimit, transaction.gasPrice, transaction.value)

    const signer = bufferToHex(transaction.getSenderAddress())

    let isDeploy = false
    if ((request as DeployTransactionRequest).relayRequest.request.recoverer !== undefined) {
      isDeploy = true
    }
    const relayRequestAbiEncode = isDeploy ? this.contractInteractor.encodeDeployCallABI((request as DeployTransactionRequest).relayRequest, request.metadata.signature) : this.contractInteractor.encodeRelayCallABI((request as RelayTransactionRequest).relayRequest, request.metadata.signature)

    if (
      isSameAddress(bufferToHex(transaction.to), this.config.relayHubAddress) &&
      relayRequestAbiEncode === bufferToHex(transaction.data) &&
      isSameAddress(request.relayRequest.relayData.relayWorker, signer)
    ) {
      log.info('validateRelayResponse - valid transaction response')

      // TODO: the relayServer encoder returns zero-length buffer for nonce=0.`
      const receivedNonce = transaction.nonce.length === 0 ? 0 : transaction.nonce.readUIntBE(0, transaction.nonce.byteLength)
      if (receivedNonce > request.metadata.relayMaxNonce) {
        // TODO: need to validate that client retries the same request and doesn't double-spend.
        // Note that this transaction is totally valid from the EVM's point of view

        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Relay used a tx nonce higher than requested. Requested ${request.metadata.relayMaxNonce} got ${receivedNonce}`)
      }

      return true
    } else {
      console.error('validateRelayResponse: req', relayRequestAbiEncode, this.config.relayHubAddress, request.relayRequest.relayData.relayWorker)
      console.error('validateRelayResponse: rsp', bufferToHex(transaction.data), bufferToHex(transaction.to), signer)
      return false
    }
  }
}
