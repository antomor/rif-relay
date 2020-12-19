import { Address, IntString } from './Aliases'
import { PrefixedHexString } from 'ethereumjs-tx'

export default interface GsnTransactionDetails {
  // Added by the Web3 call stack:
  readonly from: Address
  readonly data: PrefixedHexString
  readonly to: Address
  readonly tokenContract?: Address
  readonly tokenAmount?: IntString
  readonly recoverer?: Address
  readonly index?: IntString
  readonly value?: IntString

  /**
   * TODO: this is horrible. Think about it some more
   * Do not set this value manually as this value will be overwritten. Use {@link forceGasPrice} instead.
   */
  gas?: PrefixedHexString
  gasPrice?: PrefixedHexString

  // Required parameters for GSN, but assigned later
  readonly callForwarder?: Address
  readonly callVerifier?: Address
  readonly isSmartWalletDeploy?: boolean

  readonly clientId?: IntString

  // Optional parameters for RelayProvider only:
  /**
   * Set to 'false' to create a direct transaction
   */
  readonly useGSN?: boolean

  /**
   * Use this to force the {@link RelayClient} to use provided gas price instead of calculated one.
   */
  readonly forceGasPrice?: PrefixedHexString
}
