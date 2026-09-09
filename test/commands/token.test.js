// ///////////////////////////////////////////////////////////////////////////
// token:create / token:transfer tests
//
// These are the newest commands in the CLI and the least exercised. Everything
// here is offline: each case stops at a validation gate, or at a connection to
// a closed local port, so nothing contacts a node and no OTS key is consumed.
//
// Walking the validation ladder matters beyond coverage. token:transfer shipped
// unable to talk to a node at all, and nothing in the suite noticed, because the
// only tests were four "exits non-zero with no arguments" cases that stopped at
// the first missing-flag check.
// ///////////////////////////////////////////////////////////////////////////

const assert = require('assert')
const {spawn, execFileSync} = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

// A closed port on loopback: the CLI resolves it, fails to connect, and exits.
// Deterministic, and it never leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

const VALID_ADDRESS = 'Q000300cc040d28c309c8e82d1397aa0d9b74666b492f77b485d327bf5496a725b7b8a3c024b9ee'
const SECOND_ADDRESS = 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408'
const VALID_TOKEN_HASH = '9d3f463b300012292eac668768f2969125ae540b1cdef7c99f6fea448e736af8'
const NOT_A_WALLET = path.join(__dirname, '..', 'test-wallet', 'does-not-exist.json')

// Fixtures live in their own temp directory rather than test/test-wallet, because the
// shared hooks delete everything in that directory and other suites run in parallel.
const FIXTURES = path.join(os.tmpdir(), 'qrl-cli-token-fixtures')
const PLAIN_WALLET = path.join(FIXTURES, 'token-wallet.json')
const ENC_WALLET = path.join(FIXTURES, 'token-wallet-enc.json')
const LEGACY_WALLET = path.join(FIXTURES, 'token-wallet-legacy.json')
const MALFORMED_WALLET = path.join(FIXTURES, 'token-wallet-malformed.json')
const UNKNOWN_WALLET = path.join(FIXTURES, 'token-wallet-unknown.json')
const WALLET_PASSWORD = 'testpassword'
const WRONG_PASSWORD = 'not-the-password'

// A 102-character seed that passes the length check but is not hex, so QRLLIB rejects it.
// This is the only way to reach the "failed to rebuild the XMSS object" arm without a node.
const UNPARSEABLE_HEXSEED = 'z'.repeat(102)

// Enter is CR, not LF: prompts puts the terminal in raw mode, where LF is not a submit key.
const CR = '\r'
// Down arrow, as the terminal delivers it. Used to move onto the second sender choice.
const DOWN_ARROW = `${String.fromCharCode(27)}[B`
// Backspace, for clearing a rejected answer that the next keystrokes cannot simply fix.
const BACKSPACE = String.fromCharCode(127)

// Run the CLI and capture what it said, rather than letting it write to the test output.
function run(args) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'pipe', 'pipe']})
    let out = ''
    child.stdout.on('data', d => {
      out += d.toString()
    })
    child.stderr.on('data', d => {
      out += d.toString()
    })
    // Surface a failed spawn as output rather than an empty capture: under heavy parallel
    // load fork can fail, and without this the case fails as "output did not match" with
    // nothing to show, which reads like a CLI regression instead of a busy machine.
    child.on('error', err => resolve({code: -1, out: `${out}\nspawn failed: ${err.message}`}))
    child.on('close', code => resolve({code, out}))
  })
}

// Every case here must fail; assert on the reason, not just the exit code, so a command
// that starts failing for a different reason does not keep passing.
async function refuses(args, expected) {
  const {code, out} = await run(args)
  assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}`)
  assert.ok(
    expected.test(out),
    `expected output to match ${expected}\n--- actual ---\n${out}`
  )
}

// ///////////////////////////////////////////////////////////////////////////
// Wallet fixtures
//
// Built here rather than borrowed from test_setup, so this file passes on its own: the
// shared wallets only exist when the whole suite runs with test/hooks.js required.
// ///////////////////////////////////////////////////////////////////////////

// Reproduces the format written by the retired `aes256` package: key = sha256(password),
// AES-256-CTR, base64(iv || ciphertext). It is unauthenticated, so a wrong password
// decrypts to garbage rather than throwing, which is the only way to reach the commands'
// "invalid password" arm. Wallets in the current v2/GCM format fail closed instead.
function legacyEncrypt(password, plaintext) {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(password).digest()
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  const body = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  return Buffer.concat([iv, body]).toString('base64')
}

let walletPromise = null
let plainWallet = null

function createWallet(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'ignore', 'pipe']})
    let err = ''
    child.stderr.on('data', d => {
      err += d.toString()
    })
    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`create-wallet exited ${code}: ${err}`))
      }
    })
  })
}

async function buildFixtures() {
  fs.mkdirSync(FIXTURES, {recursive: true})
  // Height 6 keeps wallet generation to about a second; no test ever spends an OTS key.
  await createWallet(['create-wallet', '-h', '6', '-f', PLAIN_WALLET])
  await createWallet(['create-wallet', '-h', '6', '-f', ENC_WALLET, '-p', WALLET_PASSWORD])
  const [firstEntry] = JSON.parse(fs.readFileSync(PLAIN_WALLET))
  plainWallet = firstEntry

  fs.writeFileSync(
    LEGACY_WALLET,
    JSON.stringify([
      {
        encrypted: true,
        address: legacyEncrypt(WALLET_PASSWORD, plainWallet.address),
        hexseed: legacyEncrypt(WALLET_PASSWORD, plainWallet.hexseed),
        mnemonic: legacyEncrypt(WALLET_PASSWORD, plainWallet.mnemonic),
      },
    ])
  )
  // Not JSON at all: readFileSync succeeds and JSON.parse is what throws.
  fs.writeFileSync(MALFORMED_WALLET, 'this is not a wallet')
  // Parses, but `encrypted` is neither true nor false, so neither branch claims the file.
  fs.writeFileSync(UNKNOWN_WALLET, JSON.stringify([{encrypted: 'maybe', address: 'Qdeadbeef'}]))
}

function fixtures() {
  if (walletPromise === null) {
    walletPromise = buildFixtures()
  }
  return walletPromise
}

function useFixtures() {
  before(function makeWallets() {
    this.timeout(120000)
    return fixtures()
  })
}

// ///////////////////////////////////////////////////////////////////////////
// Interactive (pty) harness
//
// Both commands prompt for anything not supplied as a flag, but only when stdin and
// stdout are TTYs; through a pipe that whole half of each command is unreachable, which
// is why it was the largest untested region. util-linux `script` lends the child a pty
// without adding a native dependency. Where it is missing these cases skip rather than
// fail, and the flag-driven cases above still stand.
// ///////////////////////////////////////////////////////////////////////////

const hasPty = (() => {
  try {
    const version = execFileSync('script', ['--version'], {stdio: ['ignore', 'pipe', 'ignore']})
    return /util-linux/.test(version.toString())
  } catch (error) {
    return false
  }
})()

const shellQuote = arg => `'${String(arg).replace(/'/g, "'\\''")}'`

// Drives one prompt at a time: wait for the prompt's text, then send its answer. Answers
// are never written ahead of the prompt that consumes them, because the tty hands the
// whole buffered line to the first reader. A step may send several keystrokes, written
// separately: an escape sequence must not be glued to the key after it, and cli-ux's
// password prompt compares each chunk against CR whole, so a password and its Enter have
// to arrive as two writes.
function runInteractive(args, steps) {
  return new Promise(resolve => {
    const command = ['./bin/run'].concat(args).map(shellQuote).join(' ')
    const child = spawn('script', ['-q', '-e', '-c', command, '/dev/null'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const remaining = steps.slice()
    let all = ''
    let window = ''
    let sending = false

    const pump = () => {
      if (sending || remaining.length === 0 || !remaining[0].expect.test(window)) {
        return
      }
      const step = remaining.shift()
      // Fresh window per step, so the next prompt matches against new output only. Prompts
      // redraw their whole line on every keystroke, so a shared buffer would self-match.
      window = ''
      sending = true
      const keys = Array.isArray(step.send) ? step.send.slice() : [step.send]
      const sendNext = () => {
        if (keys.length === 0) {
          sending = false
          if (step.eof) {
            child.stdin.end()
          }
          pump()
          return
        }
        child.stdin.write(keys.shift())
        setTimeout(sendNext, 120)
      }
      sendNext()
    }

    const onData = d => {
      all += d.toString()
      window += d.toString()
      pump()
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', err => resolve({code: -1, out: `${all}\nspawn failed: ${err.message}`, unmet: remaining.length}))
    child.on('close', code => resolve({code, out: all, unmet: remaining.length}))
  })
}

async function interactively(args, steps, expected) {
  const {out, unmet} = await runInteractive(args, steps)
  assert.strictEqual(unmet, 0, `${unmet} prompt(s) never appeared\n--- actual ---\n${out}`)
  assert.ok(
    expected.test(out),
    `expected output to match ${expected}\n--- actual ---\n${out}`
  )
}

// Wallet generation plus a pty round trip per keystroke; generous, but these never hang
// because the CLI always terminates at the closed port or at a cancelled prompt.
const SLOW = 120000

describe('token:create validation', () => {
  it('exits non-zero with no arguments', async () => {
    await refuses(['token:create'], /Missing required flag: --symbol/)
  })

  it('requires a name once a symbol is given', async () => {
    await refuses(['token:create', '--symbol', 'TST'], /Missing required flag: --name/)
  })

  it('requires holder distributions', async () => {
    await refuses(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token'],
      /Missing holder distributions/
    )
  })

  it('rejects a holder that is not Address:Amount', async () => {
    await refuses(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--holder', 'no-colon-here'],
      /Invalid holder format/
    )
  })

  it('rejects a holder with an invalid QRL address', async () => {
    await refuses(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--holder', 'Qdeadbeef:100'],
      /Invalid QRL address in holder/
    )
  })

  it('requires an OTS index', async () => {
    await refuses(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--holder', `${VALID_ADDRESS}:100`],
      /Missing required flag: --otsindex/
    )
  })

  it('requires a wallet or a hexseed', async () => {
    await refuses(
      [
        'token:create', '--symbol', 'TST', '--name', 'Test Token',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0',
      ],
      /Missing sender wallet file|hexseed/
    )
  })

  it('rejects an unreadable wallet file', async () => {
    await refuses(
      [
        'token:create', '--symbol', 'TST', '--name', 'Test Token',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0', '--wallet', NOT_A_WALLET,
      ],
      /Unable to open wallet file|invalid wallet file/i
    )
  })

  it('rejects a hexseed of the wrong length', async () => {
    await refuses(
      [
        'token:create', '--symbol', 'TST', '--name', 'Test Token',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0', '--hexseed', 'deadbeef',
      ],
      /Hexseed invalid|too short/i
    )
  })

  it('rejects a mnemonic with the wrong word count', async () => {
    await refuses(
      [
        'token:create', '--symbol', 'TST', '--name', 'Test Token',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0',
        '--hexseed', 'absorb filter chalk',
      ],
      /Mnemonic phrase invalid|too short/i
    )
  })
})

describe('token:transfer validation', () => {
  it('exits non-zero with no arguments', async () => {
    await refuses(['token:transfer'], /Missing required flag: --tokenHash/)
  })

  it('requires a recipient once a token hash is given', async () => {
    await refuses(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH],
      /Missing required flag: --recipient/
    )
  })

  it('requires an amount', async () => {
    await refuses(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS],
      /Missing required flag: --amount/
    )
  })

  it('requires an OTS index', async () => {
    await refuses(
      [
        'token:transfer', '--tokenHash', VALID_TOKEN_HASH,
        '--recipient', VALID_ADDRESS, '--amount', '5',
      ],
      /Missing required flag: --otsindex/
    )
  })

  it('requires a wallet or a hexseed', async () => {
    await refuses(
      [
        'token:transfer', '--tokenHash', VALID_TOKEN_HASH,
        '--recipient', VALID_ADDRESS, '--amount', '5', '--otsindex', '0',
      ],
      /Missing sender wallet file|hexseed/
    )
  })

  it('rejects an unreadable wallet file', async () => {
    await refuses(
      [
        'token:transfer', '--tokenHash', VALID_TOKEN_HASH,
        '--recipient', VALID_ADDRESS, '--amount', '5', '--otsindex', '0',
        '--wallet', NOT_A_WALLET,
      ],
      /Unable to open wallet file|invalid wallet file/i
    )
  })

  it('rejects a hexseed of the wrong length', async () => {
    await refuses(
      [
        'token:transfer', '--tokenHash', VALID_TOKEN_HASH,
        '--recipient', VALID_ADDRESS, '--amount', '5', '--otsindex', '0',
        '--hexseed', 'deadbeef',
      ],
      /Hexseed invalid|too short/i
    )
  })
})

// ///////////////////////////////////////////////////////////////////////////
// Wallet and seed handling
//
// Everything below rebuilds a real XMSS object from a real wallet and then stops at the
// closed port. Reaching the connection attempt is the point: it proves the wallet was
// opened, decrypted where needed, and turned into keys, which is the work that has to be
// right before a signature is ever produced.
// ///////////////////////////////////////////////////////////////////////////

function createArgs(extra) {
  return [
    'token:create', '--symbol', 'TST', '--name', 'Test Token',
    '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0', '--grpc', DEAD_NODE,
  ].concat(extra)
}

function transferArgs(extra) {
  return [
    'token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
    '--amount', '5', '--otsindex', '0', '--grpc', DEAD_NODE,
  ].concat(extra)
}

// The wallet was read and the keys rebuilt; only the node was missing.
const REACHED_NODE = /Failed to connect to node/

describe('token:create wallet and seed handling', () => {
  useFixtures()

  it('loads a plaintext wallet and reaches the node with a custom fee and decimals', async () => {
    // Two holders and non-default fee/decimals in one pass: the multi-holder loop and the
    // flag-supplied fee are among the values the transaction is bound to before signing.
    await refuses(
      createArgs([
        '--holder', `${SECOND_ADDRESS}:250`, '--decimals', '3', '--fee', '500',
        '--wallet', PLAIN_WALLET,
      ]),
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('opens an encrypted wallet with the right password', async () => {
    await refuses(
      createArgs(['--wallet', ENC_WALLET, '--password', WALLET_PASSWORD]),
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('refuses an encrypted wallet with the wrong password', async () => {
    // The current wallet format is authenticated, so a wrong password fails the auth tag
    // and never yields a plausible-looking address to sign with. What it reports is that
    // the password is wrong - it used to blame the file, which was fine all along.
    await refuses(
      createArgs(['--wallet', ENC_WALLET, '--password', WRONG_PASSWORD]),
      /invalid password/i
    )
  }).timeout(SLOW)

  it('still opens a legacy-format encrypted wallet', async () => {
    await refuses(
      createArgs(['--wallet', LEGACY_WALLET, '--password', WALLET_PASSWORD]),
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('reports a bad password on a legacy wallet as a bad password', async () => {
    // Legacy blobs are unauthenticated: a wrong password yields garbage instead of an
    // error, so the address check is the only thing between the user and signing with a
    // key that is not theirs.
    await refuses(
      createArgs(['--wallet', LEGACY_WALLET, '--password', WRONG_PASSWORD]),
      /invalid password/i
    )
  }).timeout(SLOW)

  it('rejects a wallet file that is not JSON', async () => {
    await refuses(createArgs(['--wallet', MALFORMED_WALLET]), /invalid wallet file/i)
  }).timeout(SLOW)

  it('rejects a wallet whose encrypted flag is neither true nor false', async () => {
    await refuses(createArgs(['--wallet', UNKNOWN_WALLET]), /invalid wallet file/i)
  }).timeout(SLOW)

  it('accepts a full-length hexseed', async () => {
    await refuses(createArgs(['--hexseed', plainWallet.hexseed]), REACHED_NODE)
  }).timeout(SLOW)

  it('accepts a 34-word mnemonic', async () => {
    await refuses(createArgs(['--hexseed', plainWallet.mnemonic]), REACHED_NODE)
  }).timeout(SLOW)

  it('reports a hexseed that is the right length but not a seed', async () => {
    await refuses(
      createArgs(['--hexseed', UNPARSEABLE_HEXSEED]),
      /Failed to recreate XMSS wallet object/
    )
  }).timeout(SLOW)
})

describe('token:transfer wallet and seed handling', () => {
  useFixtures()

  it('loads a plaintext wallet and reaches the node with a custom fee', async () => {
    await refuses(transferArgs(['--fee', '500', '--wallet', PLAIN_WALLET]), REACHED_NODE)
  }).timeout(SLOW)

  it('opens an encrypted wallet with the right password', async () => {
    await refuses(
      transferArgs(['--wallet', ENC_WALLET, '--password', WALLET_PASSWORD]),
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('refuses an encrypted wallet with the wrong password', async () => {
    await refuses(
      transferArgs(['--wallet', ENC_WALLET, '--password', WRONG_PASSWORD]),
      /invalid password/i
    )
  }).timeout(SLOW)

  it('still opens a legacy-format encrypted wallet', async () => {
    await refuses(
      transferArgs(['--wallet', LEGACY_WALLET, '--password', WALLET_PASSWORD]),
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('reports a bad password on a legacy wallet as a bad password', async () => {
    await refuses(
      transferArgs(['--wallet', LEGACY_WALLET, '--password', WRONG_PASSWORD]),
      /invalid password/i
    )
  }).timeout(SLOW)

  it('rejects a wallet file that is not JSON', async () => {
    await refuses(transferArgs(['--wallet', MALFORMED_WALLET]), /invalid wallet file/i)
  }).timeout(SLOW)

  it('rejects a wallet whose encrypted flag is neither true nor false', async () => {
    await refuses(transferArgs(['--wallet', UNKNOWN_WALLET]), /invalid wallet file/i)
  }).timeout(SLOW)

  it('accepts a full-length hexseed', async () => {
    await refuses(transferArgs(['--hexseed', plainWallet.hexseed]), REACHED_NODE)
  }).timeout(SLOW)

  it('accepts a 34-word mnemonic', async () => {
    await refuses(transferArgs(['--hexseed', plainWallet.mnemonic]), REACHED_NODE)
  }).timeout(SLOW)

  it('reports a hexseed that is the right length but not a seed', async () => {
    await refuses(
      transferArgs(['--hexseed', UNPARSEABLE_HEXSEED]),
      /Failed to recreate XMSS wallet object/
    )
  }).timeout(SLOW)

  it('rejects a mnemonic with the wrong word count', async () => {
    await refuses(
      transferArgs(['--hexseed', 'absorb filter chalk']),
      /Mnemonic phrase invalid|too short/i
    )
  }).timeout(SLOW)
})

describe('token:create interactive prompts', () => {
  useFixtures()

  before(function needsPty() {
    if (!hasPty) {
      this.skip()
    }
  })

  it('asks again for answers that fail validation, then reaches the node', async () => {
    // The whole ladder with nothing on the command line, and an answer rejected at each
    // prompt whose validator can be satisfied on the retry: symbol, name, the holder
    // amount, then the holder loop's blank-address exit, OTS index and the wallet file.
    await interactively(
      ['token:create', '--grpc', DEAD_NODE],
      [
        {expect: /Enter Token Symbol/, send: CR},
        {expect: /Symbol must be between 1 and 10 characters/, send: `TST${CR}`},
        {expect: /Enter Token Name/, send: CR},
        {expect: /Name must be between 1 and 30 characters/, send: `Test Token${CR}`},
        {expect: /Enter Decimal Precision/, send: CR},
        {expect: /Holder QRL Address/, send: `${VALID_ADDRESS}${CR}`},
        {expect: /Amount for/, send: CR},
        {expect: /Amount must be positive/, send: `100${CR}`},
        {expect: /Holder QRL Address/, send: CR},
        {expect: /Enter OTS key index/, send: `0${CR}`},
        {expect: /specify the sender wallet/, send: CR},
        {expect: /path to wallet file/, send: `${PLAIN_WALLET}${CR}`},
      ],
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('refuses a decimal precision outside 0-9', async () => {
    // 12 is rejected, one backspace makes it 1, and the command carries on with the
    // corrected answer rather than the one that was typed first.
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0',
        '--wallet', PLAIN_WALLET, '--grpc', DEAD_NODE],
      [
        {expect: /Enter Decimal Precision/, send: `12${CR}`},
        {expect: /Decimals must be between 0 and 9/, send: [BACKSPACE, CR]},
      ],
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('refuses an invalid address inside the holder loop', async () => {
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--decimals', '9',
        '--grpc', DEAD_NODE],
      [
        {expect: /Holder QRL Address/, send: `Qdeadbeef${CR}`},
        {expect: /Invalid QRL address/, send: [], eof: true},
      ],
      /Invalid QRL address/
    )
  }).timeout(SLOW)

  it('refuses a negative OTS index', async () => {
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--decimals', '9',
        '--holder', `${VALID_ADDRESS}:100`, '--grpc', DEAD_NODE],
      [
        {expect: /Enter OTS key index/, send: `-1${CR}`},
        {expect: /OTS index must be 0 or greater/, send: [], eof: true},
      ],
      /OTS index must be 0 or greater/
    )
  }).timeout(SLOW)

  it('treats a blank OTS index as a cancellation', async () => {
    // The validator reads `value >= 0`, and an empty answer coerces to 0, so a blank
    // submission gets past it. Stopping on the empty string afterwards is what keeps the
    // command from signing with an OTS index the user never chose.
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--decimals', '9',
        '--holder', `${VALID_ADDRESS}:100`, '--grpc', DEAD_NODE],
      [{expect: /Enter OTS key index/, send: CR}],
      /Operation cancelled/
    )
  }).timeout(SLOW)

  it('refuses a wallet path that does not exist', async () => {
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--decimals', '9',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0', '--grpc', DEAD_NODE],
      [
        {expect: /specify the sender wallet/, send: CR},
        {expect: /path to wallet file/, send: `/no${CR}`},
        {expect: /File does not exist/, send: [], eof: true},
      ],
      /File does not exist/
    )
  }).timeout(SLOW)

  it('takes a hexseed from the second sender choice', async () => {
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--decimals', '9',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0', '--grpc', DEAD_NODE],
      [
        {expect: /specify the sender wallet/, send: [DOWN_ARROW, CR]},
        {expect: /Hexseed or Mnemonic/, send: CR},
        {expect: /Hexseed\/Mnemonic is required/, send: `${plainWallet.hexseed}${CR}`},
      ],
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('asks for the wallet password when it is not on the command line', async () => {
    // Typing the password beats passing --password, which leaves it in the shell history;
    // the prompted route has to open the same file just as well.
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--decimals', '9',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0',
        '--wallet', ENC_WALLET, '--grpc', DEAD_NODE],
      [{expect: /password for wallet file/, send: [WALLET_PASSWORD, CR]}],
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('treats an abandoned symbol prompt as a cancellation', async () => {
    // Closing stdin aborts the prompt, the same as a user pressing ctrl-c: no answer comes
    // back, so the command has to stop rather than carry an undefined symbol forward.
    await interactively(
      ['token:create', '--grpc', DEAD_NODE],
      [{expect: /Enter Token Symbol/, send: [], eof: true}],
      /Operation cancelled/
    )
  }).timeout(SLOW)

  it('treats an abandoned name prompt as a cancellation', async () => {
    await interactively(
      ['token:create', '--grpc', DEAD_NODE],
      [
        {expect: /Enter Token Symbol/, send: `TST${CR}`},
        {expect: /Enter Token Name/, send: [], eof: true},
      ],
      /Operation cancelled/
    )
  }).timeout(SLOW)

  it('treats an abandoned sender question as a cancellation', async () => {
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--decimals', '9',
        '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0', '--grpc', DEAD_NODE],
      [{expect: /specify the sender wallet/, send: [], eof: true}],
      /Operation cancelled/
    )
  }).timeout(SLOW)

  it('will not finish with an empty holder list', async () => {
    // Finishing the holder loop without adding anyone has to fail: a token whose entire
    // supply is allocated to nobody is not something to spend an OTS key on.
    await interactively(
      ['token:create', '--symbol', 'TST', '--name', 'Test Token', '--grpc', DEAD_NODE],
      [
        {expect: /Enter Decimal Precision/, send: CR},
        {expect: /Holder QRL Address/, send: CR},
      ],
      /at least one initial balance holder/
    )
  }).timeout(SLOW)
})

describe('token:transfer interactive prompts', () => {
  useFixtures()

  before(function needsPty() {
    if (!hasPty) {
      this.skip()
    }
  })

  it('asks again for answers that fail validation, then reaches the node', async () => {
    await interactively(
      ['token:transfer', '--grpc', DEAD_NODE],
      [
        {expect: /Enter Token Creation TxID/, send: CR},
        {expect: /Token TxID must be a 64-character hex string/, send: `${VALID_TOKEN_HASH}${CR}`},
        {expect: /Enter Recipient QRL Address/, send: `Qdeadbeef${CR}`},
        {expect: /Invalid QRL address/, send: [BACKSPACE.repeat(9), `${VALID_ADDRESS}${CR}`]},
        {expect: /Enter Amount of Tokens/, send: CR},
        {expect: /Amount must be positive/, send: `5${CR}`},
        {expect: /Enter OTS key index/, send: `0${CR}`},
        {expect: /specify the sender wallet/, send: CR},
        {expect: /path to wallet file/, send: `${PLAIN_WALLET}${CR}`},
      ],
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('refuses a negative OTS index', async () => {
    await interactively(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
        '--amount', '5', '--grpc', DEAD_NODE],
      [
        {expect: /Enter OTS key index/, send: `-1${CR}`},
        {expect: /OTS index must be 0 or greater/, send: [], eof: true},
      ],
      /OTS index must be 0 or greater/
    )
  }).timeout(SLOW)

  it('treats a blank OTS index as a cancellation', async () => {
    await interactively(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
        '--amount', '5', '--grpc', DEAD_NODE],
      [{expect: /Enter OTS key index/, send: CR}],
      /Operation cancelled/
    )
  }).timeout(SLOW)

  it('refuses a wallet path that does not exist', async () => {
    await interactively(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
        '--amount', '5', '--otsindex', '0', '--grpc', DEAD_NODE],
      [
        {expect: /specify the sender wallet/, send: CR},
        {expect: /path to wallet file/, send: `/no${CR}`},
        {expect: /File does not exist/, send: [], eof: true},
      ],
      /File does not exist/
    )
  }).timeout(SLOW)

  it('takes a mnemonic from the second sender choice', async () => {
    await interactively(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
        '--amount', '5', '--otsindex', '0', '--grpc', DEAD_NODE],
      [
        {expect: /specify the sender wallet/, send: [DOWN_ARROW, CR]},
        {expect: /Hexseed or Mnemonic/, send: CR},
        {expect: /Hexseed\/Mnemonic is required/, send: `${plainWallet.mnemonic}${CR}`},
      ],
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('asks for the wallet password when it is not on the command line', async () => {
    await interactively(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
        '--amount', '5', '--otsindex', '0', '--wallet', ENC_WALLET, '--grpc', DEAD_NODE],
      [{expect: /password for wallet file/, send: [WALLET_PASSWORD, CR]}],
      REACHED_NODE
    )
  }).timeout(SLOW)

  it('treats an abandoned token hash prompt as a cancellation', async () => {
    await interactively(
      ['token:transfer', '--grpc', DEAD_NODE],
      [{expect: /Enter Token Creation TxID/, send: [], eof: true}],
      /Operation cancelled/
    )
  }).timeout(SLOW)

  it('treats an abandoned recipient prompt as a cancellation', async () => {
    await interactively(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--grpc', DEAD_NODE],
      [{expect: /Enter Recipient QRL Address/, send: [], eof: true}],
      /Operation cancelled/
    )
  }).timeout(SLOW)

  it('treats an abandoned sender question as a cancellation', async () => {
    await interactively(
      ['token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
        '--amount', '5', '--otsindex', '0', '--grpc', DEAD_NODE],
      [{expect: /specify the sender wallet/, send: [], eof: true}],
      /Operation cancelled/
    )
  }).timeout(SLOW)
})


describe('token commands against an unreachable node', () => {
  useFixtures()

  // The last gate before the network. These reach the gRPC connection attempt, which is what
  // exercises wallet loading, XMSS reconstruction and endpoint selection end to end.
  it('token:transfer reports a connection failure rather than hanging', async () => {
    const {code, out} = await run([
      'token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
      '--amount', '5', '--otsindex', '0', '--wallet', PLAIN_WALLET, '--grpc', DEAD_NODE,
    ])
    assert.notStrictEqual(code, 0)
    assert.ok(
      /Failed to connect|connection|refused|Custom GRPC endpoint/i.test(out),
      `expected a connection failure, got:\n${out}`
    )
  }).timeout(120000)

  it('token:create reports a connection failure rather than hanging', async () => {
    const {code, out} = await run([
      'token:create', '--symbol', 'TST', '--name', 'Test Token',
      '--holder', `${VALID_ADDRESS}:100`, '--otsindex', '0',
      '--wallet', PLAIN_WALLET, '--grpc', DEAD_NODE,
    ])
    assert.notStrictEqual(code, 0)
    assert.ok(
      /Failed to connect|connection|refused|Custom GRPC endpoint/i.test(out),
      `expected a connection failure, got:\n${out}`
    )
  }).timeout(120000)

})

// ///////////////////////////////////////////////////////////////////////////
// token:create / token:transfer — what happens once a node has answered
//
// Everything above stops at a validation gate or at a closed loopback port, so
// the half of each command that runs after the node replies — the request it
// builds, the binding check that decides whether to sign at all, the signature
// itself and the push — was unreachable.
//
// These cases run both commands in *this* process against a stub gRPC client.
// src/functions/grpc is swapped in the require cache for the moment it takes to
// require each command (they capture Qrlnode at require time), then the real
// module is put straight back. There is no server and no socket.
//
// The signing is real: a throwaway height-6 wallet built in before() is used to
// produce genuine XMSS signatures. Nothing is ever pushed to a network, so no
// on-chain OTS key is spent — the wallet exists only for this file.
// ///////////////////////////////////////////////////////////////////////////

// kleur colours by environment variable rather than by isTTY, so captured
// output still carries escape sequences. Strip them before matching.
const TOKEN_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

// Behaviour the stub should show for the test currently running. Reset per test.
let tokenNode = {}
let tokenCalls = []
let tokenConnectAttempts = 0

class TokenFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    tokenConnectAttempts += 1
    if (tokenNode.connectThrows) {
      throw new Error(tokenNode.connectThrows)
    }
    const connectsOn = tokenNode.connectsOnAttempt === undefined ? 1 : tokenNode.connectsOnAttempt
    if (connectsOn !== 0 && tokenConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    tokenCalls.push({name, request})
    if (name === 'PushTransaction') {
      if (tokenNode.pushThrows) {
        throw new Error(tokenNode.pushThrows)
      }
      return tokenNode.pushResponse || {tx_hash: Buffer.from('cd'.repeat(32), 'hex')}
    }
    if (tokenNode.buildThrows) {
      throw new Error(tokenNode.buildThrows)
    }
    const built = tokenNode.build(request)
    return tokenNode.tamper ? tokenNode.tamper(built) : built
  }
}

// Require both commands against the stub, then restore the real client.
const tokenGrpcPath = require.resolve('../../src/functions/grpc')
const tokenCreatePath = require.resolve('../../src/commands/token/create')
const tokenTransferPath = require.resolve('../../src/commands/token/transfer')

const tokenRealGrpcEntry = require.cache[tokenGrpcPath]
require.cache[tokenGrpcPath] = {
  id: tokenGrpcPath,
  filename: tokenGrpcPath,
  path: path.dirname(tokenGrpcPath),
  loaded: true,
  children: [],
  paths: [],
  exports: TokenFakeQrlNode,
}
const TokenCreate = require('../../src/commands/token/create')
const TokenTransfer = require('../../src/commands/token/transfer')

if (tokenRealGrpcEntry) {
  require.cache[tokenGrpcPath] = tokenRealGrpcEntry
} else {
  delete require.cache[tokenGrpcPath]
}

// Run the command here, against the stub, capturing everything it prints (this.log
// and console.log go to stdout, the ora spinners go to stderr). run() awaits the whole
// signing and pushing sequence, so an exit inside it arrives as a thrown ExitError.
async function runTokenInProcess(Cmd, argv) {
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
    await Cmd.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  // kleur colours by environment variable rather than by isTTY, so the captured output
  // still carries escape sequences here. Strip them so the assertions read as the text a
  // person would see.
  return {code, out: chunks.join('').replace(TOKEN_ANSI, '')}
}

const TOKEN_SYMBOL = 'TST'
const TOKEN_NAME = 'Test Token'
const TOKEN_PUSH_HASH = 'cd'.repeat(32)

// What an honest node returns for GetTokenTxn: the request echoed back in the
// shape the proto loader produces, with every uint64 as a string.
const buildTokenCreateResponse = request => ({
  extended_transaction_unsigned: {
    tx: {
      master_addr: Buffer.from(request.master_addr),
      fee: String(request.fee),
      token: {
        symbol: Buffer.from(request.symbol),
        name: Buffer.from(request.name),
        owner: Buffer.from(request.owner),
        decimals: String(request.decimals),
        initial_balances: request.initial_balances.map(item => ({
          address: Buffer.from(item.address),
          amount: String(item.amount),
        })),
      },
    },
  },
})

// The same for GetTransferTokenTxn. Note the token hash comes back as the raw
// 32 bytes even though it was sent as an ASCII hex string.
const buildTokenTransferResponse = request => ({
  extended_transaction_unsigned: {
    tx: {
      master_addr: Buffer.from(request.master_addr),
      fee: String(request.fee),
      transfer_token: {
        token_txhash: Buffer.from(request.token_txhash.toString(), 'hex'),
        addrs_to: request.addresses_to.map(item => Buffer.from(item)),
        amounts: request.amounts.map(String),
      },
    },
  },
})

// The prompts only run when stdin and stdout are terminals. Fake the terminal and
// stand in for `prompts`, which both commands require lazily inside run().
function stubTokenPrompts(fake) {
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

// Answer each prompt by name; anything not listed is left unanswered, which is
// what `prompts` returns when the person cancels.
function tokenAnswering(answers) {
  return async options =>
    (Object.prototype.hasOwnProperty.call(answers, options.name) ? {[options.name]: answers[options.name]} : {})
}

async function runTokenInteractive(Cmd, argv, answers) {
  const restorePrompts = stubTokenPrompts(tokenAnswering(answers))
  const savedStdout = process.stdout.isTTY
  const savedStdin = process.stdin.isTTY
  process.stdout.isTTY = true
  process.stdin.isTTY = true
  try {
    return await runTokenInProcess(Cmd, argv)
  } finally {
    process.stdout.isTTY = savedStdout
    process.stdin.isTTY = savedStdin
    restorePrompts()
  }
}

describe('token: signing and pushing what a node returned', () => {
  useFixtures()

  // Last describe in the file, so this is where the shared wallet fixtures go.
  after(() => {
    // These cached modules hold the stubbed Qrlnode; drop them so anything
    // requiring them later in the same process gets the real client back.
    delete require.cache[tokenCreatePath]
    delete require.cache[tokenTransferPath]
    fs.rmSync(FIXTURES, {recursive: true, force: true})
  })

  beforeEach(() => {
    tokenNode = {build: buildTokenCreateResponse}
    tokenCalls = []
    tokenConnectAttempts = 0
  })

  const createArgs = (extra = []) => [
    '-s', TOKEN_SYMBOL,
    '-n', TOKEN_NAME,
    '-d', '9',
    '-H', `${VALID_ADDRESS}:1000`,
    '-i', '0',
    '-w', PLAIN_WALLET,
    '-g', DEAD_NODE,
    ...extra,
  ]

  const transferArgs = (extra = []) => [
    '-x', VALID_TOKEN_HASH,
    '-r', VALID_ADDRESS,
    '-a', '5',
    '-i', '1',
    '-w', PLAIN_WALLET,
    '-g', DEAD_NODE,
    ...extra,
  ]

  describe('token:create', () => {
    it('sends the symbol, name, owner and holders it was given', async function sends() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 0, out)
      const build = tokenCalls.find(c => c.name === 'GetTokenTxn')
      assert.ok(build, `no GetTokenTxn call was made\n--- output ---\n${out}`)
      assert.strictEqual(build.request.symbol.toString(), TOKEN_SYMBOL)
      assert.strictEqual(build.request.name.toString(), TOKEN_NAME)
      assert.strictEqual(build.request.decimals, 9)
      // the owner is the wallet's own address, not one of the holders
      assert.strictEqual(`Q${build.request.owner.toString('hex')}`, plainWallet.address)
      assert.deepStrictEqual(build.request.initial_balances.map(b => b.amount), [1000])
      assert.strictEqual(`Q${build.request.initial_balances[0].address.toString('hex')}`, VALID_ADDRESS)
      // default fee, since none was given
      assert.strictEqual(build.request.fee, 100)
    })

    it('signs, pushes, and reports the values it committed to', async function reports() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs(['-f', '250']))
      assert.strictEqual(code, 0, out)
      assert.ok(/Transaction signed with OTS key 0/.test(out), out)
      assert.ok(out.includes(`Token Symbol:       ${TOKEN_SYMBOL}`), out)
      assert.ok(out.includes(`Token Name:         ${TOKEN_NAME}`), out)
      assert.ok(out.includes('Decimals:           9'), out)
      assert.ok(out.includes('Fee (Shor):         250'), out)
      assert.ok(out.includes(`${VALID_ADDRESS}: 1000`), out)
      assert.ok(out.includes(`Token Creation TxID: ${TOKEN_PUSH_HASH}`), out)

      // the pushed transaction is the one that was signed, and it carries a signature
      const push = tokenCalls.find(c => c.name === 'PushTransaction')
      assert.ok(push, 'nothing was pushed')
      assert.ok(push.request.transaction_signed.signature.length > 0, 'pushed without a signature')
      assert.strictEqual(push.request.transaction_signed.fee, '250')
    })

    it('prints the same values as JSON when asked', async function json() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs(['-j']))
      assert.strictEqual(code, 0, out)
      const parsed = JSON.parse(out.slice(out.indexOf('{')))
      assert.strictEqual(parsed.symbol, TOKEN_SYMBOL)
      assert.strictEqual(parsed.name, TOKEN_NAME)
      assert.strictEqual(parsed.decimals, '9')
      assert.strictEqual(parsed.fee, '100')
      assert.deepStrictEqual(parsed.initialBalances, [{address: VALID_ADDRESS, amount: '1000'}])
      assert.strictEqual(parsed.txhash, TOKEN_PUSH_HASH)
      assert.strictEqual(parsed.status, 'SUBMITTED')
    })

    it('retries the connection until the node answers', async function retries() {
      this.timeout(SLOW)
      tokenNode = {build: buildTokenCreateResponse, connectsOnAttempt: 3}
      const {code} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 0)
      assert.strictEqual(tokenConnectAttempts, 3)
    })

    it('refuses to sign a response that changed the token owner', async function tamperedOwner() {
      this.timeout(SLOW)
      // The owner holds the minting rights. A node that rewrites it and gets a
      // signature has taken the token; nothing may be signed here.
      tokenNode = {
        build: buildTokenCreateResponse,
        tamper: response => {
          const {tx} = response.extended_transaction_unsigned
          tx.token.owner = Buffer.from(SECOND_ADDRESS.substring(1), 'hex')
          return response
        },
      }
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/token owner/.test(out), out)
      assert.ok(/Nothing was signed, no OTS key was used, and no token has been created/.test(out), out)
      assert.strictEqual(tokenCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
    })

    it('refuses to sign a response that changed a holder amount', async function tamperedAmount() {
      this.timeout(SLOW)
      tokenNode = {
        build: buildTokenCreateResponse,
        tamper: response => {
          const {tx} = response.extended_transaction_unsigned
          tx.token.initial_balances[0].amount = '999999'
          return response
        },
      }
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/initial balances amount at position 0/.test(out), out)
      assert.strictEqual(tokenCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
    })

    it('reports a signing failure that is not a binding failure', async function badOts() {
      this.timeout(SLOW)
      // OTS index 999 does not exist in a height-6 tree, so the response binds
      // cleanly and xmss.sign() is what fails.
      const args = [
        '-s', TOKEN_SYMBOL,
        '-n', TOKEN_NAME,
        '-H', `${VALID_ADDRESS}:1000`,
        '-i', '999',
        '-w', PLAIN_WALLET,
        '-g', DEAD_NODE,
      ]
      const {code, out} = await runTokenInProcess(TokenCreate, args)
      assert.strictEqual(code, 1, out)
      assert.strictEqual(tokenCalls.filter(c => c.name === 'PushTransaction').length, 0)
    })

    it('reports a node that refuses to build the transaction', async function buildRefused() {
      this.timeout(SLOW)
      tokenNode = {buildThrows: 'invalid token symbol'}
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/invalid token symbol/.test(out), out)
    })

    it('reports a node that rejects the push', async function pushRejected() {
      this.timeout(SLOW)
      tokenNode = {
        build: buildTokenCreateResponse,
        pushResponse: {error_code: 'INVALID', error_description: 'token symbol already exists'},
      }
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/token symbol already exists/.test(out), out)
    })

    it('reports a gRPC failure during the push', async function pushFailed() {
      this.timeout(SLOW)
      tokenNode = {build: buildTokenCreateResponse, pushThrows: 'stream removed'}
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/stream removed/.test(out), out)
    })

    it('reports a connection that fails outright', async function connectFailed() {
      this.timeout(SLOW)
      tokenNode = {connectThrows: 'no route to host'}
      const {code, out} = await runTokenInProcess(TokenCreate, createArgs())
      assert.strictEqual(code, 1, out)
      assert.strictEqual(tokenCalls.length, 0, 'nothing may be asked of a node that never connected')
    })

    it('reports a hexseed the XMSS library cannot use', async function badSeed() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInProcess(
        TokenCreate,
        createArgs(['-h', UNPARSEABLE_HEXSEED])
      )
      assert.strictEqual(code, 1, out)
      assert.strictEqual(tokenCalls.length, 0, 'no node is contacted when the key cannot be rebuilt')
    })
  })

  describe('token:transfer', () => {
    beforeEach(() => {
      tokenNode = {build: buildTokenTransferResponse}
    })

    it('sends the token hash as ASCII hex and the recipient as bytes', async function sends() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 0, out)
      const build = tokenCalls.find(c => c.name === 'GetTransferTokenTxn')
      assert.ok(build, `no GetTransferTokenTxn call was made\n--- output ---\n${out}`)
      // the node decodes this field as text, so it must not be sent as raw bytes
      assert.strictEqual(build.request.token_txhash.toString(), VALID_TOKEN_HASH)
      assert.strictEqual(`Q${build.request.addresses_to[0].toString('hex')}`, VALID_ADDRESS)
      assert.deepStrictEqual(build.request.amounts, [5])
      assert.strictEqual(build.request.fee, 100)
    })

    it('signs, pushes, and reports the values it committed to', async function reports() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInProcess(
        TokenTransfer,
        transferArgs(['-f', '300'])
      )
      assert.strictEqual(code, 0, out)
      assert.ok(/Transaction signed with OTS key 1/.test(out), out)
      assert.ok(out.includes(`Recipient Address:   ${VALID_ADDRESS}`), out)
      assert.ok(out.includes(`Token TxID (Hash):   ${VALID_TOKEN_HASH}`), out)
      assert.ok(out.includes('Amount Transferred:  5'), out)
      assert.ok(out.includes('Fee (Shor):          300'), out)
      assert.ok(out.includes(`Transaction TxID:    ${TOKEN_PUSH_HASH}`), out)

      const push = tokenCalls.find(c => c.name === 'PushTransaction')
      assert.ok(push.request.transaction_signed.signature.length > 0, 'pushed without a signature')
    })

    it('prints the same values as JSON when asked', async function json() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInProcess(
        TokenTransfer,
        transferArgs(['-j'])
      )
      assert.strictEqual(code, 0, out)
      const parsed = JSON.parse(out.slice(out.indexOf('{')))
      assert.deepStrictEqual(parsed, {
        recipient: VALID_ADDRESS,
        tokenHash: VALID_TOKEN_HASH,
        amount: '5',
        fee: '100',
        txhash: TOKEN_PUSH_HASH,
        status: 'SUBMITTED',
      })
    })

    it('refuses to sign a response that redirected the transfer', async function tamperedRecipient() {
      this.timeout(SLOW)
      // The whole point of the binding check: a node that swaps the recipient
      // gets a valid signature over its own transaction unless this refuses.
      tokenNode = {
        build: buildTokenTransferResponse,
        tamper: response => {
          const {tx} = response.extended_transaction_unsigned
          tx.transfer_token.addrs_to = [Buffer.from(SECOND_ADDRESS.substring(1), 'hex')]
          return response
        },
      }
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/transfer recipient at position 0/.test(out), out)
      assert.ok(/Nothing was signed, no OTS key was used, and no funds have moved/.test(out), out)
      assert.strictEqual(tokenCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
    })

    it('refuses to sign a response that changed the token being sent', async function tamperedHash() {
      this.timeout(SLOW)
      tokenNode = {
        build: buildTokenTransferResponse,
        tamper: response => {
          const {tx} = response.extended_transaction_unsigned
          tx.transfer_token.token_txhash = Buffer.alloc(32, 0xAB)
          return response
        },
      }
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/token hash/.test(out), out)
    })

    it('refuses to sign a response that changed the fee', async function tamperedFee() {
      this.timeout(SLOW)
      tokenNode = {
        build: buildTokenTransferResponse,
        tamper: response => {
          const {tx} = response.extended_transaction_unsigned
          tx.fee = '100000000'
          return response
        },
      }
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/fee/.test(out), out)
    })

    it('reports a signing failure that is not a binding failure', async function badOts() {
      this.timeout(SLOW)
      // OTS index 999 does not exist in a height-6 tree, so the response binds
      // cleanly and xmss.sign() is what fails.
      const args = [
        '-x', VALID_TOKEN_HASH,
        '-r', VALID_ADDRESS,
        '-a', '5',
        '-i', '999',
        '-w', PLAIN_WALLET,
        '-g', DEAD_NODE,
      ]
      const {code, out} = await runTokenInProcess(TokenTransfer, args)
      assert.strictEqual(code, 1, out)
      assert.ok(/Failed to sign transaction/.test(out), out)
      assert.strictEqual(tokenCalls.filter(c => c.name === 'PushTransaction').length, 0)
    })

    it('reports a node that refuses to build the transaction', async function buildRefused() {
      this.timeout(SLOW)
      tokenNode = {buildThrows: 'unknown token'}
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/unknown token/.test(out), out)
    })

    it('reports a node that rejects the push', async function pushRejected() {
      this.timeout(SLOW)
      tokenNode = {
        build: buildTokenTransferResponse,
        pushResponse: {error_code: 'INVALID', error_description: 'insufficient token balance'},
      }
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 1, out)
      assert.ok(/insufficient token balance/.test(out), out)
    })

    it('reports a gRPC failure during the push', async function pushFailed() {
      this.timeout(SLOW)
      tokenNode = {build: buildTokenTransferResponse, pushThrows: 'stream removed'}
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 1, out)
    })

    it('retries the connection until the node answers', async function retries() {
      this.timeout(SLOW)
      tokenNode = {build: buildTokenTransferResponse, connectsOnAttempt: 3}
      const {code} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 0)
      assert.strictEqual(tokenConnectAttempts, 3)
    })

    it('reports a connection that fails outright', async function connectFailed() {
      this.timeout(SLOW)
      tokenNode = {connectThrows: 'no route to host'}
      const {code, out} = await runTokenInProcess(TokenTransfer, transferArgs())
      assert.strictEqual(code, 1, out)
      assert.strictEqual(tokenCalls.length, 0)
    })
  })
  describe('cancelled prompts', () => {
    // A cancelled numeric prompt answers with nothing at all, and the conversion to
    // a string used to throw a TypeError one line ahead of the check meant to catch
    // it. Each of these leaves exactly one prompt unanswered.
    it('exits cleanly when token:create loses the OTS index prompt', async function createOts() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInteractive(
        TokenCreate,
        ['-s', TOKEN_SYMBOL, '-n', TOKEN_NAME, '-d', '9', '-H', `${VALID_ADDRESS}:1000`, '-g', DEAD_NODE],
        {}
      )
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.ok(!/TypeError/.test(out), out)
      assert.strictEqual(tokenCalls.length, 0, 'no node is contacted without an OTS index')
    })

    it('exits cleanly when token:transfer loses the amount prompt', async function transferAmount() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInteractive(
        TokenTransfer,
        ['-x', VALID_TOKEN_HASH, '-r', VALID_ADDRESS, '-g', DEAD_NODE],
        {}
      )
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.ok(!/TypeError/.test(out), out)
    })

    it('exits cleanly when token:transfer loses the OTS index prompt', async function transferOts() {
      this.timeout(SLOW)
      const {code, out} = await runTokenInteractive(
        TokenTransfer,
        ['-x', VALID_TOKEN_HASH, '-r', VALID_ADDRESS, '-a', '5', '-g', DEAD_NODE],
        {}
      )
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.ok(!/TypeError/.test(out), out)
    })

    it('accepts OTS index zero from token:create, which is a valid answer', async function otsZero() {
      this.timeout(SLOW)
      // 0 is falsy, so it has to survive the cancellation check rather than be
      // mistaken for no answer at all.
      const {code, out} = await runTokenInteractive(
        TokenCreate,
        ['-s', TOKEN_SYMBOL, '-n', TOKEN_NAME, '-d', '9', '-H', `${VALID_ADDRESS}:1000`,
          '-w', PLAIN_WALLET, '-g', DEAD_NODE],
        {otsindex: 0}
      )
      assert.strictEqual(code, 0, out)
      assert.ok(/Transaction signed with OTS key 0/.test(out), out)
    })
  })
})
