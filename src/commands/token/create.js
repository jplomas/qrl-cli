/* global QRLLIB */
const { Command, flags } = require('@oclif/command')
const { red, green, blue } = require('kleur')
const ora = require('ora')
const fs = require('fs')
const validateQrlAddress = require('@theqrl/validate-qrl-address')
const { cli } = require('cli-ux')
const { QRLLIBmodule } = require('qrllib/build/offline-libjsqrl') // eslint-disable-line no-unused-vars
const helpers = require('@theqrl/explorer-helpers') // eslint-disable-line no-unused-vars
const aes = require('../../utils/aes')

const Qrlnode = require('../../functions/grpc')
const { getNetworkSetup } = require('../../functions/network-helper')
const { signBoundTransaction, ResponseBindingError } = require('../../functions/tx-binding')

let QRLLIBLoaded = false

const waitForQRLLIB = (callBack) => {
  setTimeout(() => {
    if (typeof QRLLIB.str2bin === 'function' && QRLLIBLoaded === true) {
      callBack()
    } else {
      QRLLIBLoaded = true
      return waitForQRLLIB(callBack)
    }
    return false
  }, 50)
}

const openWalletFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)[0]
}

class TokenCreate extends Command {
  async run() {
    const { flags } = this.parse(TokenCreate)
    const { grpcEndpoint } = getNetworkSetup(flags)

    const prompts = require('prompts') // eslint-disable-line global-require
    const isInteractive = process.stdout.isTTY && process.stdin.isTTY

    // 1. Gather symbol
    if (!flags.symbol) {
      if (!isInteractive) {
        this.log(` ${red('›')}   Error: Missing required flag: --symbol`)
        this.exit(1)
      }
      const response = await prompts({
        type: 'text',
        name: 'symbol',
        message: 'Enter Token Symbol (max 10 chars):',
        validate: value => (value.length > 0 && value.length <= 10) ? true : 'Symbol must be between 1 and 10 characters'
      })
      flags.symbol = response.symbol
      if (!flags.symbol) {
        this.log(`${red('⨉')} Operation cancelled.`)
        this.exit(1)
      }
    }

    // 2. Gather name
    if (!flags.name) {
      if (!isInteractive) {
        this.log(` ${red('›')}   Error: Missing required flag: --name`)
        this.exit(1)
      }
      const response = await prompts({
        type: 'text',
        name: 'name',
        message: 'Enter Token Name (max 30 chars):',
        validate: value => (value.length > 0 && value.length <= 30) ? true : 'Name must be between 1 and 30 characters'
      })
      flags.name = response.name
      if (!flags.name) {
        this.log(`${red('⨉')} Operation cancelled.`)
        this.exit(1)
      }
    }

    // 3. Decimals
    if (flags.decimals === undefined) {
      if (isInteractive) {
        const response = await prompts({
          type: 'number',
          name: 'decimals',
          message: 'Enter Decimal Precision (0-9):',
          initial: 9,
          validate: value => (value >= 0 && value <= 9) ? true : 'Decimals must be between 0 and 9'
        })
        flags.decimals = response.decimals
      } else {
        flags.decimals = 9
      }
    }

    // 4. Initial Holder Balances
    const initialBalances = []
    if (flags.holder) {
      const holders = Array.isArray(flags.holder) ? flags.holder : [flags.holder]
      holders.forEach(h => {
        const parts = h.split(':')
        if (parts.length !== 2) {
          this.log(` ${red('›')}   Error: Invalid holder format: "${h}". Expected format: Address:Amount`)
          this.exit(1)
        }
        const addressHex = parts[0]
        const amount = parts[1]
        if (!validateQrlAddress.hexString(addressHex).result) {
          this.log(` ${red('›')}   Error: Invalid QRL address in holder: "${addressHex}"`)
          this.exit(1)
        }
        initialBalances.push({
          address: Buffer.from(addressHex.substring(1), 'hex'),
          amount: parseInt(amount, 10),
        })
      })
    }

    if (initialBalances.length === 0) {
      if (!isInteractive) {
        this.log(` ${red('›')}   Error: Missing holder distributions. Use --holder Address:Amount`)
        this.exit(1)
      }
      this.log(blue('Enter initial token balance allocations (e.g. your own address). Leave address blank when done.'))
      let adding = true
      while (adding) {
        // eslint-disable-next-line no-await-in-loop
        const addrResp = await prompts({
          type: 'text',
          name: 'address',
          message: 'Holder QRL Address (or leave blank to finish):',
          validate: value => {
            if (value === '') return true
            return validateQrlAddress.hexString(value).result ? true : 'Invalid QRL address'
          }
        })
        if (!addrResp.address) {
          adding = false
          break
        }
        // eslint-disable-next-line no-await-in-loop
        const amountResp = await prompts({
          type: 'number',
          name: 'amount',
          message: `Amount for ${addrResp.address}:`,
          validate: value => value > 0 ? true : 'Amount must be positive'
        })
        initialBalances.push({
          address: Buffer.from(addrResp.address.substring(1), 'hex'),
          amount: parseInt(amountResp.amount, 10),
        })
      }
      if (initialBalances.length === 0) {
        this.log(`${red('⨉')} You must specify at least one initial balance holder.`)
        this.exit(1)
      }
    }

    // 5. OTS index
    if (!flags.otsindex) {
      if (!isInteractive) {
        this.log(` ${red('›')}   Error: Missing required flag: --otsindex`)
        this.exit(1)
      }
      const response = await prompts({
        type: 'number',
        name: 'otsindex',
        message: 'Enter OTS key index (e.g. 0):',
        validate: value => value >= 0 ? true : 'OTS index must be 0 or greater'
      })
      flags.otsindex = response.otsindex.toString()
      if (!flags.otsindex) {
        this.log(`${red('⨉')} Operation cancelled.`)
        this.exit(1)
      }
    }

    // 6. Wallet / Keys
    if (!flags.wallet && !flags.hexseed) {
      if (!isInteractive) {
        this.log(` ${red('›')}   Error: Missing sender wallet file (-w) or hexseed (-h).`)
        this.exit(1)
      }
      const response = await prompts({
        type: 'select',
        name: 'walletType',
        message: 'How would you like to specify the sender wallet?',
        choices: [
          { title: 'Wallet file (wallet.json)', value: 'file' },
          { title: 'Hexseed / Mnemonic phrase', value: 'seed' }
        ]
      })
      if (response.walletType === 'file') {
        const fileResp = await prompts({
          type: 'text',
          name: 'walletFile',
          message: 'Enter path to wallet file:',
          initial: 'wallet.json',
          validate: value => fs.existsSync(value) ? true : 'File does not exist'
        })
        flags.wallet = fileResp.walletFile
      } else if (response.walletType === 'seed') {
        const seedResp = await prompts({
          type: 'password',
          name: 'hexseed',
          message: 'Enter wallet Hexseed or Mnemonic:',
          validate: value => value.trim().length > 0 ? true : 'Hexseed/Mnemonic is required'
        })
        flags.hexseed = seedResp.hexseed
      } else {
        this.log(`${red('⨉')} Operation cancelled.`)
        this.exit(1)
      }
    }

    let hexseed = ''
    let address = ''
    if (flags.wallet) {
      let isValidFile = false
      const walletJson = openWalletFile(flags.wallet)
      try {
        if (walletJson.encrypted === false) {
          isValidFile = true
          address = walletJson.address
          hexseed = walletJson.hexseed
        }
        if (walletJson.encrypted === true) {
          let password = ''
          if (flags.password) {
            password = flags.password
          } else {
            password = await cli.prompt('Enter password for wallet file', { type: 'hide' })
          }
          address = aes.decrypt(password, walletJson.address)
          hexseed = aes.decrypt(password, walletJson.hexseed)
          if (validateQrlAddress.hexString(address).result) {
            isValidFile = true
          } else {
            this.log(`${red('⨉')} Unable to open wallet file: invalid password`)
            this.exit(1)
          }
        }
      } catch (error) {
        isValidFile = false
      }
      if (!isValidFile) {
        this.log(`${red('⨉')} Unable to open wallet file: invalid wallet file`)
        this.exit(1)
      }
    }

    if (flags.hexseed) {
      hexseed = flags.hexseed
      if (hexseed.match(' ') === null) {
        if (hexseed.length !== 102) {
          this.log(`${red('⨉')} Hexseed invalid: too short`)
          this.exit(1)
        }
      } else if (hexseed.split(' ').length !== 34) {
        this.log(`${red('⨉')} Mnemonic phrase invalid: too short`)
        this.exit(1)
      }
    }

    let fee = 100 // default 100 Shor
    if (flags.fee) {
      fee = parseInt(flags.fee, 10)
    }

    const spinner = ora({ text: 'Connecting to QRL node...' }).start()
    waitForQRLLIB(async () => {
      let XMSS_OBJECT
      try {
        if (hexseed.match(' ') === null) {
          // eslint-disable-next-line new-cap
          XMSS_OBJECT = await new QRLLIB.Xmss.fromHexSeed(hexseed)
        } else {
          // eslint-disable-next-line new-cap
          XMSS_OBJECT = await new QRLLIB.Xmss.fromMnemonic(hexseed)
        }
      } catch (err) {
        spinner.fail(`Failed to recreate XMSS wallet object: ${err.message}`)
        this.exit(1)
      }

      const xmssPK = Buffer.from(XMSS_OBJECT.getPK(), 'hex')
      const ownerAddress = address || `Q${XMSS_OBJECT.getAddress()}`

      const Qrlnetwork = await new Qrlnode(grpcEndpoint)
      try {
        await Qrlnetwork.connect()
        let i = 0
        const count = 5
        while (Qrlnetwork.connection === false && i < count) {
          spinner.text = `Retry connection attempt: ${i}...`
          // eslint-disable-next-line no-await-in-loop
          await Qrlnetwork.connect()
          i += 1
        }
      } catch (e) {
        spinner.fail(`Failed to connect to node.\n${e}`)
        this.exit(1)
      }

      spinner.succeed('Connected to node. Preparing Token Creation transaction...')

      const request = {
        master_addr: Buffer.from('', 'hex'),
        symbol: Buffer.from(flags.symbol),
        name: Buffer.from(flags.name),
        owner: Buffer.from(ownerAddress.substring(1), 'hex'),
        decimals: parseInt(flags.decimals, 10),
        initial_balances: initialBalances,
        fee,
        xmss_pk: xmssPK,
      }

      let tokenTx
      try {
        tokenTx = await Qrlnetwork.api('GetTokenTxn', request)
      } catch (err) {
        spinner.fail(`Node rejected Token Creation request: ${err.message}`)
        this.exit(1)
      }

      const spinnerSign = ora({ text: 'Verifying node response and signing transaction...' }).start()

      const returnedTx = tokenTx.extended_transaction_unsigned.tx
      const returnedBalances = returnedTx.token.initial_balances
      let signature
      try {
        // Preimage order is QRL core's TokenTransaction.get_data_bytes():
        //   master_addr || fee || symbol || name || owner || decimals || (address || amount)*
        // The initial balances decide who holds the new token's supply, so they are bound to
        // the holders this command was asked for rather than taken from the node's response.
        const bound = signBoundTransaction({
          xmss: XMSS_OBJECT,
          otsIndex: flags.otsindex,
          publicKey: xmssPK,
          parts: [
            {
              name: 'master address',
              kind: 'bytes',
              local: request.master_addr,
              remote: returnedTx.master_addr,
            },
            { name: 'fee', kind: 'uint64', local: request.fee, remote: returnedTx.fee },
            { name: 'token symbol', kind: 'bytes', local: request.symbol, remote: returnedTx.token.symbol },
            { name: 'token name', kind: 'bytes', local: request.name, remote: returnedTx.token.name },
            { name: 'token owner', kind: 'bytes', local: request.owner, remote: returnedTx.token.owner },
            {
              name: 'decimals',
              kind: 'uint64',
              local: request.decimals,
              remote: returnedTx.token.decimals,
            },
            {
              name: 'initial balances',
              kind: 'pairs',
              local: {
                addresses: request.initial_balances.map(item => item.address),
                amounts: request.initial_balances.map(item => item.amount),
              },
              remote: {
                addresses: returnedBalances.map(item => item.address),
                amounts: returnedBalances.map(item => item.amount),
              },
            },
          ],
        })
        signature = bound.signature
      } catch (err) {
        if (err instanceof ResponseBindingError) {
          spinnerSign.fail(`Refusing to sign: ${err.message}`)
          this.log(red('\nThe node did not return the transaction that was requested.'))
          this.log('Nothing was signed, no OTS key was used, and no token has been created.')
          this.log('If this persists, connect to a different node with --grpc.')
          this.exit(1)
        }
        spinnerSign.fail(`Failed to sign transaction: ${err.message}`)
        this.exit(1)
      }

      returnedTx.signature = Buffer.from(signature)
      returnedTx.public_key = Buffer.from(xmssPK)

      spinnerSign.succeed(`Node response matches the request. Transaction signed with OTS key ${flags.otsindex}`)

      const spinnerPush = ora({ text: 'Pushing signed transaction to network...' }).start()
      const pushRequest = {
        transaction_signed: tokenTx.extended_transaction_unsigned.tx,
      }

      try {
        const response = await Qrlnetwork.api('PushTransaction', pushRequest)
        if (response.error_code && response.error_code !== 'SUBMITTED') {
          spinnerPush.fail(`Node rejected transaction: ${response.error_description}`)
          this.exit(1)
        }
        
        const pushResHash = Buffer.from(response.tx_hash).toString('hex')

        // Read the values back off the signed transaction rather than echoing the flags, so the
        // holders and fee that were actually committed to are the ones shown.
        const signedHolders = returnedBalances.map(
          item => `Q${Buffer.from(item.address).toString('hex')}: ${String(item.amount)}`
        )

        spinnerPush.succeed(`Token created successfully!`)
        this.log(green('\nTransaction Information (as signed):'))
        this.log(`  Token Symbol:       ${blue(Buffer.from(returnedTx.token.symbol).toString())}`)
        this.log(`  Token Name:         ${blue(Buffer.from(returnedTx.token.name).toString())}`)
        this.log(`  Decimals:           ${blue(String(returnedTx.token.decimals))}`)
        this.log(`  Fee (Shor):         ${blue(String(returnedTx.fee))}`)
        this.log(`  Initial Holders:`)
        signedHolders.forEach(holder => this.log(`    ${blue(holder)}`))
        this.log(`  Token Creation TxID: ${green(pushResHash)}`)
        
        if (flags.json) {
          const jsonOut = {
            symbol: Buffer.from(returnedTx.token.symbol).toString(),
            name: Buffer.from(returnedTx.token.name).toString(),
            decimals: String(returnedTx.token.decimals),
            fee: String(returnedTx.fee),
            initialBalances: returnedBalances.map(item => ({
              address: `Q${Buffer.from(item.address).toString('hex')}`,
              amount: String(item.amount),
            })),
            txhash: pushResHash,
            status: 'SUBMITTED'
          }
          console.log(JSON.stringify(jsonOut, null, 2)) // eslint-disable-line no-console
        }
      } catch (err) {
        spinnerPush.fail(`gRPC error during push: ${err.message}`)
        this.exit(1)
      }
    })
  }
}

TokenCreate.description = `Create a new Token on the QRL network (QRL v1.0 XMSS/gRPC)`

TokenCreate.flags = {
  symbol: flags.string({
    char: 's',
    required: false,
    description: 'Token ticker symbol (e.g. TOK, max 10 chars)',
  }),
  name: flags.string({
    char: 'n',
    required: false,
    description: 'Token name (e.g. Test Token, max 30 chars)',
  }),
  decimals: flags.integer({
    char: 'd',
    required: false,
    description: 'Decimal precision for token (0 to 9, default: 9)',
  }),
  holder: flags.string({
    char: 'H',
    required: false,
    multiple: true,
    description: 'Allocations of initial token balances (Format: Qaddress:Amount)',
  }),
  fee: flags.string({
    char: 'f',
    required: false,
    description: 'Fee for transaction in Shor (defaults to 100 Shor)',
  }),
  otsindex: flags.string({
    char: 'i',
    required: false,
    description: 'OTS key index to sign with',
  }),
  wallet: flags.string({
    char: 'w',
    required: false,
    description: 'JSON file of wallet to sign transaction from',
  }),
  hexseed: flags.string({
    char: 'h',
    required: false,
    description: 'Hexseed or mnemonic phrase of wallet to sign transaction from',
  }),
  password: flags.string({
    char: 'p',
    required: false,
    description: 'Password if the wallet.json is encrypted',
  }),
  testnet: flags.boolean({
    char: 't',
    default: false,
    description: 'Queries testnet network'
  }),
  mainnet: flags.boolean({
    char: 'm',
    default: false,
    description: 'Queries mainnet network'
  }),
  grpc: flags.string({
    char: 'g',
    required: false,
    description: 'Custom grpc endpoint (-g 127.0.0.1:19009)',
  }),
  json: flags.boolean({
    char: 'j',
    default: false,
    description: 'Print result output in JSON format'
  }),
}

module.exports = TokenCreate
