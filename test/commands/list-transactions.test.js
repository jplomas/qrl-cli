const assert = require('assert')
const {spawn} = require('child_process')
const crypto = require('crypto')
const fs = require('fs')

const testSetup = require('../test_setup')

// Suites that query a live QRL node (mainnet/testnet). Skipped in offline mode: the repo's
// existing pattern (see search.test.js / get-keys.test.js) so an offline pass never leaves the
// machine. The node-dependent code paths they cover are listed in the offline suite below.
const describeOnline = process.env.QRL_TEST_OFFLINE === 'true' ? describe.skip : describe

const processFlags = {
  stdio: 'pipe', // Changed from 'inherit' to 'pipe' to better control output
}

// Track active processes for cleanup
const activeProcesses = []

// Cleanup function to kill all active processes
function cleanupProcesses() {
  activeProcesses.forEach((childProcess) => {
    if (!childProcess.killed) {
      childProcess.kill('SIGTERM')
    }
  })
  activeProcesses.length = 0
}

// Handle process interruption
process.on('SIGINT', () => {
  cleanupProcesses()
  process.exit(0)
})

process.on('SIGTERM', () => {
  cleanupProcesses()
  process.exit(0)
})

// Helper function to add delay between tests to prevent API rate limiting
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// Helper function for wallet file creation
function createWalletIfNeeded(walletPath, isEncrypted = false, password = null) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(walletPath)) {
      resolve()
      return
    }
    
    const createWalletArgs = [
      'create-wallet',
      '-h', '6',
      '-f', walletPath
    ]
    
    if (isEncrypted && password) {
      createWalletArgs.push('-p', password)
    }
    
    const createProcess = spawn('./bin/run', createWalletArgs, processFlags)
    
    createProcess.on('exit', (createCode) => {
      if (createCode === 0) {
        resolve()
      } else {
        reject(new Error(`Failed to create wallet file: ${walletPath}`))
      }
    })
    
    createProcess.on('error', (err) => {
      reject(err)
    })
  })
}

// no args
describe('list-transactions #1', () => {
  let exitCode
  before((done) => {
    const args = ['list-transactions']
    const childProcess = spawn('./bin/run', args, processFlags)
    activeProcesses.push(childProcess)
    
    childProcess.on('exit', (code) => {
      exitCode = code
      const index = activeProcesses.indexOf(childProcess)
      if (index > -1) activeProcesses.splice(index, 1)
      done()
    })
    
    childProcess.on('error', (err) => {
      const index = activeProcesses.indexOf(childProcess)
      if (index > -1) activeProcesses.splice(index, 1)
      done(err)
    })
  })
  it('exit code should be non-0 if passed without an argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad address - too short
describe('list-transactions #2', () => {
  let exitCode
  before((done) => {
    const args = [
      'list-transactions',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad address- too short', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad address - starts with 'a'
describe('list-transactions #3', () => {
  let exitCode
  before((done) => {
    const args = [
      'list-transactions',
      'a010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad address- starts with a', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// invalid address
describe('list-transactions #4', () => {
  let exitCode
  before((done) => {
    const args = [
      'list-transactions',
      'invalid-address',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with invalid address', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad address file
describe('list-transactions #5', () => {
  let exitCode
  before((done) => {
    const args = [
      'list-transactions',
      testSetup.notAWalletFile,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad address- not an address file', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad encrypted address file password
describe('list-transactions #6', () => {
  let exitCode
  before((done) => {
    const args = [
      'list-transactions',
      testSetup.encWalletFile,
      '-p',
      'notThePass',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad address password- wrong password', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// not valid grpc address
describe('list-transactions #7', () => {
  let exitCode
  before(async function listTransactionsTest7() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    const args = [
      'list-transactions',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
      '-g',
      'https://brooklyn.theqrl.org/nottheapi/',
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be non-0 if API is down or Node address invalid', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// mainnet list-transactions
describeOnline('list-transactions #8', () => {
  let exitCode
  before(async function listTransactionsTest8() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    const args = [
      'list-transactions',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3'
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid address as argument', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success with quiet flag
describeOnline('list-transactions #9', () => {
  let exitCode
  before(async function listTransactionsTest9() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    const args = [
      'list-transactions', 
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
      '-q',
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid address and -q flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success with limit flag
describeOnline('list-transactions #10', () => {
  let exitCode
  before(async function listTransactionsTest10() {
    this.timeout(240000) // Increased timeout to account for API delays and multiple pages
    await delay(5000) // 5 second delay to prevent API rate limiting
    const args = [
      'list-transactions',
      'Q000400e9910eb0b8ff824a017b400b8ea743a32ee35e958575a898eeb1fe796d6f14eb3f51897b',
      '--limit',
      '10',
      '-t',
    ]
    const childProcess = spawn('./bin/run', args, processFlags)
    activeProcesses.push(childProcess)
    
    return new Promise((resolve, reject) => {
      childProcess.on('exit', (code) => {
        exitCode = code
        const index = activeProcesses.indexOf(childProcess)
        if (index > -1) activeProcesses.splice(index, 1)
        resolve()
      })
      childProcess.on('error', (err) => {
        const index = activeProcesses.indexOf(childProcess)
        if (index > -1) activeProcesses.splice(index, 1)
        reject(err)
      })
    })
  })
  it('exit code should be 0 if passed with a valid address and limit flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success testnet
describeOnline('list-transactions #11', () => {
  let exitCode
  before(async function listTransactionsTest11() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    const args = ['list-transactions', 'Q000400e9910eb0b8ff824a017b400b8ea743a32ee35e958575a898eeb1fe796d6f14eb3f51897b', '-t']
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid testnet address and -t flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success mainnet
describeOnline('list-transactions #12', () => {
  let exitCode
  before(async function listTransactionsTest12() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    const args = [
      'list-transactions', 
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
      '-m',
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid address and -m flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success wallet file
describeOnline('list-transactions #13', () => {
  let exitCode
  before(async function listTransactionsTest13() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    
    // Create wallet file if it doesn't exist
    await createWalletIfNeeded(testSetup.walletFile, false, null)
    
    // Now run the list-transactions command
    const args = [
      'list-transactions', 
      testSetup.walletFile,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid wallet file and testnet flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success enc-wallet file
describeOnline('list-transactions #14', () => {
  let exitCode
  before(async function listTransactionsTest14() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    
    // Create encrypted wallet file if it doesn't exist
    await createWalletIfNeeded(testSetup.encWalletFile, true, testSetup.encPass)
    
    // Now run the list-transactions command
    const args = [
      'list-transactions', 
      testSetup.encWalletFile,
      '-p',
      testSetup.encPass,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid encrypted wallet file and password flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success with CSV output
describeOnline('list-transactions #15', () => {
  let exitCode
  before(async function listTransactionsTest15() {
    this.timeout(60000)
    await delay(5000) // 5 second delay to prevent API rate limiting
    const args = [
      'list-transactions',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
      '--csv',
      'test_transactions.csv',
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid address and CSV output flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})
// ///////////////////////////////////////////////////////////////////////////
// list-transactions: offline coverage suite
//
// This command is a read-only node query with a paginating fetch loop, so
// everything from "connected" onwards needs a node. What *is* reachable offline
// is the front half: STDIN input, address validation, wallet-file opening and
// decryption (including the legacy encryption format), the --json mode branches
// that suppress every spinner, and the connection-failure path.
//
// Every case here either stops at a validation gate or dies connecting to a
// closed loopback port. Nothing contacts mainnet or testnet.
// ///////////////////////////////////////////////////////////////////////////

// A closed port on loopback: resolves, refuses the connection, exits. Never leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

const LTX_WALLET = '/tmp/list-transactions-wallet.json'
// Pre-v2 (`aes256` package) encryption: unauthenticated, so a wrong password
// returns garbage instead of throwing. It is the only way to reach the
// "invalid password" branch, which validates the decrypted address.
const LTX_LEGACY_WALLET = '/tmp/list-transactions-wallet-legacy.json'
const LTX_BAD_WALLET = '/tmp/list-transactions-bad-wallet.json'
const LTX_NO_FLAG_WALLET = '/tmp/list-transactions-no-encrypted-flag-wallet.json'
const LTX_PASSWORD = 'testpassword'
const LTX_ADDRESS = 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3'

// Run the CLI and capture what it said. `input`, when given, is written to STDIN.
function runLtx(args, input) {
  return new Promise((resolve) => {
    const child = spawn('./bin/run', args, {stdio: ['pipe', 'pipe', 'pipe']})
    let out = ''
    child.stdout.on('data', (d) => {
      out += d.toString()
    })
    child.stderr.on('data', (d) => {
      out += d.toString()
    })
    child.on('close', (code) => resolve({code, out}))
    if (input !== undefined) {
      child.stdin.write(input)
    }
    child.stdin.end()
  })
}

function ltxRefuses(args, expected, input) {
  return runLtx(args, input).then(({code, out}) => {
    assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}\n--- output ---\n${out}`)
    assert.ok(expected.test(out), `expected output to match ${expected}\n--- actual ---\n${out}`)
  })
}

function createLtxWallet(file, password) {
  return new Promise((resolve, reject) => {
    const args = ['create-wallet', '-h', '6', '-f', file]
    if (password) {
      args.push('-p', password)
    }
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'ignore', 'ignore']})
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`create-wallet exited ${code}`))))
    child.on('error', reject)
  })
}

// Legacy `aes256` blob: key = sha256(password), AES-256-CTR, base64(iv || ciphertext).
function legacyEncryptLtx(password, plaintext) {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(String(password)).digest()
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  return Buffer.concat([iv, ciphertext]).toString('base64')
}

describe('list-transactions: offline coverage', () => {
  let plainWallet

  before(async function createLtxFixtures() {
    this.timeout(120000)
    await createLtxWallet(LTX_WALLET, null)
    ;[plainWallet] = JSON.parse(fs.readFileSync(LTX_WALLET))

    fs.writeFileSync(
      LTX_LEGACY_WALLET,
      JSON.stringify([
        {
          encrypted: true,
          address: legacyEncryptLtx(LTX_PASSWORD, plainWallet.address),
          addressB32: legacyEncryptLtx(LTX_PASSWORD, plainWallet.addressB32),
          pk: legacyEncryptLtx(LTX_PASSWORD, plainWallet.pk),
          hexseed: legacyEncryptLtx(LTX_PASSWORD, plainWallet.hexseed),
          mnemonic: legacyEncryptLtx(LTX_PASSWORD, plainWallet.mnemonic),
          height: plainWallet.height,
          hashFunction: plainWallet.hashFunction,
          signatureType: plainWallet.signatureType,
          index: plainWallet.index,
        },
      ])
    )

    // Valid JSON, but not a wallet: `JSON.parse(contents)[0]` is undefined, so
    // reading `.encrypted` off it throws inside the command's try/catch.
    fs.writeFileSync(LTX_BAD_WALLET, JSON.stringify({not: 'a wallet'}))

    // Shaped like a wallet but with no `encrypted` key: neither the plaintext nor the
    // encrypted branch runs, so the file is never accepted and the command must say so
    // rather than falling through and querying the filename as an address.
    fs.writeFileSync(LTX_NO_FLAG_WALLET, JSON.stringify([{address: LTX_ADDRESS}]))
  })

  after(() => {
    [LTX_WALLET, LTX_LEGACY_WALLET, LTX_BAD_WALLET, LTX_NO_FLAG_WALLET].forEach((file) => {
      try {
        fs.unlinkSync(file)
      } catch (err) {
        // fixture already gone; nothing to clean up
      }
    })
  })

  describe('address input', () => {
    it('reads the address from STDIN when the argument is "-"', async function stdinDash() {
      this.timeout(60000)
      await ltxRefuses(['list-transactions', '-', '-g', DEAD_NODE], /Failed to connect to node/, `${LTX_ADDRESS}\n`)
    })

    it('reads the address from STDIN when no argument is given and STDIN is a pipe', async function stdinPipe() {
      this.timeout(60000)
      await ltxRefuses(['list-transactions', '-g', DEAD_NODE], /Failed to connect to node/, `${LTX_ADDRESS}\n`)
    })

    it('explains what is missing when STDIN is a pipe carrying nothing', async function stdinEmpty() {
      this.timeout(60000)
      await ltxRefuses(['list-transactions'], /Missing QRL address or wallet file/, '')
    })
  })

  describe('wallet files', () => {
    it('reads the address out of an unencrypted wallet file', async function plainWalletFile() {
      this.timeout(60000)
      const {code, out} = await runLtx(['list-transactions', LTX_WALLET, '-g', DEAD_NODE])
      assert.notStrictEqual(code, 0)
      assert.ok(out.includes(plainWallet.address), `expected the wallet address in the output\n--- actual ---\n${out}`)
      assert.ok(/Failed to connect to node/.test(out), `--- actual ---\n${out}`)
    })

    it('decrypts a legacy-format wallet file with the right password', async function legacyWalletFile() {
      this.timeout(60000)
      const {code, out} = await runLtx([
        'list-transactions',
        LTX_LEGACY_WALLET,
        '-p',
        LTX_PASSWORD,
        '-g',
        DEAD_NODE,
      ])
      assert.notStrictEqual(code, 0)
      assert.ok(out.includes(plainWallet.address), `expected the decrypted address in the output\n--- actual ---\n${out}`)
    })

    it('refuses a legacy-format wallet file when the password is wrong', async function legacyWalletBadPassword() {
      this.timeout(60000)
      await ltxRefuses(
        ['list-transactions', LTX_LEGACY_WALLET, '-p', 'not-the-password'],
        /Unable to open wallet file: invalid password/
      )
    })

    it('refuses a wallet file with no "encrypted" key', async function noEncryptedFlag() {
      this.timeout(60000)
      await ltxRefuses(
        ['list-transactions', LTX_NO_FLAG_WALLET],
        /Unable to list transactions: invalid QRL address\/wallet file/
      )
    })

    it('reports a decryption error for a JSON file that is not a wallet', async function notAWallet() {
      this.timeout(60000)
      await ltxRefuses(['list-transactions', LTX_BAD_WALLET], /Error decrypting wallet/)
    })
  })

  describe('--json output mode', () => {
    it('suppresses the spinner and reports the connection failure as a log line', async function jsonConnectFailure() {
      this.timeout(60000)
      const {code, out} = await runLtx(['list-transactions', LTX_ADDRESS, '-j', '-g', DEAD_NODE])
      assert.notStrictEqual(code, 0)
      assert.ok(/Failed to connect to node/.test(out), `--- actual ---\n${out}`)
      // The human banner and address header must not pollute JSON mode
      assert.ok(!/Custom GRPC endpoint/.test(out), `--- actual ---\n${out}`)
      assert.ok(!/Address:/.test(out), `--- actual ---\n${out}`)
    })

    it('does not print the wallet address banner in --json mode', async function jsonWalletFile() {
      this.timeout(60000)
      const {code, out} = await runLtx(['list-transactions', LTX_WALLET, '-j', '-g', DEAD_NODE])
      assert.notStrictEqual(code, 0)
      assert.ok(/Failed to connect to node/.test(out), `--- actual ---\n${out}`)
    })
  })

  describe('node connection', () => {
    it('fails with a spinner message when the node is unreachable', async function deadNode() {
      this.timeout(60000)
      await ltxRefuses(['list-transactions', LTX_ADDRESS, '-g', DEAD_NODE], /Failed to connect to node/)
    })

    it('still fails on an unreachable node when --limit and --csv are given', async function deadNodeWithFlags() {
      this.timeout(60000)
      // --csv only writes after a successful fetch, so an unreachable node must not
      // leave a partial file behind.
      const csvPath = '/tmp/list-transactions-offline.csv'
      try {
        fs.unlinkSync(csvPath)
      } catch (err) {
        // no file to remove
      }
      await ltxRefuses(
        ['list-transactions', LTX_ADDRESS, '--limit', '10', '--csv', csvPath, '-g', DEAD_NODE],
        /Failed to connect to node/
      )
      assert.strictEqual(fs.existsSync(csvPath), false, 'no CSV file may be written when the fetch never happened')
    })
  })
})

// ///////////////////////////////////////////////////////////////////////////
// list-transactions: node-dependent coverage
//
// The suite above stops wherever a node would be needed. This one covers the
// other half - the address-state query, the paginating fetch loop, the console
// table, the CSV writer and --json mode - by running the command in *this*
// process against a stub gRPC client.
//
// src/functions/grpc is swapped in the require cache for the single moment it
// takes to require the command (the command captures Qrlnode at require time),
// then the real module is put straight back. There is no server and no socket,
// so nothing here leaves the machine and no OTS key is consumed: this command
// only ever reads.
// ///////////////////////////////////////////////////////////////////////////

// Behaviour the stub should show for the test currently running. Reset per test.
let ltxNode = {}

// What the command asked the node for, so the tests can assert on page numbers
// and page size rather than just on the printed output.
let ltxRequests = []

// How many times the command called connect(): the retry loop only rewrites
// spinner text, which prints nothing when stderr is not a terminal.
let ltxConnectAttempts = 0

class LtxFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    ltxConnectAttempts += 1
    if (ltxNode.connectThrows) {
      throw new Error(ltxNode.connectThrows)
    }
    // connectsOnAttempt of 0 means "never connects", which is what the real client
    // does when the node answers but fails the proto hash check.
    const connectsOn = ltxNode.connectsOnAttempt === undefined ? 1 : ltxNode.connectsOnAttempt
    if (connectsOn !== 0 && ltxConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    ltxRequests.push({name, request})
    if (name === 'GetOptimizedAddressState') {
      if (ltxNode.stateThrows) {
        throw new Error(ltxNode.stateThrows)
      }
      return ltxNode.state === undefined ? {} : ltxNode.state
    }
    if (ltxNode.apiThrows) {
      throw new Error(ltxNode.apiThrows)
    }
    const page = (ltxNode.pages || [])[request.page_number - 1] || []
    return {transactions_detail: page}
  }
}

const ltxGrpcPath = require.resolve('../../src/functions/grpc')
const ltxCommandPath = require.resolve('../../src/commands/list-transactions')

const ltxRealGrpcEntry = require.cache[ltxGrpcPath]
require.cache[ltxGrpcPath] = {
  id: ltxGrpcPath,
  filename: ltxGrpcPath,
  path: require('path').dirname(ltxGrpcPath), // eslint-disable-line global-require
  loaded: true,
  children: [],
  paths: [],
  exports: LtxFakeQrlNode,
}
const {ListTransactions} = require('../../src/commands/list-transactions')

if (ltxRealGrpcEntry) {
  require.cache[ltxGrpcPath] = ltxRealGrpcEntry
} else {
  delete require.cache[ltxGrpcPath]
}

// Run the command here, against the stub, capturing everything it prints
// (this.log goes to stdout, the ora spinners go to stderr).
async function runLtxOffline(argv) {
  const chunks = []
  const realStdout = process.stdout.write
  const realStderr = process.stderr.write
  const capture = (chunk) => {
    chunks.push(chunk.toString())
    return true
  }
  process.stdout.write = capture
  process.stderr.write = capture
  let code = 0
  try {
    await ListTransactions.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  // kleur colours by environment variable, not by isTTY, so the captured output
  // still carries escape sequences here. Strip them so the assertions read as
  // the text a person would see.
  // eslint-disable-next-line no-control-regex
  return {code, out: chunks.join('').replace(/\u001B\[[0-9;]*m/g, '')}
}

const ltxHex = (hex) => Buffer.from(hex, 'hex')

// The address every test queries for, and a second one to be the other party.
const LTX_QUERY_HEX = LTX_ADDRESS.substring(1)
const LTX_OTHER_HEX = '000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408'
const LTX_OTHER_ADDRESS = `Q${LTX_OTHER_HEX}`

// A GetTransactionsByAddress entry, shaped the way the node returns it.
const ltxTx = (body, extra = {}) => ({
  addr_from: ltxHex(LTX_QUERY_HEX),
  timestamp: 1600000000,
  block_number: 12345,
  tx: {transaction_hash: ltxHex('ab'.repeat(32)), fee: '100000000', ...body},
  ...extra,
})

// Sent by the queried address: direction OUT.
const LTX_TRANSFER_OUT = ltxTx({
  transactionType: 'transfer',
  transfer: {amounts: ['1500000000'], addrs_to: [ltxHex(LTX_OTHER_HEX)]},
})

// Mined to the queried address: direction IN, via the coinbase branch.
const LTX_COINBASE_IN = ltxTx(
  {
    transactionType: 'coinbase',
    coinbase: {amount: '2000000000', addr_to: ltxHex(LTX_QUERY_HEX)},
  },
  {addr_from: ltxHex(LTX_OTHER_HEX)}
)

// Neither sent nor received by the queried address: direction MISC. The comma in
// the type also exercises the CSV quoting path.
const LTX_TOKEN_MISC = ltxTx(
  {
    transactionType: 'transfer_token,v2',
    transfer_token: {amounts: ['42'], addrs_to: [ltxHex(LTX_OTHER_HEX)]},
  },
  {addr_from: ltxHex(LTX_OTHER_HEX)}
)

// No timestamp, no block, no transaction body and no type: every field has to
// fall back rather than throw.
const LTX_BARE = {addr_from: undefined, tx: undefined}

// A transfer to someone else that also carries a coinbase paid to the queried
// address. `to` is read off the transfer, so the only thing that can still call
// this IN is the coinbase half of the direction check - which is exactly why
// that half is there.
const LTX_COINBASE_BEHIND_TRANSFER = ltxTx(
  {
    transactionType: 'transfer',
    transfer: {amounts: ['1000000000'], addrs_to: [ltxHex(LTX_OTHER_HEX)]},
    coinbase: {amount: '2000000000', addr_to: ltxHex(LTX_QUERY_HEX)},
  },
  {addr_from: ltxHex(LTX_OTHER_HEX)}
)

// The address prompt and the wallet-password prompt only run when stdin and
// stdout are terminals, so through a pipe that whole branch is unreachable. Fake
// the terminal, and stand in for the two prompt libraries the command uses:
// `prompts` (required lazily inside run()) and cli-ux's `cli.prompt`.
const ltxCliUx = require('cli-ux').cli // eslint-disable-line import/order

function stubLtxPrompts(fake) {
  const promptsPath = require.resolve('prompts')
  const saved = require.cache[promptsPath]
  const Module = require('module') // eslint-disable-line global-require
  const stub = new Module(promptsPath, null)
  stub.filename = promptsPath
  stub.loaded = true
  stub.exports = fake
  require.cache[promptsPath] = stub
  return () => {
    if (saved === undefined) {
      delete require.cache[promptsPath]
    } else {
      require.cache[promptsPath] = saved
    }
  }
}

// cli-ux exposes `prompt` as a getter, so it has to be redefined rather than assigned.
function stubLtxPassword(password) {
  const saved = Object.getOwnPropertyDescriptor(ltxCliUx, 'prompt')
  const asked = []
  Object.defineProperty(ltxCliUx, 'prompt', {
    configurable: true,
    get: () => async (message, options) => {
      asked.push({message, options})
      return password
    },
  })
  return {asked, restore: () => Object.defineProperty(ltxCliUx, 'prompt', saved)}
}

async function runLtxInteractive(argv, {fakePrompts, fakePassword} = {}) {
  const restorePrompts = stubLtxPrompts(fakePrompts || (async () => ({})))
  const password = fakePassword === undefined ? null : stubLtxPassword(fakePassword)
  const savedStdout = process.stdout.isTTY
  const savedStdin = process.stdin.isTTY
  process.stdout.isTTY = true
  process.stdin.isTTY = true
  try {
    const result = await runLtxOffline(argv)
    return {...result, asked: password ? password.asked : []}
  } finally {
    process.stdout.isTTY = savedStdout
    process.stdin.isTTY = savedStdin
    if (password) {
      password.restore()
    }
    restorePrompts()
  }
}

describe('list-transactions: node-dependent coverage', () => {
  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[ltxCommandPath]
  })

  beforeEach(() => {
    ltxNode = {pages: [[]]}
    ltxRequests = []
    ltxConnectAttempts = 0
  })

  describe('connecting', () => {
    it('retries five times, then gives up on a node that never connects', async () => {
      ltxNode = {connectsOnAttempt: 0, pages: [[]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 1, out)
      assert.strictEqual(ltxConnectAttempts, 6, 'one attempt plus five retries')
      assert.strictEqual(ltxRequests.length, 0, 'nothing may be asked of a node that never connected')
    })

    it('gives up on a node that never connects in --json mode too', async () => {
      // No spinner to fail, so the give-up path takes its other arm; it still has
      // to exit non-zero rather than print an empty result.
      ltxNode = {connectsOnAttempt: 0, pages: [[]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', LTX_ADDRESS])
      assert.strictEqual(code, 1, out)
      assert.strictEqual(ltxConnectAttempts, 6, 'one attempt plus five retries')
      assert.strictEqual(out.trim(), '', 'nothing may reach stdout when there is no result')
    })

    it('recovers when the node answers on a later retry', async () => {
      ltxNode = {connectsOnAttempt: 3, state: {}, pages: [[]]}
      const {code} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 0)
      assert.strictEqual(ltxConnectAttempts, 3)
    })

    it('retries quietly in --json mode, where there is no spinner to update', async () => {
      ltxNode = {connectsOnAttempt: 3, state: {}, pages: [[]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.strictEqual(ltxConnectAttempts, 3)
      assert.ok(!/retry connection attempt/.test(out), out)
      assert.strictEqual(out.trim(), '[]')
    })

    it('reports a connect() error as a plain log line in --json mode', async () => {
      ltxNode = {connectThrows: 'no route to host'}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', LTX_ADDRESS])
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to connect to node: Error: no route to host/.test(out), out)
    })
  })

  describe('address state', () => {
    it('turns the transaction count into a page estimate', async function stateCount() {
      this.timeout(60000)
      ltxNode = {state: {state: {transaction_hash_count: '3'}}, pages: [[LTX_TRANSFER_OUT, LTX_COINBASE_IN], [LTX_TOKEN_MISC]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-l', '2', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(/Found 3 transactions \(2 pages\)/.test(out), out)
      assert.deepStrictEqual(
        ltxRequests.filter((r) => r.name === 'GetTransactionsByAddress').map((r) => r.request.page_number),
        [1, 2]
      )
      assert.ok(/3 total transactions/.test(out), out)
    })

    it('stops before fetching when the address has no transactions', async () => {
      ltxNode = {state: {state: {transaction_hash_count: '0'}}}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(out.includes(`No transactions found for address ${LTX_ADDRESS}`), out)
      assert.strictEqual(
        ltxRequests.filter((r) => r.name === 'GetTransactionsByAddress').length,
        0,
        'a zero count must short-circuit the fetch loop'
      )
    })

    it('prints an empty JSON array when the address has no transactions', async () => {
      ltxNode = {state: {state: {transaction_hash_count: '0'}}}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.strictEqual(out.trim(), '[]', out)
    })

    it('turns the transaction count into a page estimate in --json mode too', async () => {
      // Same reply, no spinner to report it through: the counts still have to drive
      // the fetch loop rather than being skipped along with the progress output.
      ltxNode = {state: {state: {transaction_hash_count: '1'}}, pages: [[LTX_TRANSFER_OUT]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', '-l', '2', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.strictEqual(JSON.parse(out).length, 1)
      assert.ok(!/Found 1 transactions/.test(out), out)
    })

    it('warns silently when the state query fails in --json mode', async () => {
      ltxNode = {stateThrows: 'state unavailable', pages: [[]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(!/Could not get address state/.test(out), out)
      assert.strictEqual(out.trim(), '[]')
    })

    it('warns and carries on when the state query fails', async () => {
      ltxNode = {stateThrows: 'state unavailable', pages: [[]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(/Could not get address state \(state unavailable\) - continuing with fetch/.test(out), out)
    })

    it('says the count is unknown when the node returns no state', async () => {
      ltxNode = {state: {}, pages: [[]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(/transaction count will be determined during fetch/.test(out), out)
    })
  })

  describe('fetch loop', () => {
    it('reports an empty first page as no transactions', async () => {
      ltxNode = {state: {}, pages: [[]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(/No transactions found for this address/.test(out), out)
      assert.ok(out.includes(`No transactions found for address ${LTX_ADDRESS}`), out)
    })

    it('estimates the total while paging when the count is unknown', async function estimating() {
      // Two full pages then an empty one, with a 5 second rate-limit pause after
      // each: deliberately slow rather than flaky.
      this.timeout(90000)
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT], [LTX_COINBASE_IN], []]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-l', '1', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(/est\. 3\+/.test(out), `expected a first-page estimate\n--- actual ---\n${out}`)
      assert.ok(/Pausing/.test(out), out)
      assert.ok(/End of data/.test(out), out)
      assert.ok(/2 total transactions/.test(out), out)
    })

    it('exits when the node errors on a page', async () => {
      ltxNode = {state: {}, apiThrows: 'stream removed', pages: []}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 1, out)
      assert.ok(/Page 1 │ stream removed/.test(out), out)
    })

    it('reports a page error as a plain log line in --json mode', async () => {
      // No spinner to fail in JSON mode, so the error takes the other branch: a
      // silent non-zero exit would be indistinguishable from an empty result.
      ltxNode = {state: {}, apiThrows: 'stream removed', pages: []}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', LTX_ADDRESS])
      assert.strictEqual(code, 1, out)
      assert.ok(/Error fetching transactions page 1: stream removed/.test(out), out)
    })

    it('falls back to 100 per page when --limit is zero', async () => {
      // oclif defaults --limit to 100, but an explicit 0 is falsy and gets through.
      // Both the request and the page estimate have to fall back to the same number,
      // or the command asks for zero-length pages and never finishes.
      ltxNode = {state: {state: {transaction_hash_count: '3'}}, pages: [[LTX_TRANSFER_OUT]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-l', '0', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      const fetch = ltxRequests.find((r) => r.name === 'GetTransactionsByAddress')
      assert.strictEqual(fetch.request.item_per_page, 100)
      assert.ok(/Found 3 transactions \(1 pages\)/.test(out), out)
    })

    it('sends the address as bytes and honours --limit', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT]]}
      await runLtxOffline(['-g', DEAD_NODE, '-l', '25', LTX_ADDRESS])
      const fetch = ltxRequests.find((r) => r.name === 'GetTransactionsByAddress')
      assert.strictEqual(fetch.request.item_per_page, 25)
      assert.strictEqual(fetch.request.address.toString('hex'), LTX_QUERY_HEX)
    })
  })

  describe('console output', () => {
    it('lays out one row per transaction with direction, amount and fee', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT, LTX_COINBASE_IN, LTX_TOKEN_MISC, LTX_BARE]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(/Transaction Summary/.test(out), out)
      // transfer sent by the queried address
      assert.ok(/OUT\s+transfer\s+/.test(out), out)
      assert.ok(out.includes('1.500000000'), 'transfer amount in quanta')
      // coinbase paid to the queried address
      assert.ok(/IN\s+coinbase\s+/.test(out), out)
      assert.ok(out.includes('2.000000000'), 'coinbase amount in quanta')
      // token transfer between two other addresses
      assert.ok(/MISC\s+transfer_token/.test(out), out)
      assert.ok(out.includes('42 tokens'), out)
      // the bodyless entry falls back rather than throwing
      assert.ok(/N\/A\s+MISC\s+unknown/.test(out), out)
      assert.ok(out.includes('0.100000000'), 'fee in quanta')
      assert.ok(/4 total transactions/.test(out), out)
    })

    it('calls a coinbase paid to the queried address IN, whatever the transfer says', async () => {
      ltxNode = {state: {}, pages: [[LTX_COINBASE_BEHIND_TRANSFER]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(/IN\s+transfer\s+/.test(out), out)
    })

    it('keeps the console table when only --quiet is given', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT]]}
      const {out} = await runLtxOffline(['-g', DEAD_NODE, '-q', LTX_ADDRESS])
      assert.ok(/Transaction Summary/.test(out), '--quiet alone only matters alongside --csv')
    })
  })

  describe('--csv export', () => {
    const csvPath = '/tmp/list-transactions-node-coverage.csv'

    afterEach(() => {
      try {
        fs.unlinkSync(csvPath)
      } catch (err) {
        // no file to remove
      }
    })

    it('writes a header row and one row per transaction, quoting embedded commas', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT, LTX_COINBASE_IN, LTX_TOKEN_MISC, LTX_BARE]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-c', csvPath, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(out.includes(`Transactions exported to CSV file: ${csvPath}`), out)

      const rows = fs.readFileSync(csvPath, 'utf8').split('\n')
      assert.strictEqual(rows[0], 'Timestamp,Direction,Type,Hash,From,To,Amount,Fee,Block')
      assert.strictEqual(rows.length, 5, 'header plus four transactions')
      assert.ok(
        rows[1].includes(`,OUT,transfer,`) &&
          rows[1].includes(`,Q${LTX_QUERY_HEX},${LTX_OTHER_ADDRESS},1.500000000,0.100000000,12345`),
        rows[1]
      )
      // a coinbase is credited to the queried address, and its amount is in quanta
      assert.ok(rows[2].includes(',IN,coinbase,'), rows[2])
      assert.ok(rows[2].includes(',2.000000000,'), rows[2])
      // the type contains a comma, so the field has to be quoted
      assert.ok(rows[3].includes('"transfer_token,v2"'), rows[3])
      // an entry with no timestamp, block or body still produces a row rather than throwing
      assert.strictEqual(rows[4], 'N/A,MISC,unknown,N/A,N/A,N/A,0,0.000000000,N/A')
    })

    it('calls a coinbase paid to the queried address IN, whatever the transfer says', async () => {
      ltxNode = {state: {}, pages: [[LTX_COINBASE_BEHIND_TRANSFER]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-c', csvPath, LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      const rows = fs.readFileSync(csvPath, 'utf8').split('\n')
      assert.ok(rows[1].includes(',IN,transfer,'), rows[1])
    })

    it('drops the console table when --csv and --quiet are used together', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-c', csvPath, '-q', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.ok(!/Transaction Summary/.test(out), `--csv --quiet must not print the table\n--- actual ---\n${out}`)
      assert.ok(fs.existsSync(csvPath), 'the CSV file is still written')
    })

    it('exits when the CSV file cannot be written', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT]]}
      const {code, out} = await runLtxOffline([
        '-g',
        DEAD_NODE,
        '-c',
        '/tmp/no-such-directory-for-qrl-cli/out.csv',
        LTX_ADDRESS,
      ])
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to write CSV file/.test(out), out)
    })
  })

  describe('--json output', () => {
    it('prints the transactions as JSON and exits 0', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      const parsed = JSON.parse(out)
      assert.strictEqual(parsed.length, 1)
      assert.strictEqual(parsed[0].block_number, 12345)
      // none of the human-readable furniture may reach stdout in JSON mode
      assert.ok(!/Transaction Summary/.test(out), out)
      assert.ok(!/Fetching Transactions/.test(out), out)
    })

    it('stops on a short page with no spinner to tell it to', async () => {
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT]]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', '-l', '2', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.strictEqual(JSON.parse(out).length, 1)
      assert.strictEqual(ltxRequests.filter((r) => r.name === 'GetTransactionsByAddress').length, 1)
    })

    it('pages past a full page with no spinner to tell it to', async function jsonPaging() {
      this.timeout(60000)
      ltxNode = {state: {}, pages: [[LTX_TRANSFER_OUT], []]}
      const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '-j', '-l', '1', LTX_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.strictEqual(JSON.parse(out).length, 1)
      assert.deepStrictEqual(
        ltxRequests.filter((r) => r.name === 'GetTransactionsByAddress').map((r) => r.request.page_number),
        [1, 2]
      )
    })
  })
  it('reports a directory where a wallet file was expected, rather than crashing', async () => {
    const {code, out} = await runLtxOffline(['-g', DEAD_NODE, '/tmp'])
    assert.strictEqual(code, 1, out)
    assert.ok(/Unable to list transactions: invalid QRL address\/wallet file/.test(out), out)
    assert.strictEqual(ltxRequests.length, 0, 'no node is queried for a path that never opened')
  })

  describe('at a terminal', () => {
    const promptWallet = '/tmp/list-transactions-node-prompt-wallet.json'

    before(() => {
      // Decrypts with the right password to a real address, so the command gets
      // past the address check and on to the (stubbed) node.
      const aes = require('../../src/utils/aes') // eslint-disable-line global-require
      fs.writeFileSync(
        promptWallet,
        JSON.stringify([{encrypted: true, address: aes.encrypt('prompted-password', LTX_ADDRESS)}])
      )
    })

    after(() => {
      try {
        fs.unlinkSync(promptWallet)
      } catch (err) {
        // never created; nothing to clean up
      }
    })

    it('asks for an address when none was given', async () => {
      ltxNode = {state: {}, pages: [[]]}
      let asked
      const {code, out} = await runLtxInteractive(['-g', DEAD_NODE], {
        fakePrompts: async options => {
          asked = options
          return {address: LTX_ADDRESS}
        },
      })
      assert.strictEqual(code, 0, out)
      assert.strictEqual(asked.name, 'address')
      assert.ok(/QRL address or path to wallet\.json/.test(asked.message))
      assert.strictEqual(asked.validate(''), 'Address/File is required')
      assert.strictEqual(asked.validate(LTX_ADDRESS), true)
    })

    it('exits non-zero when the address prompt is cancelled', async () => {
      const {code, out} = await runLtxInteractive(['-g', DEAD_NODE], {fakePrompts: async () => ({})})
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.strictEqual(ltxRequests.length, 0, 'no node is queried without an address')
    })

    it('asks for the wallet password when --password is not given', async () => {
      // Without this branch an encrypted wallet would only be usable with the
      // password on the command line, where it lands in shell history.
      ltxNode = {state: {}, pages: [[]]}
      const {code, out, asked} = await runLtxInteractive([promptWallet, '-g', DEAD_NODE], {
        fakePassword: 'prompted-password',
      })
      assert.strictEqual(code, 0, out)
      assert.strictEqual(asked.length, 1)
      assert.ok(/Enter password for wallet file/.test(asked[0].message))
      assert.strictEqual(asked[0].options.type, 'hide', 'the password must not be echoed')
      assert.ok(out.includes(LTX_ADDRESS), out)
    })

    it('refuses a wrong password typed at the wallet prompt', async () => {
      const {code, out} = await runLtxInteractive([promptWallet, '-g', DEAD_NODE], {
        fakePassword: 'not-the-password',
      })
      assert.strictEqual(code, 1, out)
      assert.strictEqual(ltxRequests.length, 0, 'no node is queried for an address that never decrypted')
    })
  })
})
