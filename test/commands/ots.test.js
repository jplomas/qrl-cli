// ///////////////////////////////////////////////////////////////////////////
// ots command tests
//
// `ots` reports the next unused one-time-signature index for an address, so it
// needs a node before it can answer -- but everything in front of that answer
// is local: address validation, the wallet-file fallback, and the password
// handling that decrypts an encrypted wallet. That front half is what these
// tests cover, and it is the half that decides *which* address the query is
// made for.
//
// The cases are split:
//   * the original cases that query a real public node are skipped when
//     QRL_TEST_OFFLINE=true, the same switch test/hooks.js already uses.
//   * everything added below either stops at a local validation gate or
//     connects to a closed loopback port, so nothing leaves the machine and no
//     OTS key is ever consumed.
//
// Child processes get a throwaway config directory, because `ots` resolves its
// endpoint through the `conf` store.
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

// A closed port on loopback: refused immediately, deterministically, locally.
const DEAD_NODE = '127.0.0.1:1'

const VALID_ADDRESS = 'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f'
const WALLET_PASSWORD = 'testing'

// kleur colours its output even into a pipe; strip the escapes before matching.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

// no args
describe('ots #1', () => {
  let exitCode
  before(done => {
    const args = [
      'ots',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without an argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad address given
describe('ots #2', () => {
  let exitCode
  before(done => {
    const args = [
      'ots',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f4',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with an invalid address as argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad address file given
// A directory: existsSync says yes, so the command tries to read it as a wallet. It used
// to die on the raw EISDIR that throws out of that read, which is a non-zero exit for a
// reason this case never meant to test - so the reason is asserted now, not just the code.
describe('ots #3', () => {
  let exitCode
  let out = ''
  before(done => {
    const args = [
      'ots',
      '/tmp',
    ]
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'pipe', 'pipe']})
    child.stdout.on('data', d => {
      out += d.toString()
    })
    child.stderr.on('data', d => {
      out += d.toString()
    })
    child.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('says the path is not a usable wallet file rather than crashing', () => {
    assert.ok(/Unable to get OTS: not a file/.test(out), out)
    assert.ok(!/EISDIR/.test(out), `the read error must not escape\n--- actual ---\n${out}`)
  })
  it('exit code should be non-0 if passed with an invalid address file as argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// bad password for address file given
describe('ots #4', () => {
  let exitCode
  before(done => {
    const args = [
      'ots',
      '/tmp/enc-wallet.json',
      '-p',
      'NotThePassword'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with an invalid password for address file as argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// fail with bad grpc address
describe('ots #5', () => {
  let exitCode
  before(done => {
    const args = [
      'ots',
      'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f',
      '-g',
      'invalid.theqrl.org:19009',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with dead custom grpc link and a valid address as argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})



// valid args should succeed
describeOnline('ots #6', () => {
  let exitCode
  before(done => {
    const args = [
      'ots',
      'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed with a valid address as argument', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// valid mainnet flag
describeOnline('ots #7', () => {
  let exitCode
  before(done => {
    const args = [
      'ots',
      'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-m',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed with mainnet flag and a valid address as argument', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// valid testnet flag
describeOnline('ots #8', () => {
  let exitCode
  before(done => {
    const args = [
      'ots',
      'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd7f',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed with testnet flag and a valid address as argument', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// Offline coverage of everything that happens before the node is queried.
//
// The cases above assert only exit codes, so an `ots` that refused for the
// wrong reason -- the wrong file read, the wrong address decrypted -- looked
// exactly like one that refused for the right one. These assert on the message,
// and on which address the command decided to ask about.
// ///////////////////////////////////////////////////////////////////////////

describe('ots: local validation and the wallet-file fallback', () => {
  let tempDir
  let childEnv
  let plainWallet
  let encryptedWallet
  let encryptedGarbageWallet
  let noEncryptedFlagWallet
  let emptyArrayWallet
  let notJsonFile

  const write = (name, contents) => {
    const file = path.join(tempDir, name)
    fs.writeFileSync(file, contents)
    return file
  }

  function run(args, stdin) {
    return new Promise(resolve => {
      const child = spawn('./bin/run', args, {
        stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        env: childEnv,
      })
      let out = ''
      child.stdout.on('data', d => {
        out += d.toString()
      })
      child.stderr.on('data', d => {
        out += d.toString()
      })
      child.on('close', code => resolve({code, out: out.replace(ANSI, '')}))
      if (stdin !== undefined) {
        child.stdin.end(stdin)
      }
    })
  }

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-ots-test-'))
    childEnv = {
      ...process.env,
      HOME: tempDir,
      XDG_CONFIG_HOME: tempDir,
      APPDATA: tempDir,
      LOCALAPPDATA: tempDir,
    }
    // eslint-disable-next-line global-require
    const aes = require('../../src/utils/aes')

    plainWallet = write('plain-wallet.json', JSON.stringify([{encrypted: false, address: VALID_ADDRESS}]))
    encryptedWallet = write(
      'enc-wallet.json',
      JSON.stringify([{encrypted: true, address: aes.encrypt(WALLET_PASSWORD, VALID_ADDRESS)}])
    )
    // Decrypts cleanly with the right password, but to something that is not an
    // address. This is the shape a legacy (unauthenticated) wallet takes when
    // opened with the wrong password, and the only thing that catches it is the
    // address check after the decrypt.
    encryptedGarbageWallet = write(
      'enc-garbage-wallet.json',
      JSON.stringify([{encrypted: true, address: aes.encrypt(WALLET_PASSWORD, 'not-an-address')}])
    )
    noEncryptedFlagWallet = write('no-flag-wallet.json', JSON.stringify([{address: VALID_ADDRESS}]))
    emptyArrayWallet = write('empty-array-wallet.json', '[]')
    notJsonFile = write('not-json.txt', 'this is not a wallet')
  })

  after(() => {
    fs.rmSync(tempDir, {recursive: true, force: true})
  })

  it('reports a missing address when stdin is empty and there is no TTY', async () => {
    const {code, out} = await run(['ots'], '')
    assert.strictEqual(code, 1)
    assert.ok(/Missing QRL address or wallet file/.test(out), out)
  })

  it('rejects a string that is neither a valid address nor an existing file', async () => {
    const {code, out} = await run(['ots', 'Qdefinitelynotanaddress'])
    assert.strictEqual(code, 1)
    assert.ok(/Unable to get OTS: invalid QRL address\/wallet file/.test(out), out)
  })

  it('takes the address from an unencrypted wallet file', async () => {
    // Getting this far means the file was parsed and the address inside it
    // accepted; the only thing left is the node, which is a closed port.
    const {code, out} = await run(['ots', plainWallet, '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node/.test(out), out)
    assert.ok(!/invalid QRL address\/wallet file/.test(out), out)
  })

  it('decrypts an encrypted wallet file given the right password', async () => {
    const {code, out} = await run([
      'ots',
      encryptedWallet,
      '-p',
      WALLET_PASSWORD,
      '-g',
      DEAD_NODE,
    ])
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node/.test(out), out)
    assert.ok(!/invalid password/.test(out), out)
  })

  it('refuses an encrypted wallet file given the wrong password', async () => {
    // The current format is authenticated, so a wrong password makes the
    // decrypt itself throw rather than yield garbage.
    const {code, out} = await run(['ots', encryptedWallet, '-p', 'NotThePassword'])
    assert.strictEqual(code, 1)
    assert.ok(!/Failed to connect to node/.test(out), out)
  })

  it('refuses a wallet whose decrypted contents are not an address', async () => {
    // The decrypt succeeds here; only the address check afterwards catches it.
    // Without that check the command would go on to query the node for a
    // Buffer built from arbitrary bytes.
    const {code, out} = await run([
      'ots',
      encryptedGarbageWallet,
      '-p',
      WALLET_PASSWORD,
      '-g',
      DEAD_NODE,
    ])
    assert.strictEqual(code, 1)
    assert.ok(/Unable to open wallet file: invalid password/.test(out), out)
    assert.ok(!/Failed to connect to node/.test(out), out)
  })

  it('refuses a wallet file with no `encrypted` flag rather than guessing', async () => {
    const {code, out} = await run(['ots', noEncryptedFlagWallet, '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(/Unable to get a OTS: invalid QRL address\/wallet file/.test(out), out)
  })

  it('refuses an empty wallet array', async () => {
    const {code, out} = await run(['ots', emptyArrayWallet, '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(!/Failed to connect to node/.test(out), out)
  })

  it('refuses a file that is not JSON at all', async () => {
    const {code, out} = await run(['ots', notJsonFile, '-g', DEAD_NODE])
    assert.notStrictEqual(code, 0)
    assert.ok(!/Failed to connect to node/.test(out), out)
  })

  it('reads the address from stdin when none is given', async () => {
    const {code, out} = await run(['ots', '-g', DEAD_NODE], `${VALID_ADDRESS}\n`)
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node/.test(out), out)
  })

  it('reads the address from stdin when the argument is "-"', async () => {
    const {code, out} = await run(['ots', '-', '-g', DEAD_NODE], `${VALID_ADDRESS}\n`)
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node/.test(out), out)
  })
})

describe('ots: when the node cannot be reached', () => {
  let tempDir
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

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-ots-net-'))
    childEnv = {
      ...process.env,
      HOME: tempDir,
      XDG_CONFIG_HOME: tempDir,
      APPDATA: tempDir,
      LOCALAPPDATA: tempDir,
    }
  })

  after(() => {
    fs.rmSync(tempDir, {recursive: true, force: true})
  })

  it('names the endpoint before querying it', async () => {
    const {code, out} = await run(['ots', VALID_ADDRESS, '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(out.includes(`Custom GRPC endpoint: [${DEAD_NODE}]`), out)
    assert.ok(/Failed to connect to node\. Check network connection & parameters/.test(out), out)
  })

  it('reports the failure without a spinner in --json mode', async () => {
    // --json suppresses the spinner, so the failure takes the other branch. A
    // caller parsing this output must not be left with a silent non-zero exit.
    const {code, out} = await run(['ots', VALID_ADDRESS, '--json', '-g', DEAD_NODE])
    assert.strictEqual(code, 1)
    assert.ok(/Failed to connect to node:/.test(out), out)
    assert.ok(!out.includes('Custom GRPC endpoint:'), out)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// The interactive paths.
//
// The address prompt only runs when both streams are TTYs, and the wallet
// password prompt reads from the terminal, neither of which a spawned child
// with pipes can be. These drive the command in-process with those inputs
// stubbed.
//
// Every case here is answered in a way that stops the command before it would
// query a node, so no connection of any kind is opened.
// ///////////////////////////////////////////////////////////////////////////

describe('ots: the interactive prompts', () => {
  let savedEnv
  let tempDir
  let oclifConfig
  let OTSKey
  let cliUx
  let garbageWallet
  let encryptedWallet

  const CONFIG_ENV = ['HOME', 'XDG_CONFIG_HOME', 'APPDATA', 'LOCALAPPDATA']

  before(async () => {
    // `conf` is instantiated when the command's modules load, so the config
    // directory has to be redirected before they are required.
    savedEnv = {}
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-ots-prompt-'))
    CONFIG_ENV.forEach(k => {
      savedEnv[k] = process.env[k]
      process.env[k] = tempDir
    })

    // oclif's help layer measures the terminal at require time, so it has to be
    // loaded before the TTY flags are forced on.
    // eslint-disable-next-line global-require
    oclifConfig = await require('@oclif/config').load(path.join(__dirname, '..', '..'))
    // eslint-disable-next-line global-require
    cliUx = require('cli-ux').cli
    // eslint-disable-next-line global-require
    const aes = require('../../src/utils/aes')
    // eslint-disable-next-line global-require
    OTSKey = require('../../src/commands/ots').OTSKey

    encryptedWallet = path.join(tempDir, 'enc-wallet.json')
    fs.writeFileSync(
      encryptedWallet,
      JSON.stringify([{encrypted: true, address: aes.encrypt(WALLET_PASSWORD, VALID_ADDRESS)}])
    )
    // Decrypts cleanly with the right password, but not to an address.
    garbageWallet = path.join(tempDir, 'garbage-wallet.json')
    fs.writeFileSync(
      garbageWallet,
      JSON.stringify([{encrypted: true, address: aes.encrypt(WALLET_PASSWORD, 'not-an-address')}])
    )
  })

  after(() => {
    CONFIG_ENV.forEach(k => {
      if (savedEnv[k] === undefined) {
        delete process.env[k]
      } else {
        process.env[k] = savedEnv[k]
      }
    })
    fs.rmSync(tempDir, {recursive: true, force: true})
  })

  // Replace the lazily-required `prompts` module for the duration of one run.
  function stubPrompts(fake) {
    const promptsPath = require.resolve('prompts')
    const saved = require.cache[promptsPath]
    // eslint-disable-next-line global-require
    const Module = require('module')
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

  // cli-ux exposes `prompt` as a getter, so it has to be redefined rather than
  // assigned.
  function stubPassword(password) {
    const saved = Object.getOwnPropertyDescriptor(cliUx, 'prompt')
    Object.defineProperty(cliUx, 'prompt', {
      configurable: true,
      get: () => async () => password,
    })
    return () => Object.defineProperty(cliUx, 'prompt', saved)
  }

  async function runInProcess(argv, {fakePrompts, fakePassword} = {}) {
    const restorePrompts = stubPrompts(fakePrompts || (async () => ({})))
    const restorePassword = fakePassword === undefined ? () => {} : stubPassword(fakePassword)
    const savedStdout = process.stdout.isTTY
    const savedStdin = process.stdin.isTTY
    const savedWrite = process.stdout.write
    const savedErrWrite = process.stderr.write
    const savedWindowSize = process.stdout.getWindowSize
    let out = ''
    const capture = chunk => {
      out += chunk.toString()
      return true
    }
    process.stdout.isTTY = true
    process.stdin.isTTY = true
    if (!process.stdout.getWindowSize) {
      process.stdout.getWindowSize = () => [80, 24]
    }
    process.stdout.write = capture
    process.stderr.write = capture
    try {
      const cmd = new OTSKey(argv, oclifConfig)
      await cmd.run()
      return {code: 0, out: out.replace(ANSI, '')}
    } catch (error) {
      const code = error.oclif ? error.oclif.exit : 1
      return {code, out: out.replace(ANSI, '')}
    } finally {
      process.stdout.write = savedWrite
      process.stderr.write = savedErrWrite
      process.stdout.getWindowSize = savedWindowSize
      process.stdout.isTTY = savedStdout
      process.stdin.isTTY = savedStdin
      restorePassword()
      restorePrompts()
    }
  }

  it('uses the answer typed at the address prompt', async () => {
    // Answered with something that is neither an address nor a file, so the
    // command stops at the local gate: what is being checked is that the typed
    // answer is the value it went on to use.
    let asked
    const {code, out} = await runInProcess([], {
      fakePrompts: async options => {
        asked = options
        return {address: 'Qtyped-at-the-prompt'}
      },
    })
    assert.strictEqual(code, 1)
    assert.ok(/Unable to get OTS: invalid QRL address\/wallet file/.test(out), out)
    assert.strictEqual(asked.name, 'address')
    assert.ok(/QRL address or path to wallet\.json/.test(asked.message))
  })

  it('will not accept an empty answer at the address prompt', async () => {
    let asked
    await runInProcess([], {
      fakePrompts: async options => {
        asked = options
        return {address: 'Qtyped-at-the-prompt'}
      },
    })
    assert.strictEqual(asked.validate(''), 'Address/File is required')
    assert.strictEqual(asked.validate(VALID_ADDRESS), true)
  })

  it('exits non-zero when the address prompt is cancelled', async () => {
    const {code, out} = await runInProcess([], {fakePrompts: async () => ({})})
    assert.strictEqual(code, 1)
    assert.ok(/Operation cancelled/.test(out), out)
  })

  it('asks for the wallet password when --password is not given', async () => {
    // Without this branch an encrypted wallet would be unusable unless the
    // password were put on the command line, where it lands in shell history.
    // The wallet here decrypts to something that is not an address, so the
    // command stops at the address check rather than reaching a node.
    const {code, out} = await runInProcess([garbageWallet], {fakePassword: WALLET_PASSWORD})
    assert.strictEqual(code, 1)
    assert.ok(/Unable to open wallet file: invalid password/.test(out), out)
  })

  it('says the password was the problem, rather than exiting silently', async () => {
    // The v2 wallet format is authenticated, so a wrong password makes decryption throw.
    // That was swallowed: exit 1 with nothing printed and no hint at the cause.
    const {code, out} = await runInProcess([encryptedWallet, '-p', 'not-the-password'])
    assert.strictEqual(code, 1, out)
    assert.ok(/Error decrypting wallet/.test(out), out)
  })

  it('refuses a wrong password typed at the wallet prompt', async () => {
    const {code, out} = await runInProcess([encryptedWallet], {fakePassword: 'NotThePassword'})
    assert.strictEqual(code, 1)
    assert.ok(!/Fetching OTS from API/.test(out), out)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// ots: what the command does once a node has answered
//
// Everything above stops at the connection or at a local validation gate. This
// suite runs the command in *this* process against a stub gRPC client so the
// retry loop and all three endings of a GetOTS reply - the key in plain text,
// the key as JSON, and "no key found" - are covered without a node, a socket,
// or a packet leaving the machine. `ots` only reads; nothing is ever signed.
// ///////////////////////////////////////////////////////////////////////////

// Behaviour the stub should show for the test currently running. Reset per test.
let otsNode = {}
let otsRequests = []
let otsConnectAttempts = 0

class OtsFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    otsConnectAttempts += 1
    if (otsNode.connectThrows) {
      throw new Error(otsNode.connectThrows)
    }
    const connectsOn = otsNode.connectsOnAttempt === undefined ? 1 : otsNode.connectsOnAttempt
    if (connectsOn !== 0 && otsConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    otsRequests.push({name, request})
    if (otsNode.apiThrows) {
      throw new Error(otsNode.apiThrows)
    }
    return otsNode.ots
  }
}

describe('ots: reporting a node reply', () => {
  const otsGrpcPath = require.resolve('../../src/functions/grpc')
  const otsCommandPath = require.resolve('../../src/commands/ots')
  let StubbedOTSKey
  let savedCommandEntry

  before(() => {
    // The command captures Qrlnode at require time, so it has to be required
    // afresh with the stub in place. The suite above already cached the real
    // one; both entries are put back in `after`.
    savedCommandEntry = require.cache[otsCommandPath]
    delete require.cache[otsCommandPath]

    const realGrpcEntry = require.cache[otsGrpcPath]
    require.cache[otsGrpcPath] = {
      id: otsGrpcPath,
      filename: otsGrpcPath,
      path: path.dirname(otsGrpcPath),
      loaded: true,
      children: [],
      paths: [],
      exports: OtsFakeQrlNode,
    }
    // eslint-disable-next-line global-require
    StubbedOTSKey = require('../../src/commands/ots').OTSKey
    if (realGrpcEntry) {
      require.cache[otsGrpcPath] = realGrpcEntry
    } else {
      delete require.cache[otsGrpcPath]
    }
  })

  after(() => {
    if (savedCommandEntry === undefined) {
      delete require.cache[otsCommandPath]
    } else {
      require.cache[otsCommandPath] = savedCommandEntry
    }
  })

  beforeEach(() => {
    otsNode = {ots: {unused_ots_index_found: true, next_unused_ots_index: 12}}
    otsRequests = []
    otsConnectAttempts = 0
  })

  async function runOtsOffline(argv) {
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
      await StubbedOTSKey.run(argv)
    } catch (error) {
      code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
    } finally {
      process.stdout.write = realStdout
      process.stderr.write = realStderr
    }
    return {code, out: chunks.join('').replace(ANSI, '')}
  }

  it('asks the node for the address it was given, as bytes', async () => {
    const {code} = await runOtsOffline(['-g', DEAD_NODE, VALID_ADDRESS])
    assert.strictEqual(code, 0)
    assert.strictEqual(otsRequests.length, 1)
    assert.strictEqual(otsRequests[0].name, 'GetOTS')
    assert.strictEqual(otsRequests[0].request.address.toString('hex'), VALID_ADDRESS.substring(1))
  })

  it('retries the connection until the node answers', async () => {
    otsNode = {ots: {unused_ots_index_found: true, next_unused_ots_index: 0}, connectsOnAttempt: 3}
    const {code, out} = await runOtsOffline(['-g', DEAD_NODE, VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.strictEqual(otsConnectAttempts, 3)
    assert.ok(/retry connection attempt: 0/.test(out), out)
  })

  it('retries quietly in JSON mode, where there is no spinner to update', async () => {
    otsNode = {ots: {unused_ots_index_found: true, next_unused_ots_index: 4}, connectsOnAttempt: 3}
    const {code, out} = await runOtsOffline(['-g', DEAD_NODE, '-j', VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.strictEqual(otsConnectAttempts, 3)
    assert.ok(!/retry connection attempt/.test(out), out)
    assert.deepStrictEqual(JSON.parse(out), [{next_key: 4}])
  })

  it('reports the next unused key', async () => {
    const {code, out} = await runOtsOffline(['-g', DEAD_NODE, VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.ok(/Next unused OTS key: 12/.test(out), out)
  })

  it('reports the next unused key as JSON, with nothing else on stdout', async () => {
    const {code, out} = await runOtsOffline(['-g', DEAD_NODE, '-j', VALID_ADDRESS])
    assert.strictEqual(code, 0, out)
    assert.deepStrictEqual(JSON.parse(out), [{next_key: 12}])
  })

  it('exits non-zero when the node reports no unused key', async () => {
    // A wallet with every OTS key spent: signing anything further would reuse a
    // key, so this has to fail rather than report a default of 0.
    otsNode = {ots: {unused_ots_index_found: false}}
    const {code, out} = await runOtsOffline(['-g', DEAD_NODE, VALID_ADDRESS])
    assert.strictEqual(code, 1, out)
    assert.ok(/Unable to fetch an OTS key/.test(out), out)
  })

  it('says so in JSON mode too when there is no unused key', async () => {
    // There is no spinner to fail in JSON mode, so the message takes the other
    // branch: a silent non-zero exit would be indistinguishable from a crash.
    otsNode = {ots: {unused_ots_index_found: false}}
    const {code, out} = await runOtsOffline(['-g', DEAD_NODE, '-j', VALID_ADDRESS])
    assert.strictEqual(code, 1, out)
    assert.ok(/Unable to fetch an OTS key/.test(out), out)
  })

  it('reports a connect() failure as a plain log line in JSON mode', async () => {
    otsNode = {connectThrows: 'no route to host'}
    const {code, out} = await runOtsOffline(['-g', DEAD_NODE, '-j', VALID_ADDRESS])
    assert.strictEqual(code, 1, out)
    assert.ok(/Failed to connect to node: Error: no route to host/.test(out), out)
  })
})
