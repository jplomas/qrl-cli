// ///////////////////////////////////////////////////////////////////////////
// stdin-helper test
//
// readStdin is how a hexseed or mnemonic gets piped into the CLI without
// appearing in the process list or shell history, so its edge cases are worth
// pinning: an interactive terminal must not block waiting for input, and a
// producer that never closes the stream must not hang the command forever.
//
// process.stdin is replaced with an in-memory stream for the duration, and
// restored afterwards.
// ///////////////////////////////////////////////////////////////////////////

const assert = require('assert')
const {PassThrough} = require('stream')

const {readStdin} = require('../../src/functions/stdin-helper')

const originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin')

function useFakeStdin(isTTY = false) {
  const fake = new PassThrough()
  fake.isTTY = isTTY
  // readStdin calls pause() during cleanup; PassThrough has it, but not setEncoding
  // semantics identical to a tty, which is fine for these tests.
  Object.defineProperty(process, 'stdin', {value: fake, configurable: true})
  return fake
}

describe('functions/stdin-helper', () => {
  afterEach(() => {
    Object.defineProperty(process, 'stdin', originalStdin)
  })

  it('resolves empty immediately on an interactive terminal', async () => {
    // Without this, running a command with no piped input would sit waiting for EOF.
    useFakeStdin(true)
    assert.strictEqual(await readStdin(), '')
  })

  it('reads piped input and trims it', async () => {
    const fake = useFakeStdin()
    const result = readStdin()
    fake.write('  a-hexseed-value\n')
    fake.end()
    assert.strictEqual(await result, 'a-hexseed-value')
  })

  it('concatenates input arriving in several chunks', async () => {
    const fake = useFakeStdin()
    const result = readStdin()
    fake.write('first ')
    fake.write('second ')
    fake.write('third')
    fake.end()
    assert.strictEqual(await result, 'first second third')
  })

  it('gives up after its timeout if the producer never closes the stream', async () => {
    // A pipe that stays open would otherwise hang the CLI indefinitely.
    const fake = useFakeStdin()
    const started = Date.now()
    const result = readStdin()
    fake.write('partial input')
    // deliberately never call end()
    assert.strictEqual(await result, 'partial input')
    assert.ok(Date.now() - started >= 90, 'resolved via the timeout, not via end')
  })

  it('resolves empty when the stream closes with nothing on it', async () => {
    const fake = useFakeStdin()
    const result = readStdin()
    fake.end()
    assert.strictEqual(await result, '')
  })

  it('removes its listeners, so a second read is unaffected by the first', async () => {
    const fake = useFakeStdin()
    const first = readStdin()
    fake.write('one')
    fake.end()
    assert.strictEqual(await first, 'one')
    assert.strictEqual(fake.listenerCount('data'), 0)
    assert.strictEqual(fake.listenerCount('end'), 0)
  })
})
