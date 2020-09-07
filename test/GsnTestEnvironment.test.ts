import { GsnTestEnvironment, TestEnvironment } from '../src/relayclient/GsnTestEnvironment'
import { HttpProvider } from 'web3-core'
import { RelayClient } from '../src/relayclient/RelayClient'
import { expectEvent } from '@openzeppelin/test-helpers'
import { TestRecipientInstance } from '../types/truffle-contracts'
import { getTestingEnvironment } from './TestUtils'

const TestRecipient = artifacts.require('TestRecipient')

contract('GsnTestEnvironment', function () {
  let host: string

  before(function () {
    host = (web3.currentProvider as HttpProvider).host ?? 'localhost'
  })

  describe('#startGsn()', function () {
    it('should create a valid test environment for other tests to rely on', async function () {
      const host = (web3.currentProvider as HttpProvider).host
      const env = await getTestingEnvironment()
      const testEnv = await GsnTestEnvironment.startGsn(host, env)
      assert.equal(testEnv.deploymentResult.relayHubAddress.length, 42)
    })

    after(async function () {
      await GsnTestEnvironment.stopGsn()
    })
  })

  context('using RelayClient', () => {
    let sr: TestRecipientInstance
    let sender: string
    let testEnvironment: TestEnvironment
    let relayClient: RelayClient
    before(async () => {
      sender = await web3.eth.personal.newAccount('password')
      const env = await getTestingEnvironment()
      testEnvironment = await GsnTestEnvironment.startGsn(host, env)
      relayClient = testEnvironment.relayProvider.relayClient
      sr = await TestRecipient.new(testEnvironment.deploymentResult.forwarderAddress)
    })

    after(async () => {
      await GsnTestEnvironment.stopGsn()
    })

    it('should relay using relayTransaction', async () => {
      const ret = await relayClient.relayTransaction({
        from: sender,
        to: sr.address,
        forwarder: await sr.getTrustedForwarder(),
        paymaster: testEnvironment.deploymentResult.naivePaymasterAddress,
        gas: '0x' + 1e6.toString(16),
        data: sr.contract.methods.emitMessage('hello').encodeABI(),
        tokenRecipient: '',
        tokenContract: '',
        paybackTokens: '0',
        tokenGas: '0x0'
      })
      assert.deepEqual([...ret.relayingErrors.values(), ...ret.pingErrors.values()], [])
      const events = await sr.contract.getPastEvents()
      assert.equal(events[0].event, 'SampleRecipientEmitted')
      assert.equal(events[0].returnValues.realSender.toLocaleLowerCase(), sender.toLocaleLowerCase())
    })
  })

  context('using RelayProvider', () => {
    let sr: TestRecipientInstance
    let sender: string
    let testEnvironment: TestEnvironment
    before(async function () {
      sender = await web3.eth.personal.newAccount('password')
      const env = await getTestingEnvironment()
      testEnvironment = await GsnTestEnvironment.startGsn(host, env)
      sr = await TestRecipient.new(testEnvironment.deploymentResult.forwarderAddress)

      // @ts-ignore
      TestRecipient.web3.setProvider(testEnvironment.relayProvider)
    })
    after(async () => {
      await GsnTestEnvironment.stopGsn()
    })

    it('should send relayed transaction through RelayProvider', async () => {
      const txDetails = {
        from: sender,
        paymaster: testEnvironment.deploymentResult.naivePaymasterAddress,
        forwarder: await sr.getTrustedForwarder()
      }
      const ret = await sr.emitMessage('hello', txDetails)

      expectEvent(ret, 'SampleRecipientEmitted', {
        realSender: sender
      })
    })
  })
})
