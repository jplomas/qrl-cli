// ///////////////////////////////////////////////////////////////////////////
// status command tests
//
// `status` is one of the two commands here that has to reach a node before it
// can do anything, so the cases split in two:
//
//   * the original cases, which query a real public node. They are skipped when
//     QRL_TEST_OFFLINE=true, the same switch test/hooks.js already uses, so the
//     suite is runnable with no network at all.
//   * offline cases, which point the command at a closed loopback port. Those
//     exercise everything up to and including the connection-failure reporting
//     without leaving the machine.
//
// Child processes get a throwaway config directory: `status` resolves its
// endpoint through the `conf` store, so a value in the developer's real config
// would otherwise change which node these tests talk to.
// ///////////////////////////////////////////////////////////////////////////

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {spawn} = require('child_process')

const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

// The cases that need a live node. Skipped rather than deleted so they still
// run in the normal, networked CI job.
const describeOnline = process.env.QRL_TEST_OFFLINE === 'true' ? describe.skip : describe

// A closed port on loopback: the connection is refused immediately and
// deterministically, and nothing leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

// kleur colours its output even into a pipe; strip the escapes before matching.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

let tempHome
let childEnv

function run(args) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'pipe', 'pipe'], env: childEnv})
    let out = ''
    child.stdout.on('data', d => {
      out += d.toString()
    })
    child.stderr.on('data', d => {
      out += d.toString()
    })
    child.on('close', code => resolve({code, out: out.replace(ANSI, '')}))
  })
}

describeOnline('status #1', () => {
  let exitCode
  const args = [
    'status',
  ]
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed without any arguments (default mainnet)', () => {
    assert.strictEqual(exitCode, 0)
  })
})


describeOnline('status #2', () => {
  let exitCode
  const args = [
    'status',
    '-m',
  ]
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed with -m mainnet flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

describeOnline('status #3', () => {
  let exitCode
  const args = ['status', '-t']
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed with -t testnet flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

//  devnet is Zond...
// describe('status #4', () => {
//   const args = ['status', '-d']
//   let exitCode
//   before(done => {
//     const process = spawn('./bin/run', args, processFlags)
//     process.on('exit', code => {
//       exitCode = code
//       done()
//     })
//   })
//   it('exit code should be 0 if passed with -d devnet flag', () => {
//     assert.strictEqual(exitCode, 0)
//   })
// })


describeOnline('status #5', () => {
  let exitCode
  const args = ['status', '-g', 'mainnet-3.automated.theqrl.org:19009']
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed with -g and valid custom grpc endpoint', () => {
    assert.strictEqual(exitCode, 0)
  })
})

describe('status #6', () => {
  let exitCode
  const args = ['status', '-g']
  before(done => {
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

describe('status #7', () => {
  let exitCode
  const args = ['status', '-g', 'invalid.theqrl.org']
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -g and a bad grpc endpoint', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// need to inject false proto shasums to test lines 40, 41 and 49

// ///////////////////////////////////////////////////////////////////////////
// Offline behaviour: what the user is told when the node cannot be reached.
//
// The cases above only assert exit codes, so a `status` that failed for an
// entirely different reason -- a crash in argument handling, say -- would still
// have looked like a pass. These assert on the message.
// ///////////////////////////////////////////////////////////////////////////

describe('status: when the node cannot be reached', () => {
  before(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-status-test-'))
    childEnv = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: tempHome,
      APPDATA: tempHome,
      LOCALAPPDATA: tempHome,
    }
  })

  after(() => {
    fs.rmSync(tempHome, {recursive: true, force: true})
  })

  it('names the endpoint it is about to query before querying it', async () => {
    // The banner is the only thing that tells a user which host the CLI is
    // about to speak plaintext gRPC to, so it has to name the custom endpoint
    // rather than the network the flags nominally selected.
    const {code, out} = await run(['status', '-g', DEAD_NODE])
    assert.notStrictEqual(code, 0)
    assert.ok(out.includes(`Custom GRPC endpoint: [${DEAD_NODE}]`), out)
  })

  it('reports the connection failure and exits non-zero', async () => {
    const {code, out} = await run(['status', '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node\. Check network connection & parameters/.test(out), out)
    assert.ok(/ECONNREFUSED/.test(out), out)
    // and it must not go on to print a status it never received
    assert.ok(!/Block height/.test(out), out)
  })

  it('reports the connection failure without a spinner in --json mode', async () => {
    // With --json there is no spinner to fail, so the error takes a different
    // branch. It still has to say something: a silent non-zero exit here would
    // be indistinguishable from a node that answered with nothing.
    const {code, out} = await run(['status', '--json', '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node:/.test(out), out)
    assert.ok(/ECONNREFUSED/.test(out), out)
    // --json suppresses the human banner
    assert.ok(!out.includes('Custom GRPC endpoint:'), out)
  })

  it('honours -j as well as --json', async () => {
    const {code, out} = await run(['status', '-j', '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node:/.test(out), out)
  })

  it('takes the endpoint from the config store when no flag is given', async () => {
    // The stored grpc-endpoint silently redirects every command. Proving it is
    // honoured here also proves these tests are reading the throwaway store and
    // not the developer's own.
    await run(['config', 'set', 'grpc-endpoint', DEAD_NODE])
    try {
      const {code, out} = await run(['status'])
      assert.strictEqual(code, 1)
      assert.ok(out.includes(`Custom GRPC endpoint: [${DEAD_NODE}]`), out)
      assert.ok(/Failed to connect to node/.test(out), out)
    } finally {
      await run(['config', 'delete', 'grpc-endpoint'])
    }
  })
})

// ///////////////////////////////////////////////////////////////////////////
// status: what the command does once a node has answered
//
// Everything above stops at the connection. This suite runs the command in
// *this* process against a stub gRPC client, so the retry loop and both
// renderings of a GetStats reply - the human report and --json - are covered
// without a node, a socket or a packet leaving the machine.
//
// src/functions/grpc is swapped in the require cache only for the moment it
// takes to require the command (the command captures Qrlnode at require time),
// then the real module is put straight back.
// ///////////////////////////////////////////////////////////////////////////

// Behaviour the stub should show for the test currently running. Reset per test.
let statusNode = {}
let statusCalls = []
let statusConnectAttempts = 0

class StatusFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    statusConnectAttempts += 1
    if (statusNode.connectThrows) {
      throw new Error(statusNode.connectThrows)
    }
    const connectsOn = statusNode.connectsOnAttempt === undefined ? 1 : statusNode.connectsOnAttempt
    if (connectsOn !== 0 && statusConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name) {
    statusCalls.push(name)
    if (statusNode.apiThrows) {
      throw new Error(statusNode.apiThrows)
    }
    return statusNode.stats
  }
}

const statusGrpcPath = require.resolve('../../src/functions/grpc')
const statusCommandPath = require.resolve('../../src/commands/status')

const statusRealGrpcEntry = require.cache[statusGrpcPath]
require.cache[statusGrpcPath] = {
  id: statusGrpcPath,
  filename: statusGrpcPath,
  path: path.dirname(statusGrpcPath),
  loaded: true,
  children: [],
  paths: [],
  exports: StatusFakeQrlNode,
}
const {Status} = require('../../src/commands/status')

if (statusRealGrpcEntry) {
  require.cache[statusGrpcPath] = statusRealGrpcEntry
} else {
  delete require.cache[statusGrpcPath]
}

// A GetStats reply, shaped the way the node returns it: every numeric field
// arrives as a string.
const STATS = {
  uptime_network: '864000',
  epoch: 7,
  coins_emitted: '65000000000000000',
  coins_total_supply: '105000000',
  block_last_reward: '5324567890',
  node_info: {
    network_id: 'the QRL testnet',
    version: '4.0.2 python',
    state: 'SYNCED',
    num_connections: '17',
    num_known_peers: '42',
    uptime: '172800',
    block_height: '2764412',
  },
}

// Run the command here, against the stub, capturing everything it prints. The
// human report goes through this.log, --json through console.log, and the ora
// spinners through stderr, so all three streams are captured.
async function runStatusOffline(argv) {
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
    await Status.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  return {code, out: chunks.join('').replace(ANSI, '')}
}

describe('status: reporting a node reply', () => {
  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[statusCommandPath]
  })

  beforeEach(() => {
    statusNode = {stats: STATS}
    statusCalls = []
    statusConnectAttempts = 0
  })

  it('asks the node for its stats once it is connected', async () => {
    const {code} = await runStatusOffline(['-g', DEAD_NODE])
    assert.strictEqual(code, 0)
    assert.deepStrictEqual(statusCalls, ['GetStats'])
  })

  it('retries the connection until the node answers', async () => {
    statusNode = {stats: STATS, connectsOnAttempt: 3}
    const {code, out} = await runStatusOffline(['-g', DEAD_NODE])
    assert.strictEqual(code, 0, out)
    assert.strictEqual(statusConnectAttempts, 3)
    assert.ok(/retry connection attempt: 0/.test(out), out)
    assert.ok(/retry connection attempt: 1/.test(out), out)
  })

  it('retries quietly in --json mode, where there is no spinner to update', async () => {
    statusNode = {stats: STATS, connectsOnAttempt: 3}
    const {code, out} = await runStatusOffline(['-g', DEAD_NODE, '--json'])
    assert.strictEqual(code, 0, out)
    assert.strictEqual(statusConnectAttempts, 3)
    assert.ok(!/retry connection attempt/.test(out), out)
    assert.strictEqual(JSON.parse(out).node.state, 'SYNCED')
  })

  describe('the human report', () => {
    it('converts the network figures the node reports into what it claims to print', async () => {
      const {code, out} = await runStatusOffline(['-g', DEAD_NODE])
      assert.strictEqual(code, 0, out)
      assert.ok(out.includes('Network id the QRL testnet'), out)
      // 864000 seconds of network uptime is 10 days, and the report says "days"
      assert.ok(/Network uptime 10 days/.test(out), out)
      assert.ok(/Epoch 7/.test(out), out)
      // shor -> quanta, so the emitted supply is not printed off by 10^9
      assert.ok(/Coins emitted 65000000/.test(out), out)
      assert.ok(/Total coin supply 105000000/.test(out), out)
      assert.ok(/Last block reward 5\.32456789/.test(out), out)
    })

    it('prints the node figures under their own heading', async () => {
      const {out} = await runStatusOffline(['-g', DEAD_NODE])
      assert.ok(/Node status:/.test(out), out)
      assert.ok(/Version 4\.0\.2 python/.test(out), out)
      assert.ok(/State SYNCED/.test(out), out)
      assert.ok(/Connections 17/.test(out), out)
      assert.ok(/Known peers 42/.test(out), out)
      // 172800 seconds is 2 days
      assert.ok(/Node uptime 2 days/.test(out), out)
      assert.ok(/Block height 2764412/.test(out), out)
    })
  })

  describe('--json', () => {
    it('prints one JSON object with the same figures and no banner', async () => {
      const {code, out} = await runStatusOffline(['-g', DEAD_NODE, '--json'])
      assert.strictEqual(code, 0, out)
      const parsed = JSON.parse(out)
      assert.deepStrictEqual(parsed.network, {
        id: 'the QRL testnet',
        uptime_days: 10,
        epoch: 7,
        coins_emitted: 65000000,
        coins_total_supply: '105000000',
        last_block_reward: 5.32456789,
      })
      assert.deepStrictEqual(parsed.node, {
        version: '4.0.2 python',
        state: 'SYNCED',
        connections: '17',
        known_peers: '42',
        uptime_days: 2,
        block_height: '2764412',
      })
    })

    it('prints no spinner text alongside the JSON', async () => {
      // Anything else on stdout would stop the output being parseable by the
      // scripts --json exists for.
      const {out} = await runStatusOffline(['-g', DEAD_NODE, '-j'])
      assert.ok(!/Network status:/.test(out), out)
      assert.ok(!/Custom GRPC endpoint/.test(out), out)
    })
  })

  it('surfaces a GetStats failure rather than reporting a blank status', async () => {
    statusNode = {apiThrows: 'stream removed'}
    const {code, out} = await runStatusOffline(['-g', DEAD_NODE])
    assert.strictEqual(code, 1, out)
    assert.ok(!/Block height/.test(out), out)
  })
})
