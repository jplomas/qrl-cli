// /* ////////////////////////
// Generate Lattice Keys Tests
// OTS Keys - 11-24
// */ ///////////////////////

const assert = require('assert')
const {spawn} = require('child_process')
const fs = require('fs');
const path = require('path')

const setup = require('../test_setup')
const aes = require('../../src/utils/aes')

const openFile = (path) => {
  const contents = fs.readFileSync(path)
  return JSON.parse(contents)
}

let aliceWallet
let bobWallet

const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}


// lattice command given without any flags
describe('generate-lattice-keys setup', () => {
  let exitCode
  before(done => {
    aliceWallet = openFile(setup.alicePTWalletLocation)
    bobWallet = openFile(setup.bobPTWalletLocation) // 
    done()
  })
  it('exit code should be non-0 if passed without any arguments/flags, requires xmss address and ots index', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// //////////////
// Failing tests
// //////////////

// lattice command given without any flags
describe('generate-lattice-keys #1 - lattice command without any flags', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without any arguments/flags, requires xmss address and ots index', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// wrong grpc endpoint
describe('generate-lattice-keys #2 - wrong grpc endpoint', () => {
  let exitCode
  before(done => {
  const args = [
    'generate-lattice-keys',
    '-i', '12',
    '-s', aliceWallet[0].hexseed,
    '-b',
    '-g',
  ]
// console.log(`aliceWallet[0].hexseed: ${aliceWallet[0].hexseed}`)
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

// bad grpc endpoint
describe('generate-lattice-keys #2.a - bad grpc endpoint', () => {
  let exitCode
  before(done => {
  const args = [
    'generate-lattice-keys',
    '-i', '12',
    '-s', aliceWallet[0].hexseed,
    '-b',
    '-g', 'https://brooklyn.theqrl.org/nottheapi/'
  ]
// console.log(`aliceWallet[0].hexseed: ${aliceWallet[0].hexseed}`)
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

// incorrect seed length
describe('generate-lattice-keys #3 - incorrect seed length', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '12',
      '-s', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb139',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -s and incorrect hexseed', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// incorrect seed char
// The right length but not hex, so it clears the length check and only fails inside
// QRLLIB. That throw used to escape uncaught: the command exited non-zero having printed
// nothing at all, which this case could not tell apart from a clean rejection.
describe('generate-lattice-keys #3.a - incorrect seed char', () => {
  let exitCode
  let out = ''
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '12',
      '-s', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb139HG',
      '-t',
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
  it('exit code should be non-0 if passed with -s and incorrect hexseed', () => {
    assert.notStrictEqual(exitCode, 0)
  })
  it('says why, rather than failing silently', () => {
    assert.ok(/Failed to recreate XMSS wallet object/.test(out), `expected a reason\n--- actual ---\n${out}`)
  })
})

// no seed 
describe('generate-lattice-keys #3.b - no seed given', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '12',
      '-s', '',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -s and no hexseed', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// incorrect data in wallet.json
describe('generate-lattice-keys #4 - incorrect data in wallet.json', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '12',
      '-w', setup.badWallet,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -w and incorrect wallet.json file', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// no wallet.json file
describe('generate-lattice-keys #4.a - no wallet.json file', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '12',
      '-w', setup.notAWalletFile,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -w and no wallet.json file', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad encryption password for enc wallet
describe('generate-lattice-keys #4.b - bad encryption password', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '12',
      '-w', setup.aliceENCWalletLocation,
      '-p',
      setup.bobEncPass,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -w encrypted walelt and bad decryption password', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// no ots with broadcast
describe('generate-lattice-keys #5 - broadcast with no OTS given', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-b',
      '-w', setup.alicePTWalletLocation,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -b and no OTS given', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad mnemonic
describe('generate-lattice-keys #6 - bad mnemonic, too short', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '12',
      '-s', 'action core power grief surge square attic mere thence scarce rigid broken parcel leper crew twelve bicker recall met smoky congo happy soup change awhile willow lick ignore inject solve costly this split', 
      '-b',
      '-t', 
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -s and no mnemonic', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad mnemonic
describe('generate-lattice-keys #6.a - mnemonic, no ots', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-s', aliceWallet[0].mnemonic, 
      '-t', 
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -s mnemonic no ots', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad ots
describe('generate-lattice-keys #7 - bad ots (a)', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-s', aliceWallet[0].mnemonic, 
      '-t',
      '-i', 'a', 
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with -s mnemonic and bad ots', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad fee
describe('generate-lattice-keys #8 - bad fee', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-s', aliceWallet[0].mnemonic, 
      '-t',
      '-i', '12',
      '-f',
      'a' 
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad fee', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// /////////
// pass
// /////////

// print keys to console if no file location given and not broadcast
describe('generate-lattice-keys #9 - print keys', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '11',
      '-s', bobWallet[0].hexseed,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys printed to console and not broadcast', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// print keys to console in json if no file location given and not broadcast in json
describe('generate-lattice-keys #10 - print keys json', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '13',
      '-s', bobWallet[0].hexseed,
      '-t',
      '-j',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys printed to console in and not broadcast', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// print keys to console in json encrypted if no file location given and not broadcast in json
describe('generate-lattice-keys #11 - print keys to console in json encrypted', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '14',
      '-s', bobWallet[0].hexseed,
      '-t',
      '-j',
      '-e', setup.bobEncPass,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys printed to console encrypted locally', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// print keys to file location given
describe('generate-lattice-keys #12 - print keys to file', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '15',
      '-s', bobWallet[0].hexseed,
      '-c', setup.bobTempLatticeKey,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys printed to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// print keys to file location given with encryption
describe('generate-lattice-keys #13 - print keys to file encrypted', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '16', // OTS index
      '-s', bobWallet[0].hexseed, // hexseed to use for creation
      '-c', setup.aliceTempENCLatticeKey,
      '-e', setup.aliceEncPass, // encryption pass
      '-t', // testnet
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with encrypted keys printed to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// broadcast keys to testnet network and save crystals file
describe('generate-lattice-keys #14', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '17',
      '-w', setup.bobPTWalletLocation,
      '-c', setup.bobTempLatticeKey,
      '-t',
      '-b', // broadcast
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys broadcast to network and saved into temp file location', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// broadcast keys to testnet network and save crystals file encrypted
describe('generate-lattice-keys #15', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '18',
      '-w', setup.bobENCWalletLocation,
      '-p', setup.bobEncPass, 
      '-c', setup.bobTempENCLatticeKey,
      '-t',
      '-b',
      '-e', setup.bobEncPass,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys broadcast to network from encrypted wallet and encrypted keys saved into /tmp/enc-lattice.json file location', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// broadcast keys without saving to file
describe('generate-lattice-keys #16', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '19',
      '-w', setup.bobPTWalletLocation,
      '-t',
      '-b',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys broadcast to network printed to console', () => {
    assert.strictEqual(exitCode, 0)
  })
})


// broadcast keys without saving to file in json
describe('generate-lattice-keys #17', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '20',
      '-w', setup.bobPTWalletLocation,
      '-t',
      '-b',
      '-j',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys broadcast to network printed to console in json', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// broadcast encrypted keys without saving to file in json
describe('generate-lattice-keys #18', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '21',
      '-w', setup.bobENCWalletLocation,
      '-p', setup.bobEncPass,
      '-t',
      '-b',
      '-j',
      '-e', setup.bobEncPass,
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys broadcast to network printed to console in json encrypted', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// broadcast keys to testnet network and save crystals file
describe('generate-lattice-keys #19', () => {
  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '22',
      '-w', setup.alicePTWalletLocation,
      '-c', setup.aliceTempLatticeKey,
      '-t',
      '-b',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys broadcast to network and saved into temp file location', () => {
    assert.strictEqual(exitCode, 0)
  })
})


// broadcast keys to testnet network and save crystals file
describe('generate-lattice-keys #20', () => {

  let exitCode
  before(done => {
    const args = [
      'generate-lattice-keys',
      '-i', '23',
      '-w', setup.bobPTWalletLocation,
      '-c', setup.bobTempLatticeKey,
      '-t',
      '-b',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 with keys broadcast to network and saved into temp file location', () => {
    assert.strictEqual(exitCode, 0)
  })
})
// ///////////////////////////////////////////////////////////////////////////
// Offline cases
//
// Everything below runs without a node: each case either stops at a validation
// gate or at a connection to a closed local port. The suites above that pass
// -b against testnet are the only ones that spend an OTS key; these spend none,
// and they assert on the message so a command that starts failing for a
// different reason cannot keep passing.
//
// The wallet is generated here rather than borrowed from the shared fixtures,
// so these cases stand on their own.
// ///////////////////////////////////////////////////////////////////////////

// A closed port on loopback: the CLI resolves it, fails to connect, and exits.
// Deterministic, and it never leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

const offlineWallet = '/tmp/glk-offline-wallet.json'
const offlineEncWallet = '/tmp/glk-offline-wallet-enc.json'
const offlineWalletPassword = 'testpassword'
const offlineKeyFile = '/tmp/glk-offline-lattice.json'

function runLattice(args) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', ['generate-lattice-keys', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
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

function makeWallet(args) {
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

describe('generate-lattice-keys offline', () => {
  let wallet

  before(async function makeWallets() {
    this.timeout(120000)
    await makeWallet(['-f', offlineWallet])
    await makeWallet(['-f', offlineEncWallet, '-p', offlineWalletPassword])
    const [first] = openFile(offlineWallet)
    wallet = first
  })

  after(() => {
    [offlineWallet, offlineEncWallet, offlineKeyFile].forEach(file => {
      try {
        fs.unlinkSync(file)
      } catch (error) {
        // never created; nothing to clean up
      }
    })
  })

  it('refuses to run with neither a wallet file nor a hexseed', async () => {
    const {code, out} = await runLattice(['-i', '0'])
    assert.notStrictEqual(code, 0)
    assert.ok(/no wallet json file or hexseed specified/.test(out), out)
  })

  it('refuses an unreadable wallet file', async () => {
    const {code, out} = await runLattice(['-w', '/tmp/glk-does-not-exist.json', '-i', '0'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Unable to open wallet file: invalid wallet file/.test(out), out)
  })

  it('refuses an encrypted wallet opened with the wrong password', async () => {
    const {code, out} = await runLattice(['-w', offlineEncWallet, '-p', 'not-the-password', '-i', '0'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Unable to open wallet file: invalid/.test(out), out)
  })

  it('refuses to broadcast from a wallet file with no OTS index', async () => {
    const {code, out} = await runLattice(['-w', offlineWallet, '-b', '-g', DEAD_NODE])
    assert.notStrictEqual(code, 0)
    assert.ok(/no OTS index given/.test(out), out)
  })

  it('generates keys without an OTS index when it is not broadcasting', async () => {
    // The OTS index only matters for the transaction that registers the keys, so
    // generating them locally must not demand one.
    const {code, out} = await runLattice(['-w', offlineWallet])
    assert.strictEqual(code, 0, out)
    assert.ok(/Kyber PK:/.test(out), out)
    assert.ok(/Dilithium PK:/.test(out), out)
    // kleur colours the labels, so match on the parts either side of the escapes
    assert.ok(/tx_hash:/.test(out), out)
    assert.ok(!/Transaction submitted to node/.test(out), 'nothing may be broadcast without -b')
  })

  it('refuses a fee that is not a number', async () => {
    const {code, out} = await runLattice(['-s', wallet.hexseed, '-i', '0', '-f', 'free'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Fee is invalid/.test(out), out)
  })

  // The mnemonic form of the seed reaches a different XMSS constructor than the
  // hexseed form, and nothing offline had ever taken it.
  it('accepts a 34 word mnemonic and an explicit fee, and writes the key file', async function fromMnemonic() {
    this.timeout(120000)
    const {code, out} = await runLattice([
      '-s', wallet.mnemonic,
      '-i', '0',
      '-f', '100',
      '-c', offlineKeyFile,
    ])
    assert.strictEqual(code, 0, out)
    const keys = openFile(offlineKeyFile)[0]
    assert.strictEqual(keys.encrypted, false)
    assert.strictEqual(keys.tx_hash, 'false', 'nothing was broadcast')
    assert.ok(keys.kyberPK && keys.dilithiumPK && keys.ecdsaPK, 'expected all three public keys')
  })

  // -b against a closed port: the command must give up at the connection and
  // never reach the signing code, so no OTS key is spent.
  it('gives up when the node cannot be reached, without signing anything', async function deadNode() {
    this.timeout(120000)
    const {code, out} = await runLattice(['-w', offlineWallet, '-i', '0', '-b', '-g', DEAD_NODE])
    assert.notStrictEqual(code, 0)
    assert.ok(/Failed to connect to node/.test(out), out)
    assert.ok(!/Transaction signed/.test(out), `an OTS key was spent:\n${out}`)
    assert.ok(!/Pushing transaction/.test(out), `a transaction was pushed:\n${out}`)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// Encrypted wallet handling
//
// A wrong password makes aes.decrypt throw, which lands in the catch that
// reports "invalid wallet file" -- so the branch that reports "invalid
// password" is only reachable with a file whose ciphertext decrypts cleanly to
// something that is not a QRL address. That is what is built here.
//
// The interactive branch (an encrypted wallet with no -p) cannot be driven
// through a pipe: cli-ux's hidden prompt shells out to `sh -c 'read -s'`, which
// spins forever when stdin is not a terminal. Running the command in-process
// with the prompt stubbed exercises the same branch without needing a pty, and
// the command exits on the bad address before any key generation starts.
// ///////////////////////////////////////////////////////////////////////////

describe('generate-lattice-keys encrypted wallets', () => {
  const junkWallet = '/tmp/glk-decrypts-to-junk.json'
  const walletPassword = 'testpassword'

  before(() => {
    fs.writeFileSync(
      junkWallet,
      JSON.stringify([
        {
          encrypted: true,
          address: aes.encrypt(walletPassword, 'not-a-qrl-address'),
          hexseed: aes.encrypt(walletPassword, 'not-a-hexseed'),
        },
      ])
    )
  })

  after(() => {
    try {
      fs.unlinkSync(junkWallet)
    } catch (error) {
      // never created; nothing to clean up
    }
  })

  it('blames the password when the wallet decrypts to something that is not an address', async () => {
    const {code, out} = await runLattice(['-w', junkWallet, '-p', walletPassword, '-i', '0'])
    assert.notStrictEqual(code, 0)
    assert.ok(/Unable to open wallet file: invalid password/.test(out), out)
  })

  describe('with no -p on the command line', () => {
    const {cli} = require('cli-ux') // eslint-disable-line global-require
    const {Lattice} = require('../../src/commands/generate-lattice-keys') // eslint-disable-line global-require

    const root = path.join(__dirname, '..', '..')
    let originalPrompt
    let asked

    beforeEach(() => {
      asked = []
      originalPrompt = Object.getOwnPropertyDescriptor(cli, 'prompt')
      Object.defineProperty(cli, 'prompt', {
        configurable: true,
        value: async (message, options) => {
          asked.push({message, options})
          return walletPassword
        },
      })
    })

    afterEach(() => {
      Object.defineProperty(cli, 'prompt', originalPrompt)
    })

    it('asks for the wallet password, hidden', async () => {
      const write = process.stdout.write.bind(process.stdout)
      let out = ''
      process.stdout.write = chunk => {
        out += chunk.toString()
        return true
      }
      let failed
      try {
        await Lattice.run(['-w', junkWallet, '-i', '0'], root)
      } catch (error) {
        failed = error
      } finally {
        process.stdout.write = write
      }
      assert.ok(failed, 'expected the command to exit non-zero')
      assert.deepStrictEqual(
        asked.map(a => a.message),
        ['Enter password for wallet file'],
        'expected exactly one password prompt'
      )
      assert.strictEqual(asked[0].options.type, 'hide', 'the password must not be echoed')
      assert.ok(/Unable to open wallet file: invalid password/.test(out), out)
    })
  })
})

// ///////////////////////////////////////////////////////////////////////////
// generate-lattice-keys: what happens once a node has answered
//
// The offline suites above never pass -b, so the lattice keys are generated and
// printed but nothing is ever broadcast. The broadcast half — the transaction
// the command asks the node to build, the binding check that decides whether to
// sign, the push, and the transaction-id check on the way back — only ran
// against a live node, so its failure branches were unreachable.
//
// These cases run the command in *this* process against a stub gRPC client.
// src/functions/grpc is swapped in the require cache for the moment it takes to
// require the command (it captures Qrlnode at require time), then the real
// module is put straight back. There is no server and no socket.
//
// The signing is real, against a throwaway height-4 wallet, and the stub
// recomputes the transaction hash the way a node does. Nothing reaches a
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
const GLK_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const GLK_NODE_WALLET = '/tmp/glk-node-wallet.json'

// Behaviour the stub should show for the test currently running. Reset per test.
let glkNode = {}
let glkCalls = []
let glkConnectAttempts = 0

// Rebuild the transaction hash from the signed transaction the command pushed,
// the way QRL core does for a LatticeTransaction:
//   preimage = master_addr || fee || pk1 || pk2 || pk3
//   hash     = sha256(sha256(preimage) || signature || public key)
function latticeTransactionHash(signedTx) {
  const preimage = concatenateTypedArrays(
    Uint8Array,
    toBigendianUint64BytesUnsigned(parseInt(signedTx.fee, 10)),
    Uint8Array.from(Buffer.from(signedTx.latticePK.pk1)),
    Uint8Array.from(Buffer.from(signedTx.latticePK.pk2)),
    Uint8Array.from(Buffer.from(signedTx.latticePK.pk3))
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

// What an honest node returns for GetLatticeTxn: the request echoed back.
const buildLatticeResponse = request => ({
  extended_transaction_unsigned: {
    tx: {
      master_addr: Buffer.from(request.master_addr),
      fee: String(request.fee),
      latticePK: {
        pk1: Buffer.from(request.pk1),
        pk2: Buffer.from(request.pk2),
        pk3: Buffer.from(request.pk3),
      },
    },
  },
})

class LatticeFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    glkConnectAttempts += 1
    if (glkNode.connectThrows) {
      throw new Error(glkNode.connectThrows)
    }
    const connectsOn = glkNode.connectsOnAttempt === undefined ? 1 : glkNode.connectsOnAttempt
    if (connectsOn !== 0 && glkConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    glkCalls.push({name, request})
    if (name === 'GetLatticeTxn') {
      const built = buildLatticeResponse(request)
      return glkNode.tamper ? glkNode.tamper(built) : built
    }
    if (glkNode.pushResponse) {
      return glkNode.pushResponse
    }
    const hash = latticeTransactionHash(request.transaction_signed)
    return {tx_hash: glkNode.wrongHash ? Buffer.alloc(32, 0x11) : hash}
  }
}

const glkGrpcPath = require.resolve('../../src/functions/grpc')
const glkCommandPath = require.resolve('../../src/commands/generate-lattice-keys')

// This file already required the command higher up (the password-prompt suite),
// so the cached copy holds the real gRPC client. Drop it, require it again with
// the stub in place, and put the original back when this suite is done.
const glkRealCommandEntry = require.cache[glkCommandPath]
delete require.cache[glkCommandPath]

const glkRealGrpcEntry = require.cache[glkGrpcPath]
require.cache[glkGrpcPath] = {
  id: glkGrpcPath,
  filename: glkGrpcPath,
  path: path.dirname(glkGrpcPath),
  loaded: true,
  children: [],
  paths: [],
  exports: LatticeFakeQrlNode,
}
const {Lattice} = require('../../src/commands/generate-lattice-keys')

if (glkRealGrpcEntry) {
  require.cache[glkGrpcPath] = glkRealGrpcEntry
} else {
  delete require.cache[glkGrpcPath]
}

// Run generate-lattice-keys here, against the stub, capturing everything it prints (this.log
// and console.log go to stdout, the ora spinners go to stderr). run() awaits the whole
// signing and pushing sequence, so an exit inside it arrives as a thrown ExitError.
async function runLatticeInProcess(argv) {
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
    await Lattice.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  // kleur colours by environment variable rather than by isTTY, so the captured output
  // still carries escape sequences here. Strip them so the assertions read as the text a
  // person would see.
  return {code, out: chunks.join('').replace(GLK_ANSI, '')}
}

describe('generate-lattice-keys: broadcasting to a node', () => {
  before(async function makeNodeWallet() {
    this.timeout(120000)
    await makeWallet(['-f', GLK_NODE_WALLET])
  })

  after(() => {
    // The cached command module holds the stubbed Qrlnode; put the real one back
    // so anything requiring it later in the same process is unaffected.
    if (glkRealCommandEntry === undefined) {
      delete require.cache[glkCommandPath]
    } else {
      require.cache[glkCommandPath] = glkRealCommandEntry
    }
    try {
      fs.unlinkSync(GLK_NODE_WALLET)
    } catch (error) {
      // never created; nothing to clean up
    }
  })

  beforeEach(() => {
    glkNode = {}
    glkCalls = []
    glkConnectAttempts = 0
  })

  const latticeArgs = (extra = []) => ['-w', GLK_NODE_WALLET, '-i', '0', '-b', '-t', ...extra]

  it('asks the node to register the three public keys it just generated', async function builds() {
    this.timeout(180000)
    const {code, out} = await runLatticeInProcess(latticeArgs())
    assert.strictEqual(code, 0, out)
    const build = glkCalls.find(c => c.name === 'GetLatticeTxn')
    assert.ok(build, `no GetLatticeTxn call was made\n--- output ---\n${out}`)
    // kyber, dilithium and ecdsa public keys, each non-empty and distinct
    assert.ok(build.request.pk1.length > 0 && build.request.pk2.length > 0 && build.request.pk3.length > 0)
    assert.notStrictEqual(Buffer.from(build.request.pk1).toString('hex'), Buffer.from(build.request.pk2).toString('hex'))
    assert.strictEqual(build.request.fee, 0)
  })

  it('accepts an explicit fee of 0, the same value it uses when -f is omitted', async function zeroFee() {
    this.timeout(180000)
    const {code, out} = await runLatticeInProcess(latticeArgs(['-f', '0']))
    assert.strictEqual(code, 0, out)
    assert.strictEqual(glkCalls.find(c => c.name === 'GetLatticeTxn').request.fee, 0)
  })

  it('signs, pushes, and reports the id the node gave back', async function signs() {
    this.timeout(180000)
    const {code, out} = await runLatticeInProcess(latticeArgs(['-f', '100']))
    assert.strictEqual(code, 0, out)
    assert.ok(/Transaction signed with OTS key 0/.test(out), out)
    const push = glkCalls.find(c => c.name === 'PushTransaction')
    assert.ok(push.request.transaction_signed.signature.length > 0, 'pushed without a signature')
    assert.strictEqual(push.request.transaction_signed.fee, '100')
    const hash = latticeTransactionHash(push.request.transaction_signed).toString('hex')
    assert.ok(out.includes(`transaction ID: ${hash}`), out)
    assert.ok(out.includes(`https://testnet-explorer.theqrl.org/tx/${hash}`), out)
  })

  it('links to the mainnet explorer when broadcasting to mainnet', async function mainnet() {
    this.timeout(180000)
    const {code, out} = await runLatticeInProcess(
      ['-w', GLK_NODE_WALLET, '-i', '0', '-b', '-m']
    )
    assert.strictEqual(code, 0, out)
    assert.ok(/https:\/\/explorer\.theqrl\.org\/tx\/[0-9a-f]{64}/.test(out), out)
  })

  it('reports the transaction id on a custom endpoint too', async function customEndpoint() {
    this.timeout(180000)
    // No explorer to link to for a custom node, but the transaction still has to
    // be named, or a successful broadcast leaves nothing to look it up with.
    const {code, out} = await runLatticeInProcess(['-w', GLK_NODE_WALLET, '-i', '0', '-b', '-g', DEAD_NODE])
    assert.strictEqual(code, 0, out)
    const push = glkCalls.find(c => c.name === 'PushTransaction')
    const hash = latticeTransactionHash(push.request.transaction_signed).toString('hex')
    assert.ok(out.includes(`transaction ID: ${hash}`), out)
    assert.ok(!/explorer\.theqrl\.org/.test(out), 'no explorer link for a network with no explorer')
  })

  it('retries the connection until the node answers', async function retries() {
    this.timeout(180000)
    glkNode = {connectsOnAttempt: 3}
    const {code} = await runLatticeInProcess(latticeArgs())
    assert.strictEqual(code, 0)
    assert.strictEqual(glkConnectAttempts, 3)
  })

  it('refuses to sign a response that swapped a public key', async function tamperedKey() {
    this.timeout(180000)
    // Registering a lattice key the user does not hold the secret half of would
    // let a node substitute its own key for every later encrypted exchange.
    glkNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.latticePK.pk2 = Buffer.alloc(tx.latticePK.pk2.length, 0xAB)
        return response
      },
    }
    const {code, out} = await runLatticeInProcess(latticeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different dilithium public key/.test(out), out)
    assert.ok(/Nothing was signed and no OTS key was used/.test(out), out)
    assert.strictEqual(glkCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
  })

  it('refuses to sign a response that inflated the fee', async function tamperedFee() {
    this.timeout(180000)
    glkNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.fee = '100000000'
        return response
      },
    }
    const {code, out} = await runLatticeInProcess(latticeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different fee/.test(out), out)
  })

  it('reports a node that rejects the push', async function pushRejected() {
    this.timeout(180000)
    glkNode = {pushResponse: {error_code: 'INVALID', error_description: 'OTS key reused'}}
    const {code, out} = await runLatticeInProcess(latticeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/OTS key reused/.test(out), out)
  })

  it('refuses a transaction id that is not the one it signed', async function hashMismatch() {
    this.timeout(180000)
    glkNode = {wrongHash: true}
    const {code, out} = await runLatticeInProcess(latticeArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/Node transaction hash 1111/.test(out), out)
  })

  it('reports a connection that fails outright', async function connectFailed() {
    this.timeout(180000)
    glkNode = {connectThrows: 'no route to host'}
    const {code, out} = await runLatticeInProcess(latticeArgs())
    assert.strictEqual(code, 1, out)
    assert.strictEqual(glkCalls.length, 0, 'nothing may be asked of a node that never connected')
  })
  it('reports a signing failure that is not a binding failure', async function badOts() {
    this.timeout(180000)
    // OTS index 999 does not exist in a height-4 tree, so the response binds
    // cleanly and it is xmss.sign() that fails.
    const {code, out} = await runLatticeInProcess(
      ['-w', GLK_NODE_WALLET, '-i', '999', '-b', '-t']
    )
    assert.strictEqual(code, 1, out)
    assert.strictEqual(glkCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
  })
})
