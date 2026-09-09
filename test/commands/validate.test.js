const assert = require('assert')
const {spawn} = require('child_process')

const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

describe('validate', () => {
  let exitCode
  before(done => {
    const args = [
      'validate',
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

describe('validate', () => {
  let exitCode
  before(done => {
    const args = [
      'validate',
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

describe('validate', () => {
  let exitCode
  before(done => {
    const args = [
      'validate',
      '-q',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if passed with a valid address as argument & quiet flag', () => {
    assert.strictEqual(exitCode, 0)
  })
})

describe('validate', () => {
  let exitCode
  before(done => {
    const args = [
      'validate',
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
describe('validate', () => {
  let exitCode
  before(done => {
    const args = [
      'validate',
      'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f4',
      '-q',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with an invalid address as argument & quiet flag', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// ///////////////////////////////////////////////////////////////////////////
// Everything below is additional coverage for the paths the cases above never
// reach: the two output modes, the stdin/pipe entry points, and the
// interactive prompt.
//
// `validate` is pure local address validation -- no node is involved -- so all
// of this is offline by construction.
// ///////////////////////////////////////////////////////////////////////////

const Module = require('module')

const ROOT = require('path').join(__dirname, '..', '..')

// kleur colours its output even into a pipe; strip the escapes before matching.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const VALID = 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3'
const BAD_CHECKSUM = 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f4'

// Run the CLI as a child process, optionally feeding it stdin, and capture what
// it said rather than letting it write into the test output.
function run(args, stdin) {
  return new Promise(resolve => {
    const child = spawn('./bin/run', args, {
      stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
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

// The interactive branch only runs when both streams are TTYs, which a spawned
// child with pipes can never be. Drive the command in-process instead, with the
// TTY flags forced on and `prompts` replaced by a stub.
function stubPrompts(fake) {
  const promptsPath = require.resolve('prompts')
  const saved = require.cache[promptsPath]
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

// oclif's help layer measures the terminal at require time, so both it and the
// command have to be loaded before the TTY flags are forced on.
let oclifConfig
let Validate

before(async () => {
  // eslint-disable-next-line global-require
  oclifConfig = await require('@oclif/config').load(ROOT)
  // eslint-disable-next-line global-require
  Validate = require('../../src/commands/validate')
})

async function runInteractive(argv, fakePrompts) {
  const restorePrompts = stubPrompts(fakePrompts)
  const savedStdout = process.stdout.isTTY
  const savedStdin = process.stdin.isTTY
  const savedWrite = process.stdout.write
  const savedWindowSize = process.stdout.getWindowSize
  let out = ''
  process.stdout.isTTY = true
  process.stdin.isTTY = true
  if (!process.stdout.getWindowSize) {
    process.stdout.getWindowSize = () => [80, 24]
  }
  process.stdout.write = chunk => {
    out += chunk.toString()
    return true
  }
  try {
    const cmd = new Validate(argv, oclifConfig)
    await cmd.run()
    return {code: 0, out: out.replace(ANSI, '')}
  } catch (error) {
    const code = error.oclif ? error.oclif.exit : 1
    return {code, out: out.replace(ANSI, '')}
  } finally {
    process.stdout.write = savedWrite
    process.stdout.getWindowSize = savedWindowSize
    process.stdout.isTTY = savedStdout
    process.stdin.isTTY = savedStdin
    restorePrompts()
  }
}

describe('validate: what it actually reports', () => {
  it('names every check it performed for a valid address', async () => {
    // The exit code alone cannot tell a user which property failed, so the
    // per-check lines are the real output of this command.
    const {code, out} = await run(['validate', VALID])
    assert.strictEqual(code, 0)
    assert.ok(/Length: 79 characters/.test(out), out)
    assert.ok(/Starts with Q/.test(out), out)
    assert.ok(/Signature scheme: XMSS/.test(out), out)
    assert.ok(/Hash: SHAKE-128/.test(out), out)
    assert.ok(/Tree height: /.test(out), out)
    assert.ok(/Checksum/.test(out), out)
    assert.ok(/VALID/.test(out), out)
  })

  it('marks an address that fails only its checksum as INVALID', async () => {
    // This address differs from the valid one by a single trailing character:
    // everything except the checksum passes, which is exactly the case a user
    // hits after a typo, and exactly the case that must not be reported valid.
    const {code, out} = await run(['validate', BAD_CHECKSUM])
    assert.notStrictEqual(code, 0)
    assert.ok(/INVALID/.test(out), out)
  })

  it('prints nothing but the exit code in quiet mode', async () => {
    const {code, out} = await run(['validate', '-q', VALID])
    assert.strictEqual(code, 0)
    assert.strictEqual(out.trim(), '')
  })

  it('emits parseable JSON with --json, and json wins over quiet', async () => {
    const {code, out} = await run(['validate', '--json', '--quiet', VALID])
    assert.strictEqual(code, 0)
    const parsed = JSON.parse(out)
    assert.strictEqual(parsed.result, true)
    assert.strictEqual(parsed.checksum.result, true)
    assert.strictEqual(parsed.startQ.result, true)
  })

  it('still exits non-zero for an invalid address in JSON mode', async () => {
    const {code, out} = await run(['validate', '-j', BAD_CHECKSUM])
    assert.notStrictEqual(code, 0)
    const parsed = JSON.parse(out)
    assert.strictEqual(parsed.result, false)
    assert.strictEqual(parsed.checksum.result, false)
  })
})

describe('validate: reading the address from stdin', () => {
  it('reads a piped address when no argument is given', async () => {
    const {code, out} = await run(['validate'], `${VALID}\n`)
    assert.strictEqual(code, 0)
    assert.ok(/VALID/.test(out), out)
  })

  it('reads a piped address when the argument is "-"', async () => {
    const {code, out} = await run(['validate', '-'], `${VALID}\n`)
    assert.strictEqual(code, 0)
    assert.ok(/VALID/.test(out), out)
  })

  it('rejects a piped address that is invalid', async () => {
    const {code, out} = await run(['validate', '-'], `${BAD_CHECKSUM}\n`)
    assert.notStrictEqual(code, 0)
    assert.ok(/INVALID/.test(out), out)
  })

  it('reports the missing address when stdin is empty and there is no TTY', async () => {
    const {code, out} = await run(['validate'], '')
    assert.notStrictEqual(code, 0)
    assert.ok(/Missing QRL address to validate/.test(out), out)
  })
})

describe('validate: the interactive prompt', () => {
  it('validates an address typed at the prompt', async () => {
    let asked
    const {code, out} = await runInteractive([], async options => {
      asked = options
      return {address: VALID}
    })
    assert.strictEqual(code, 0)
    assert.ok(/VALID/.test(out), out)
    assert.strictEqual(asked.name, 'address')
    assert.strictEqual(asked.type, 'text')
  })

  it('refuses an empty answer at the prompt rather than validating nothing', async () => {
    // The prompt's own validator is the only thing standing between an
    // accidental <enter> and a "validation" of the empty string.
    let asked
    await runInteractive([], async options => {
      asked = options
      return {address: VALID}
    })
    assert.strictEqual(asked.validate(''), 'Address is required')
    assert.strictEqual(asked.validate(VALID), true)
  })

  it('exits non-zero when the prompt is cancelled', async () => {
    const {code, out} = await runInteractive([], async () => ({}))
    assert.notStrictEqual(code, 0)
    assert.ok(/Operation cancelled/.test(out), out)
  })
})
