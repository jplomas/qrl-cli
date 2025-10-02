/* eslint new-cap: 0, max-depth: 0 */
const { Command, flags } = require('@oclif/command')
const { red, white, black, green } = require('kleur')
const ora = require('ora')
const validateQrlAddress = require('@theqrl/validate-qrl-address')
const fs = require('fs')
const aes256 = require('aes256')
const { cli } = require('cli-ux')
const moment = require('moment')

const Qrlnode = require('../functions/grpc')

const shorPerQuanta = 10 ** 9

const openWalletFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)[0]
}

const addressForAPI = (address) => {
  return Buffer.from(address.substring(1), 'hex')
}

// Sleep function for rate limiting
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Format transaction data for console output
const formatTransactionForConsole = (tx, index, queryAddress) => {
  // Handle missing or invalid timestamp
  let timestamp = 'N/A'
  let blockNumber = 'N/A'
  
  if (tx.timestamp) {
    timestamp = moment.unix(tx.timestamp).format('YYYY-MM-DD HH:mm:ss')
  }
  
  if (tx.block_number) {
    blockNumber = tx.block_number
  }
  
  const txType = (tx.tx && tx.tx.transactionType) || 'unknown'
  let amount = 0
  let to = 'N/A'
  
  if (tx.tx && tx.tx.transfer) {
    amount = (parseInt(tx.tx.transfer.amounts[0], 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.transfer.addrs_to[0]).toString('hex')}`
  } else if (tx.tx && tx.tx.coinbase) {
    amount = (parseInt(tx.tx.coinbase.amount, 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.coinbase.addr_to).toString('hex')}`
  } else if (tx.tx && tx.tx.transfer_token) {
    amount = `${tx.tx.transfer_token.amounts[0]} tokens`
    to = `Q${Buffer.from(tx.tx.transfer_token.addrs_to[0]).toString('hex')}`
  }

  const fee = (tx.tx && tx.tx.fee) ? (parseInt(tx.tx.fee, 10) / shorPerQuanta).toFixed(9) : '0.000000000'
  const from = tx.addr_from ? `Q${Buffer.from(tx.addr_from).toString('hex')}` : 'N/A'
  const txHash = (tx.tx && tx.tx.transaction_hash) ? Buffer.from(tx.tx.transaction_hash).toString('hex') : 'N/A'
  
  // Determine direction (IN/OUT) based on address comparison
  let direction = 'N/A'
  if (from === queryAddress) {
    direction = 'OUT'
  } else if (to === queryAddress || (tx.tx && tx.tx.coinbase && `Q${Buffer.from(tx.tx.coinbase.addr_to).toString('hex')}` === queryAddress)) {
    direction = 'IN'
  } else {
    // For transactions like multi_sig operations where the address might be involved differently
    direction = 'MISC'
  }
  
  return {
    index: index + 1,
    timestamp,
    direction,
    type: txType,
    hash: txHash,
    from,
    to,
    amount,
    fee,
    block: blockNumber
  }
}

// Format transaction data for CSV output
const formatTransactionForCSV = (tx, queryAddress) => {
  // Handle missing or invalid timestamp
  let timestamp = 'N/A'
  let blockNumber = 'N/A'
  
  if (tx.timestamp) {
    timestamp = moment.unix(tx.timestamp).format('YYYY-MM-DD HH:mm:ss')
  }
  
  if (tx.block_number) {
    blockNumber = tx.block_number
  }
  
  const txType = (tx.tx && tx.tx.transactionType) || 'unknown'
  let amount = 0
  let to = 'N/A'
  
  if (tx.tx && tx.tx.transfer) {
    amount = (parseInt(tx.tx.transfer.amounts[0], 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.transfer.addrs_to[0]).toString('hex')}`
  } else if (tx.tx && tx.tx.coinbase) {
    amount = (parseInt(tx.tx.coinbase.amount, 10) / shorPerQuanta).toFixed(9)
    to = `Q${Buffer.from(tx.tx.coinbase.addr_to).toString('hex')}`
  } else if (tx.tx && tx.tx.transfer_token) {
    amount = `${tx.tx.transfer_token.amounts[0]} tokens`
    to = `Q${Buffer.from(tx.tx.transfer_token.addrs_to[0]).toString('hex')}`
  }

  const fee = (tx.tx && tx.tx.fee) ? (parseInt(tx.tx.fee, 10) / shorPerQuanta).toFixed(9) : '0.000000000'
  const from = tx.addr_from ? `Q${Buffer.from(tx.addr_from).toString('hex')}` : 'N/A'
  const txHash = (tx.tx && tx.tx.transaction_hash) ? Buffer.from(tx.tx.transaction_hash).toString('hex') : 'N/A'
  
  // Determine direction (IN/OUT) based on address comparison
  let direction = 'N/A'
  if (from === queryAddress) {
    direction = 'OUT'
  } else if (to === queryAddress || (tx.tx && tx.tx.coinbase && `Q${Buffer.from(tx.tx.coinbase.addr_to).toString('hex')}` === queryAddress)) {
    direction = 'IN'
  } else {
    // For transactions like multi_sig operations where the address might be involved differently
    direction = 'MISC'
  }
  
  return [
    timestamp,
    direction,
    txType,
    txHash,
    from,
    to,
    amount,
    fee,
    blockNumber
  ]
}

// Create CSV content
const createCSVContent = (transactions, queryAddress) => {
  const headers = ['Timestamp', 'Direction', 'Type', 'Hash', 'From', 'To', 'Amount', 'Fee', 'Block']
  const csvRows = [headers.join(',')]
  
  transactions.forEach(tx => {
    const row = formatTransactionForCSV(tx, queryAddress)
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

class ListTransactions extends Command {
  async run() {
    const { args, flags } = this.parse(ListTransactions)
    let { address } = args
    
    // Handle wallet file or address validation
    if (!validateQrlAddress.hexString(address).result) {
      // not a valid address - is it a file?
      let isFile = false
      let isValidFile = false
      const path = address
      try {
        if (fs.existsSync(path)) {
          isFile = true
        }
      } catch (error) {
        this.log(`${red('⨉')} Unable to list transactions: invalid QRL address/wallet file - ${error.message}`)
        this.exit(1)
      }
      if (isFile === false) {
        this.log(`${red('⨉')} Unable to list transactions: invalid QRL address/wallet file`)
        this.exit(1)
      } else {
        const walletJson = openWalletFile(path)
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
            address = aes256.decrypt(password, walletJson.address)
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
        this.log(`${red('⨉')} Unable to list transactions: invalid QRL address/wallet file`)
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

    // Get the exact transaction count for this address
    const stateSpinner = ora({ text: 'Getting transaction count...' }).start()
    let totalTransactionCount = 0
    let estimatedTotal = null
    let estimatedPages = null
    
    try {
      const stateRequest = {
        address: addressForAPI(address),
      }
      const stateResponse = await Qrlnetwork.api('GetOptimizedAddressState', stateRequest)
      
      if (stateResponse.state && stateResponse.state.transaction_hash_count) {
        totalTransactionCount = parseInt(stateResponse.state.transaction_hash_count, 10)
        if (totalTransactionCount > 0) {
          estimatedTotal = totalTransactionCount
          estimatedPages = Math.ceil(totalTransactionCount / (flags.limit || 100))
          stateSpinner.succeed(`Found ${totalTransactionCount} transactions (${estimatedPages} pages)`)
        } else {
          stateSpinner.succeed('No transactions found for this address')
          this.log(`${green('✓')} No transactions found for address ${address}`)
          return
        }
      } else {
        stateSpinner.succeed('Address found (transaction count will be determined during fetch)')
      }
    } catch (error) {
      stateSpinner.warn(`Could not get address state (${error.message}) - continuing with fetch`)
    }

    // Fetch transactions with pagination
    const allTransactions = []
    const itemsPerPage = flags.limit || 100
    let currentPage = 1
    let hasMorePages = true
    let totalFetched = 0
    // estimatedTotal and estimatedPages are set above from transaction_hash_count

    this.log(`${white().bgBlue(' Fetching Transactions ')}\n`)

    while (hasMorePages) {
      let progressText = `${white('Page')} ${green(currentPage.toString())}`
      
      if (estimatedPages) {
        progressText += ` ${white('of')} ${green(estimatedPages.toString())}`
      }
      
      progressText += ` ${white('│')} ${green(totalFetched.toString())}`
      
      if (estimatedTotal) {
        progressText += ` ${white('of')} ${green(estimatedTotal.toString())}`
      }
      
      progressText += ` ${white('transactions')}`
      
      const fetchSpinner = ora({ text: progressText }).start()

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
          
          // Update estimates based on actual data
          if (totalTransactionCount === 0) {
            // We don't have exact count, so estimate dynamically
            if (currentPage === 1 && response.transactions_detail.length === itemsPerPage) {
              // Conservative estimate: assume at least 2-3 more pages if first page is full
              estimatedTotal = `${totalFetched * 3}+`
              estimatedPages = `${currentPage + 2}+`
            } else if (currentPage === 2 && response.transactions_detail.length === itemsPerPage) {
              // Better estimate after 2 full pages
              estimatedTotal = `${totalFetched * 2}+`
              estimatedPages = `${currentPage + 1}+`
            }
          }
          
          let successText = `Page ${currentPage.toString()}`
          
          if (estimatedPages && !estimatedPages.toString().includes('+')) {
            successText += ` of ${estimatedPages.toString()}`
          } else if (estimatedPages) {
            successText += ` (est. ${estimatedPages.toString()})`
          }
          
          successText += ` │ ${response.transactions_detail.length.toString()} new │ `
          successText += `${totalFetched.toString()}`
          
          if (estimatedTotal && !estimatedTotal.toString().includes('+')) {
            successText += ` of ${estimatedTotal.toString()}`
          } else if (estimatedTotal) {
            successText += ` of ${estimatedTotal.toString()}`
          }
          
          successText += ` total`
          
          fetchSpinner.succeed(successText)
          
          // Check if we have more pages
          if (response.transactions_detail.length < itemsPerPage) {
            hasMorePages = false
            // Update final counts now that we know the actual total
            estimatedTotal = totalFetched
            estimatedPages = currentPage
          } else {
            currentPage += 1
            // Rate limiting: 5 second pause between pages
            if (hasMorePages) {
              let countdown = 5
              const pauseSpinner = ora({ 
                text: `${white('Pausing')} ${green(countdown.toString())} ${white('seconds to respect API limits...')}` 
              }).start()
              
              const countdownInterval = setInterval(() => {
                countdown -= 1
                if (countdown > 0) {
                  pauseSpinner.text = `${white('Pausing')} ${green(countdown.toString())} ${white('seconds to respect API limits...')}`
                } else {
                  clearInterval(countdownInterval)
                  pauseSpinner.succeed('Ready for next page')
                }
              }, 1000)
              
              // eslint-disable-next-line no-await-in-loop
              await sleep(5000)
            }
          }
        } else {
          hasMorePages = false
          if (currentPage === 1) {
            fetchSpinner.succeed('No transactions found for this address')
          } else {
            fetchSpinner.succeed(
              `Page ${currentPage.toString()} │ ` +
              `0 new transactions │ ` +
              `${totalFetched.toString()} total │ End of data`
            )
          }
        }
      } catch (error) {
        fetchSpinner.fail(`Page ${currentPage.toString()} │ ${error.message}`)
        this.exit(1)
      }
    }

    if (allTransactions.length === 0) {
      this.log(`${green('✓')} No transactions found for address ${address}`)
      return
    }
    
    this.log(`\n${green('🎉')} ${white('Fetch Complete!')}`)
    this.log(`${white('├─')} ${green(allTransactions.length.toString())} ${white('total transactions')}`)
    this.log(`${white('└─')} ${green(currentPage.toString())} ${white('pages fetched')}\n`)

    // Output to console
    if (!flags.csv || !flags.quiet) {
      this.log(`\n${white().bgBlue(' Transaction Summary ')}`)
      this.log('═'.repeat(135))
      this.log(
        `${'#'.padEnd(4)} ${'Timestamp'.padEnd(20)} ${'Dir'.padEnd(5)} ${'Type'.padEnd(12)} ${'Hash'.padEnd(66)} ${'Amount'.padEnd(15)} ${'Fee'.padEnd(12)}`
      )
      this.log('─'.repeat(135))

      allTransactions.forEach((tx, index) => {
        const formatted = formatTransactionForConsole(tx, index, address)
        this.log(
          `${formatted.index.toString().padEnd(4)} ${formatted.timestamp.padEnd(20)} ${formatted.direction.padEnd(5)} ${formatted.type.padEnd(12)} ${formatted.hash.padEnd(66)} ${formatted.amount.toString().padEnd(15)} ${formatted.fee.padEnd(12)}`
        )
      })
      this.log('═'.repeat(135))
    }

    // Output to CSV file if requested
    if (flags.csv) {
      try {
        const csvContent = createCSVContent(allTransactions, address)
        fs.writeFileSync(flags.csv, csvContent, 'utf8')
        this.log(`${green('✓')} Transactions exported to CSV file: ${flags.csv}`)
      } catch (error) {
        this.log(`${red('⨉')} Failed to write CSV file: ${error.message}`)
        this.exit(1)
      }
    }
  }
}

ListTransactions.description = `List transaction history for a QRL address to console and optionally to CSV file

Fetches all transactions for a given QRL address and displays them in a formatted table.
Supports exporting to CSV format and includes rate limiting to avoid overwhelming the API.

The command implements a 5-second pause between API pages to respect rate limits.
Use the --limit flag to control how many transactions are fetched per API call.

Documentation at https://docs.theqrl.org/developers/qrl-cli
`

ListTransactions.args = [
  {
    name: 'address',
    description: 'QRL address or wallet.json file to list transactions for',
    required: true,
  },
]

ListTransactions.flags = {
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

module.exports = { ListTransactions }
