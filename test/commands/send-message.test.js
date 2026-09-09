const assert = require('assert')
const {spawn} = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const testSetup = require('../test_setup')

const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

const openFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)
}

// Broadcast tests can fail on transient node connection issues; retry with a pause before giving up
const spawnWithRetry = (args, onExit, retriesLeft = 2) => {
  const child = spawn('./bin/run', args, processFlags)
  child.on('exit', code => {
    if (code !== 0 && retriesLeft > 0) {
      setTimeout(() => spawnWithRetry(args, onExit, retriesLeft - 1), 10000)
    } else {
      onExit(code)
    }
  })
}

let wallet
let walletHexseed

describe('setup', () => {
  let exitCode
  before(done => {
    wallet = openFile(testSetup.walletFile)
    walletHexseed = wallet[0].hexseed
    done()
  })
  it('exit code should be non-0 if passed without any arguments/flags, requires xmss address and ots index', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


describe('send-message #1', () => {
  let exitCode
  const args = ['send-message',]
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if no message or keys given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// message is longer than 80 bites
describe('send-message #2', () => {
  let exitCode
  const args = [
  'send-message',
  '-M', 'This Message Is Over 80 bytes and will throw an error in the console'
]
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if message is over 80 bytes, blockchain limit', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// passed the -r flag and gave bad qrl address

describe('send-message #3', () => {
  let exitCode
  const args = [
    'send-message',
    '-t',
    '-M', 'Hey There qrl-cli 3',
    '-r', 'Q000500b5ea246980f3ff4ee42f399e4a79598d6844e66373eb61ab59d1a1e6cfe8e963eb4bcd'
  ]
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed the -r flag and gave bad qrl address', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// no private keys given
describe('send-message #4', () => {
  let exitCode
  const args = [
    'send-message',
    '-t',
    '-M', 'Hey There qrl-cli 4',
    '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
  ]
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if no private keys given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// wrong password given for encrypted wallet file
describe('send-message #5', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-t',
      '-M', 'Hey There qrl-cli 5',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-p', 'send-message-test-NOT-password',
      '-w', testSetup.encWalletFile,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if wrong password given for encrypted wallet file', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// no OTS given for wallet file
describe('send-message #6', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-t',
      '-M', 'Hey There qrl-cli 6',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-w', testSetup.walletFile,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if no OTS given for wallet file', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad hexseed given
describe('send-message #7', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-t',
      '-M', 'Hey There qrl-cli 7',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-s', '0005000d4b37e849aa5e3c2e27de0d51131d9a26b4b458e60f9be62951441fdd6867efc10d7b2f696982c788bc779512727',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad hexseed given, toop short', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// bad mnemonic given
describe('send-message #8', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-t',
      '-M', 'Hey There qrl-cli 8',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-s', 'aback filled atop regal town opaque gloss send cheek ten fisher cow once home remain module aye salt chord before bunch stiff heel won attend reduce heroic oak shrug midday king fit islam',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad mnemonic given, too short', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})



// no OTS given for hexseed file
describe('send-message #9', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-t',
      '-M', 'Hey There qrl-cli 9',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-s',
      walletHexseed,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if no OTS given for hexseed', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad OTS given for hexseed file
describe('send-message #10', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-t',
      '-M', 'Hey There qrl-cli 10',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-s', walletHexseed,
      '-i', 'i',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad OTS given for hexseed, passed i here', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})



// bad OTS given for hexseed file
describe('send-message #11', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-t',
      '-M', 'Hey There qrl-cli 11',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-s', walletHexseed,
      '-i', '0',
      '-f', 'none'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad fee given, passed none here', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// An explicit fee of 0 is the same value the command uses when -f is omitted, so it has
// to be accepted and the run has to get all the way to the node. This case used to point
// at a bogus URL and assert only "non-zero if API is down" - which it was, but because
// `parseInt('0')` is falsy and the fee check rejected it long before any API was involved.
describe('send-message #12', () => {
  let exitCode
  let out = ''
  before(done => {
    const args = [
      'send-message',
      '-M', 'Hey There qrl-cli 12',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-s', walletHexseed,
      '-i', '0',
      '-f', '0',
      '-g', '127.0.0.1:1',
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
  it('exit code should be non-0 when the node cannot be reached', () => {
    assert.notStrictEqual(exitCode, 0)
  })
  it('gets past the fee check, and fails at the node instead', () => {
    assert.ok(!/Fee is invalid/.test(out), `a fee of 0 must be accepted\n--- actual ---\n${out}`)
    assert.ok(/Failed to connect to node/.test(out), out)
  })
})

// successful message send wallet file
describe('send-message #13', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-M', 'qrl-cli test 13',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-w', testSetup.walletFile,
      '-i', '0',
      '-t',
    ]
    spawnWithRetry(args, code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if message sent', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// successful mesage send encrypted wallet file
describe('send-message #14', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-M', 'qrl-cli test 14',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-w', testSetup.encWalletFile,
      '-p', testSetup.encPass,
      '-i', '2',
      '-t',
    ]
    spawnWithRetry(args, code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if message sent', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// successful message send hex seed
describe('send-message #15', () => {
  let exitCode
  before(done => {
    const args = [
      'send-message',
      '-M', 'qrl-cli test 15',
      '-r', 'Q020200cf30b98939844cecbaa20e47d16b83aa8de58581ec0fda34d83a42a5a665b49986c4b832',
      '-s', walletHexseed,
      '-i', '1',
      '-t',
    ]
    spawnWithRetry(args, code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if message sent', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// Offline cases.
//
// These stop at a validation gate or at a connection to a closed local port, so
// no transaction is ever built or pushed and no OTS key is consumed. The wallet
// is created here rather than taken from the shared fixtures, so the block runs
// on its own.
// ///////////////////////////////////////////////////////////////////////////

// A closed port on loopback: the CLI resolves it, fails to connect, and exits.
const DEAD_NODE = '127.0.0.1:1'

let offlineDir
let offlineWallet
let offlineMnemonic
// A wallet in the legacy (pre-v2) encryption format holding an address that is not a QRL
// address. That format is unauthenticated, so a wrong password does not fail to decrypt, it
// yields something that is not an address — the only thing standing between that and a signing
// attempt is the address check send-message makes afterwards. Stored decrypted-to-nonsense
// rather than encrypted under another password so the case is deterministic.
let legacyWallet

// Encrypt the way the retired `aes256` package did: key = sha256(password), AES-256-CTR,
// base64(iv || ciphertext).
function legacyEncrypt(password, plaintext) {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(password).digest()
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  return Buffer.concat([iv, cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]).toString('base64')
}

// Run the CLI and capture what it said, rather than letting it write to the test output.
function runSendMessage(args) {
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
async function sendMessageRefuses(args, expected) {
  const {code, out} = await runSendMessage(args)
  assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}`)
  expected.forEach(pattern => {
    assert.ok(pattern.test(out), `expected output to match ${pattern}\n--- actual ---\n${out}`)
  })
  return out
}

describe('send-message offline', () => {
  before(done => {
    offlineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-send-message-'))
    offlineWallet = path.join(offlineDir, 'wallet.json')
    legacyWallet = path.join(offlineDir, 'legacy-wallet.json')
    const child = spawn('./bin/run', ['create-wallet', '-3', '-h', '6', '-f', offlineWallet], processFlags)
    child.on('exit', code => {
      if (code !== 0) {
        done(new Error(`create-wallet exited with code ${code}`))
        return
      }
      const created = openFile(offlineWallet)[0]
      offlineMnemonic = created.mnemonic
      fs.writeFileSync(
        legacyWallet,
        JSON.stringify([
          {
            encrypted: true,
            address: legacyEncrypt('the-right-password', 'this-is-not-a-qrl-address'),
            addressB32: '',
            pk: '',
            hexseed: legacyEncrypt('the-right-password', created.hexseed),
            mnemonic: legacyEncrypt('the-right-password', created.mnemonic),
            height: created.height,
            hashFunction: created.hashFunction,
            signatureType: created.signatureType,
            index: 0,
          },
        ])
      )
      done()
    })
  })

  after(() => {
    fs.rmSync(offlineDir, {recursive: true, force: true})
  })

  it('opens a wallet from a mnemonic, then stops at the unreachable node', async () => {
    const out = await sendMessageRefuses(
      ['send-message', '-M', 'hello', '-s', offlineMnemonic, '-i', '0', '-f', '100', '-g', DEAD_NODE],
      [/xmssPK returned/, /Failed to connect to node/]
    )
    // Nothing may be signed or pushed once the node is unreachable.
    assert.ok(!/Transaction signed/.test(out), `nothing may be signed\n--- actual ---\n${out}`)
    assert.ok(!/Transaction submitted/.test(out), `nothing may be pushed\n--- actual ---\n${out}`)
  })

  it('does not fall back to a public node when the given endpoint is unreachable', async () => {
    const out = await sendMessageRefuses(
      ['send-message', '-M', 'hello', '-s', offlineMnemonic, '-i', '0', '-g', DEAD_NODE],
      [/Failed to connect to node/]
    )
    assert.ok(
      !/automated\.theqrl\.org/.test(out),
      `a failed custom endpoint must not be replaced by a public one\n--- actual ---\n${out}`
    )
  })

  it('refuses a legacy wallet whose decrypted address is not a QRL address', async () => {
    await sendMessageRefuses(
      ['send-message', '-M', 'hello', '-w', legacyWallet, '-p', 'the-right-password', '-i', '0', '-g', DEAD_NODE],
      [/invalid password/]
    )
  })
})

// ///////////////////////////////////////////////////////////////////////////
// send-message: what happens once a node has answered
//
// Everything above stops at a validation gate or at a closed loopback port, so
// the half of the command that runs after the node replies — the request it
// builds, the binding check that decides whether to sign, the push, and the
// transaction-id check on the way back — was unreachable.
//
// These cases run the command in *this* process against a stub gRPC client.
// src/functions/grpc is swapped in the require cache for the moment it takes to
// require the command (it captures Qrlnode at require time), then the real
// module is put straight back. There is no server and no socket.
//
// The signing is real, against a throwaway height-6 wallet, and the stub
// recomputes the transaction hash the way a node does, so a signature over
// something other than the request would show up here. Nothing reaches a
// network, so no on-chain OTS key is spent.
// ///////////////////////////////////////////////////////////////////////////

const {
  concatenateTypedArrays,
  toBigendianUint64BytesUnsigned,
  toUint8Vector,
  binaryToBytes,
} = require('../../src/functions/tx-binding')

// kleur colours by environment variable rather than by isTTY, so captured output
// still carries escape sequences. Strip them before matching.
const MSG_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const MSG_RECIPIENT = 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408'
const MSG_OTHER = 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3'

// Behaviour the stub should show for the test currently running. Reset per test.
let msgNode = {}
let msgCalls = []
let msgConnectAttempts = 0

// Rebuild the transaction hash from the signed transaction the command pushed,
// the way QRL core does for a MessageTransaction:
//   preimage = master_addr || fee || message_hash || addr_to
//   hash     = sha256(sha256(preimage) || signature || public key)
function messageTransactionHash(signedTx) {
  const parts = [
    toBigendianUint64BytesUnsigned(parseInt(signedTx.fee, 10)),
    Uint8Array.from(Buffer.from(signedTx.message.message_hash)),
    Uint8Array.from(Buffer.from(signedTx.message.addr_to || [])),
  ]
  const preimage = concatenateTypedArrays(Uint8Array, ...parts)
  const digest = QRLLIB.sha2_256(toUint8Vector(preimage)) // eslint-disable-line no-undef
  const whole = concatenateTypedArrays(
    Uint8Array,
    binaryToBytes(digest),
    Uint8Array.from(signedTx.signature),
    Uint8Array.from(signedTx.public_key)
  )
  // eslint-disable-next-line no-undef
  return Buffer.from(QRLLIB.bin2hstr(QRLLIB.sha2_256(toUint8Vector(whole))), 'hex')
}

// What an honest node returns for GetMessageTxn: the request echoed back.
const buildMessageResponse = request => ({
  extended_transaction_unsigned: {
    tx: {
      master_addr: Buffer.from(request.master_addr),
      fee: String(request.fee),
      message: {
        message_hash: Buffer.from(request.message),
        addr_to: Buffer.from(request.addr_to),
      },
    },
  },
})

class MessageFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    msgConnectAttempts += 1
    if (msgNode.connectThrows) {
      throw new Error(msgNode.connectThrows)
    }
    const connectsOn = msgNode.connectsOnAttempt === undefined ? 1 : msgNode.connectsOnAttempt
    if (connectsOn !== 0 && msgConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    msgCalls.push({name, request})
    if (name === 'GetMessageTxn') {
      const built = buildMessageResponse(request)
      return msgNode.tamper ? msgNode.tamper(built) : built
    }
    if (msgNode.pushResponse) {
      return msgNode.pushResponse
    }
    const hash = messageTransactionHash(request.transaction_signed)
    return {tx_hash: msgNode.wrongHash ? Buffer.alloc(32, 0x11) : hash}
  }
}

const msgGrpcPath = require.resolve('../../src/functions/grpc')
const msgCommandPath = require.resolve('../../src/commands/send-message')

const msgRealGrpcEntry = require.cache[msgGrpcPath]
require.cache[msgGrpcPath] = {
  id: msgGrpcPath,
  filename: msgGrpcPath,
  path: path.dirname(msgGrpcPath),
  loaded: true,
  children: [],
  paths: [],
  exports: MessageFakeQrlNode,
}
const {SendMessage} = require('../../src/commands/send-message')

if (msgRealGrpcEntry) {
  require.cache[msgGrpcPath] = msgRealGrpcEntry
} else {
  delete require.cache[msgGrpcPath]
}

// Run send-message here, against the stub, capturing everything it prints (this.log
// and console.log go to stdout, the ora spinners go to stderr). run() awaits the whole
// signing and pushing sequence, so an exit inside it arrives as a thrown ExitError.
async function runSendMessageInProcess(argv) {
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
    await SendMessage.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  // kleur colours by environment variable rather than by isTTY, so the captured output
  // still carries escape sequences here. Strip them so the assertions read as the text a
  // person would see.
  return {code, out: chunks.join('').replace(MSG_ANSI, '')}
}

// cli-ux exposes `prompt` as a getter, so the wallet-password prompt has to be
// redefined rather than assigned.
const msgCliUx = require('cli-ux').cli // eslint-disable-line import/order

function stubMsgPassword(password) {
  const saved = Object.getOwnPropertyDescriptor(msgCliUx, 'prompt')
  const asked = []
  Object.defineProperty(msgCliUx, 'prompt', {
    configurable: true,
    get: () => async (message, options) => {
      asked.push({message, options})
      return password
    },
  })
  return {asked, restore: () => Object.defineProperty(msgCliUx, 'prompt', saved)}
}

async function runSendMessageWithPassword(argv, password) {
  const stub = stubMsgPassword(password)
  try {
    const result = await runSendMessageInProcess(argv)
    return {...result, asked: stub.asked}
  } finally {
    stub.restore()
  }
}

describe('send-message: signing and pushing what a node returned', () => {
  let nodeDir
  let nodeWallet
  let nodeBadWallet

  before(function createNodeWallet(done) {
    this.timeout(120000)
    nodeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-send-message-node-'))
    nodeWallet = path.join(nodeDir, 'wallet.json')
    nodeBadWallet = path.join(nodeDir, 'not-a-wallet.json')
    fs.writeFileSync(nodeBadWallet, 'this file is not JSON at all')
    const child = spawn('./bin/run', ['create-wallet', '-3', '-h', '6', '-f', nodeWallet], processFlags)
    child.on('exit', code => (code === 0 ? done() : done(new Error(`create-wallet exited ${code}`))))
  })

  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[msgCommandPath]
    fs.rmSync(nodeDir, {recursive: true, force: true})
  })

  beforeEach(() => {
    msgNode = {}
    msgCalls = []
    msgConnectAttempts = 0
  })

  const msgArgs = (extra = []) => [
    '-M', 'hello chain',
    '-r', MSG_RECIPIENT,
    '-i', '0',
    '-w', nodeWallet,
    '-g', DEAD_NODE,
    ...extra,
  ]

  it('asks the node to build the message it was given', async function builds() {
    this.timeout(120000)
    const {code, out} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 0, out)
    const build = msgCalls.find(c => c.name === 'GetMessageTxn')
    assert.ok(build, `no GetMessageTxn call was made\n--- output ---\n${out}`)
    assert.strictEqual(Buffer.from(build.request.message).toString(), 'hello chain')
    assert.strictEqual(`Q${Buffer.from(build.request.addr_to).toString('hex')}`, MSG_RECIPIENT)
    assert.strictEqual(build.request.fee, 0)
  })

  it('signs, pushes, and reports the id the node gave back', async function signs() {
    this.timeout(120000)
    const {code, out} = await runSendMessageInProcess(msgArgs(['-f', '100']))
    assert.strictEqual(code, 0, out)
    assert.ok(/Transaction signed with OTS key 0/.test(out), out)
    const push = msgCalls.find(c => c.name === 'PushTransaction')
    assert.ok(push.request.transaction_signed.signature.length > 0, 'pushed without a signature')
    assert.strictEqual(push.request.transaction_signed.fee, '100')
    // The id can only match if the command signed the message it asked the node to build.
    const hash = messageTransactionHash(push.request.transaction_signed).toString('hex')
    assert.ok(out.includes(`transaction ID: ${hash}`), out)
  })

  it('reports a wallet file it cannot read at all as an unusable file', async function badWallet() {
    this.timeout(120000)
    // The other side of the password fix: a file that genuinely will not parse still has
    // to be called an unusable file, not a bad password.
    const {code, out} = await runSendMessageInProcess(
      ['-M', 'hello chain', '-i', '0', '-w', nodeBadWallet, '-g', DEAD_NODE]
    )
    assert.strictEqual(code, 1, out)
    assert.ok(/Unable to open wallet file: invalid wallet file/.test(out), out)
    assert.ok(!/invalid password/.test(out), `the password was never the problem\n--- actual ---\n${out}`)
    assert.strictEqual(msgCalls.length, 0, 'no node is contacted for a wallet that never opened')
  })

  it('reports a hexseed the XMSS library cannot use, rather than failing silently', async function badSeed() {
    this.timeout(120000)
    const {code, out} = await runSendMessageInProcess(
      ['-M', 'hello chain', '-i', '0', '-s', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb139HG', '-g', DEAD_NODE]
    )
    assert.strictEqual(code, 1, out)
    assert.ok(/Failed to recreate XMSS wallet object/.test(out), out)
    assert.strictEqual(msgCalls.length, 0, 'no node is contacted when the key cannot be rebuilt')
  })

  it('accepts an explicit fee of 0, the same value it uses when -f is omitted', async function zeroFee() {
    this.timeout(120000)
    const {code, out} = await runSendMessageInProcess(msgArgs(['-f', '0']))
    assert.strictEqual(code, 0, out)
    assert.strictEqual(msgCalls.find(c => c.name === 'GetMessageTxn').request.fee, 0)
  })

  it('sends a message with no recipient at all', async function noRecipient() {
    this.timeout(120000)
    // A message with no addr_to is broadcast rather than addressed; the empty
    // recipient still has to be bound, or a node could add one.
    const {code, out} = await runSendMessageInProcess(
      ['-M', 'to nobody', '-i', '0', '-w', nodeWallet, '-g', DEAD_NODE]
    )
    assert.strictEqual(code, 0, out)
    const build = msgCalls.find(c => c.name === 'GetMessageTxn')
    assert.deepStrictEqual(build.request.addr_to, [])
  })

  it('retries the connection until the node answers', async function retries() {
    this.timeout(120000)
    msgNode = {connectsOnAttempt: 3}
    const {code} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 0)
    assert.strictEqual(msgConnectAttempts, 3)
  })

  it('links to the mainnet explorer when sending on mainnet', async function mainnet() {
    this.timeout(120000)
    const {code, out} = await runSendMessageInProcess(
      ['-M', 'hello chain', '-i', '0', '-w', nodeWallet, '-m']
    )
    assert.strictEqual(code, 0, out)
    assert.ok(/https:\/\/explorer\.theqrl\.org\/tx\/[0-9a-f]{64}/.test(out), out)
  })

  it('links to the testnet explorer when sending on testnet', async function testnet() {
    this.timeout(120000)
    const {code, out} = await runSendMessageInProcess(
      ['-M', 'hello chain', '-i', '0', '-w', nodeWallet, '-t']
    )
    assert.strictEqual(code, 0, out)
    assert.ok(/https:\/\/testnet-explorer\.theqrl\.org\/tx\/[0-9a-f]{64}/.test(out), out)
  })

  it('refuses to sign a response that rewrote the message', async function tamperedMessage() {
    this.timeout(120000)
    msgNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.message.message_hash = Buffer.from('something else entirely')
        return response
      },
    }
    const {code, out} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different message/.test(out), out)
    assert.ok(/Nothing was signed and no OTS key was used/.test(out), out)
    assert.strictEqual(msgCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
  })

  it('refuses to sign a response that redirected the message', async function tamperedRecipient() {
    this.timeout(120000)
    msgNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.message.addr_to = Buffer.from(MSG_OTHER.substring(1), 'hex')
        return response
      },
    }
    const {code, out} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different recipient/.test(out), out)
  })

  it('refuses to sign a response that inflated the fee', async function tamperedFee() {
    this.timeout(120000)
    msgNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.fee = '100000000'
        return response
      },
    }
    const {code, out} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different fee/.test(out), out)
  })

  it('reports a node that rejects the push', async function pushRejected() {
    this.timeout(120000)
    msgNode = {pushResponse: {error_code: 'INVALID', error_description: 'OTS key reused'}}
    const {code, out} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/OTS key reused/.test(out), out)
  })

  it('refuses a transaction id that is not the one it signed', async function hashMismatch() {
    this.timeout(120000)
    msgNode = {wrongHash: true}
    const {code, out} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/Node transaction hash 1111/.test(out), out)
  })

  it('reports a connection that fails outright', async function connectFailed() {
    this.timeout(120000)
    msgNode = {connectThrows: 'no route to host'}
    const {code, out} = await runSendMessageInProcess(msgArgs())
    assert.strictEqual(code, 1, out)
    assert.strictEqual(msgCalls.length, 0, 'nothing may be asked of a node that never connected')
  })
  describe('wallet password', () => {
    let encWallet
    const WALLET_PASSWORD = 'prompted-password'

    before(() => {
      const aes = require('../../src/utils/aes') // eslint-disable-line global-require
      const [created] = JSON.parse(fs.readFileSync(nodeWallet))
      encWallet = path.join(nodeDir, 'enc-wallet.json')
      fs.writeFileSync(
        encWallet,
        JSON.stringify([
          {
            encrypted: true,
            address: aes.encrypt(WALLET_PASSWORD, created.address),
            hexseed: aes.encrypt(WALLET_PASSWORD, created.hexseed),
          },
        ])
      )
    })

    it('asks for the password when --password is not given', async function passwordPrompt() {
      this.timeout(120000)
      // Without this branch an encrypted wallet would only be usable with the
      // password on the command line, where it lands in shell history.
      const {code, out, asked} = await runSendMessageWithPassword(
        ['-M', 'hello chain', '-i', '0', '-w', encWallet, '-g', DEAD_NODE],
        WALLET_PASSWORD
      )
      assert.strictEqual(code, 0, out)
      assert.strictEqual(asked.length, 1)
      assert.ok(/Enter password for wallet file/.test(asked[0].message))
      assert.strictEqual(asked[0].options.type, 'hide', 'the password must not be echoed')
    })

    it('refuses a wrong password typed at the prompt', async function wrongPassword() {
      this.timeout(120000)
      const {code, out} = await runSendMessageWithPassword(
        ['-M', 'hello chain', '-i', '0', '-w', encWallet, '-g', DEAD_NODE],
        'not-the-password'
      )
      assert.strictEqual(code, 1, out)
      assert.strictEqual(msgCalls.length, 0, 'nothing is signed or sent for a wallet that never opened')
    })
  })

  it('reports a signing failure that is not a binding failure', async function badOts() {
    this.timeout(120000)
    // OTS index 999 does not exist in a height-6 tree, so the response binds
    // cleanly and it is xmss.sign() that fails.
    const {code, out} = await runSendMessageInProcess(
      ['-M', 'hello chain', '-i', '999', '-w', nodeWallet, '-g', DEAD_NODE]
    )
    assert.strictEqual(code, 1, out)
    assert.strictEqual(msgCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
  })
})
