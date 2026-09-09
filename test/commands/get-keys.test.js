// ////////////////////////////////
// Get Lattice Keys test
// 
// ///////////////////////////////

const assert = require('assert')
const {spawn} = require('child_process')
const fs = require('fs')
const path = require('path')

const setup = require('../test_setup')

// Suites needing on-chain state (skipped in offline mock mode: hooks create no broadcast txs)
const describeOnline = process.env.QRL_TEST_OFFLINE === 'true' ? describe.skip : describe


const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

const openFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)
}

let aliceWallet
let bobWallet
let aliceAddress
let bobAddress
let bobLattice
let bobTXID

describe('get-keys setup', () => {
  let exitCode
  before(done => {
    aliceWallet = openFile(setup.alicePTWalletLocation)
    bobWallet = openFile(setup.bobPTWalletLocation) // 
    aliceAddress= aliceWallet[0].address
    bobAddress= bobWallet[0].address
    bobLattice = openFile(setup.bobLatticeLocation) // 
    bobTXID = bobLattice[0].tx_hash
    done()
  })
  it('exit code should be 0 if setup......', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// get-keys command without any flags
describe('get-keys #1', () => {
  const args = [
    'get-keys',
  ]
  let exitCode
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without any arguments/flags, requires QRL address', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// get-keys command with an incorrect QRL address
describe('get-keys #2', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b83',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with incorrect QRL address', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// get-keys command with itemsPerPage set to non-number 
describe('get-keys #3', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-i', 'a',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with itemsPerPage set to non-number ', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// get-keys command with pageNumber set to non-number 
describe('get-keys #4', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-i', '1',
      '-p', 'a',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with pageNumber set to non-number ', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// wrong grpc endpoint
describe('get-keys #5', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-i', '1',
      '-p', '1',
      '-g', 'invalid.theqrl.org:19009',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -g and missing grpc endpoint', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// get keys from address given testnet
describe('get-keys #6', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with keys printed to console for testnet', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given mainnet
describe('get-keys #7', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-i', '1',
      '-p', '1',
      '-m',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with keys printed to console for mainnet', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print json
describe('get-keys #8', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-i', '1',
      '-p', '1',
      '-t',
      '-j',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with public keys printed to console in json', () => {
    assert.strictEqual(exitCode, 0)
  })
})
// get keys from address given and print to file
describe('get-keys #9', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-i', '2',
      '-p', '1',
      '-t',
      '-f', setup.aliceTempPubKeyFile,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with keys printed to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print to console without item passed
describe('get-keys #10', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-t',
      '-j',
      '-p', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with default number of keys printed to console', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print to console without page passed
describe('get-keys #11', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', bobAddress,
      '-t',
      '-j',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with default number of keys printed to console', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print to console  No keys found
describe('get-keys #12', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', 'Q000500215d6a512b193aa19f7812bb708251f94e48e176e00bfea0760fa48419feae6ce3ab1637',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with no keys found', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print to console  No keys found
describe('get-keys #13', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-T', 'NotATransaction',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if -T passed without correct txhash Unable to find transaction', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// get keys from address given and print to console  Not a lattice transaction
describe('get-keys #14', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-T', '021bb526ec6d35e880e2e706e2dd16a4c6da7223a8b632a57cd5cd44d5f4cf42',
      '-m',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if -T passed with txhash that is not a lattice transaction', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// get keys from address given and print to console without page passed
describeOnline('get-keys #15', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-T', bobTXID,
      '-t',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with default number of keys printed to console', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print to console without page passed
describeOnline('get-keys #16', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-T', bobTXID,
      '-t',
      '-i', '1',
      '-j',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with default number of keys printed to console', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print to file
describe('get-keys #17', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', aliceAddress,
      '-i', '2',
      '-p', '1',
      '-t',
      '-f', setup.aliceTempPubKeyFile,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with keys printed to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// get keys from address given and print to file
describe('get-keys #18', () => {
  let exitCode
  before(done => {
    const args = [
      'get-keys',
      '-a', bobAddress,
      '-i', '2',
      '-p', '1',
      '-t',
      '-f', setup.bobTempPubKeyFile,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if everything is correct with keys printed to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})
// ///////////////////////////////////////////////////////////////////////////
// Offline cases
//
// The suites above all reach for a real node: most of them assert exit code 0,
// which only holds while mainnet/testnet are answering. The cases below run
// with no node at all -- each one stops at a validation gate, or at a
// connection to a closed local port -- and they assert on the message rather
// than the exit code alone, so a command that starts failing at a different
// gate cannot keep passing.
// ///////////////////////////////////////////////////////////////////////////

// A closed port on loopback: the CLI resolves it, fails to connect, and exits.
// Deterministic, and it never leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

// Well formed but arbitrary: these never get as far as a node.
const SOME_ADDRESS = 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3'
const SOME_TX_HASH = '021bb526ec6d35e880e2e706e2dd16a4c6da7223a8b632a57cd5cd44d5f4cf42'

// -t and -m hard-code the public QRL endpoints and ignore --grpc, so the only
// way to exercise them without reaching mainnet or testnet is to take name
// resolution away from the child, which is what a machine with no network
// looks like anyway. Appended to NODE_OPTIONS so nyc's own preload survives.
const OFFLINE_DNS = path.join(__dirname, '..', 'helpers', 'offline-dns.js')
const offlineEnv = {
  ...process.env,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${OFFLINE_DNS}`.trim(),
}

function runGetKeys(args) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', ['get-keys', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: offlineEnv,
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

describe('get-keys offline', () => {
  it('says which argument is missing when given none', async () => {
    const {code, out} = await runGetKeys([])
    assert.notStrictEqual(code, 0)
    assert.ok(/No address or txHash given/.test(out), out)
  })

  it('names the address as the problem when it fails validation', async () => {
    const {code, out} = await runGetKeys(['-a', 'Q0000000000000000000000000000000000000000000000000000000000000000000000000000000'])
    assert.notStrictEqual(code, 0)
    assert.ok(/QRL Address is not valid/.test(out), out)
  })

  it('rejects a non-numeric items-per-page', async () => {
    const {code, out} = await runGetKeys(['-a', SOME_ADDRESS, '-i', 'lots'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Not a valid number: Need items per page number/.test(out), out)
  })

  it('rejects a non-numeric page number', async () => {
    const {code, out} = await runGetKeys(['-a', SOME_ADDRESS, '-i', '1', '-p', 'first'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Not a valid number: Which page to view/.test(out), out)
  })

  it('reports the endpoint it was asked to use before it fails to reach it', async () => {
    const {code, out} = await runGetKeys(['-a', SOME_ADDRESS, '-g', DEAD_NODE])
    assert.notStrictEqual(code, 0)
    assert.ok(out.includes(`Custom GRPC endpoint: [${DEAD_NODE}]`), out)
    assert.ok(/Failed to connect to node/.test(out), out)
  })

  it('names testnet as the network it is querying', async () => {
    const {code, out} = await runGetKeys(['-a', SOME_ADDRESS, '-t'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Fetching Lattice keys on/.test(out), out)
    assert.ok(/Testnet/.test(out), out)
    assert.ok(/Failed to connect to node/.test(out), out)
  })

  it('names mainnet as the network it is querying', async () => {
    const {code, out} = await runGetKeys(['-a', SOME_ADDRESS, '-m'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Mainnet/.test(out), out)
    assert.ok(/Failed to connect to node/.test(out), out)
  })

  it('fails the same way for a transaction hash lookup', async () => {
    const {code, out} = await runGetKeys(['-T', SOME_TX_HASH, '-g', DEAD_NODE])
    assert.notStrictEqual(code, 0)
    assert.ok(/Failed to connect to node/.test(out), out)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// get-keys: what the command does once a node has answered
//
// The suites above stop at a closed loopback port, so everything after the
// connection - the retry loop and the transaction lookup - only ran against a
// live node. These cases run the command in *this* process against a stub gRPC
// client instead. src/functions/grpc is swapped in the require cache for the
// moment it takes to require the command (it captures Qrlnode at require time),
// then the real module is put straight back. There is no server and no socket,
// and `get-keys` only ever reads.
// ///////////////////////////////////////////////////////////////////////////

// kleur colours by environment variable rather than by isTTY, so captured output
// still carries escape sequences. Strip them before matching.
const GK_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

// Behaviour the stub should show for the test currently running. Reset per test.
let gkNode = {}
let gkCalls = []
let gkConnectAttempts = 0

class GetKeysFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    gkConnectAttempts += 1
    if (gkNode.connectThrows) {
      throw new Error(gkNode.connectThrows)
    }
    const connectsOn = gkNode.connectsOnAttempt === undefined ? 1 : gkNode.connectsOnAttempt
    if (connectsOn !== 0 && gkConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    gkCalls.push({name, request})
    if (name === 'GetTransaction') {
      return gkNode.transaction
    }
    return gkNode.object === undefined ? {found: false} : gkNode.object
  }
}

const gkGrpcPath = require.resolve('../../src/functions/grpc')
const gkCommandPath = require.resolve('../../src/commands/get-keys')

const gkRealGrpcEntry = require.cache[gkGrpcPath]
require.cache[gkGrpcPath] = {
  id: gkGrpcPath,
  filename: gkGrpcPath,
  path: path.dirname(gkGrpcPath),
  loaded: true,
  children: [],
  paths: [],
  exports: GetKeysFakeQrlNode,
}
const {keySearch} = require('../../src/commands/get-keys')

if (gkRealGrpcEntry) {
  require.cache[gkGrpcPath] = gkRealGrpcEntry
} else {
  delete require.cache[gkGrpcPath]
}

async function runGetKeysOffline(argv) {
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
    await keySearch.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  return {code, out: chunks.join('').replace(GK_ANSI, '')}
}

const gkBytes = (hex) => Buffer.from(hex, 'hex')

// A lattice transaction as the node returns it, with the three public keys the
// command is there to extract.
const LATTICE_OBJECT = {
  found: true,
  transaction: {
    addr_from: gkBytes(SOME_ADDRESS.substring(1)),
    tx: {
      transaction_hash: gkBytes(SOME_TX_HASH),
      latticePK: {
        pk1: gkBytes('aa'.repeat(32)),
        pk2: gkBytes('bb'.repeat(32)),
        pk3: gkBytes('cc'.repeat(32)),
      },
    },
  },
}

const LATTICE_METADATA = {
  tx: {
    master_addr: gkBytes(''),
    public_key: gkBytes('dd'.repeat(32)),
    signature: gkBytes('ee'.repeat(32)),
    transaction_hash: gkBytes(SOME_TX_HASH),
  },
  block_header_hash: gkBytes('ff'.repeat(32)),
}

describe('get-keys: reading a node reply', () => {
  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[gkCommandPath]
  })

  beforeEach(() => {
    gkNode = {object: LATTICE_OBJECT, transaction: LATTICE_METADATA}
    gkCalls = []
    gkConnectAttempts = 0
  })

  it('retries the connection until the node answers', async () => {
    gkNode = {connectsOnAttempt: 3, object: {found: false}}
    const {code, out} = await runGetKeysOffline(['-T', SOME_TX_HASH, '-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.strictEqual(gkConnectAttempts, 3)
    assert.ok(/retry connection attempt: 0/.test(out), out)
  })

  it('asks the node for the transaction hash it was given, as bytes', async () => {
    const {code, out} = await runGetKeysOffline(['-T', SOME_TX_HASH, '-g', DEAD_NODE])
    assert.strictEqual(code, 0, out)
    const lookup = gkCalls.find((c) => c.name === 'GetObject')
    assert.strictEqual(lookup.request.query.toString('hex'), SOME_TX_HASH)
  })

  it('reports the three lattice public keys it found', async () => {
    const {code, out} = await runGetKeysOffline(['-T', SOME_TX_HASH, '-g', DEAD_NODE])
    assert.strictEqual(code, 0, out)
    assert.ok(out.includes('aa'.repeat(32)), out)
    assert.ok(out.includes('bb'.repeat(32)), out)
    assert.ok(out.includes('cc'.repeat(32)), out)
  })

  it('exits non-zero when the node has no such transaction', async () => {
    gkNode = {object: {found: false}}
    const {code, out} = await runGetKeysOffline(['-T', SOME_TX_HASH, '-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.ok(/Unable to find transaction/.test(out), out)
  })

  it('refuses a transaction that is not a lattice transaction', async () => {
    // Without this check the command would go on to read latticePK off a
    // transaction that has none, and report keys it never found.
    gkNode = {object: {found: true, transaction: {addr_from: gkBytes(SOME_ADDRESS.substring(1)), tx: {}}}}
    const {code, out} = await runGetKeysOffline(['-T', SOME_TX_HASH, '-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.ok(/Not a lattice transaction/.test(out), out)
  })
})
