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
const {spawn} = require('child_process')
const path = require('path')

const setup = require('../test_setup')

// A closed port on loopback: the CLI resolves it, fails to connect, and exits.
// Deterministic, and it never leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

const VALID_ADDRESS = 'Q000300cc040d28c309c8e82d1397aa0d9b74666b492f77b485d327bf5496a725b7b8a3c024b9ee'
const VALID_TOKEN_HASH = '9d3f463b300012292eac668768f2969125ae540b1cdef7c99f6fea448e736af8'
const NOT_A_WALLET = path.join(__dirname, '..', 'test-wallet', 'does-not-exist.json')

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

describe('token commands against an unreachable node', () => {
  // The last gate before the network. These reach the gRPC connection attempt, which is what
  // exercises wallet loading, XMSS reconstruction and endpoint selection end to end.
  it('token:transfer reports a connection failure rather than hanging', async () => {
    const {code, out} = await run([
      'token:transfer', '--tokenHash', VALID_TOKEN_HASH, '--recipient', VALID_ADDRESS,
      '--amount', '5', '--otsindex', '0', '--wallet', setup.walletFile, '--grpc', DEAD_NODE,
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
      '--wallet', setup.walletFile, '--grpc', DEAD_NODE,
    ])
    assert.notStrictEqual(code, 0)
    assert.ok(
      /Failed to connect|connection|refused|Custom GRPC endpoint/i.test(out),
      `expected a connection failure, got:\n${out}`
    )
  }).timeout(120000)
})
