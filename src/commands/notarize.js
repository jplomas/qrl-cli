/* global QRLLIB */
/* eslint new-cap: 0 */

/*
// Notarization requires a sha256 hash of the data intended to hash. This can be acquired prior using 
//   something like `sha256sum {FILE}` on a typical *nix system
*/

const { Command, flags } = require('@oclif/command')
const { white, black } = require('kleur')
const ora = require('ora')
const fs = require('fs')
const validateQrlAddress = require('@theqrl/validate-qrl-address')
const { cli } = require('cli-ux')
const { QRLLIBmodule } = require('qrllib/build/offline-libjsqrl') // eslint-disable-line no-unused-vars
const aes = require('../utils/aes')
// const CryptoJS = require("crypto-js");
const Qrlnode = require('../functions/grpc')
const { getNetworkSetup } = require('../functions/network-helper')
const { signBoundTransaction, ResponseBindingError } = require('../functions/tx-binding')

// open wallet file
const openWalletFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)[0]
}

function stringToBytes(str) {
  const result = [];
  /* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
  for (let i = 0; i < str.length; i++) {
    result.push(str.charCodeAt(i));
  }
  return result;
}

// Convert bytes to hex
function bytesToHex(byteArray) {
  return [...byteArray]
    /* eslint-disable */
    .map((byte) => {
      return ('00' + (byte & 0xff).toString(16)).slice(-2)
    })
    /* eslint-enable */
    .join('')
}

let QRLLIBLoaded = false

// Resolves once QRLLIB has loaded *and* `callBack` has run to completion, so run() can
// await the work instead of returning while it is still going. Without that, a this.exit()
// inside the callback surfaces as an unhandled rejection rather than an exit code.
const waitForQRLLIB = (callBack) =>
  new Promise((resolve, reject) => {
    const poll = () => {
      setTimeout(() => {
        // Test the QRLLIB object has the str2bin function.
        // This is sufficient to tell us QRLLIB has loaded.
        if (typeof QRLLIB.str2bin === 'function' && QRLLIBLoaded === true) {
          Promise.resolve().then(callBack).then(resolve, reject)
        } else {
          QRLLIBLoaded = true
          poll()
        }
      }, 50)
    }
    poll()
  })

// Concatenates multiple typed arrays into one.
// toUint8Vector

// Take input and convert to unsigned uint64 bigendian bytes
// Convert Binary object to Bytes
// With --json the progress spinners are stood down, but every call site uses the spinner
// unconditionally, so this stand-in takes their place rather than a `null`: it drops the
// progress chatter and still reports failures on stderr, so a --json run that goes wrong
// says why instead of exiting silently. (stdout stays JSON-only either way: ora writes to
// stderr, and only this.log reaches stdout.) succeed and fail are the only two methods this
// command calls on a spinner; anything else added later needs adding here too.
const quietSpinner = () => {
  const self = {
    succeed: () => self,
    fail: (text) => {
      // The command calls fail('') in one place purely to clear the spinner line.
      if (text) {
        process.stderr.write(`${text}\n`)
      }
      return self
    },
  }
  return self
}

const startSpinner = (json, text) => (json ? quietSpinner() : ora({ text }).start())

class Notarise extends Command {
  async run() {
    const { args, flags } = this.parse(Notarise)
    // let dataHash
    let messageData
    let messageHex
    let notarization = 'AFAFA'
    let hexseed
    let address
    let notarialHash

    const { grpcEndpoint, network } = getNetworkSetup(flags)
    if (!flags.json){
      this.log(white().bgBlue(network))
    }
    // the data to notarise here, can be a file submitted (path) or a string passed on cli
    const spinner = startSpinner(flags.json, 'Notarising Data...\n')
    // Unreachable: `dataHash` is declared as a required argument, and oclif rejects a missing or
    // empty value before run() is entered. Kept as a guard for any future non-oclif caller.
    /* istanbul ignore else */
    if (args.dataHash) {
      const sha256regex = /^\b[A-Fa-f0-9]{64}\b/.test(args.dataHash)
      // is the passed data the correct length? should be a sha256 sum hash
      if (args.dataHash.length !== 64 || !sha256regex ) {
        // either length is wrong or regex not matching
        spinner.fail(`${black().bgRed(`notarization data hash invalid...`)}` )
        this.exit(1)
      }
      notarialHash = args.dataHash
    }
    notarization += `2${notarialHash}`
    spinner.succeed(`notarization: ${notarization}`)
    // additional data to send with the notary - user defined
    
    if (flags.message) {
      messageData = flags.message.toString()
      if (messageData.length > 45) {
        spinner.fail(`${black().bgRed(`Message cannot be longer than 45 characters.`)} Message Length: ${messageData.length}` )
        this.exit(1)
      }
      spinner.succeed(`Message data received: ${messageData}`)
      // Convert string to hex to append to the hash
      const messageDataBytes = stringToBytes(messageData)
      // spinner.succeed(`messageDataBytes: ${messageDataBytes}`)
      messageHex = bytesToHex(messageDataBytes)
      // Construct final hex string for notarization appending message hex
      notarization += messageHex
    }
    spinner.succeed(`final notarization hex: ${notarization}`)
    // get wallet private details for transaction
    if (!flags.wallet && !flags.hexseed) {
      spinner.fail(`${black().bgRed(`No wallet.json file (-w) or hexseed (-h) specified...`)}` )
      this.exit(1)
    }

    // open wallet file
    if (flags.wallet) {
      let isValidFile = false
      let badPassword = false
      let walletJson
      try {
        // Inside the try: a missing or malformed file must reach the "invalid wallet file"
        // message below, not escape as an unhandled ENOENT from readFileSync or a SyntaxError
        // from JSON.parse.
        walletJson = openWalletFile(flags.wallet)
        if (walletJson.encrypted === false) {
          isValidFile = true
          address = walletJson.address
          hexseed = walletJson.hexseed
        }
        if (walletJson.encrypted === true) {
          let password = ''
          if (flags.password) {
            password = flags.password
          } 
          else {
            password = await cli.prompt('Enter password for wallet file', { type: 'hide' })
          }
          // Two ways a wrong password shows up: the v2 format is authenticated, so decryption
          // throws, and the legacy format is not, so it decrypts to nonsense that fails the
          // address check. Both mean the password is wrong rather than the file. Reporting it
          // from inside this try used to be swallowed by the catch below, which then printed
          // "Invalid wallet file" on top of it - two contradictory messages for one mistake.
          try {
            address = aes.decrypt(password, walletJson.address)
            hexseed = aes.decrypt(password, walletJson.hexseed)
            isValidFile = validateQrlAddress.hexString(address).result
          } catch (error) {
            isValidFile = false
          }
          badPassword = !isValidFile
        }
      }
      catch (error) {
        isValidFile = false
      }
      if (badPassword) {
        spinner.fail(`${black().bgRed(`Unable to open wallet file: Invalid password...`)}` )
        this.exit(1)
      }
      if (!isValidFile) {
        spinner.fail(`${black().bgRed(`Unable to open wallet file: Invalid wallet file...`)}` )
        this.exit(1)
      }
      if (!flags.otsindex ) {
        spinner.fail(`${black().bgRed(`No OTS index (-i) given...`)}` )
        spinner.fail(``)
        this.exit(1)
      }
    }
    // open from hexseed OR MNEMONIC
    if (flags.hexseed) {
      // reconstruct XMSS from hexseed
      hexseed = flags.hexseed
      // sanity checks on this parameter
      if (hexseed.match(' ') === null) {
        // hexseed: correct length?
        if (hexseed.length !== 102) {
          spinner.fail(`${black().bgRed(`Hexseed invalid: too short...`)}` )
          this.exit(1)
        }
      } else {
        // mnemonic: correct number of words?
        // eslint-disable-next-line no-lonely-if
        if (hexseed.split(' ').length !== 34) {
          spinner.fail(`${black().bgRed(`Mnemonic phrase invalid: too short...`)}` )
          this.exit(1)
        }
      }
      if (!flags.otsindex ) {
        spinner.fail(`${black().bgRed(`No OTS index (-i) given...`)}` )
        this.exit(1)
      }
    }
    // check ots for valid entry
    // Defensive: reaching this line needs either --wallet or --hexseed, and both of those
    // branches already exit when no OTS index was given, so the else can never be taken.
    /* istanbul ignore else */
    if (flags.otsindex) {
      const passedOts = parseInt(flags.otsindex, 10)
      if (!passedOts && passedOts !== 0) {
        spinner.fail(`${black().bgRed(`OTS key is invalid...`)}` )
        this.exit(1)
      }
    }
    // set the fee to default or flag
    let fee = 0 // default fee 0 Shor
    if (flags.fee) {
      const passedFee = parseInt(flags.fee, 10)
      // Rejected on being unusable, not on being falsy: parseInt('0') is 0, and a zero
      // fee is both legal on the network and what this command uses when -f is omitted.
      // Testing truthiness sent an explicit -f 0 down the "invalid" path.
      if (Number.isNaN(passedFee) || passedFee < 0) {
        spinner.fail(`${black().bgRed(`Fee is invalid...`)}` )
        this.exit(1)
      }
      fee = passedFee
    }

    // sign and send transaction
    await waitForQRLLIB(async () => {
      let XMSS_OBJECT
      // QRLLIB throws an emscripten pointer (a bare number), not an Error, so there is no
      // message to relay and nothing useful to show the user. Without this catch the command
      // exited non-zero having printed nothing at all.
      try {
        if (hexseed.match(' ') === null) {
          XMSS_OBJECT = await new QRLLIB.Xmss.fromHexSeed(hexseed)
        } else {
          XMSS_OBJECT = await new QRLLIB.Xmss.fromMnemonic(hexseed)
        }
      } catch (err) {
        spinner.fail('Failed to recreate XMSS wallet object: invalid hexseed or mnemonic')
        this.exit(1)
      }
      const xmssPK = Buffer.from(XMSS_OBJECT.getPK(), 'hex')
      spinner.succeed('xmssPK returned...')
      const Qrlnetwork = await new Qrlnode(grpcEndpoint)
      try {
        await Qrlnetwork.connect()
        // verify we have connected and try again if not
        let i = 0
        const count = 5
        while (Qrlnetwork.connection === false && i < count) {
          spinner.succeed(`retry connection attempt: ${i}...`)
          // eslint-disable-next-line no-await-in-loop
          await Qrlnetwork.connect()
          // eslint-disable-next-line no-plusplus
          i++
        }
      } catch (e) {
        spinner.fail(`Failed to connect to node. Check network connection & parameters.\n${e}`)
        this.exit(1)
      }
      // get message hex into bytes for transaction
      const messageBytes = Buffer.from(notarization, 'hex')
      const request = {
        master_addr: Buffer.from('', 'hex'),
        message: messageBytes,
        fee,
        xmss_pk: xmssPK,
      }
      // send the message transaction with the notarise encoding to the node
      const message = await Qrlnetwork.api('GetMessageTxn', request)

      const spinner3 = startSpinner(flags.json, 'Signing transaction...')

      // Preimage order is QRL core's MessageTransaction.get_data_bytes():
      //   master_addr || fee || message_hash || addr_to
      // A notarisation has no recipient, so addr_to is bound to empty — that also stops a node
      // adding one. The fee was the only field ever taken from the response.
      const returnedTx = message.extended_transaction_unsigned.tx
      let signature
      let txnHash
      try {
        const bound = signBoundTransaction({
          xmss: XMSS_OBJECT,
          otsIndex: flags.otsindex,
          publicKey: xmssPK,
          parts: [
            { name: 'fee', kind: 'uint64', local: fee, remote: returnedTx.fee },
            {
              name: 'notarisation data',
              kind: 'bytes',
              local: messageBytes,
              remote: returnedTx.message.message_hash,
            },
            {
              name: 'recipient',
              kind: 'bytes',
              local: Buffer.alloc(0),
              remote: returnedTx.message.addr_to,
            },
          ],
        })
        signature = bound.signature
        txnHash = bound.txnHash
      } catch (err) {
        if (err instanceof ResponseBindingError) {
          spinner3.fail(`Refusing to sign: ${err.message}`)
          this.log(`${white('⨉')} The node did not return the transaction that was requested.`)
          this.log('Nothing was signed and no OTS key was used.')
          this.log('If this persists, connect to a different node with --grpc.')
          this.exit(1)
        }
        spinner3.fail(`Failed to sign transaction: ${err.message}`)
        this.exit(1)
      }
      spinner3.succeed(`Node response matches the request. Transaction signed with OTS key ${flags.otsindex}. (nodes will reject this transaction if key reuse is detected)`)
      const spinner4 = startSpinner(flags.json, 'Pushing transaction to node...')
      // transaction sig and pub key into buffer
      returnedTx.signature = Buffer.from(signature)
      returnedTx.public_key = Buffer.from(xmssPK) // eslint-disable-line camelcase
      const pushTransactionReq = {
        transaction_signed: returnedTx, // eslint-disable-line camelcase
      }
      // push the transaction to the network
      const response = await Qrlnetwork.api('PushTransaction', pushTransactionReq)
      if (response.error_code && response.error_code !== 'SUBMITTED') {
        spinner.fail(
          `${black().bgRed(`Qrlnetwork.api error: ${response.error_code}`)} ` +
            `Unable send push transaction [error: ${response.error_description}]`
        )
        this.exit(1)
      }
      const pushTransactionRes = JSON.stringify(response.tx_hash)
      const txhash = JSON.parse(pushTransactionRes)
      if (txnHash === bytesToHex(txhash.data)) {
        // Reported for every network, not only the two public ones: a notarisation sent to a
        // custom --grpc endpoint used to succeed and say nothing at all, so there was no way
        // to find the transaction afterwards.
        const txId = bytesToHex(txhash.data)
        spinner4.succeed(`Transaction submitted to ${network} node: transaction ID: ${txId}`)
        // return link to explorer
        if (network === 'Mainnet') {
          spinner3.succeed(`https://explorer.theqrl.org/tx/${txId}`)
        }
        else if (network === 'Testnet') {
          spinner3.succeed(`https://testnet-explorer.theqrl.org/tx/${txId}`)
        }
        if (flags.json){
          this.log(`[{"tx_id":"${txId}"}]`)
        }
        // this.exit(0)
      } 
      else {
        spinner.fail(`${black().bgRed(`Node transaction hash ${bytesToHex(txhash.data)} does not match`)}` )
        this.exit(1)
      }
    })
  }
}

Notarise.description = `Notarise a document or file on the blockchain

Notarise data onto the blockchain. Takes a sha256 hash of a file and submits it to the network using
the wallet address given.

Advanced: you can use a custom defined node to broadcast the notarization. Use the (-g) grpc endpoint.
`

Notarise.args = [
   {
     name: 'dataHash',
     description: 'File sha256 Hash',
     required: true,
   },
 ]

Notarise.flags = {

  testnet: flags.boolean({
    char: 't',
    default: false,
    description: 'uses testnet for the notarization'
  }),

  mainnet: flags.boolean({
    char: 'm',
    default: false,
    description: 'uses mainnet for the notarization'
  }),

  json: flags.boolean({
    char: 'j',
    default: false,
    description: 'Return JSON response'
  }),


  grpc: flags.string({
    char: 'g',
    required: false,
    description: 'advanced: grpc endpoint (for devnet/custom QRL network deployments)',
  }),

  message: flags.string({
    char: 'M',
    default: false,
    description: 'Additional (M)essage data to send (max 45 char)'
  }),

  wallet: flags.string({
    char: 'w',
    required: false,
    description: 'JSON (w)allet file notarization will be sent from',
  }),

 password: flags.string({
    char: 'p',
    required: false,
    description: 'Encrypted QRL wallet file (p)assword'
  }),

  hexseed: flags.string({
    char: 'h',
    required: false,
    description: 'Secret (h)exseed/mnemonic of address notarization should be sent from',
  }),

  fee: flags.string({
    char: 'f',
    required: false,
    description: 'QRL (f)ee for transaction in Shor (defaults to 0 Shor)'
  }),

  otsindex: flags.string({ 
    char: 'i',
    required: false,
    description: 'Unused OTS key (i)ndex for message transaction' 
  }),
}

module.exports = { Notarise }