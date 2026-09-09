const assert = require('assert')
const {spawn} = require('child_process')
const fs = require('fs')
const path = require('path')

const testSetup = require('../test_setup')
const aes = require('../../src/utils/aes')

const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

// //////////////
// Failed Tests
// //////////////

// no args given
describe('receive #1', () => {
  let exitCode
  before(done => {
    const args = [
      'receive',
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

// bad args given
describe('receive #2', () => {
  let exitCode
  before(done => {
    const args = [
      'receive',
      '/tmp/notafile'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad file as argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad args given
describe('receive #3', () => {
  let exitCode
  let out = ''
  before(done => {
    const args = [
      'receive',
      testSetup.encWalletFile,
      '-p',
      'wrongPassword'
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
  it('exit code should be non-0 if passed with bad password to encrypted wallet', () => {
    assert.notStrictEqual(exitCode, 0)
  })
  it('says the password was the problem, rather than exiting silently', () => {
    assert.ok(/Error decrypting wallet/.test(out), `expected a reason\n--- actual ---\n${out}`)
  })
})

// bad address given
describe('receive #4', () => {
  let exitCode
  before(done => {
    const args = [
      'receive',
      'NotAQRLAddress',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad QRL Address', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// //////////////
// Passing Tests
// /////////////

describe('receive #5', () => {
  let exitCode
  before(done => {
    const args = [
      'receive',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
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

describe('receive #6', () => {
  let exitCode
  before(done => {
    const args = [
      'receive',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f4',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with an invalid QRL address as argument', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// Wallet file handling
//
// Everything above stops at a gate; nothing here had ever walked `receive` all
// the way through a wallet file, so the only paths that were exercised were the
// ones that print "Invalid QRL address/wallet file" and quit. The cases below
// cover the rest: a plaintext wallet, an encrypted wallet opened with -p, an
// encrypted wallet opened from the interactive prompt, a file whose ciphertext
// decrypts to something that is not an address, and a file with no usable
// `encrypted` flag at all.
//
// Offline and self-contained: the wallets are built in the before() hook, and
// `receive` never talks to a node.
// ///////////////////////////////////////////////////////////////////////////

const WALLET_PASSWORD = 'testpassword'

const ptWallet = '/tmp/recv-wallet.json'
const encWallet = '/tmp/recv-wallet-enc.json'
// An encrypted wallet whose address decrypts cleanly but is not a QRL address:
// the only way to reach the "invalid password" branch, since a wrong password
// makes aes.decrypt throw instead.
const decryptsToJunkWallet = '/tmp/recv-wallet-junk-address.json'
// A wallet file that is valid JSON but claims neither encrypted:true nor false.
const noEncryptedFlagWallet = '/tmp/recv-wallet-no-flag.json'

// Run the CLI and capture what it said, so the assertions can be about the
// message and not only about the exit code.
function runReceive(args, stdin) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', ['receive', ...args], {
      stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    })
    let out = ''
    child.stdout.on('data', d => {
      out += d.toString()
    })
    child.stderr.on('data', d => {
      out += d.toString()
    })
    if (stdin !== undefined) {
      child.stdin.end(stdin)
    }
    child.on('close', code => resolve({code, out}))
  })
}

function createWallet(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('./bin/run', ['create-wallet', '-h', '4', ...args], processFlags)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`create-wallet exited ${code}`))
      }
    })
  })
}

const openWallet = file => JSON.parse(fs.readFileSync(file))[0]

describe('receive: wallet files', () => {
  let ptAddress
  let encAddress

  before(async function makeWallets() {
    this.timeout(120000)
    await createWallet(['-f', ptWallet])
    await createWallet(['-f', encWallet, '-p', WALLET_PASSWORD])

    ptAddress = openWallet(ptWallet).address
    encAddress = aes.decrypt(WALLET_PASSWORD, openWallet(encWallet).address)

    fs.writeFileSync(
      decryptsToJunkWallet,
      JSON.stringify([
        {
          encrypted: true,
          address: aes.encrypt(WALLET_PASSWORD, 'not-a-qrl-address'),
        },
      ])
    )
    fs.writeFileSync(
      noEncryptedFlagWallet,
      JSON.stringify([{encrypted: 'maybe', address: ptAddress}])
    )
  })

  after(() => {
    [ptWallet, encWallet, decryptsToJunkWallet, noEncryptedFlagWallet].forEach(file => {
      try {
        fs.unlinkSync(file)
      } catch (error) {
        // the file was never created; nothing to clean up
      }
    })
  })

  it('prints the address held in a plaintext wallet file', async () => {
    const {code, out} = await runReceive([ptWallet])
    assert.strictEqual(code, 0, out)
    assert.ok(out.includes(ptAddress), `expected the wallet address in:\n${out}`)
  })

  it('prints the address held in an encrypted wallet file given -p', async () => {
    const {code, out} = await runReceive([encWallet, '-p', WALLET_PASSWORD])
    assert.strictEqual(code, 0, out)
    assert.ok(out.includes(encAddress), `expected the decrypted address in:\n${out}`)
  })

  it('rejects a wallet whose ciphertext does not decrypt to a QRL address', async () => {
    const {code, out} = await runReceive([decryptsToJunkWallet, '-p', WALLET_PASSWORD])
    assert.notStrictEqual(code, 0)
    assert.ok(
      /Unable to open wallet file: invalid password/.test(out),
      `expected the invalid-password message in:\n${out}`
    )
  })

  it('rejects a JSON file that is not marked encrypted or unencrypted', async () => {
    const {code, out} = await runReceive([noEncryptedFlagWallet])
    assert.notStrictEqual(code, 0)
    assert.ok(
      /Invalid QRL address\/wallet file/.test(out),
      `expected the invalid-wallet message in:\n${out}`
    )
  })
})

// The interactive branch -- an encrypted wallet with no -p -- cannot be driven
// through a pipe: cli-ux's hidden prompt shells out to `sh -c 'read -s'`, which
// spins forever when stdin is not a terminal. Running the command in-process
// with the prompt stubbed exercises the same branch without needing a pty.
describe('receive: a directory where a wallet file was expected', () => {
  it('reports it rather than crashing on the read', async () => {
    // existsSync says yes to a directory, so the command goes on to read it as a
    // wallet. That read throws, and it used to escape as a raw EISDIR.
    const {code, out} = await runReceive(['/tmp'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Invalid QRL address\/wallet file/.test(out), out)
    assert.ok(!/EISDIR/.test(out), out)
  })
})

describe('receive: password prompt', () => {
  const {cli} = require('cli-ux') // eslint-disable-line global-require
  const {Receive} = require('../../src/commands/receive') // eslint-disable-line global-require

  const root = path.join(__dirname, '..', '..')
  const walletFile = '/tmp/recv-wallet-prompt.json'
  let address
  let originalPrompt
  let asked

  before(async function makeWallet() {
    this.timeout(120000)
    await createWallet(['-f', walletFile, '-p', WALLET_PASSWORD])
    address = aes.decrypt(WALLET_PASSWORD, openWallet(walletFile).address)
  })

  beforeEach(() => {
    asked = []
    originalPrompt = Object.getOwnPropertyDescriptor(cli, 'prompt')
    Object.defineProperty(cli, 'prompt', {
      configurable: true,
      value: async (message, options) => {
        asked.push({message, options})
        return WALLET_PASSWORD
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(cli, 'prompt', originalPrompt)
  })

  after(() => {
    try {
      fs.unlinkSync(walletFile)
    } catch (error) {
      // the wallet was never created; nothing to clean up
    }
  })

  // Swallow the address banner and the QR block the command writes to stdout.
  async function runInProcess(argv) {
    const write = process.stdout.write.bind(process.stdout)
    let out = ''
    process.stdout.write = chunk => {
      out += chunk.toString()
      return true
    }
    try {
      await Receive.run(argv, root)
    } finally {
      process.stdout.write = write
    }
    return out
  }

  it('asks for the password when an encrypted wallet is given without -p', async () => {
    const out = await runInProcess([walletFile])
    assert.deepStrictEqual(
      asked.map(a => a.message),
      ['Enter password for wallet file'],
      'expected exactly one password prompt'
    )
    assert.strictEqual(asked[0].options.type, 'hide', 'the password must not be echoed')
    assert.ok(out.includes(address), `expected the decrypted address in:\n${out}`)
  })
})
