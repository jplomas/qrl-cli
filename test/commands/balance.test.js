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
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

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
describe('balance #1', () => {
  let exitCode
  before((done) => {
    const args = ['balance']
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without an argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad address
describe('balance #2', () => {
  let exitCode
  before((done) => {
    const args = [
    'balance',
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
// bad address
describe('balance #3', () => {
  let exitCode
  before((done) => {
    const args = [
    'balance',
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

// bad address file
describe('balance #4', () => {
  let exitCode
  before((done) => {
    const args = [
    'balance',
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
describe('balance #5', () => {
  let exitCode
  let out = ''
  before((done) => {
    const args = [
    'balance',
    testSetup.encWalletFile,
    '-p',
    'notThePass',
    ]
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'pipe', 'pipe']})
    child.stdout.on('data', (d) => {
      out += d.toString()
    })
    child.stderr.on('data', (d) => {
      out += d.toString()
    })
    child.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad address password- wrong password', () => {
    assert.notStrictEqual(exitCode, 0)
  })
  it('says the password was the problem, rather than exiting silently', () => {
    assert.ok(/Error decrypting wallet/.test(out), `expected a reason\n--- actual ---\n${out}`)
  })
})

describe('balance #6', () => {
  let exitCode
  before((done) => {
    const args = [
      'balance',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
      '-s',
      '-q',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', (code) => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with a valid address, and both -s and -q flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// not valid grpc address
describe('balance #7', () => {
  let exitCode
  before(async function balanceTest7() {
    this.timeout(15000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    const args = [
      'balance',
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

// pass

// mainnet balance
describeOnline('balance #8', () => {
  let exitCode
  before(async function balanceTest8() {
    this.timeout(15000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    const args = [
      'balance',
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


describeOnline('balance #9', () => {
  let exitCode
  before(async function balanceTest9() {
    this.timeout(15000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    const args = [
      'balance',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
      '-s'
    ]
    const process = spawn('./bin/run', args, processFlags)
    return new Promise((resolve) => {
      process.on('exit', (code) => {
        exitCode = code
        resolve()
      })
    })
  })
  it('exit code should be 0 if passed with a valid address and a -s flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// success -q
describeOnline('balance #10', () => {
  let exitCode
  before(async function balanceTest10() {
    this.timeout(15000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    const args = [
      'balance', 
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

// success testnet
describeOnline('balance #11', () => {
  let exitCode
  before(async function balanceTest11() {
    this.timeout(30000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    const args = ['balance', 'Q000400e9910eb0b8ff824a017b400b8ea743a32ee35e958575a898eeb1fe796d6f14eb3f51897b', '-t']
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
describeOnline('balance #12', () => {
  let exitCode
  before(async function balanceTest12() {
    this.timeout(15000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    const args = [
      'balance', 
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
describeOnline('balance #13', () => {
  let exitCode
  before(async function balanceTest13() {
    this.timeout(20000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    
    // Create wallet file if it doesn't exist
    await createWalletIfNeeded(testSetup.walletFile, false, null)
    
    // Now run the balance command
    const args = [
      'balance', 
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
describeOnline('balance #14', () => {
  let exitCode
  before(async function balanceTest14() {
    this.timeout(20000)
    await delay(5000) // 2 second delay to prevent API rate limiting
    
    // Create encrypted wallet file if it doesn't exist
    await createWalletIfNeeded(testSetup.encWalletFile, true, testSetup.encPass)
    
    // Now run the balance command
    const args = [
      'balance', 
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
// ///////////////////////////////////////////////////////////////////////////
// balance: offline coverage suite
//
// `balance` is a read-only node query, so the part that reads a balance cannot
// run without a node. Everything *before* the query can: argument handling,
// STDIN input, address validation, wallet-file opening and decryption, the
// --json output mode's suppressed-spinner branches, and the connection-failure
// path.
//
// Every case here either stops at a validation gate or dies connecting to a
// closed loopback port. Nothing contacts mainnet or testnet.
// ///////////////////////////////////////////////////////////////////////////

// A closed port on loopback: resolves, refuses the connection, exits. Never leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

const BALANCE_WALLET = '/tmp/balance-wallet.json'
// Pre-v2 (`aes256` package) encryption: unauthenticated, so a wrong password
// returns garbage instead of throwing. It is the only way to reach balance.js's
// "invalid password" branch, which validates the decrypted address.
const BALANCE_LEGACY_WALLET = '/tmp/balance-wallet-legacy.json'
const BALANCE_BAD_WALLET = '/tmp/balance-bad-wallet.json'
const BALANCE_NO_FLAG_WALLET = '/tmp/balance-no-encrypted-flag-wallet.json'
const BALANCE_PASSWORD = 'testpassword'
const A_VALID_ADDRESS = 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3'

// Run the CLI and capture what it said. `input`, when given, is written to STDIN.
function runBalance(args, input) {
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

function balanceRefuses(args, expected, input) {
  return runBalance(args, input).then(({code, out}) => {
    assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}\n--- output ---\n${out}`)
    assert.ok(expected.test(out), `expected output to match ${expected}\n--- actual ---\n${out}`)
  })
}

function createBalanceWallet(file, password) {
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
function legacyEncryptBalance(password, plaintext) {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(String(password)).digest()
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  return Buffer.concat([iv, ciphertext]).toString('base64')
}

describe('balance: offline coverage', () => {
  let plainWallet

  before(async function createBalanceFixtures() {
    this.timeout(120000)
    await createBalanceWallet(BALANCE_WALLET, null)
    ;[plainWallet] = JSON.parse(fs.readFileSync(BALANCE_WALLET))

    fs.writeFileSync(
      BALANCE_LEGACY_WALLET,
      JSON.stringify([
        {
          encrypted: true,
          address: legacyEncryptBalance(BALANCE_PASSWORD, plainWallet.address),
          addressB32: legacyEncryptBalance(BALANCE_PASSWORD, plainWallet.addressB32),
          pk: legacyEncryptBalance(BALANCE_PASSWORD, plainWallet.pk),
          hexseed: legacyEncryptBalance(BALANCE_PASSWORD, plainWallet.hexseed),
          mnemonic: legacyEncryptBalance(BALANCE_PASSWORD, plainWallet.mnemonic),
          height: plainWallet.height,
          hashFunction: plainWallet.hashFunction,
          signatureType: plainWallet.signatureType,
          index: plainWallet.index,
        },
      ])
    )

    // Valid JSON, but not a wallet: `JSON.parse(contents)[0]` is undefined, so
    // reading `.encrypted` off it throws inside the command's try/catch.
    fs.writeFileSync(BALANCE_BAD_WALLET, JSON.stringify({not: 'a wallet'}))

    // Shaped like a wallet but with no `encrypted` key: neither the plaintext nor the
    // encrypted branch runs, so the file is never accepted and the command must say so
    // rather than falling through and querying the filename as an address.
    fs.writeFileSync(BALANCE_NO_FLAG_WALLET, JSON.stringify([{address: A_VALID_ADDRESS}]))
  })

  after(() => {
    [BALANCE_WALLET, BALANCE_LEGACY_WALLET, BALANCE_BAD_WALLET, BALANCE_NO_FLAG_WALLET].forEach((file) => {
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
      // Reaches the node query with the piped address, then fails to connect.
      await balanceRefuses(['balance', '-', '-g', DEAD_NODE], /Failed to connect to node/, `${A_VALID_ADDRESS}\n`)
    })

    it('reads the address from STDIN when no argument is given and STDIN is a pipe', async function stdinPipe() {
      this.timeout(60000)
      await balanceRefuses(['balance', '-g', DEAD_NODE], /Failed to connect to node/, `${A_VALID_ADDRESS}\n`)
    })

    it('explains what is missing when STDIN is a pipe carrying nothing', async function stdinEmpty() {
      this.timeout(60000)
      await balanceRefuses(['balance'], /Missing QRL address or wallet file/, '')
    })
  })

  describe('wallet files', () => {
    it('reads the address out of an unencrypted wallet file', async function plainWalletFile() {
      this.timeout(60000)
      const {code, out} = await runBalance(['balance', BALANCE_WALLET, '-g', DEAD_NODE])
      assert.notStrictEqual(code, 0)
      assert.ok(out.includes(plainWallet.address), `expected the wallet address in the output\n--- actual ---\n${out}`)
      assert.ok(/Failed to connect to node/.test(out), `--- actual ---\n${out}`)
    })

    it('decrypts a legacy-format wallet file with the right password', async function legacyWalletFile() {
      this.timeout(60000)
      const {code, out} = await runBalance([
        'balance',
        BALANCE_LEGACY_WALLET,
        '-p',
        BALANCE_PASSWORD,
        '-g',
        DEAD_NODE,
      ])
      assert.notStrictEqual(code, 0)
      assert.ok(out.includes(plainWallet.address), `expected the decrypted address in the output\n--- actual ---\n${out}`)
    })

    it('refuses a legacy-format wallet file when the password is wrong', async function legacyWalletBadPassword() {
      this.timeout(60000)
      // Unauthenticated format: decryption "succeeds" and yields garbage, so the
      // command has to notice the plaintext is not a QRL address.
      await balanceRefuses(
        ['balance', BALANCE_LEGACY_WALLET, '-p', 'not-the-password'],
        /Unable to open wallet file: invalid password/
      )
    })

    it('refuses a wallet file with no "encrypted" key', async function noEncryptedFlag() {
      this.timeout(60000)
      await balanceRefuses(
        ['balance', BALANCE_NO_FLAG_WALLET],
        /Unable to get a balance: invalid QRL address\/wallet file/
      )
    })

    it('refuses a JSON file that is not a wallet', async function notAWallet() {
      this.timeout(60000)
      const {code} = await runBalance(['balance', BALANCE_BAD_WALLET])
      assert.notStrictEqual(code, 0)
    })
  })

  describe('--json output mode', () => {
    it('suppresses the spinner and reports the connection failure as a log line', async function jsonConnectFailure() {
      this.timeout(60000)
      // With --json there is no spinner, so the failure has to be printed instead
      // of being written onto a spinner that does not exist.
      const {code, out} = await runBalance(['balance', A_VALID_ADDRESS, '-j', '-g', DEAD_NODE])
      assert.notStrictEqual(code, 0)
      assert.ok(/Failed to connect to node/.test(out), `--- actual ---\n${out}`)
      // The network banner is part of the human output and must not pollute JSON mode
      assert.ok(!/Custom GRPC endpoint/.test(out), `--- actual ---\n${out}`)
    })

    it('does not print the wallet address banner in --json mode', async function jsonWalletFile() {
      this.timeout(60000)
      const {code, out} = await runBalance(['balance', BALANCE_WALLET, '-j', '-g', DEAD_NODE])
      assert.notStrictEqual(code, 0)
      assert.ok(/Failed to connect to node/.test(out), `--- actual ---\n${out}`)
    })
  })

  describe('node connection', () => {
    it('fails with a spinner message when the node is unreachable', async function deadNode() {
      this.timeout(60000)
      await balanceRefuses(['balance', A_VALID_ADDRESS, '-g', DEAD_NODE], /Failed to connect to node/)
    })
  })
})

// ///////////////////////////////////////////////////////////////////////////
// balance: what the command does once a node has answered
//
// The suites above stop wherever a node would be needed. This one runs the
// command in *this* process against a stub gRPC client, so the retry loop and
// every rendering of a GetOptimizedAddressState reply - quanta, shor, JSON and
// the token list - are covered without a node, a socket, or a packet leaving
// the machine. `balance` only reads, so no OTS key is ever consumed.
//
// src/functions/grpc is swapped in the require cache for the moment it takes to
// require the command (the command captures Qrlnode at require time), then the
// real module is put straight back.
// ///////////////////////////////////////////////////////////////////////////

// kleur colours by environment variable rather than by isTTY, so the captured
// output still carries escape sequences. Strip them before matching.
const BALANCE_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

// Behaviour the stub should show for the test currently running. Reset per test.
let balanceNode = {}
let balanceRequests = []
let balanceConnectAttempts = 0

class BalanceFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    balanceConnectAttempts += 1
    if (balanceNode.connectThrows) {
      throw new Error(balanceNode.connectThrows)
    }
    const connectsOn = balanceNode.connectsOnAttempt === undefined ? 1 : balanceNode.connectsOnAttempt
    if (connectsOn !== 0 && balanceConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    balanceRequests.push({name, request})
    if (balanceNode.apiThrows) {
      throw new Error(balanceNode.apiThrows)
    }
    return balanceNode.state
  }
}

const balanceGrpcPath = require.resolve('../../src/functions/grpc')
const balanceCommandPath = require.resolve('../../src/commands/balance')

const balanceRealGrpcEntry = require.cache[balanceGrpcPath]
require.cache[balanceGrpcPath] = {
  id: balanceGrpcPath,
  filename: balanceGrpcPath,
  path: require('path').dirname(balanceGrpcPath), // eslint-disable-line global-require
  loaded: true,
  children: [],
  paths: [],
  exports: BalanceFakeQrlNode,
}
const {Balance} = require('../../src/commands/balance')

if (balanceRealGrpcEntry) {
  require.cache[balanceGrpcPath] = balanceRealGrpcEntry
} else {
  delete require.cache[balanceGrpcPath]
}

// Run the command here, against the stub, capturing everything it prints.
async function runBalanceOffline(argv) {
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
    await Balance.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  return {code, out: chunks.join('').replace(BALANCE_ANSI, '')}
}

// 2.5 Quanta, and two token holdings keyed by token hash.
const BALANCE_STATE = {
  state: {
    balance: '2500000000',
    tokens: {
      '000000000000000000000000000000000000000000000000000000000000beef': '1200',
      '000000000000000000000000000000000000000000000000000000000000cafe': '7',
    },
  },
}

// The address prompt and the wallet-password prompt only run when stdin and
// stdout are terminals, so through a pipe that whole branch is unreachable. Fake
// the terminal, and stand in for the two prompt libraries the command uses:
// `prompts` (required lazily inside run()) and cli-ux's `cli.prompt`.
const balanceCliUx = require('cli-ux').cli // eslint-disable-line import/order

function stubBalancePrompts(fake) {
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
function stubBalancePassword(password) {
  const saved = Object.getOwnPropertyDescriptor(balanceCliUx, 'prompt')
  const asked = []
  Object.defineProperty(balanceCliUx, 'prompt', {
    configurable: true,
    get: () => async (message, options) => {
      asked.push({message, options})
      return password
    },
  })
  return {asked, restore: () => Object.defineProperty(balanceCliUx, 'prompt', saved)}
}

async function runBalanceInteractive(argv, {fakePrompts, fakePassword} = {}) {
  const restorePrompts = stubBalancePrompts(fakePrompts || (async () => ({})))
  const password = fakePassword === undefined ? null : stubBalancePassword(fakePassword)
  const savedStdout = process.stdout.isTTY
  const savedStdin = process.stdin.isTTY
  process.stdout.isTTY = true
  process.stdin.isTTY = true
  try {
    const result = await runBalanceOffline(argv)
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

describe('balance: reporting a node reply', () => {
  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[balanceCommandPath]
  })

  beforeEach(() => {
    balanceNode = {state: {state: {balance: '2500000000'}}}
    balanceRequests = []
    balanceConnectAttempts = 0
  })

  it('asks the node for the address it was given, as bytes', async () => {
    const {code} = await runBalanceOffline(['-g', DEAD_NODE, A_VALID_ADDRESS])
    assert.strictEqual(code, 0)
    assert.strictEqual(balanceRequests.length, 1)
    assert.strictEqual(balanceRequests[0].name, 'GetOptimizedAddressState')
    assert.strictEqual(balanceRequests[0].request.address.toString('hex'), A_VALID_ADDRESS.substring(1))
  })

  it('retries the connection until the node answers', async () => {
    balanceNode = {state: {state: {balance: '0'}}, connectsOnAttempt: 3}
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, A_VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.strictEqual(balanceConnectAttempts, 3)
    assert.ok(/retry connection attempt: 0/.test(out), out)
  })

  it('retries quietly in --json mode, where there is no spinner to update', async () => {
    balanceNode = {state: {state: {balance: '0'}}, connectsOnAttempt: 3}
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, '-j', A_VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.strictEqual(balanceConnectAttempts, 3)
    assert.ok(!/retry connection attempt/.test(out), out)
    assert.strictEqual(JSON.parse(out).balance_shor, '0')
  })

  it('reports quanta by default', async () => {
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, A_VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.ok(/Balance: 2\.5 Quanta/.test(out), out)
    assert.ok(!/Shor/.test(out), out)
  })

  it('reports shor when asked for shor', async () => {
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, '-s', A_VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.ok(/Balance: 2500000000 Shor/.test(out), out)
    assert.ok(!/Quanta/.test(out), out)
  })

  it('reports quanta when asked for quanta', async () => {
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, '-q', A_VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.ok(/Balance: 2\.5 Quanta/.test(out), out)
  })

  it('refuses to report both units at once', async () => {
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, '-q', '-s', A_VALID_ADDRESS])
    assert.strictEqual(code, 1, out)
    assert.ok(/Please enter one, shor \(-s\) or quanta \(-q\)/.test(out), out)
  })

  it('lists token balances under their token hash', async () => {
    balanceNode = {state: BALANCE_STATE}
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, A_VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.ok(/Token Balances:/.test(out), out)
    assert.ok(out.includes('000000000000000000000000000000000000000000000000000000000000beef: 1200'), out)
    assert.ok(out.includes('000000000000000000000000000000000000000000000000000000000000cafe: 7'), out)
  })

  it('says nothing about tokens when the address holds none', async () => {
    const {out} = await runBalanceOffline(['-g', DEAD_NODE, A_VALID_ADDRESS])
    assert.ok(!/Token Balances:/.test(out), out)
  })

  describe('--json', () => {
    it('prints one object carrying both units and the token map', async () => {
      balanceNode = {state: BALANCE_STATE}
      const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, '-j', A_VALID_ADDRESS])
      assert.strictEqual(code, 0, out)
      assert.deepStrictEqual(JSON.parse(out), {
        address: A_VALID_ADDRESS,
        balance_shor: '2500000000',
        balance_quanta: '2.5',
        tokens: BALANCE_STATE.state.tokens,
      })
    })

    it('reports an empty token map rather than omitting the key', async () => {
      const {out} = await runBalanceOffline(['-g', DEAD_NODE, '-j', A_VALID_ADDRESS])
      assert.deepStrictEqual(JSON.parse(out).tokens, {})
    })

    it('prints no banner or spinner text alongside the JSON', async () => {
      const {out} = await runBalanceOffline(['-g', DEAD_NODE, '-j', A_VALID_ADDRESS])
      assert.ok(!/Custom GRPC endpoint/.test(out), out)
      assert.ok(!/Fetching balance from node/.test(out), out)
    })

    it('reports a connect() failure as a plain log line with no spinner to fail', async () => {
      balanceNode = {connectThrows: 'no route to host'}
      const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, '-j', A_VALID_ADDRESS])
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to connect to node: Error: no route to host/.test(out), out)
    })
  })
  it('reports a directory where a wallet file was expected, rather than crashing', async () => {
    // existsSync says yes to a directory, so the command goes on to read it as a wallet.
    // That read throws, and it used to escape as a raw EISDIR.
    const {code, out} = await runBalanceOffline(['-g', DEAD_NODE, '/tmp'])
    assert.strictEqual(code, 1, out)
    assert.ok(/Unable to get a balance: invalid QRL address\/wallet file/.test(out), out)
    assert.ok(!/EISDIR/.test(out), out)
    assert.strictEqual(balanceRequests.length, 0, 'no node is queried for a path that never opened')
  })

  describe('at a terminal', () => {
    const promptWallet = '/tmp/balance-node-prompt-wallet.json'

    before(() => {
      // Decrypts with the right password to a real address, so the command gets
      // past the address check and on to the (stubbed) node.
      const aes = require('../../src/utils/aes') // eslint-disable-line global-require
      fs.writeFileSync(
        promptWallet,
        JSON.stringify([{encrypted: true, address: aes.encrypt('prompted-password', A_VALID_ADDRESS)}])
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
      let asked
      const {code, out} = await runBalanceInteractive(['-g', DEAD_NODE], {
        fakePrompts: async options => {
          asked = options
          return {address: A_VALID_ADDRESS}
        },
      })
      assert.strictEqual(code, 0, out)
      assert.strictEqual(asked.name, 'address')
      assert.ok(/QRL address or path to wallet\.json/.test(asked.message))
      assert.ok(/Balance: 2\.5 Quanta/.test(out), out)
    })

    it('will not accept an empty answer at the address prompt', async () => {
      let asked
      await runBalanceInteractive(['-g', DEAD_NODE], {
        fakePrompts: async options => {
          asked = options
          return {address: A_VALID_ADDRESS}
        },
      })
      assert.strictEqual(asked.validate(''), 'Address/File is required')
      assert.strictEqual(asked.validate(A_VALID_ADDRESS), true)
    })

    it('exits non-zero when the address prompt is cancelled', async () => {
      const {code, out} = await runBalanceInteractive(['-g', DEAD_NODE], {fakePrompts: async () => ({})})
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.strictEqual(balanceRequests.length, 0, 'no node is queried without an address')
    })

    it('asks for the wallet password when --password is not given', async () => {
      // Without this branch an encrypted wallet would only be usable with the
      // password on the command line, where it lands in shell history.
      const {code, out, asked} = await runBalanceInteractive([promptWallet, '-g', DEAD_NODE], {
        fakePassword: 'prompted-password',
      })
      assert.strictEqual(code, 0, out)
      assert.strictEqual(asked.length, 1)
      assert.ok(/Enter password for wallet file/.test(asked[0].message))
      assert.strictEqual(asked[0].options.type, 'hide', 'the password must not be echoed')
      assert.ok(out.includes(A_VALID_ADDRESS), out)
    })

    it('refuses a wrong password typed at the wallet prompt', async () => {
      const {code, out} = await runBalanceInteractive([promptWallet, '-g', DEAD_NODE], {
        fakePassword: 'not-the-password',
      })
      assert.strictEqual(code, 1, out)
      assert.strictEqual(balanceRequests.length, 0, 'no node is queried for an address that never decrypted')
    })
  })
})
