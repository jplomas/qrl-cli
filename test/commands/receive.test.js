const assert = require('assert')
const {spawn} = require('child_process')

const testSetup = require('../test_setup')

const processFlags = {
  detached: true,
  stdio: 'inherit',
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
  before(done => {
    const args = [
      'receive',
      testSetup.encWalletFile,
      '-p',
      'wrongPassword'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad password to encrypted wallet', () => {
    assert.notStrictEqual(exitCode, 0)
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
