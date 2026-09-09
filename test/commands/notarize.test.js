// //////////////////
// notarize test
// /////////////////

const assert = require('assert')
const {spawn} = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const setup = require('../test_setup')

const badHashShort = 'fc23dfce42391794f9d86fe0e2babfa815bd1846161784fd5f78fdd774f'
const badHashInvalid = 'fc23dfce42391794f9d86fe0e2babfa815bd1846161784fd5f78fdd774fc0a_gg'
const sha256Hash = 'ead9e1846686f29c315b235099529e1d31340699ccbcd0c010e50032d14bb3d6'
const longMessage = 'thisMessageIsTooLongToSendWithNotarisationAndWillBeBlockedAsItWontFitInsideTheMessageData'
const messageData = 'Some Text'

let bobWallet
let hexString 


const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

const openFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)
}

describe('notarize setup', () => {
  let exitCode
  before(done => {
    bobWallet = openFile(setup.bobPTWalletLocation) // 
    hexString = bobWallet[0].hexseed
    done()
  })
  it('exit code should be 0 if setup', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})
  // test cases

describe('notarize #1', () => {
  const args = [
    'notarize',
  ]
  let exitCode
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if no file or wallet keys given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

describe('notarize #2', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      badHashShort,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad hash given - too short', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

describe('notarize #3', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      badHashInvalid,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if invalid hash given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

describe('notarize #4', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-h', '00003a2ebbbbe4adfca4b236a0bf91604438e5b09a35d660c7b77343ca8f1e983e115c5166aab75d4dcab819148b5e065aea',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad hexString given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


describe('notarize #5', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-h', hexString,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if no OTS given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

describe('notarize #6', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-h', hexString,
      '-i', '25',
      '-M', longMessage,
      '-t'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if too long message string added', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

describe('notarize #7', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-w', setup.notAWalletFile,
      '-i', '25',
      '-t'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad wallet file given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


describe('notarize #8', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-w', setup.bobPTWalletLocation,
      '-i', 'F',
      '-t'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad OTS', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// //////////////////////////
// pass 
// //////////////////////////

describe('notarize #9 bobs plaintext wallet hexString', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
       sha256Hash,
      '-h', hexString,
      '-i', '2',
      '-t'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if notarization succeeded', () => {
    assert.strictEqual(exitCode, 0)
  })
})

describe('notarize #10 Bobs plaintext wallet file with messageData', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-w', setup.bobPTWalletLocation,
      '-i', '3',
      '-M', messageData,
      '-t'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if notarization succeeded with message data added', () => {
    assert.strictEqual(exitCode, 0)
  })
})

describe('notarize #11 Bobs Plain text wallet', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-w',
      setup.bobPTWalletLocation,
      '-i', '4',
      '-t'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if notarization succeeded with message data added from wallet file', () => {
    assert.strictEqual(exitCode, 0)
  })
    })

describe('notarize #12 - Alice\'s encrypted wallet', () => {
  let exitCode
  before(done => {
    const args = [
      'notarize',
      sha256Hash,
      '-w',
      setup.aliceENCWalletLocation,
      '-i', '1',
      '-t',
      '-p', setup.aliceEncPass,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if notarization succeeded with message data added from encrypted wallet', () => {
    assert.strictEqual(exitCode, 0)
  })
    })
// ///////////////////////////////////////////////////////////////////////////
// Offline cases.
//
// notarize builds and pushes a message transaction, so every case below has to
// stop before that: either at a validation gate, or at a connection to a closed
// local port. Nothing is signed, nothing is broadcast and no OTS key is used.
// The wallet is created here rather than taken from the shared fixtures, so the
// block runs on its own.
// ///////////////////////////////////////////////////////////////////////////

// A closed port on loopback: the CLI resolves it, fails to connect, and exits.
const DEAD_NODE = '127.0.0.1:1'
const shortMnemonic = 'aback filled atop regal town opaque gloss send cheek ten fisher cow'

let offlineDir
let offlineWallet
let offlineMnemonic
// A wallet in the legacy (pre-v2) encryption format holding an address that is not a QRL address.
// That format is unauthenticated, so a wrong password does not fail to decrypt, it yields
// something that is not an address — the check on the decrypted address is what has to catch it.
// Stored decrypted-to-nonsense rather than encrypted under another password so it is deterministic.
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
function runNotarize(args) {
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
async function notarizeRefuses(args, expected) {
  const {code, out} = await runNotarize(args)
  assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}`)
  expected.forEach(pattern => {
    assert.ok(pattern.test(out), `expected output to match ${pattern}\n--- actual ---\n${out}`)
  })
  return out
}

describe('notarize offline', () => {
  before(done => {
    offlineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-notarize-'))
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

  it('requires a wallet or a hexseed', async () => {
    await notarizeRefuses(['notarize', sha256Hash], [/No wallet.json file \(-w\) or hexseed/])
  })

  it('requires an OTS index alongside a wallet file', async () => {
    await notarizeRefuses(['notarize', sha256Hash, '-w', offlineWallet], [/No OTS index/])
  })

  it('rejects a mnemonic with the wrong number of words', async () => {
    await notarizeRefuses(
      ['notarize', sha256Hash, '-h', shortMnemonic, '-i', '1'],
      [/Mnemonic phrase invalid/]
    )
  })

  it('rejects a fee that is not a number', async () => {
    await notarizeRefuses(
      ['notarize', sha256Hash, '-h', offlineMnemonic, '-i', '1', '-f', 'none'],
      [/Fee is invalid/]
    )
  })

  it('refuses a wallet whose decrypted address is not a QRL address', async () => {
    await notarizeRefuses(
      ['notarize', sha256Hash, '-w', legacyWallet, '-p', 'the-right-password', '-i', '1', '-g', DEAD_NODE],
      [/Invalid password/]
    )
  })

  it('opens a wallet from a mnemonic and a fee, then stops at the unreachable node', async () => {
    const out = await notarizeRefuses(
      ['notarize', sha256Hash, '-h', offlineMnemonic, '-i', '1', '-f', '100', '-g', DEAD_NODE],
      [/xmssPK returned/, /Failed to connect to node/]
    )
    // Nothing may be signed or broadcast once the node is unreachable.
    assert.ok(!/Transaction signed/.test(out), `nothing may be signed\n--- actual ---\n${out}`)
    assert.ok(!/transaction ID/.test(out), `nothing may be broadcast\n--- actual ---\n${out}`)
    assert.ok(
      !/automated\.theqrl\.org/.test(out),
      `a failed custom endpoint must not be replaced by a public one\n--- actual ---\n${out}`
    )
  })

  it('does not notarize anything when --json is passed', async () => {
    // --json is currently broken end to end: it suppresses the spinner by setting it to null and
    // then calls into it anyway, so the command dies before it reaches a node. Asserted as
    // "produces no transaction", which stays true once that is fixed.
    const {code, out} = await runNotarize(['notarize', sha256Hash, '-j'])
    assert.notStrictEqual(code, 0)
    assert.ok(!/tx_id/.test(out), `no transaction may be reported\n--- actual ---\n${out}`)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// notarize: what happens once a node has answered
//
// Everything above stops at a validation gate or at a closed loopback port, so
// the half of the command that runs after the node replies — the message
// transaction it builds, the binding check that decides whether to sign, the
// push, and the transaction-id check on the way back — was unreachable.
//
// These cases run the command in *this* process against a stub gRPC client.
// src/functions/grpc is swapped in the require cache for the moment it takes to
// require the command (it captures Qrlnode at require time), then the real
// module is put straight back. There is no server and no socket.
//
// The signing is real, against a throwaway height-6 wallet, and the stub
// recomputes the transaction hash the way a node does. Nothing reaches a
// network, so no on-chain OTS key is spent.
//
// Note the command only reports success on mainnet or testnet: with a custom
// --grpc endpoint the network is neither, and the success arm prints nothing.
// The cases below use -m/-t for that reason.
// ///////////////////////////////////////////////////////////////////////////

const {
  concatenateTypedArrays,
  toBigendianUint64BytesUnsigned,
  toUint8Vector,
  binaryToBytes,
} = require('../../src/functions/tx-binding')

// kleur colours by environment variable rather than by isTTY, so captured output
// still carries escape sequences. Strip them before matching.
const NOTARIZE_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const NOTARIZE_OTHER_ADDRESS = 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408'

// Behaviour the stub should show for the test currently running. Reset per test.
let notarizeNode = {}
let notarizeCalls = []
let notarizeConnectAttempts = 0

// Rebuild the transaction hash from the signed transaction the command pushed,
// the way QRL core does for a MessageTransaction:
//   preimage = master_addr || fee || message_hash || addr_to
//   hash     = sha256(sha256(preimage) || signature || public key)
function notarizeTransactionHash(signedTx) {
  const preimage = concatenateTypedArrays(
    Uint8Array,
    toBigendianUint64BytesUnsigned(parseInt(signedTx.fee, 10)),
    Uint8Array.from(Buffer.from(signedTx.message.message_hash)),
    Uint8Array.from(Buffer.from(signedTx.message.addr_to || []))
  )
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

// What an honest node returns for GetMessageTxn. A notarisation has no
// recipient, so addr_to comes back empty.
const buildNotarizeResponse = request => ({
  extended_transaction_unsigned: {
    tx: {
      master_addr: Buffer.from(request.master_addr),
      fee: String(request.fee),
      message: {
        message_hash: Buffer.from(request.message),
        addr_to: Buffer.alloc(0),
      },
    },
  },
})

class NotarizeFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    notarizeConnectAttempts += 1
    if (notarizeNode.connectThrows) {
      throw new Error(notarizeNode.connectThrows)
    }
    const connectsOn = notarizeNode.connectsOnAttempt === undefined ? 1 : notarizeNode.connectsOnAttempt
    if (connectsOn !== 0 && notarizeConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    notarizeCalls.push({name, request})
    if (name === 'GetMessageTxn') {
      const built = buildNotarizeResponse(request)
      return notarizeNode.tamper ? notarizeNode.tamper(built) : built
    }
    if (notarizeNode.pushResponse) {
      return notarizeNode.pushResponse
    }
    const hash = notarizeTransactionHash(request.transaction_signed)
    return {tx_hash: notarizeNode.wrongHash ? Buffer.alloc(32, 0x11) : hash}
  }
}

const notarizeGrpcPath = require.resolve('../../src/functions/grpc')
const notarizeCommandPath = require.resolve('../../src/commands/notarize')

const notarizeRealGrpcEntry = require.cache[notarizeGrpcPath]
require.cache[notarizeGrpcPath] = {
  id: notarizeGrpcPath,
  filename: notarizeGrpcPath,
  path: path.dirname(notarizeGrpcPath),
  loaded: true,
  children: [],
  paths: [],
  exports: NotarizeFakeQrlNode,
}
const {Notarise} = require('../../src/commands/notarize')

if (notarizeRealGrpcEntry) {
  require.cache[notarizeGrpcPath] = notarizeRealGrpcEntry
} else {
  delete require.cache[notarizeGrpcPath]
}

// Run notarize here, against the stub, capturing everything it prints (this.log
// and console.log go to stdout, the ora spinners go to stderr). run() awaits the whole
// signing and pushing sequence, so an exit inside it arrives as a thrown ExitError.
async function runNotarizeInProcess(argv) {
  const chunks = []
  const outChunks = []
  const realStdout = process.stdout.write
  const realStderr = process.stderr.write
  // `stdout` is kept apart from the combined capture as well: --json promises that a
  // caller reading stdout gets JSON or nothing, and that is only checkable per stream.
  process.stdout.write = chunk => {
    chunks.push(chunk.toString())
    outChunks.push(chunk.toString())
    return true
  }
  process.stderr.write = chunk => {
    chunks.push(chunk.toString())
    return true
  }
  let code = 0
  try {
    await Notarise.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  // kleur colours by environment variable rather than by isTTY, so the captured output
  // still carries escape sequences here. Strip them so the assertions read as the text a
  // person would see.
  return {
    code,
    out: chunks.join('').replace(NOTARIZE_ANSI, ''),
    stdout: outChunks.join('').replace(NOTARIZE_ANSI, ''),
  }
}

// cli-ux exposes `prompt` as a getter, so the wallet-password prompt has to be
// redefined rather than assigned.
const notarizeCliUx = require('cli-ux').cli // eslint-disable-line import/order

function stubNotarizePassword(password) {
  const saved = Object.getOwnPropertyDescriptor(notarizeCliUx, 'prompt')
  const asked = []
  Object.defineProperty(notarizeCliUx, 'prompt', {
    configurable: true,
    get: () => async (message, options) => {
      asked.push({message, options})
      return password
    },
  })
  return {asked, restore: () => Object.defineProperty(notarizeCliUx, 'prompt', saved)}
}

async function runNotarizeWithPassword(argv, password) {
  const stub = stubNotarizePassword(password)
  try {
    const result = await runNotarizeInProcess(argv)
    return {...result, asked: stub.asked}
  } finally {
    stub.restore()
  }
}

describe('notarize: signing and pushing what a node returned', () => {
  let nodeDir
  let nodeWallet

  before(function createNodeWallet(done) {
    this.timeout(120000)
    nodeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrl-cli-notarize-node-'))
    nodeWallet = path.join(nodeDir, 'wallet.json')
    const child = spawn('./bin/run', ['create-wallet', '-3', '-h', '6', '-f', nodeWallet], processFlags)
    child.on('exit', code => (code === 0 ? done() : done(new Error(`create-wallet exited ${code}`))))
  })

  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[notarizeCommandPath]
    fs.rmSync(nodeDir, {recursive: true, force: true})
  })

  beforeEach(() => {
    notarizeNode = {}
    notarizeCalls = []
    notarizeConnectAttempts = 0
  })

  const notarizeArgs = (extra = []) => [sha256Hash, '-i', '0', '-w', nodeWallet, '-t', ...extra]

  it('notarises the hash it was given, prefixed with the notarisation marker', async function builds() {
    this.timeout(120000)
    const {code, out} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 0, out)
    const build = notarizeCalls.find(c => c.name === 'GetMessageTxn')
    assert.ok(build, `no GetMessageTxn call was made\n--- output ---\n${out}`)
    // 'AFAFA' + '2' + the sha256 hash, as hex bytes
    assert.strictEqual(Buffer.from(build.request.message).toString('hex'), `afafa2${sha256Hash}`)
    assert.strictEqual(build.request.fee, 0)
  })

  it('appends user message data to the notarisation', async function withMessage() {
    this.timeout(120000)
    const {code, out} = await runNotarizeInProcess(
      notarizeArgs(['-M', messageData])
    )
    assert.strictEqual(code, 0, out)
    const build = notarizeCalls.find(c => c.name === 'GetMessageTxn')
    const sent = Buffer.from(build.request.message).toString('hex')
    assert.ok(sent.startsWith(`afafa2${sha256Hash}`), sent)
    assert.ok(sent.includes(Buffer.from(messageData).toString('hex')), sent)
  })

  it('reports a hexseed the XMSS library cannot use, rather than failing silently', async function badSeed() {
    this.timeout(120000)
    const {code, out} = await runNotarizeInProcess([sha256Hash, '-i', '0', '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb139HG', '-t'])
    assert.strictEqual(code, 1, out)
    assert.ok(/Failed to recreate XMSS wallet object/.test(out), out)
    assert.strictEqual(notarizeCalls.length, 0, 'no node is contacted when the key cannot be rebuilt')
  })

  it('accepts an explicit fee of 0, the same value it uses when -f is omitted', async function zeroFee() {
    this.timeout(120000)
    const {code, out} = await runNotarizeInProcess(notarizeArgs(['-f', '0']))
    assert.strictEqual(code, 0, out)
    assert.strictEqual(notarizeCalls.find(c => c.name === 'GetMessageTxn').request.fee, 0)
  })

  it('signs, pushes, and reports the id the node gave back', async function signs() {
    this.timeout(120000)
    const {code, out} = await runNotarizeInProcess(
      notarizeArgs(['-f', '100'])
    )
    assert.strictEqual(code, 0, out)
    assert.ok(/Transaction signed with OTS key 0/.test(out), out)
    const push = notarizeCalls.find(c => c.name === 'PushTransaction')
    assert.ok(push.request.transaction_signed.signature.length > 0, 'pushed without a signature')
    assert.strictEqual(push.request.transaction_signed.fee, '100')
    const hash = notarizeTransactionHash(push.request.transaction_signed).toString('hex')
    assert.ok(out.includes(`transaction ID: ${hash}`), out)
    assert.ok(out.includes(`https://testnet-explorer.theqrl.org/tx/${hash}`), out)
  })

  it('reports the transaction id on a custom endpoint too', async function customEndpoint() {
    this.timeout(120000)
    // There is no explorer to link to for a custom node, but a successful
    // notarisation still has to name the transaction it made: this used to
    // print nothing at all unless the network was mainnet or testnet.
    const {code, out} = await runNotarizeInProcess([sha256Hash, '-i', '0', '-w', nodeWallet, '-g', DEAD_NODE])
    assert.strictEqual(code, 0, out)
    const push = notarizeCalls.find(c => c.name === 'PushTransaction')
    const hash = notarizeTransactionHash(push.request.transaction_signed).toString('hex')
    assert.ok(out.includes(`transaction ID: ${hash}`), out)
    assert.ok(!/explorer\.theqrl\.org/.test(out), 'no explorer link for a network with no explorer')
  })

  it('links to the mainnet explorer when notarising on mainnet', async function mainnet() {
    this.timeout(120000)
    const {code, out} = await runNotarizeInProcess(
      [sha256Hash, '-i', '0', '-w', nodeWallet, '-m']
    )
    assert.strictEqual(code, 0, out)
    assert.ok(/https:\/\/explorer\.theqrl\.org\/tx\/[0-9a-f]{64}/.test(out), out)
  })

  it('retries the connection until the node answers', async function retries() {
    this.timeout(120000)
    notarizeNode = {connectsOnAttempt: 3}
    const {code} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 0)
    assert.strictEqual(notarizeConnectAttempts, 3)
  })

  it('refuses to sign a response that rewrote the notarisation data', async function tamperedData() {
    this.timeout(120000)
    // The notarisation data is the whole point of the transaction: a node that
    // rewrites it and gets a signature has notarised something else entirely.
    notarizeNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.message.message_hash = Buffer.from('afafa2', 'hex')
        return response
      },
    }
    const {code, out} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different notarisation data/.test(out), out)
    assert.ok(/Nothing was signed and no OTS key was used/.test(out), out)
    assert.strictEqual(notarizeCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
  })

  it('refuses to sign a response that added a recipient', async function tamperedRecipient() {
    this.timeout(120000)
    // A notarisation has no recipient. One appearing in the response means the
    // node turned it into an addressed message.
    notarizeNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.message.addr_to = Buffer.from(NOTARIZE_OTHER_ADDRESS.substring(1), 'hex')
        return response
      },
    }
    const {code, out} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different recipient/.test(out), out)
  })

  it('refuses to sign a response that inflated the fee', async function tamperedFee() {
    this.timeout(120000)
    notarizeNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.fee = '100000000'
        return response
      },
    }
    const {code, out} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different fee/.test(out), out)
  })

  it('reports a node that rejects the push', async function pushRejected() {
    this.timeout(120000)
    notarizeNode = {pushResponse: {error_code: 'INVALID', error_description: 'OTS key reused'}}
    const {code, out} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/OTS key reused/.test(out), out)
  })

  it('refuses a transaction id that is not the one it signed', async function hashMismatch() {
    this.timeout(120000)
    notarizeNode = {wrongHash: true}
    const {code, out} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/Node transaction hash 1111/.test(out), out)
  })

  it('reports a connection that fails outright', async function connectFailed() {
    this.timeout(120000)
    notarizeNode = {connectThrows: 'no route to host'}
    const {code, out} = await runNotarizeInProcess(notarizeArgs())
    assert.strictEqual(code, 1, out)
    assert.strictEqual(notarizeCalls.length, 0, 'nothing may be asked of a node that never connected')
  })

  describe('--json', () => {
    it('prints the transaction id as JSON and nothing else on stdout', async function json() {
      this.timeout(120000)
      const {code, out} = await runNotarizeInProcess(notarizeArgs(['-j']))
      assert.strictEqual(code, 0, out)
      const push = notarizeCalls.find(c => c.name === 'PushTransaction')
      const hash = notarizeTransactionHash(push.request.transaction_signed).toString('hex')
      assert.deepStrictEqual(JSON.parse(out), [{tx_id: hash}])
    })

    it('reports why it failed instead of exiting silently', async function jsonFailure() {
      this.timeout(120000)
      // The progress spinners are stood down in JSON mode, but a failure still has
      // to say something: a bare non-zero exit would be indistinguishable from a
      // crash, and this command used to die outright the moment --json was given.
      notarizeNode = {connectThrows: 'no route to host'}
      const {code, out} = await runNotarizeInProcess(notarizeArgs(['-j']))
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to connect to node/.test(out), out)
    })

    it('says nothing on stdout when it fails', async function jsonFailureStdout() {
      this.timeout(120000)
      // Everything the spinners print goes to stderr, so a caller reading stdout
      // gets valid JSON or nothing at all - never half a progress report.
      notarizeNode = {connectThrows: 'no route to host'}
      const {code, stdout} = await runNotarizeInProcess(notarizeArgs(['-j']))
      assert.strictEqual(code, 1)
      assert.strictEqual(stdout.trim(), '')
    })

    it('still reports a missing OTS index', async function jsonNoOts() {
      this.timeout(120000)
      // This gate clears the spinner line with an empty second message, which the
      // stand-in has to swallow rather than print as a blank line of noise.
      const {code, out, stdout} = await runNotarizeInProcess([sha256Hash, '-w', nodeWallet, '-j', '-t'])
      assert.strictEqual(code, 1, out)
      // the reason, and nothing else: the empty second message is swallowed rather
      // than printed as a blank line
      assert.deepStrictEqual(
        out.split('\n').filter((line) => line !== ''),
        ['No OTS index (-i) given...']
      )
      assert.strictEqual(stdout, '', 'stdout stays JSON-only, so it says nothing at all here')
      assert.strictEqual(notarizeCalls.length, 0, 'it never reaches a node')
    })

    it('drops the progress chatter that a plain run prints', async function jsonQuiet() {
      this.timeout(120000)
      const {out} = await runNotarizeInProcess(notarizeArgs(['-j']))
      assert.ok(!/notarization:/.test(out), out)
      assert.ok(!/xmssPK returned/.test(out), out)
      assert.ok(!/Transaction submitted to/.test(out), out)
    })
  })
  describe('wallet password', () => {
    const encWallet = '/tmp/notarize-node-enc-wallet.json'
    const WALLET_PASSWORD = 'prompted-password'
    let plainWallet

    before(() => {
      const aes = require('../../src/utils/aes') // eslint-disable-line global-require
      ;[plainWallet] = openFile(nodeWallet)
      fs.writeFileSync(
        encWallet,
        JSON.stringify([
          {
            encrypted: true,
            address: aes.encrypt(WALLET_PASSWORD, plainWallet.address),
            hexseed: aes.encrypt(WALLET_PASSWORD, plainWallet.hexseed),
          },
        ])
      )
    })

    after(() => {
      try {
        fs.unlinkSync(encWallet)
      } catch (error) {
        // never created; nothing to clean up
      }
    })

    it('asks for the password when --password is not given', async function passwordPrompt() {
      this.timeout(120000)
      // Without this branch an encrypted wallet would only be usable with the
      // password on the command line, where it lands in shell history.
      const {code, out, asked} = await runNotarizeWithPassword(
        [sha256Hash, '-i', '0', '-w', encWallet, '-t'],
        WALLET_PASSWORD
      )
      assert.strictEqual(code, 0, out)
      assert.strictEqual(asked.length, 1)
      assert.ok(/Enter password for wallet file/.test(asked[0].message))
      assert.strictEqual(asked[0].options.type, 'hide', 'the password must not be echoed')
    })

    it('refuses a wrong password typed at the prompt', async function wrongPassword() {
      this.timeout(120000)
      const {code, out} = await runNotarizeWithPassword(
        [sha256Hash, '-i', '0', '-w', encWallet, '-t'],
        'not-the-password'
      )
      assert.strictEqual(code, 1, out)
      assert.strictEqual(notarizeCalls.length, 0, 'nothing is signed or sent for a wallet that never opened')
    })
  })

  it('reports a signing failure that is not a binding failure', async function badOts() {
    this.timeout(120000)
    // OTS index 999 does not exist in a height-6 tree, so the response binds
    // cleanly and it is xmss.sign() that fails.
    const {code, out} = await runNotarizeInProcess(
      [sha256Hash, '-i', '999', '-w', nodeWallet, '-t']
    )
    assert.strictEqual(code, 1, out)
    assert.strictEqual(notarizeCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
  })
})
