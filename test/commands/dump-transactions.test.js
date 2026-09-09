// ///////////////////////////////////////////////////////////////////////////
// dump-transactions tests
//
// Two layers, both offline:
//
//  1. Child-process runs of ./bin/run for everything that happens before a node
//     is needed - argument parsing, address validation, wallet file handling and
//     password decryption - plus the connection failure path, which is pointed at
//     a closed loopback port so it never leaves the machine.
//
//  2. In-process runs for the half of the command that only executes once a node
//     has answered: the retry loop, pagination, the console table, and the CSV
//     writer. src/functions/grpc is swapped for a plain stub class for the single
//     moment it takes to require the command (see below) - there is no server and
//     no socket, and the real module is restored immediately, so nothing here
//     leaks into other test files.
//
// No transaction is ever built or signed, so no OTS key is consumed.
// ///////////////////////////////////////////////////////////////////////////

/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 10] */

const assert = require('assert')
const {spawn} = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const aes = require('../../src/utils/aes')

// A closed port on loopback: the CLI resolves it, fails to connect, and exits.
const DEAD_NODE = '127.0.0.1:1'

// ---------------------------------------------------------------------------
// gRPC stub
// ---------------------------------------------------------------------------

// Behaviour the stub should show for the test currently running. Reset per test.
let nodeBehaviour = {}

// Requests the command sent, so the tests can assert on what it asked the node
// for (page numbers, page size, and the address it converted to bytes).
let apiRequests = []

// How many times the command asked to connect: the retry loop only updates the
// spinner text, which prints nothing when stderr is not a terminal.
let connectAttempts = 0

class FakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    connectAttempts += 1
    if (nodeBehaviour.connectThrows) {
      throw new Error(nodeBehaviour.connectThrows)
    }
    // connectsOnAttempt of 0 means "never connects", which is what the real
    // client does when the node answers but fails the proto hash check.
    const connectsOn = nodeBehaviour.connectsOnAttempt === undefined ? 1 : nodeBehaviour.connectsOnAttempt
    if (connectsOn !== 0 && connectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    apiRequests.push({name, request})
    if (nodeBehaviour.apiThrows) {
      throw new Error(nodeBehaviour.apiThrows)
    }
    const page = nodeBehaviour.pages[request.page_number - 1] || []
    return {transactions_detail: page}
  }
}

const grpcModulePath = require.resolve('../../src/functions/grpc')
const commandModulePath = require.resolve('../../src/commands/dump-transactions')

// The command captures Qrlnode at require time, so the stub only has to be in
// place for that one require call. Put the real entry back straight afterwards
// so a full-suite run is unaffected.
const realGrpcEntry = require.cache[grpcModulePath]
require.cache[grpcModulePath] = {
  id: grpcModulePath,
  filename: grpcModulePath,
  path: path.dirname(grpcModulePath),
  loaded: true,
  children: [],
  paths: [],
  exports: FakeQrlNode,
}
const {DumpTransactions} = require('../../src/commands/dump-transactions')

if (realGrpcEntry) {
  require.cache[grpcModulePath] = realGrpcEntry
} else {
  delete require.cache[grpcModulePath]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Run the CLI in a child process and capture what it said, rather than letting
// it write to the test output. QRL_GRPC_ENDPOINT keeps the default (no flags)
// network selection on loopback instead of mainnet.
function run(args) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {...process.env, QRL_TEST_OFFLINE: 'true', QRL_GRPC_ENDPOINT: DEAD_NODE},
    })
    let out = ''
    child.stdout.on('data', d => {
      out += d.toString()
    })
    child.stderr.on('data', d => {
      out += d.toString()
    })
    child.on('close', code => resolve({code, out}))
  })
}

// Every failing case asserts on the reason, not just the exit code, so a command
// that starts failing for a different reason does not keep passing.
async function refuses(args, expected) {
  const {code, out} = await run(args)
  assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}`)
  assert.ok(expected.test(out), `expected output to match ${expected}\n--- actual ---\n${out}`)
}

// Run the command in this process against the stub, capturing everything it
// prints (this.log goes to stdout, the ora spinners go to stderr).
async function runOffline(argv) {
  const chunks = []
  const realStdout = process.stdout.write
  const realStderr = process.stderr.write
  const capture = chunk => {
    chunks.push(chunk.toString())
    return true
  }
  process.stdout.write = capture
  process.stderr.write = capture
  let code = 0
  try {
    await DumpTransactions.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  return {code, out: chunks.join('')}
}

const hexBuffer = hex => Buffer.from(hex, 'hex')

const FROM_HEX = '000300cc040d28c309c8e82d1397aa0d9b74666b492f77b485d327bf5496a725b7b8a3c024b9ee'
const TO_HEX = '0002003b4c8bb2c0e1a1b0b9b9f0e0e8b2e9d0c1b2a3948576f8e9d0c1b2a3948576f8e9d0c1b2a3'

// A GetTransactionsByAddress entry, shaped the way the node returns it.
const transaction = (body, extra = {}) => ({
  addr_from: hexBuffer(FROM_HEX),
  header: {timestamp_seconds: 1600000000, block_number: 12345, ...extra},
  tx: {transaction_hash: hexBuffer('ab'.repeat(32)), fee: '100000000', ...body},
})

const TRANSFER_TX = transaction({
  transactionType: 'transfer',
  transfer: {amounts: ['1500000000'], addrs_to: [hexBuffer(TO_HEX)]},
})

const COINBASE_TX = transaction({
  transactionType: 'coinbase',
  coinbase: {amount: '2000000000', addr_to: hexBuffer(TO_HEX)},
})

// The comma in the type exercises the CSV quoting path.
const TOKEN_TX = transaction({
  transactionType: 'transfer_token,v2',
  transfer_token: {amounts: ['42'], addrs_to: [hexBuffer(TO_HEX)]},
})

// No transfer/coinbase/token body and no type: the command has to fall back to
// "unknown", amount 0 and to N/A rather than throwing.
const BARE_TX = transaction({})

let tmpDir
let plainWallet
let encryptedWallet
let notJsonWallet
let noEncryptedFlagWallet
let decryptsToGarbageWallet
let plainAddress
const WALLET_PASSWORD = 'testing'

describe('commands/dump-transactions', () => {
  before(async function beforeAll() {
    this.timeout(180000)
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-dump-'))
    plainWallet = path.join(tmpDir, 'wallet.json')
    encryptedWallet = path.join(tmpDir, 'enc-wallet.json')
    notJsonWallet = path.join(tmpDir, 'not-json.json')
    noEncryptedFlagWallet = path.join(tmpDir, 'no-encrypted-flag.json')
    decryptsToGarbageWallet = path.join(tmpDir, 'decrypts-to-garbage.json')

    const created = await run(['create-wallet', '-3', '-h', '6', '-f', plainWallet])
    assert.strictEqual(created.code, 0, `create-wallet failed: ${created.out}`)
    const encCreated = await run(['create-wallet', '-3', '-h', '6', '-f', encryptedWallet, '-p', WALLET_PASSWORD])
    assert.strictEqual(encCreated.code, 0, `encrypted create-wallet failed: ${encCreated.out}`)

    plainAddress = JSON.parse(fs.readFileSync(plainWallet))[0].address

    fs.writeFileSync(notJsonWallet, 'this is not a wallet')
    // encrypted is neither true nor false, so neither decryption branch runs and
    // the file has to be rejected rather than silently used.
    fs.writeFileSync(noEncryptedFlagWallet, JSON.stringify([{address: plainAddress}]))
    // Decrypts cleanly with the right password but does not yield an address:
    // the only way to reach the "invalid password" check without an error.
    fs.writeFileSync(
      decryptsToGarbageWallet,
      JSON.stringify([{encrypted: true, address: aes.encrypt(WALLET_PASSWORD, 'not-an-address')}])
    )
  })

  after(() => {
    // The command in the require cache holds the stubbed Qrlnode; drop it so a
    // later require in the same process gets the real one back.
    delete require.cache[commandModulePath]
    fs.rmSync(tmpDir, {recursive: true, force: true})
  })

  beforeEach(() => {
    nodeBehaviour = {pages: [[]]}
    apiRequests = []
    connectAttempts = 0
  })

  describe('command definition', () => {
    it('takes a single required address argument', () => {
      assert.ok(Array.isArray(DumpTransactions.args))
      assert.strictEqual(DumpTransactions.args.length, 1)
      assert.strictEqual(DumpTransactions.args[0].name, 'address')
      assert.strictEqual(DumpTransactions.args[0].required, true)
    })

    it('documents itself as a transaction dump with CSV export', () => {
      assert.ok(DumpTransactions.description.includes('transaction list'))
      assert.ok(DumpTransactions.description.includes('CSV'))
    })

    it('offers the network, wallet and output flags', () => {
      const names = Object.keys(DumpTransactions.flags)
      ;['testnet', 'mainnet', 'grpc', 'password', 'csv', 'limit', 'quiet'].forEach(flag => {
        assert.ok(names.includes(flag), `should have a ${flag} flag`)
      })
      assert.strictEqual(DumpTransactions.flags.limit.default, 100)
      assert.strictEqual(DumpTransactions.flags.testnet.default, false)
      assert.strictEqual(DumpTransactions.flags.mainnet.default, false)
    })
  })

  describe('address and wallet file validation', () => {
    it('exits non-zero with no arguments', async () => {
      await refuses(['dump-transactions'], /Missing 1 required arg/)
    })

    it('rejects a string that is neither an address nor a file', async () => {
      await refuses(['dump-transactions', 'not-an-address'], /invalid QRL address\/wallet file/)
    })

    it('rejects a wallet path that does not exist', async () => {
      await refuses(
        ['dump-transactions', path.join(tmpDir, 'nope.json')],
        /invalid QRL address\/wallet file/
      )
    })

    it('reports the parse failure for a file that is not JSON', async () => {
      await refuses(['dump-transactions', notJsonWallet], /JSON/)
    })

    it('refuses a directory where a wallet file was expected, rather than crashing', async () => {
      // existsSync says yes to a directory, so the command goes on to read it as a
      // wallet. That read throws, and it used to escape as a raw EISDIR.
      const {code, out} = await run(['dump-transactions', '/tmp'])
      assert.strictEqual(code, 1, out)
      assert.ok(/invalid QRL address\/wallet file/.test(out), out)
    })

    it('rejects a wallet file with no encrypted flag', async () => {
      await refuses(['dump-transactions', noEncryptedFlagWallet], /invalid QRL address\/wallet file/)
    })

    it('reads the address out of a plaintext wallet file', async () => {
      const {code, out} = await run(['dump-transactions', plainWallet, '-g', DEAD_NODE])
      assert.strictEqual(code, 1, out)
      assert.ok(out.includes(plainAddress), `expected the wallet address in:\n${out}`)
      assert.ok(/Custom GRPC endpoint: \[127\.0\.0\.1:1\]/.test(out), out)
      assert.ok(/Failed to connect to node/.test(out), out)
    })

    it('decrypts an encrypted wallet file with --password', async () => {
      const {code, out} = await run([
        'dump-transactions',
        encryptedWallet,
        '-p',
        WALLET_PASSWORD,
        '-g',
        DEAD_NODE,
      ])
      assert.strictEqual(code, 1, out)
      assert.ok(/Address:.*Q[0-9a-f]{78}/.test(out), `expected a decrypted address in:\n${out}`)
      assert.ok(/Failed to connect to node/.test(out), out)
    })

    it('refuses an encrypted wallet with the wrong password', async () => {
      await refuses(
        ['dump-transactions', encryptedWallet, '-p', 'wrong-password', '-g', DEAD_NODE],
        /Error decrypting wallet/
      )
    })

    it('refuses a wallet whose plaintext is not an address', async () => {
      await refuses(
        ['dump-transactions', decryptsToGarbageWallet, '-p', WALLET_PASSWORD, '-g', DEAD_NODE],
        /invalid password/
      )
    })

    it('prompts for the password when --password is omitted', async () => {
      // cli.prompt reads the terminal, which never answers under a test runner,
      // so stand in for it. The command holds the cli-ux singleton, and prompt is
      // an accessor there, so it has to be redefined rather than assigned.
      const {cli} = require('cli-ux') // eslint-disable-line global-require
      const realPrompt = Object.getOwnPropertyDescriptor(cli, 'prompt')
      const asked = []
      Object.defineProperty(cli, 'prompt', {
        configurable: true,
        value: async question => {
          asked.push(question)
          return WALLET_PASSWORD
        },
      })
      try {
        nodeBehaviour = {pages: [[]]}
        const {code, out} = await runOffline([encryptedWallet])
        assert.deepStrictEqual(asked, ['Enter password for wallet file'])
        assert.strictEqual(code, 0, out)
        assert.ok(/No transactions found for address Q[0-9a-f]{78}/.test(out), out)
      } finally {
        Object.defineProperty(cli, 'prompt', realPrompt)
      }
    })
  })

  describe('network selection', () => {
    it('defaults to mainnet when no network flag is given', async () => {
      // QRL_GRPC_ENDPOINT keeps the actual socket on loopback while the command
      // still walks its default-network branch.
      const {code, out} = await run(['dump-transactions', plainAddress])
      assert.strictEqual(code, 1, out)
      assert.ok(/Mainnet/.test(out), out)
      assert.ok(/Failed to connect to node|Failed to establish connection/.test(out), out)
    })

    it('announces testnet with --testnet', async () => {
      const {out} = await runOffline(['--testnet', plainAddress])
      assert.ok(/Testnet/.test(out), out)
    })

    it('announces mainnet with --mainnet, which wins over --grpc', async () => {
      const {out} = await runOffline(['--grpc', DEAD_NODE, '--mainnet', plainAddress])
      assert.ok(/Mainnet/.test(out), out)
      assert.ok(!/Custom GRPC endpoint/.test(out), out)
    })
  })

  describe('connecting', () => {
    it('retries the connection before giving up', async () => {
      nodeBehaviour = {connectsOnAttempt: 3, pages: [[]]}
      const {code, out} = await runOffline(['-g', DEAD_NODE, plainAddress])
      assert.strictEqual(code, 0, out)
      assert.strictEqual(connectAttempts, 3, 'should have retried until the node answered')
      assert.ok(/Connected to node/.test(out), out)
    })

    it('gives up when the node never completes the handshake', async () => {
      nodeBehaviour = {connectsOnAttempt: 0, pages: [[]]}
      const {code, out} = await runOffline(['-g', DEAD_NODE, plainAddress])
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to establish connection to node/.test(out), out)
    })

    it('reports the underlying error when connect throws', async () => {
      nodeBehaviour = {connectThrows: 'no route to host', pages: [[]]}
      const {code, out} = await runOffline(['-g', DEAD_NODE, plainAddress])
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to connect to node.*\n?.*no route to host/.test(out), out)
    })
  })

  describe('fetching', () => {
    it('asks for the address as raw bytes, without the leading Q', async () => {
      await runOffline(['-g', DEAD_NODE, plainAddress])
      assert.strictEqual(apiRequests.length, 1)
      assert.strictEqual(apiRequests[0].name, 'GetTransactionsByAddress')
      assert.strictEqual(
        apiRequests[0].request.address.toString('hex'),
        plainAddress.substring(1).toLowerCase()
      )
      assert.strictEqual(apiRequests[0].request.page_number, 1)
    })

    it('says so when the address has no transactions', async () => {
      const {code, out} = await runOffline(['-g', DEAD_NODE, plainAddress])
      assert.strictEqual(code, 0, out)
      assert.ok(out.includes(`No transactions found for address ${plainAddress}`), out)
      assert.ok(!/Transaction Summary/.test(out), 'should not print an empty table')
    })

    it('exits when the node errors on a page', async () => {
      nodeBehaviour = {apiThrows: 'stream removed', pages: []}
      const {code, out} = await runOffline(['-g', DEAD_NODE, plainAddress])
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to fetch page 1: stream removed/.test(out), out)
    })

    it('pages until a short page, pausing between pages', async function paging() {
      // The command sleeps 5s between pages on purpose (API rate limit), so this
      // case is deliberately slow rather than flaky.
      this.timeout(60000)
      nodeBehaviour = {pages: [[TRANSFER_TX], []]}
      const {code, out} = await runOffline(['-g', DEAD_NODE, '-l', '1', plainAddress])
      assert.strictEqual(code, 0, out)
      assert.deepStrictEqual(
        apiRequests.map(r => r.request.page_number),
        [1, 2]
      )
      assert.strictEqual(apiRequests[0].request.item_per_page, 1)
      assert.ok(/Pausing 5 seconds/.test(out), out)
      assert.ok(/end of data/.test(out), out)
      assert.ok(/Total transactions fetched: 1/.test(out), out)
    })

    it('falls back to 100 per page when --limit is zero', async () => {
      await runOffline(['-g', DEAD_NODE, '-l', '0', plainAddress])
      assert.strictEqual(apiRequests[0].request.item_per_page, 100)
    })
  })

  describe('output', () => {
    it('prints a row per transaction, whatever the transaction type', async () => {
      nodeBehaviour = {pages: [[TRANSFER_TX, COINBASE_TX, TOKEN_TX, BARE_TX]]}
      const {code, out} = await runOffline(['-g', DEAD_NODE, plainAddress])
      assert.strictEqual(code, 0, out)
      assert.ok(/Total transactions fetched: 4/.test(out), out)
      assert.ok(/Transaction Summary/.test(out), out)
      assert.ok(out.includes('2020-09-13'), `expected the formatted timestamp in:\n${out}`)
      assert.ok(out.includes('1.500000000'), 'transfer amount in quanta')
      assert.ok(out.includes('2.000000000'), 'coinbase amount in quanta')
      assert.ok(out.includes('42 tokens'), 'token amounts are not quanta')
      assert.ok(out.includes('unknown'), 'a transaction with no type is reported as unknown')
      assert.ok(out.includes('0.100000000'), 'fee in quanta')
      assert.ok(out.includes('ab'.repeat(32)), 'transaction hash')
    })

    it('writes a CSV file with --csv, quoting fields containing commas', async () => {
      const csvPath = path.join(tmpDir, 'out.csv')
      nodeBehaviour = {pages: [[TRANSFER_TX, COINBASE_TX, TOKEN_TX, BARE_TX]]}
      const {code, out} = await runOffline(['-g', DEAD_NODE, '-c', csvPath, plainAddress])
      assert.strictEqual(code, 0, out)
      assert.ok(out.includes(`exported to CSV file: ${csvPath}`), out)

      const rows = fs.readFileSync(csvPath, 'utf8').split('\n')
      assert.strictEqual(rows[0], 'Timestamp,Type,Hash,From,To,Amount,Fee,Block')
      assert.strictEqual(rows.length, 5, 'header plus one row per transaction')
      assert.ok(rows[1].startsWith('2020-09-13'), rows[1])
      assert.ok(rows[1].includes(`,transfer,`), rows[1])
      assert.ok(rows[1].includes(`,Q${FROM_HEX},Q${TO_HEX},1.500000000,0.100000000,12345`), rows[1])
      assert.ok(rows[2].includes(`,coinbase,`), rows[2])
      assert.ok(rows[2].includes(',2.000000000,'), rows[2])
      // The comma inside the type has to be quoted or the columns shift.
      assert.ok(rows[3].includes('"transfer_token,v2"'), rows[3])
      assert.ok(rows[3].includes(',42 tokens,'), rows[3])
      assert.ok(rows[4].includes(',unknown,'), rows[4])
      assert.ok(rows[4].includes(',N/A,0,'), 'no recipient and no amount')
      // Without --quiet the table is still printed alongside the export.
      assert.ok(/Transaction Summary/.test(out), out)
    })

    it('suppresses the table with --csv --quiet', async () => {
      const csvPath = path.join(tmpDir, 'quiet.csv')
      nodeBehaviour = {pages: [[TRANSFER_TX]]}
      const {code, out} = await runOffline(['-g', DEAD_NODE, '-c', csvPath, '-q', plainAddress])
      assert.strictEqual(code, 0, out)
      assert.ok(!/Transaction Summary/.test(out), out)
      assert.ok(fs.existsSync(csvPath), 'the CSV is still written')
    })

    it('still prints the table with --quiet alone', async () => {
      nodeBehaviour = {pages: [[TRANSFER_TX]]}
      const {out} = await runOffline(['-g', DEAD_NODE, '-q', plainAddress])
      assert.ok(/Transaction Summary/.test(out), out)
    })

    it('exits when the CSV file cannot be written', async () => {
      nodeBehaviour = {pages: [[TRANSFER_TX]]}
      // A directory is never a valid destination, so the write always fails here.
      const {code, out} = await runOffline(['-g', DEAD_NODE, '-c', tmpDir, plainAddress])
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to write CSV file/.test(out), out)
    })
  })
})
