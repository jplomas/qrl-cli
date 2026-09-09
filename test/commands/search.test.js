const assert = require('assert')
const {spawn} = require('child_process')
const fs = require('fs')

const testSetup = require('../test_setup')

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


let aliceLattice
let aliceTxHash

//
describe('search setup', () => {
  let exitCode
  before(done => {
    aliceLattice = openFile(testSetup.aliceLatticeLocation) // 
    aliceTxHash = aliceLattice[0].tx_hash
    done()
  })
  it('exit code should be non-0 if passed without any arguments/flags, requires xmss address and ots index', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// search command without any flags
describe('search #1', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without any arguments/flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// search command without correct search info
describe('search #2', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      'something_to_look_for_never_to_be_found',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with incorrect arguments/flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// search command address lookup mainnet without flag
describe('search #3', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 - search command address lookup mainnet', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// search command tx lookup mainnet
describe('search #4', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      '15',
      '-m',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 - search command block lookup mainnet with -m flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})
// search command tx lookup grpc to testnet
describeOnline('search #5', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      aliceTxHash,
      '-g',
      'testnet-3.automated.theqrl.org:19009',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 - search command transaction hash lookup with manual grpc to testnet', () => {
    assert.strictEqual(exitCode, 0)
  })
})


// search command with txHash that does not exist
describe('search #6', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      'ce14f14564be176a62794088bab55a095ac82fdfa0f390fe6e8df6d2f200b2e9',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if txHash not found', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// search command with block that does not exist
describe('search #7', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      '9999999999',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if block not found', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// search command address lookup with json flag
describe('search #8', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f',
      '-j',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 - search command address lookup with json flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// search command tx lookup with json flag
describeOnline('search #9', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      aliceTxHash,
      '-j',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 - search command tx lookup with json flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// search command address lookup with bad address
describe('search #10', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      '15',
      '-j',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 - search command address lookup with bad address', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// search command address lookup with bad address
describe('search #11', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7g',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 - search command address lookup with bad address', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// search command address lookup with bad address (not start with q)
describe('search #12', () => {
  let exitCode
  before(done => {
    const args = [
      'search',
      'a000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 - search command address lookup with bad address (not start with q)', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// Offline cases.
//
// Nothing below reaches a node: each case either stops at the search-string
// switch or at a connection to a closed local port. `-g 127.0.0.1:1` is a port
// nothing listens on, so the CLI resolves it, fails to connect and exits — a
// deterministic failure that never leaves the machine.
// ///////////////////////////////////////////////////////////////////////////

const DEAD_NODE = '127.0.0.1:1'
// A 78 character address with the leading Q stripped: search accepts this form too.
const ADDRESS_NO_Q = '000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f'

// Run the CLI and capture what it said, rather than letting it write to the test output.
function runSearch(args) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'pipe', 'pipe']})
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

// Assert on the reason a case failed, not just on the exit code, so a command that starts
// failing somewhere else does not keep the test green.
async function searchRefuses(args, expected) {
  const {code, out} = await runSearch(args)
  assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}`)
  expected.forEach(pattern => {
    assert.ok(pattern.test(out), `expected output to match ${pattern}\n--- actual ---\n${out}`)
  })
}

describe('search offline', () => {
  it('reports the custom endpoint it was given, and that it could not reach it', async () => {
    await searchRefuses(
      ['search', '15', '-g', DEAD_NODE],
      [/Custom GRPC endpoint: \[127\.0\.0\.1:1\]/, /Block/, /Failed to connect to node/]
    )
  })

  it('reads a 78 character hex string as an address', async () => {
    await searchRefuses(
      ['search', ADDRESS_NO_Q, '-g', DEAD_NODE],
      [/Address/, /Failed to connect to node/]
    )
  })

  it('does not fall back to a public node when the given endpoint is unreachable', async () => {
    const {out} = await runSearch(['search', '15', '-g', DEAD_NODE])
    assert.ok(
      !/automated\.theqrl\.org/.test(out),
      `a failed custom endpoint must not be replaced by a public one\n--- actual ---\n${out}`
    )
  })
})

// ///////////////////////////////////////////////////////////////////////////
// search: what the command does once a node has answered
//
// The suites above stop at a closed loopback port, so everything after the
// connection - the retry loop and the three kinds of lookup the command makes -
// only ran against a live node. These cases run the command in *this* process
// against a stub gRPC client instead. src/functions/grpc is swapped in the
// require cache for the moment it takes to require the command (it captures
// Qrlnode at require time), then the real module is put straight back. There is
// no server and no socket, and `search` only ever reads.
// ///////////////////////////////////////////////////////////////////////////

// kleur colours by environment variable rather than by isTTY, so captured output
// still carries escape sequences. Strip them before matching.
const SEARCH_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

// Behaviour the stub should show for the test currently running. Reset per test.
let searchNode = {}
let searchCalls = []
let searchConnectAttempts = 0

class SearchFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    searchConnectAttempts += 1
    if (searchNode.connectThrows) {
      throw new Error(searchNode.connectThrows)
    }
    const connectsOn = searchNode.connectsOnAttempt === undefined ? 1 : searchNode.connectsOnAttempt
    if (connectsOn !== 0 && searchConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    searchCalls.push({name, request})
    return searchNode.response === undefined ? {found: false} : searchNode.response
  }
}

const searchGrpcPath = require.resolve('../../src/functions/grpc')
const searchCommandPath = require.resolve('../../src/commands/search')

const searchRealGrpcEntry = require.cache[searchGrpcPath]
require.cache[searchGrpcPath] = {
  id: searchGrpcPath,
  filename: searchGrpcPath,
  path: require('path').dirname(searchGrpcPath), // eslint-disable-line global-require
  loaded: true,
  children: [],
  paths: [],
  exports: SearchFakeQrlNode,
}
const {Search} = require('../../src/commands/search')

if (searchRealGrpcEntry) {
  require.cache[searchGrpcPath] = searchRealGrpcEntry
} else {
  delete require.cache[searchGrpcPath]
}

// Run the command here, against the stub, capturing everything it prints
// (this.log and console.dir go to stdout, the ora spinner goes to stderr).
async function runSearchOffline(argv) {
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
    await Search.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  return {code, out: chunks.join('').replace(SEARCH_ANSI, '')}
}

const A_TX_HASH = '9d3f463b300012292eac668768f2969125ae540b1cdef7c99f6fea448e736af8'

describe('search: reading a node reply', () => {
  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[searchCommandPath]
  })

  beforeEach(() => {
    searchNode = {}
    searchCalls = []
    searchConnectAttempts = 0
  })

  it('retries the connection until the node answers', async () => {
    searchNode = {connectsOnAttempt: 3}
    const {code, out} = await runSearchOffline(['15', '-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.strictEqual(searchConnectAttempts, 3)
    assert.ok(/retry connection attempt: 0/.test(out), out)
    assert.ok(/retry connection attempt: 1/.test(out), out)
  })

  it('asks for a block by its height', async () => {
    const {code, out} = await runSearchOffline(['15', '-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.strictEqual(searchCalls[0].name, 'GetObject')
    // a block height goes over the wire as its decimal text, not as bytes
    assert.strictEqual(searchCalls[0].request.query.toString(), '15')
    assert.ok(/Unable to find block/.test(out), out)
  })

  it('asks for a transaction by its hash, as bytes', async () => {
    const {code, out} = await runSearchOffline([A_TX_HASH, '-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.strictEqual(searchCalls[0].request.query.toString('hex'), A_TX_HASH)
    assert.ok(/Unable to find transaction/.test(out), out)
  })

  it('rejects an address the node was never going to recognise', async () => {
    // 79 characters starting with Q, so it is routed as an address, but not a
    // valid one: that has to be caught here rather than asked of the node.
    const {code, out} = await runSearchOffline([`Q${'0'.repeat(78)}`, '-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.ok(/Invalid address given/.test(out), out)
    assert.strictEqual(searchCalls.length, 0, 'nothing may be asked of the node for a bad address')
  })
})
