import { PrefixedHexString } from 'ethereumjs-tx'
import HttpClient from '../../src/relayclient/HttpClient'
import HttpWrapper from '../../src/relayclient/HttpWrapper'
import {
  PingResponse,
  EnvelopingConfig,
  RelayTransactionRequest
} from '@rsksmart/rif-relay-common'

export default class BadHttpClient extends HttpClient {
  static readonly message = 'This is not the relay you are looking for'

  private readonly failRelay: boolean
  private readonly failPing: boolean
  private readonly timeoutRelay: boolean
  private readonly stubRelay: string | undefined
  private readonly stubPing: PingResponse | undefined

  constructor (config: EnvelopingConfig, failPing: boolean, failRelay: boolean, timeoutRelay: boolean, stubPing?: PingResponse, stubRelay?: string) {
    super(new HttpWrapper(), config)
    this.failPing = failPing
    this.failRelay = failRelay
    this.timeoutRelay = timeoutRelay
    this.stubRelay = stubRelay
    this.stubPing = stubPing
  }

  async getPingResponse (relayUrl: string, verifier?: string): Promise<PingResponse> {
    if (this.failPing) {
      throw new Error(BadHttpClient.message)
    }
    if (this.stubPing != null) {
      return this.stubPing
    }
    return await super.getPingResponse(relayUrl, verifier)
  }

  async relayTransaction (relayUrl: string, request: RelayTransactionRequest): Promise<PrefixedHexString> {
    if (this.failRelay) {
      throw new Error(BadHttpClient.message)
    }
    if (this.timeoutRelay) {
      throw new Error('some error describing how timeout occurred somewhere')
    }
    if (this.stubRelay != null) {
      return this.stubRelay
    }
    return await super.relayTransaction(relayUrl, request)
  }
}
