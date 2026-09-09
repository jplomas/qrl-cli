/* eslint new-cap: 0, max-depth: 0 */
const { Command, flags } = require('@oclif/command')
const { red, white, black, green } = require('kleur')
const ora = require('ora')
const validateQrlAddress = require('@theqrl/validate-qrl-address')
const fs = require('fs')
const { cli } = require('cli-ux')
const moment = require('moment')

const aes = require('../utils/aes')
const Qrlnode = require('../functions/grpc')

const shorPerQuanta = 10 ** 9

const openWalletFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)[0]
}

const addressForAPI = (address) => Buffer.from(address.substring(1), 'hex')

// Sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => {
  setTimeout(resolve, ms)
})

// Format transaction data for console output
const formatTransactionForConsole = (tx, index) => {
  const timestamp = moment.unix(tx.header.timestamp_seconds).format('YYYY-MM-DD HH:mm:ss')
  const txType = tx.tx.transactionType || 'unknown'
  let amount = 0
  let to = 'N/A'
  
  if (tx.tx.transfer) {
    amount = (parseInt(tx.tx.transfer.amounts[0], 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.transfer.addrs_to[0]).toString('hex')}`
  } else if (tx.tx.coinbase) {
    amount = (parseInt(tx.tx.coinbase.amount, 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.coinbase.addr_to).toString('hex')}`
  } else if (tx.tx.transfer_token) {
    amount = `${tx.tx.transfer_token.amounts[0]} tokens`
    to = `Q${Buffer.from(tx.tx.transfer_token.addrs_to[0]).toString('hex')}`
  }

  const fee = (parseInt(tx.tx.fee, 10) / shorPerQuanta).toFixed(9)
  const from = `Q${Buffer.from(tx.addr_from).toString('hex')}`
  const txHash = Buffer.from(tx.tx.transaction_hash).toString('hex')
  
  return {
    index: index + 1,
    timestamp,
    type: txType,
    hash: txHash,
    from,
    to,
    amount,
    fee,
    block: tx.header.block_number
  }
}

// Format transaction data for CSV output
const formatTransactionForCSV = (tx) => {
  const timestamp = moment.unix(tx.header.timestamp_seconds).format('YYYY-MM-DD HH:mm:ss')
  const txType = tx.tx.transactionType || 'unknown'
  let amount = 0
  let to = 'N/A'
  
  if (tx.tx.transfer) {
    amount = (parseInt(tx.tx.transfer.amounts[0], 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.transfer.addrs_to[0]).toString('hex')}`
  } else if (tx.tx.coinbase) {
    amount = (parseInt(tx.tx.coinbase.amount, 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.coinbase.addr_to).toString('hex')}`
  } else if (tx.tx.transfer_token) {
    amount = `${tx.tx.transfer_token.amounts[0]} tokens`
    to = `Q${Buffer.from(tx.tx.transfer_token.addrs_to[0]).toString('hex')}`
  }

  const fee = (parseInt(tx.tx.fee, 10) / shorPerQuanta).toFixed(9)
  const from = `Q${Buffer.from(tx.addr_from).toString('hex')}`
  const txHash = Buffer.from(tx.tx.transaction_hash).toString('hex')
  
  return [
    timestamp,
    txType,
    txHash,
    from,
    to,
    amount,
    fee,
    tx.header.block_number
  ]
}

// Create CSV content
const createCSVContent = (transactions) => {
  const headers = ['Timestamp', 'Type', 'Hash', 'From', 'To', 'Amount', 'Fee', 'Block']
  const csvRows = [headers.join(',')]
  
  transactions.forEach(tx => {
    const row = formatTransactionForCSV(tx)
    // Escape any commas in the data
    const escapedRow = row.map(field => {
      if (typeof field === 'string' && field.includes(',')) {
        return `"${field}"`
      }
      return field
    })
    csvRows.push(escapedRow.join(','))
  })
  
  return csvRows.join('\n')
}

class DumpTransactions extends Command {
  async run() {
    const { args, flags } = this.parse(DumpTransactions)
    let { address } = args
    
    // Handle wallet file or address validation
    if (!validateQrlAddress.hexString(address).result) {
      // not a valid address - is it a file?
      let isFile = false
      let isValidFile = false
      const path = address
      let walletJson
      // The read belongs inside the try: existsSync says yes to anything on disk, including a
      // directory, and reading one throws. Left outside, that escaped as a raw EISDIR instead
      // of the message below.
      try {
        if (fs.existsSync(path)) {
          isFile = true
          walletJson = openWalletFile(path)
        }
      } catch (error) {
        this.log(`${red('⨉')} Unable to dump transactions: invalid QRL address/wallet file - ${error.message}`)
        this.exit(1)
      }
      if (isFile === false) {
        this.log(`${red('⨉')} Unable to dump transactions: invalid QRL address/wallet file`)
        this.exit(1)
      } else {
        try {
          if (walletJson.encrypted === false) {
            isValidFile = true
            address = walletJson.address
          }
          if (walletJson.encrypted === true) {
            let password = ''
            if (flags.password) {
              password = flags.password
            } else {
              password = await cli.prompt('Enter password for wallet file', { type: 'hide' })
            }
            address = aes.decrypt(password, walletJson.address)
            if (validateQrlAddress.hexString(address).result) {
              isValidFile = true
            } else {
              this.log(`${red('⨉')} Unable to open wallet file: invalid password`)
              this.exit(1)
            }
          }
        } catch (error) {
          this.log(`${red('⨉')} Error decrypting wallet: ${error.message}`)
          this.exit(1)
        }
        this.log(`${black().bgWhite(address)}`)
      }
      if (isValidFile === false) {
        this.log(`${red('⨉')} Unable to dump transactions: invalid QRL address/wallet file`)
        this.exit(1)
      }
    }

    // Network configuration
    let grpcEndpoint = 'mainnet-3.automated.theqrl.org:19009'
    let network = 'Mainnet'
    if (flags.grpc) {
      grpcEndpoint = flags.grpc
      network = `Custom GRPC endpoint: [${flags.grpc}]`
    }
    if (flags.testnet) {
      grpcEndpoint = 'testnet-3.automated.theqrl.org:19009'
      network = 'Testnet'
    }
    if (flags.mainnet) {
      grpcEndpoint = 'mainnet-3.automated.theqrl.org:19009'
      network = 'Mainnet'
    }

    this.log(white().bgBlue(network))
    this.log(`${black().bgWhite('Address:')} ${address}`)

    const spinner = ora({ text: 'Connecting to node...' }).start()
    const Qrlnetwork = await new Qrlnode(grpcEndpoint)
    
    try {
      await Qrlnetwork.connect()
      // verify we have connected and try again if not
      let i = 0
      const count = 5
      while (Qrlnetwork.connection === false && i < count) {
        spinner.text = `retry connection attempt: ${i}...`
        // eslint-disable-next-line no-await-in-loop
        await Qrlnetwork.connect()
        // eslint-disable-next-line no-plusplus
        i++
      }
    } catch (e) {
      spinner.fail(`Failed to connect to node. Check network connection & parameters.\n${e}`)
      this.exit(1)
    }

    if (Qrlnetwork.connection === false) {
      spinner.fail('Failed to establish connection to node')
      this.exit(1)
    }

    spinner.succeed('Connected to node')

    // Fetch transactions with pagination
    const allTransactions = []
    const itemsPerPage = flags.limit || 100
    let currentPage = 1
    let hasMorePages = true
    let totalFetched = 0

    while (hasMorePages) {
      const fetchSpinner = ora({ 
        text: `Fetching page ${currentPage} (${totalFetched} transactions so far)...` 
      }).start()

      try {
        const request = {
          address: addressForAPI(address),
          item_per_page: itemsPerPage,
          page_number: currentPage,
        }

        // eslint-disable-next-line no-await-in-loop
        const response = await Qrlnetwork.api('GetTransactionsByAddress', request)
        
        if (response.transactions_detail && response.transactions_detail.length > 0) {
          allTransactions.push(...response.transactions_detail)
          totalFetched += response.transactions_detail.length
          fetchSpinner.succeed(`Fetched page ${currentPage}: ${response.transactions_detail.length} transactions`)
          
          // Check if we have more pages
          if (response.transactions_detail.length < itemsPerPage) {
            hasMorePages = false
          } else {
            currentPage += 1
            // Rate limiting: 5 second pause between pages. This arm is only reached while
            // there are more pages to fetch, so no further check is needed.
            const pauseSpinner = ora({ text: 'Pausing 5 seconds to avoid hitting API limits...' }).start()
            // eslint-disable-next-line no-await-in-loop
            await sleep(5000)
            pauseSpinner.succeed('Pause completed')
          }
        } else {
          hasMorePages = false
          if (currentPage === 1) {
            fetchSpinner.succeed('No transactions found for this address')
          } else {
            fetchSpinner.succeed(`Fetched page ${currentPage}: 0 transactions (end of data)`)
          }
        }
      } catch (error) {
        fetchSpinner.fail(`Failed to fetch page ${currentPage}: ${error.message}`)
        this.exit(1)
      }
    }

    if (allTransactions.length === 0) {
      this.log(`${green('✓')} No transactions found for address ${address}`)
      return
    }

    this.log(`${green('✓')} Total transactions fetched: ${allTransactions.length}`)

    // Output to console
    if (!flags.csv || !flags.quiet) {
      this.log(`\n${white().bgBlue(' Transaction Summary ')}`)
      this.log('═'.repeat(120))
      this.log(
        `${'#'.padEnd(4)} ${'Timestamp'.padEnd(20)} ${'Type'.padEnd(12)} ${'Hash'.padEnd(66)} ${'Amount'.padEnd(15)} ${'Fee'.padEnd(12)}`
      )
      this.log('─'.repeat(120))

      allTransactions.forEach((tx, index) => {
        const formatted = formatTransactionForConsole(tx, index)
        this.log(
          `${formatted.index.toString().padEnd(4)} ${formatted.timestamp.padEnd(20)} ${formatted.type.padEnd(12)} ${formatted.hash.padEnd(66)} ${formatted.amount.toString().padEnd(15)} ${formatted.fee.padEnd(12)}`
        )
      })
      this.log('═'.repeat(120))
    }

    // Output to CSV file if requested
    if (flags.csv) {
      try {
        const csvContent = createCSVContent(allTransactions)
        fs.writeFileSync(flags.csv, csvContent, 'utf8')
        this.log(`${green('✓')} Transactions exported to CSV file: ${flags.csv}`)
      } catch (error) {
        this.log(`${red('⨉')} Failed to write CSV file: ${error.message}`)
        this.exit(1)
      }
    }
  }
}

DumpTransactions.description = `Dump transaction list for a QRL address to console and optionally to CSV file

Fetches all transactions for a given QRL address and displays them in a formatted table.
Supports exporting to CSV format and includes rate limiting to avoid overwhelming the API.

The command implements a 5-second pause between API pages to respect rate limits.
Use the --limit flag to control how many transactions are fetched per API call.

Documentation at https://docs.theqrl.org/developers/qrl-cli
`

DumpTransactions.args = [
  {
    name: 'address',
    description: 'QRL address or wallet.json file to dump transactions for',
    required: true,
  },
]

DumpTransactions.flags = {
  testnet: flags.boolean({
    char: 't',
    default: false,
    description: 'Query testnet network for transactions'
  }),
  mainnet: flags.boolean({
    char: 'm',
    default: false,
    description: 'Query mainnet network for transactions'
  }),
  grpc: flags.string({
    char: 'g',
    required: false,
    description: 'Custom grpc endpoint to connect a hosted QRL node (-g 127.0.0.1:19009)',
  }),
  password: flags.string({
    char: 'p',
    required: false,
    description: 'Encrypted QRL wallet.json password to decrypt',
  }),
  csv: flags.string({
    char: 'c',
    required: false,
    description: 'Export transactions to CSV file (provide filename)',
  }),
  limit: flags.integer({
    char: 'l',
    default: 100,
    description: 'Number of transactions to fetch per API call (default: 100)',
  }),
  quiet: flags.boolean({
    char: 'q',
    default: false,
    description: 'Suppress console output when using CSV export',
  }),
}

module.exports = { DumpTransactions }