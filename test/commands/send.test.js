const assert = require('assert')
const {spawn} = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const testSetup = require('../test_setup')

// Suites that need a reachable node (skipped in offline mode). These push a signed transaction
// to the network, so they must never run as part of an offline/no-node test pass.
const describeOnline = process.env.QRL_TEST_OFFLINE === 'true' ? describe.skip : describe


const processFlags = {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
}

// no args given
describe('send #1a', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without any arguments/flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// not enough args given
describe('send #1b', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without OTS arguments/flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// no args given
describe('send #1c', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without recipient arguments/flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// no args given
describe('send #1d', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-i', '1',
      '-r', 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed without wallet/keys arguments/flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad args

// recipient address is bad
describe('send #2a', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-i', '1',
      '-r', 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227fg',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-f', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with bad recipient address arguments/flags', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// multiple outputs
describe('send #2b', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-i', '1',
      '-f', '1',
      '-R', 'outputs.json',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-r', 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with more than one source of outputs -R and -r', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// multiple outputs
describe('send #2c', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-f', '1',
      '-i', '1',
      '-R', 'outputs.json',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with more than one source of outputs -R and -j', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// multiple outputs
describe('send #2d', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-i', '1',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-r', 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with more than one source of outputs -j and -r', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// multiple outputs
describe('send #2e', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-i', '1',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-R', 'outputs.json',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with more than one source of outputs -j and -R', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// shor passed with json
describe('send #2f', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-i', '1',
      '-s',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with the --shor flag', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// no hexseed passed
describe('send #2g', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if no wallet or hexseed passed', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad hexseed passed
describe('send #2f', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb1396',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with bad hexseed', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad json passed
describe('send #2g', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with bad JSON data', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// incorrect json data passed
describe('send #2h', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"To":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with incorrect formatted JSON data, TO not to', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// incorrect json data passed bad address
describe('send #2i', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with incorrect formatted JSON data, invalid qrl address', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// incorrect json data passed shor
describe('send #2j', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","Shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shore":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with incorrect formatted JSON data, shor v Shor', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// incorrect wallet file
describe('send #2k', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-R', testSetup.badWallet,
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using wallet file that does not exist.', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

describe('send #2l', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb13967',
      '-i', '1',
      '-r', 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f4',
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed with an invalid QRL address as recipient', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad password for encrypted wallet
describe('send #2m', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-w', testSetup.encWalletFile,
      '-i', '1',
      '-p', 'test321' // wrong password
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with a bad wallet password', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad password for encrypted wallet
describe('send #2n', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-w', testSetup.badWalletFile,
      '-i', '1',

    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with a invalid wallet file', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad hexseed, too short
describe('send #2o', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb1396',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with a invalid hexseed - too short', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad mnemonic too short
describe('send #2p', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', 'aback filled atop regal town opaque gloss send cheek ten fisher cow once home remain module aye salt chord before bunch stiff heel won attend reduce heroic oak shrug midday king fit islam',
      '-i', '1',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with a invalid mnemonic', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// bad OTS
describe('send #2q', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', 'aback filled atop regal town opaque gloss send cheek ten fisher cow once home remain module aye salt chord before bunch stiff heel won attend reduce heroic oak shrug midday king fit islam appear',
      '-i', 'a',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with a invalid OTS key', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

describe('send #2r', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-j', '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
      '-h', 'aback filled atop regal town opaque gloss send cheek ten fisher cow once home remain module aye salt chord before bunch stiff heel won attend reduce heroic oak shrug midday king fit islam appear',
      '-i', '1',
      '-f', '.01'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if using a json source of output with an invalid fee', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// message data over 80 bites
describe('send #2s', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-r', 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
      '-h', 'aback filled atop regal town opaque gloss send cheek ten fisher cow once home remain module aye salt chord before bunch stiff heel won attend reduce heroic oak shrug midday king fit islam appear',
      '-i', '1',
      '-f', '.01',
      '-M', 'here is a long message exactly 81 bytes long and consisting of tons of words etc.'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed message with too long content', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// load from file with additional args
describe('send #2t', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '-F', testSetup.sendTXOfflineFile,
      '-f', '1'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if passed message with too long content', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})


// load from bad json offline file
describe('send #2u', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '-F', testSetup.badWallet,
      '-f', '1'
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if bad send content provided in JSON', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// save to file with bad location - can not write to root
describe('send #2v', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '10',
      '-r', 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
      '-h', 'aback filled atop regal town opaque gloss send cheek ten fisher cow once home remain module aye salt chord before bunch stiff heel won attend reduce heroic oak shrug midday king fit islam appear',
      '-i', '10',
      '-T', '/root/send_tx.json',
      '-t',
      '-s',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be non-0 if saving to file with save location non-writable', () => {
    assert.notStrictEqual(exitCode, 0)
  })
})

// successful send

// save to file 
describe('send #3a', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '0',
      '-r', 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
      '-h', 'aback filled atop regal town opaque gloss send cheek ten fisher cow once home remain module aye salt chord before bunch stiff heel won attend reduce heroic oak shrug midday king fit islam appear',
      '-i', '10',
      '-t', 
      '-s',
      '-T',
      testSetup.sendTXOfflineFile
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if offline send tx saved to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// save to file with enc wallet
describe('send #3a', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '0',
      '-r', 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
      '-w', testSetup.aliceENCWalletLocation,
      '-p', testSetup.aliceEncPass,
      '-i', '10',
      '-t', 
      '-s',
      '-T',
      testSetup.sendTXOfflineFile
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if offline send tx saved to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})



// load from a file 
describeOnline('send #3b', () => {
  let exitCode
  before(done => {
    const args = [
      'send',
      '-F', testSetup.sendTXOfflineFile,
      '-t',
    ]
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if offline send tx saved to file', () => {
    assert.strictEqual(exitCode, 0)
  })
})



// Need funds in the test wallet for this to proceed
/* 

// send basic - -r recipient
describe('send #3a', () => {
  const args = [
    'send',
    '10',
    '-r',
    'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
    '-w',
    testSetup.walletFile,
    '-i',
    '10',
    '-t',
    '-s',
  ]
  let exitCode
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if basic sendTX sent (will fail on network as there are no funds in wallet)', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// send basic - shor
describe('send #3b', () => {
  const args = [
    'send',
    '10',
    '-r',
    'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
    '-w',
    testSetup.walletFile,
    '-i',
    '11',
    '-t',
    '-s',
  ]
  let exitCode
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if basic sendTX sent (will fail on network as there are no funds in wallet)', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// send basic - json recipient
describe('send #3c', () => {
  const args = [
    'send',
    '10',
    '-j',
    '{"tx":[{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"10"},{"to":"Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408","shor":"15"}]}',
    '-w',
    testSetup.walletFile,
    '-i',
    '12',
    '-t',
    '-f',
    '1',
    '-s',
  ]
  let exitCode
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if json recipient with -f 1 sendTX sent (will fail on network as there are no funds in wallet)', () => {
    assert.strictEqual(exitCode, 0)
  })
})


// send using wallet file
describe('send #3d', () => {
  const args = [
    'send',
    '1',
    '-r',
    'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
    '-w',
    testSetup.walletFile,
    '-i',
    '13',
    '-t',
    '-s',
  ]
  let exitCode
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if basic sendTX sent using wallet file (will fail on network as there are no funds in wallet)', () => {
    assert.strictEqual(exitCode, 0)
  })
})

// send using wallet file
describe('send #3e', () => {
  const args = [
    'send',
    '1',
    '-r',
    'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408',
    '-w',
    testSetup.encWalletFile,
    '-p',
    'test123',
    '-i',
    '14',
    '-t',
    '-s',
  ]
  let exitCode
  before(done => {
    const process = spawn('./bin/run', args, processFlags)
    process.on('exit', code => {
      exitCode = code
      done()
    })
  })
  it('exit code should be 0 if basic sendTX sent using wallet file (will fail on network as there are no funds in wallet)', () => {
    assert.strictEqual(exitCode, 0)
  })
})
*/
// ///////////////////////////////////////////////////////////////////////////
// send: offline coverage suite
//
// `send` has three modes and only one of them needs a node:
//
//   * online          - asks a node to build the transaction, signs it, pushes it
//   * --savetofile/-T - builds AND signs the transaction entirely locally, writes JSON
//   * --loadfromfile/-F - reads a signed transaction back and pushes it
//
// Everything below stays inside the offline half: each case either stops at a
// validation gate, signs into a file under /tmp, or dies connecting to a closed
// loopback port. Nothing contacts mainnet or testnet and no transaction is ever
// pushed.
//
// OTS keys: these tests sign with wallets this file creates in its own before()
// hook (/tmp/send-wallet*.json), never with a shared fixture, so a signature
// here can never burn a key another test or another person depends on.
//
// Assertions are on the message the command printed, not just the exit code: the
// validation ladder in `send` has a dozen different ways to exit non-zero and a
// test that only checks the code keeps passing when the command starts failing
// for the wrong reason.
// ///////////////////////////////////////////////////////////////////////////

// A closed port on loopback. The CLI resolves it, fails to connect and exits.
// Deterministic, and the packet never leaves the machine.
const DEAD_NODE = '127.0.0.1:1'

const OFFLINE_WALLET = '/tmp/send-wallet.json'
const OFFLINE_ENC_WALLET = '/tmp/send-wallet-enc.json'
// A wallet in the pre-v2 (`aes256` package) encryption format. That format is
// unauthenticated, so a wrong password yields garbage instead of throwing - the
// only way to reach send.js's "invalid password" branch, which validates the
// decrypted address rather than trusting the decryption to fail.
const OFFLINE_LEGACY_WALLET = '/tmp/send-wallet-legacy.json'
const OFFLINE_PASSWORD = 'testpassword'
const OFFLINE_OUTPUTS = '/tmp/send-outputs.json'
const OFFLINE_NOT_JSON = '/tmp/send-not-json.txt'
const OFFLINE_TX_OUT = '/tmp/send-offline-tx.json'

const RECIPIENT_A = 'Q000200ecffb27f3d7b11ccd048eb559277d64bb52bfda998341e66a9f11b2d07f6b2ee4f62c408'
const RECIPIENT_B = 'Q010500bc576efa69fd6cbc854f2224f149f0b0a4d18fcb30c1feab64781245f4f27a61874227f3'

// Run the CLI and capture what it said rather than letting it write to test output.
function runSend(args) {
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

function sendRefuses(args, expected) {
  return runSend(args).then(({code, out}) => {
    assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}\n--- output ---\n${out}`)
    assert.ok(expected.test(out), `expected output to match ${expected}\n--- actual ---\n${out}`)
  })
}

function sendAccepts(args, expected) {
  return runSend(args).then(({code, out}) => {
    assert.strictEqual(code, 0, `expected a zero exit for: ${args.join(' ')}\n--- output ---\n${out}`)
    assert.ok(expected.test(out), `expected output to match ${expected}\n--- actual ---\n${out}`)
  })
}

function createOfflineWallet(file, password) {
  return new Promise((resolve, reject) => {
    const args = ['create-wallet', '-h', '6', '-f', file]
    if (password) {
      args.push('-p', password)
    }
    const child = spawn('./bin/run', args, {stdio: ['ignore', 'ignore', 'ignore']})
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`create-wallet exited ${code}`))))
    child.on('error', reject)
  })
}

// Legacy `aes256` blob: key = sha256(password), AES-256-CTR, base64(iv || ciphertext).
// Matches the format src/utils/aes.js still reads for backwards compatibility.
function legacyEncrypt(password, plaintext) {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(String(password)).digest()
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  return Buffer.concat([iv, ciphertext]).toString('base64')
}

describe('send: offline coverage', () => {
  let plainWallet

  before(async function createSendFixtures() {
    this.timeout(180000)
    await createOfflineWallet(OFFLINE_WALLET, null)
    await createOfflineWallet(OFFLINE_ENC_WALLET, OFFLINE_PASSWORD)
    ;[plainWallet] = JSON.parse(fs.readFileSync(OFFLINE_WALLET))

    fs.writeFileSync(
      OFFLINE_LEGACY_WALLET,
      JSON.stringify([
        {
          encrypted: true,
          address: legacyEncrypt(OFFLINE_PASSWORD, plainWallet.address),
          addressB32: legacyEncrypt(OFFLINE_PASSWORD, plainWallet.addressB32),
          pk: legacyEncrypt(OFFLINE_PASSWORD, plainWallet.pk),
          hexseed: legacyEncrypt(OFFLINE_PASSWORD, plainWallet.hexseed),
          mnemonic: legacyEncrypt(OFFLINE_PASSWORD, plainWallet.mnemonic),
          height: plainWallet.height,
          hashFunction: plainWallet.hashFunction,
          signatureType: plainWallet.signatureType,
          index: plainWallet.index,
        },
      ])
    )

    fs.writeFileSync(
      OFFLINE_OUTPUTS,
      JSON.stringify({tx: [{to: RECIPIENT_A, shor: '10'}, {to: RECIPIENT_B, shor: '15'}]})
    )
    fs.writeFileSync(OFFLINE_NOT_JSON, 'this file is not JSON at all')
  })

  after(() => {
    [OFFLINE_WALLET, OFFLINE_ENC_WALLET, OFFLINE_LEGACY_WALLET, OFFLINE_OUTPUTS, OFFLINE_NOT_JSON, OFFLINE_TX_OUT].forEach(
      file => {
        try {
          fs.unlinkSync(file)
        } catch (err) {
          // fixture already gone; nothing to clean up
        }
      }
    )
  })

  // -------------------------------------------------------------------------
  // What each prompt falls back to through a pipe. Every one of these is a
  // question the command would ask at a terminal; with no terminal to ask, it
  // has to name the missing flag rather than prompt into a closed stdin.
  // -------------------------------------------------------------------------
  describe('missing arguments, with no terminal to ask at', () => {
    it('names the missing quantity', async () => {
      await sendRefuses(
        ['send', '-r', RECIPIENT_A, '-i', '0', '-w', OFFLINE_WALLET],
        /Missing required argument: quantity/
      )
    })

    it('names the missing OTS index', async () => {
      await sendRefuses(
        ['send', '1', '-r', RECIPIENT_A, '-w', OFFLINE_WALLET],
        /Missing required flag: --otsindex/
      )
    })

    it('names the missing wallet or hexseed', async () => {
      await sendRefuses(['send', '1', '-r', RECIPIENT_A, '-i', '0'], /Missing sender wallet file/)
    })
  })

  // -------------------------------------------------------------------------
  // Recipient/amount parsing: -r, -j and -R all end up in the same `output.tx`
  // -------------------------------------------------------------------------

  describe('recipient sources', () => {
    it('converts a Quanta amount to Shor when -s is not given', async function quantaToShor() {
      this.timeout(120000)
      // 2 Quanta must be written out as 2000000000 Shor. Without -s the amount goes
      // through BigNumber; this is the only path that multiplies by 10^9.
      await sendAccepts(
        ['send', '2', '-r', RECIPIENT_A, '-w', OFFLINE_WALLET, '-i', '0', '-T', OFFLINE_TX_OUT],
        /amount in shor: 2000000000/
      )
      const saved = JSON.parse(fs.readFileSync(OFFLINE_TX_OUT))
      assert.strictEqual(saved.tx.transfer.amounts[0], '2000000000')
      assert.strictEqual(saved.addr_from, plainWallet.address)
      assert.strictEqual(saved.ots_key, '0')
    })

    it('signs a multi-recipient transaction passed as a JSON object with -j', async function jsonObject() {
      this.timeout(120000)
      await sendAccepts(
        [
          'send',
          // NOTE: the positional `quantity` is still required even though -j carries every
          // amount. It is parsed and then ignored on this path.
          '0',
          '-j',
          JSON.stringify({tx: [{to: RECIPIENT_A, shor: '10'}, {to: RECIPIENT_B, shor: '15'}]}),
          '-w',
          OFFLINE_WALLET,
          '-i',
          '1',
          '-T',
          OFFLINE_TX_OUT,
        ],
        /Transaction data has been saved to the file/
      )
      const saved = JSON.parse(fs.readFileSync(OFFLINE_TX_OUT))
      assert.deepStrictEqual(saved.tx.transfer.amounts, ['10', '15'])
      assert.strictEqual(saved.tx.transfer.addrs_to.length, 2)
    })

    it('signs a multi-recipient transaction read from a JSON file with -R', async function recipientFile() {
      this.timeout(120000)
      await sendAccepts(
        ['send', '0', '-R', OFFLINE_OUTPUTS, '-w', OFFLINE_WALLET, '-i', '2', '-T', OFFLINE_TX_OUT],
        /Transaction data has been saved to the file/
      )
      const saved = JSON.parse(fs.readFileSync(OFFLINE_TX_OUT))
      assert.deepStrictEqual(saved.tx.transfer.amounts, ['10', '15'])
    })

    it('rejects a -R file that is not JSON', async function recipientFileNotJson() {
      this.timeout(60000)
      await sendRefuses(
        ['send', '0', '-R', OFFLINE_NOT_JSON, '-w', OFFLINE_WALLET, '-i', '3', '-T', OFFLINE_TX_OUT],
        /Unable to send: json object passed with -j contains invalid output data/
      )
    })

    it('rejects a -j object with no tx array', async function jsonNoTxArray() {
      this.timeout(60000)
      await sendRefuses(
        ['send', '10', '-j', '{"outputs":[]}', '-w', OFFLINE_WALLET, '-i', '3', '-T', OFFLINE_TX_OUT],
        /array is undefined/
      )
    })

    it('rejects a -j object with an empty tx array', async function jsonEmptyTxArray() {
      this.timeout(60000)
      await sendRefuses(
        ['send', '10', '-j', '{"tx":[]}', '-w', OFFLINE_WALLET, '-i', '3', '-T', OFFLINE_TX_OUT],
        /No transactions found: length of array is 0/
      )
    })

    it('rejects a -R file whose outputs have no tx array', async function recipientFileNoTx() {
      this.timeout(60000)
      await sendRefuses(
        ['send', '0', '-R', OFFLINE_ENC_WALLET, '-w', OFFLINE_WALLET, '-i', '3', '-T', OFFLINE_TX_OUT],
        /json file contains invalid output data/
      )
    })
  })

  // -------------------------------------------------------------------------
  // Wallet handling
  // -------------------------------------------------------------------------

  describe('sender wallet', () => {
    it('opens an unencrypted wallet file and reports the sending address', async function plainWalletFile() {
      this.timeout(120000)
      await sendAccepts(
        ['send', '1', '-s', '-r', RECIPIENT_A, '-w', OFFLINE_WALLET, '-i', '4', '-T', OFFLINE_TX_OUT],
        new RegExp(`Sending from: ${plainWallet.address}`)
      )
    })

    it('decrypts a v2 encrypted wallet with the right password', async function encWalletFile() {
      this.timeout(120000)
      await sendAccepts(
        [
          'send',
          '1',
          '-s',
          '-r',
          RECIPIENT_A,
          '-w',
          OFFLINE_ENC_WALLET,
          '-p',
          OFFLINE_PASSWORD,
          '-i',
          '5',
          '-T',
          OFFLINE_TX_OUT,
        ],
        /Transaction data has been saved to the file/
      )
    })

    it('decrypts a legacy-format encrypted wallet with the right password', async function legacyWalletFile() {
      this.timeout(120000)
      await sendAccepts(
        [
          'send',
          '1',
          '-s',
          '-r',
          RECIPIENT_A,
          '-w',
          OFFLINE_LEGACY_WALLET,
          '-p',
          OFFLINE_PASSWORD,
          '-i',
          '6',
          '-T',
          OFFLINE_TX_OUT,
        ],
        new RegExp(`Sending from: ${plainWallet.address}`)
      )
    })

    it('refuses a legacy-format wallet when the password is wrong', async function legacyWalletBadPassword() {
      this.timeout(60000)
      // The legacy format is unauthenticated, so decryption "succeeds" and returns
      // garbage. send.js has to notice the plaintext is not a QRL address.
      await sendRefuses(
        [
          'send',
          '1',
          '-s',
          '-r',
          RECIPIENT_A,
          '-w',
          OFFLINE_LEGACY_WALLET,
          '-p',
          'not-the-password',
          '-i',
          '6',
          '-T',
          OFFLINE_TX_OUT,
        ],
        /Unable to open wallet file: invalid password/
      )
    })

    it('signs from a raw hexseed', async function hexseedSender() {
      this.timeout(120000)
      await sendAccepts(
        ['send', '1', '-s', '-r', RECIPIENT_A, '-h', plainWallet.hexseed, '-i', '7', '-T', OFFLINE_TX_OUT],
        /Transaction data has been saved to the file/
      )
    })

    it('signs from a mnemonic phrase', async function mnemonicSender() {
      this.timeout(120000)
      await sendAccepts(
        ['send', '1', '-s', '-r', RECIPIENT_A, '-h', plainWallet.mnemonic, '-i', '8', '-T', OFFLINE_TX_OUT],
        /Transaction data has been saved to the file/
      )
    })
  })

  // -------------------------------------------------------------------------
  // Fee, message and signing
  // -------------------------------------------------------------------------

  describe('fee, message and signing', () => {
    it('accepts an explicit fee in Shor', async function explicitFee() {
      this.timeout(120000)
      await sendAccepts(
        ['send', '1', '-s', '-r', RECIPIENT_A, '-w', OFFLINE_WALLET, '-i', '9', '-f', '100', '-T', OFFLINE_TX_OUT],
        /Fee: 100 Shor/
      )
      const saved = JSON.parse(fs.readFileSync(OFFLINE_TX_OUT))
      assert.strictEqual(saved.tx.fee, '100')
    })

    it('attaches message data to the saved transaction', async function messageData() {
      this.timeout(120000)
      const message = 'offline coverage message'
      await sendAccepts(
        [
          'send',
          '1',
          '-s',
          '-r',
          RECIPIENT_A,
          '-w',
          OFFLINE_WALLET,
          '-i',
          '10',
          '-M',
          message,
          '-T',
          OFFLINE_TX_OUT,
        ],
        new RegExp(`Message Length\\s+${message.length}`)
      )
      const saved = JSON.parse(fs.readFileSync(OFFLINE_TX_OUT))
      // message_data survives into the file as the same bytes that were signed
      assert.deepStrictEqual(
        Buffer.from(saved.tx.transfer.message_data).toString('utf8'),
        message
      )
    })

    it('accepts a message of exactly 80 bytes', async function messageAtLimit() {
      this.timeout(120000)
      const message = 'a'.repeat(80)
      await sendAccepts(
        [
          'send',
          '1',
          '-s',
          '-r',
          RECIPIENT_A,
          '-w',
          OFFLINE_WALLET,
          '-i',
          '11',
          '-M',
          message,
          '-T',
          OFFLINE_TX_OUT,
        ],
        /Message Length\s+80/
      )
    })

    it('fails cleanly when the OTS index is beyond the end of the tree', async function otsOutOfRange() {
      this.timeout(120000)
      // A height-6 wallet has 64 OTS keys (0-63). Asking for 64 makes QRLLIB refuse
      // to sign; nothing must be written and the command must not claim success.
      await sendRefuses(
        ['send', '1', '-s', '-r', RECIPIENT_A, '-w', OFFLINE_WALLET, '-i', '64', '-T', OFFLINE_TX_OUT],
        /Failed to sign transaction/
      )
    })

    it('refuses to write the signed transaction to an unwritable path', async function unwritableTarget() {
      this.timeout(120000)
      await sendRefuses(
        [
          'send',
          '1',
          '-s',
          '-r',
          RECIPIENT_A,
          '-w',
          OFFLINE_WALLET,
          '-i',
          '12',
          '-T',
          path.join('/proc/self/no-such-dir', 'tx.json'),
        ],
        /Unable to save data to TX file/
      )
    })
  })

  // -------------------------------------------------------------------------
  // Node connection failures (closed loopback port, never a real endpoint)
  // -------------------------------------------------------------------------

  describe('node connection', () => {
    it('reports a connection failure instead of signing when the node is unreachable', async function deadNodeSend() {
      this.timeout(120000)
      // Online mode: the transaction is built by the node, so an unreachable node
      // must stop us before any OTS key is consumed.
      const {code, out} = await runSend([
        'send',
        '1',
        '-s',
        '-r',
        RECIPIENT_A,
        '-w',
        OFFLINE_WALLET,
        '-i',
        '13',
        '-g',
        DEAD_NODE,
      ])
      assert.notStrictEqual(code, 0)
      assert.ok(/Failed to connect to node/.test(out), `--- actual ---\n${out}`)
      assert.ok(
        !/Transaction signed with OTS key/.test(out),
        `nothing may be signed when the node is unreachable\n--- actual ---\n${out}`
      )
    })

    it('reports a connection failure when pushing a saved transaction with -F', async function deadNodeLoad() {
      this.timeout(120000)
      // Build a signed transaction offline first, then try to push it at a closed port.
      await sendAccepts(
        ['send', '1', '-s', '-r', RECIPIENT_A, '-w', OFFLINE_WALLET, '-i', '14', '-T', OFFLINE_TX_OUT],
        /Transaction data has been saved to the file/
      )
      await sendRefuses(['send', '-F', OFFLINE_TX_OUT, '-g', DEAD_NODE], /Failed to connect to node/)
    })
  })
})

// ///////////////////////////////////////////////////////////////////////////
// send: what happens once a node has answered
//
// The suites above stop at a validation gate, at a closed loopback port, or at
// --savetofile, which never contacts a node. What was left uncovered is the
// half of the command that runs after the node replies: the request it builds,
// the binding check that decides whether to sign at all, the push, and the
// transaction-id check on the way back.
//
// These cases run the command in *this* process against a stub gRPC client.
// src/functions/grpc is swapped in the require cache for the moment it takes to
// require the command (it captures Qrlnode at require time), then the real
// module is put straight back. There is no server and no socket.
//
// The signing is real: a throwaway height-6 wallet is used to produce genuine
// XMSS signatures, and the stub recomputes the transaction hash the way a node
// would, so a signature that did not match the request would be visible here.
// Nothing reaches a network, so no on-chain OTS key is spent.
// ///////////////////////////////////////////////////////////////////////////

const {
  concatenateTypedArrays,
  toBigendianUint64BytesUnsigned,
  toUint8Vector,
  binaryToBytes,
} = require('../../src/functions/tx-binding')

// kleur colours by environment variable rather than by isTTY, so captured output
// still carries escape sequences. Strip them before matching.
const SEND_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const SEND_NODE_WALLET = '/tmp/send-node-wallet.json'
const SEND_NODE_TX_FILE = '/tmp/send-node-offline-tx.json'
const SEND_NODE_NOT_JSON = '/tmp/send-node-not-json.txt'
const SEND_NODE_ENC_WALLET = '/tmp/send-node-enc-wallet.json'
const SEND_NODE_PASSWORD = 'node-suite-password'

// Behaviour the stub should show for the test currently running. Reset per test.
let sendNode = {}
let sendCalls = []
let sendConnectAttempts = 0

// Rebuild the transaction hash from the signed transaction the command pushed,
// exactly as QRL core does: sha256(digest) over the preimage, then
// sha256(digest || signature || public key). Doing it here rather than echoing a
// value back means the success case only passes if the command signed the
// transaction it said it was signing.
function nodeTransactionHash(signedTx) {
  const parts = [toBigendianUint64BytesUnsigned(parseInt(signedTx.fee, 10))]
  if (signedTx.transfer.message_data) {
    parts.push(Uint8Array.from(Buffer.from(signedTx.transfer.message_data)))
  }
  signedTx.transfer.addrs_to.forEach((addr, i) => {
    parts.push(Uint8Array.from(Buffer.from(addr)))
    parts.push(toBigendianUint64BytesUnsigned(signedTx.transfer.amounts[i]))
  })
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

// What an honest node returns for TransferCoins: the request echoed back in the
// shape the proto loader produces.
function buildTransferResponse(request) {
  const transfer = {
    addrs_to: request.addresses_to.map(item => Buffer.from(item)),
    amounts: request.amounts.slice(),
  }
  if (request.message_data) {
    transfer.message_data = Buffer.from(request.message_data)
  }
  return {
    extended_transaction_unsigned: {
      tx: {
        fee: String(request.fee),
        public_key: {},
        signature: {},
        transaction_hash: {},
        transfer,
      },
    },
  }
}

class SendFakeQrlNode {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.connection = false
  }

  // eslint-disable-next-line class-methods-use-this
  async connect() {
    sendConnectAttempts += 1
    if (sendNode.connectThrows) {
      throw new Error(sendNode.connectThrows)
    }
    const connectsOn = sendNode.connectsOnAttempt === undefined ? 1 : sendNode.connectsOnAttempt
    if (connectsOn !== 0 && sendConnectAttempts >= connectsOn) {
      this.connection = true
    }
    return this.connection
  }

  // eslint-disable-next-line class-methods-use-this
  async api(name, request) {
    sendCalls.push({name, request})
    if (name === 'TransferCoins') {
      const built = buildTransferResponse(request)
      return sendNode.tamper ? sendNode.tamper(built) : built
    }
    // PushTransaction
    if (sendNode.pushResponse) {
      return sendNode.pushResponse
    }
    const signedTx = request.transaction_signed
    // A transaction loaded from a file already carries the hash it was signed
    // with; one built here has to have it recomputed.
    const hash =
      typeof signedTx.transaction_hash === 'string'
        ? Buffer.from(signedTx.transaction_hash, 'hex')
        : nodeTransactionHash(signedTx)
    return {tx_hash: sendNode.wrongHash ? Buffer.alloc(32, 0x11) : hash}
  }
}

const sendGrpcPath = require.resolve('../../src/functions/grpc')
const sendCommandPath = require.resolve('../../src/commands/send')

const sendRealGrpcEntry = require.cache[sendGrpcPath]
require.cache[sendGrpcPath] = {
  id: sendGrpcPath,
  filename: sendGrpcPath,
  path: path.dirname(sendGrpcPath),
  loaded: true,
  children: [],
  paths: [],
  exports: SendFakeQrlNode,
}
const {Send} = require('../../src/commands/send')

if (sendRealGrpcEntry) {
  require.cache[sendGrpcPath] = sendRealGrpcEntry
} else {
  delete require.cache[sendGrpcPath]
}

// Run send here, against the stub, capturing everything it prints (this.log
// and console.log go to stdout, the ora spinners go to stderr). run() awaits the whole
// signing and pushing sequence, so an exit inside it arrives as a thrown ExitError.
async function runSendInProcess(argv) {
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
    await Send.run(argv)
  } catch (error) {
    code = error.oclif && error.oclif.exit !== undefined ? error.oclif.exit : 1
  } finally {
    process.stdout.write = realStdout
    process.stderr.write = realStderr
  }
  // kleur colours by environment variable rather than by isTTY, so the captured output
  // still carries escape sequences here. Strip them so the assertions read as the text a
  // person would see.
  return {code, out: chunks.join('').replace(SEND_ANSI, '')}
}

// The prompts only run when stdin and stdout are terminals, so through a pipe
// that whole half of the command is unreachable. Fake the terminal, and stand in
// for the two prompt libraries send uses: `prompts` (required lazily inside
// run()) and cli-ux's `cli.prompt` for the wallet password.
const sendCliUx = require('cli-ux').cli // eslint-disable-line import/order

function stubSendPrompts(fake) {
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

// cli-ux exposes `prompt` as a getter, so it has to be redefined rather than assigned.
function stubSendPassword(password) {
  const saved = Object.getOwnPropertyDescriptor(sendCliUx, 'prompt')
  const asked = []
  Object.defineProperty(sendCliUx, 'prompt', {
    configurable: true,
    get: () => async (message, options) => {
      asked.push({message, options})
      return password
    },
  })
  return {asked, restore: () => Object.defineProperty(sendCliUx, 'prompt', saved)}
}

// Answer each prompt by name, and record the option objects so the tests can
// check the questions and their validators as well as the answers.
function answering(answers, seen) {
  return async options => {
    seen.push(options)
    return Object.prototype.hasOwnProperty.call(answers, options.name)
      ? {[options.name]: answers[options.name]}
      : {}
  }
}

async function runSendInteractive(argv, {fakePrompts, fakePassword} = {}) {
  const restorePrompts = stubSendPrompts(fakePrompts || (async () => ({})))
  const password = fakePassword === undefined ? null : stubSendPassword(fakePassword)
  const savedStdout = process.stdout.isTTY
  const savedStdin = process.stdin.isTTY
  process.stdout.isTTY = true
  process.stdin.isTTY = true
  try {
    const result = await runSendInProcess(argv)
    return {...result, asked: password ? password.asked : []}
  } finally {
    process.stdout.isTTY = savedStdout
    process.stdin.isTTY = savedStdin
    if (password) {
      password.restore()
    }
    restorePrompts()
  }
}

describe('send: signing and pushing what a node returned', () => {
  let nodeWallet

  before(async function createNodeFixtures() {
    this.timeout(180000)
    await createOfflineWallet(SEND_NODE_WALLET, null)
    ;[nodeWallet] = JSON.parse(fs.readFileSync(SEND_NODE_WALLET))
    fs.writeFileSync(SEND_NODE_NOT_JSON, 'this file is not a transaction')
    // Encrypted with the current (authenticated) format, so a wrong password makes
    // decryption throw rather than return nonsense.
    const aes = require('../../src/utils/aes') // eslint-disable-line global-require
    fs.writeFileSync(
      SEND_NODE_ENC_WALLET,
      JSON.stringify([
        {
          encrypted: true,
          address: aes.encrypt(SEND_NODE_PASSWORD, nodeWallet.address),
          hexseed: aes.encrypt(SEND_NODE_PASSWORD, nodeWallet.hexseed),
        },
      ])
    )
  })

  after(() => {
    // The cached command module holds the stubbed Qrlnode; drop it so anything
    // requiring it later in the same process gets the real client back.
    delete require.cache[sendCommandPath]
    ;[SEND_NODE_WALLET, SEND_NODE_TX_FILE, SEND_NODE_NOT_JSON, SEND_NODE_ENC_WALLET].forEach(file => {
      try {
        fs.unlinkSync(file)
      } catch (err) {
        // fixture already gone; nothing to clean up
      }
    })
  })

  beforeEach(() => {
    sendNode = {}
    sendCalls = []
    sendConnectAttempts = 0
  })

  const sendArgs = (extra = []) => [
    '1.5',
    '-r', RECIPIENT_A,
    '-i', '0',
    '-w', SEND_NODE_WALLET,
    '-g', DEAD_NODE,
    ...extra,
  ]

  it('asks the node to build the transaction it was told to send', async function builds() {
    this.timeout(120000)
    const {code, out} = await runSendInProcess(sendArgs())
    assert.strictEqual(code, 0, out)
    const build = sendCalls.find(c => c.name === 'TransferCoins')
    assert.ok(build, `no TransferCoins call was made\n--- output ---\n${out}`)
    assert.strictEqual(`Q${Buffer.from(build.request.addresses_to[0]).toString('hex')}`, RECIPIENT_A)
    // 1.5 Quanta expressed in Shor, since -s was not given
    assert.deepStrictEqual(build.request.amounts, ['1500000000'])
    assert.strictEqual(build.request.fee, 0)
    assert.strictEqual(build.request.message_data, undefined)
  })

  it('signs the transaction and reports the id the node gave back', async function signs() {
    this.timeout(120000)
    const {code, out} = await runSendInProcess(sendArgs(['-f', '100']))
    assert.strictEqual(code, 0, out)
    assert.ok(/Transaction signed with OTS key 0/.test(out), out)
    // the sender named in the output is the wallet the funds actually leave
    assert.ok(out.includes(`Sending from: ${nodeWallet.address}`), out)
    const push = sendCalls.find(c => c.name === 'PushTransaction')
    assert.ok(push, 'nothing was pushed')
    assert.ok(push.request.transaction_signed.signature.length > 0, 'pushed without a signature')
    assert.strictEqual(push.request.transaction_signed.fee, '100')
    // The id printed is the one the stub derived from the signed transaction, so
    // it can only match if the command signed what it asked the node to build.
    const hash = nodeTransactionHash(push.request.transaction_signed).toString('hex')
    assert.ok(out.includes(`transaction ID: ${hash}`), out)
  })

  it('blames the password, not the file, when an encrypted wallet will not open', async function wrongPw() {
    this.timeout(120000)
    // The wallet is fine; the password is not. The decryption error used to be caught by
    // the same handler that reports an unreadable file, so it said "invalid wallet file".
    const {code, out} = await runSendInProcess(
      ['1', '-r', RECIPIENT_A, '-i', '0', '-w', SEND_NODE_ENC_WALLET, '-p', 'not-the-password', '-g', DEAD_NODE]
    )
    assert.strictEqual(code, 1, out)
    assert.ok(/Unable to open wallet file: invalid password/.test(out), out)
    assert.ok(!/invalid wallet file/.test(out), `only one reason may be given\n--- actual ---\n${out}`)
  })

  it('reports a hexseed the XMSS library cannot use, rather than failing silently', async function badSeed() {
    this.timeout(120000)
    // The right length but not hex, so it clears the length check and only fails inside
    // QRLLIB. That throw used to escape uncaught, exiting non-zero with nothing printed.
    const {code, out} = await runSendInProcess(
      ['1', '-r', RECIPIENT_A, '-i', '0', '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb139HG', '-g', DEAD_NODE]
    )
    assert.strictEqual(code, 1, out)
    assert.ok(/Failed to recreate XMSS wallet object/.test(out), out)
    assert.strictEqual(sendCalls.length, 0, 'no node is contacted when the key cannot be rebuilt')
  })

  it('accepts an explicit fee of 0, the same value it uses when -f is omitted', async function zeroFee() {
    this.timeout(120000)
    // parseInt('0') is 0, which is falsy: testing the parsed fee for truthiness sent an
    // explicit -f 0 down the "invalid" path, while omitting -f used 0 quite happily.
    const {code, out} = await runSendInProcess(sendArgs(['-f', '0']))
    assert.strictEqual(code, 0, out)
    assert.strictEqual(sendCalls.find(c => c.name === 'TransferCoins').request.fee, 0)
    assert.strictEqual(sendCalls.find(c => c.name === 'PushTransaction').request.transaction_signed.fee, '0')
  })

  it('still refuses a negative fee', async function negativeFee() {
    this.timeout(120000)
    const {code, out} = await runSendInProcess(sendArgs(['-f', '-5']))
    assert.strictEqual(code, 1, out)
    assert.ok(/Fee is invalid/.test(out), out)
    assert.strictEqual(sendCalls.length, 0, 'nothing may be asked of a node for an unusable fee')
  })

  it('sends in shor when -s is given', async function shor() {
    this.timeout(120000)
    const {code} = await runSendInProcess(
      ['12345', '-r', RECIPIENT_A, '-i', '0', '-w', SEND_NODE_WALLET, '-g', DEAD_NODE, '-s']
    )
    assert.strictEqual(code, 0)
    assert.deepStrictEqual(sendCalls.find(c => c.name === 'TransferCoins').request.amounts, ['12345'])
  })

  it('attaches a message when one is given', async function withMessage() {
    this.timeout(120000)
    const {code, out} = await runSendInProcess(sendArgs(['-M', 'hello chain']))
    assert.strictEqual(code, 0, out)
    const build = sendCalls.find(c => c.name === 'TransferCoins')
    assert.strictEqual(Buffer.from(build.request.message_data).toString(), 'hello chain')
    const push = sendCalls.find(c => c.name === 'PushTransaction')
    assert.strictEqual(
      Buffer.from(push.request.transaction_signed.transfer.message_data).toString(),
      'hello chain'
    )
  })

  it('sends every output of a multi-recipient JSON object', async function multi() {
    this.timeout(120000)
    const jsonObject = JSON.stringify({tx: [{to: RECIPIENT_A, shor: '10'}, {to: RECIPIENT_B, shor: '15'}]})
    const {code, out} = await runSendInProcess(
      // the quantity argument is still required by the gate above, and ignored:
      // the amounts come from the JSON object.
      ['1', '-j', jsonObject, '-i', '0', '-w', SEND_NODE_WALLET, '-g', DEAD_NODE]
    )
    assert.strictEqual(code, 0, out)
    const build = sendCalls.find(c => c.name === 'TransferCoins')
    assert.deepStrictEqual(build.request.amounts, ['10', '15'])
    assert.strictEqual(build.request.addresses_to.length, 2)
  })

  it('retries the connection until the node answers', async function retries() {
    this.timeout(120000)
    sendNode = {connectsOnAttempt: 3}
    const {code} = await runSendInProcess(sendArgs())
    assert.strictEqual(code, 0)
    assert.strictEqual(sendConnectAttempts, 3)
  })

  it('links to the mainnet explorer when sending on mainnet', async function mainnet() {
    this.timeout(120000)
    const {code, out} = await runSendInProcess(
      ['1', '-r', RECIPIENT_A, '-i', '0', '-w', SEND_NODE_WALLET, '-m']
    )
    assert.strictEqual(code, 0, out)
    assert.ok(/https:\/\/explorer\.theqrl\.org\/tx\/[0-9a-f]{64}/.test(out), out)
  })

  it('links to the testnet explorer when sending on testnet', async function testnet() {
    this.timeout(120000)
    const {code, out} = await runSendInProcess(
      ['1', '-r', RECIPIENT_A, '-i', '0', '-w', SEND_NODE_WALLET, '-t']
    )
    assert.strictEqual(code, 0, out)
    assert.ok(/https:\/\/testnet-explorer\.theqrl\.org\/tx\/[0-9a-f]{64}/.test(out), out)
  })

  it('refuses to sign a response that redirected the payment', async function tamperedRecipient() {
    this.timeout(120000)
    // The reason the binding check exists: a node that swaps the recipient gets
    // a valid signature over its own transaction unless this refuses.
    sendNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.transfer.addrs_to = [Buffer.from(RECIPIENT_B.substring(1), 'hex')]
        return response
      },
    }
    const {code, out} = await runSendInProcess(sendArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/transfer recipient at position 0/.test(out), out)
    assert.ok(/Nothing was signed, no OTS key was used, and no funds have moved/.test(out), out)
    assert.strictEqual(sendCalls.filter(c => c.name === 'PushTransaction').length, 0, 'nothing may be pushed')
  })

  it('refuses to sign a response that changed the amount', async function tamperedAmount() {
    this.timeout(120000)
    sendNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.transfer.amounts = ['999999999999']
        return response
      },
    }
    const {code, out} = await runSendInProcess(sendArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/transfer amount at position 0/.test(out), out)
  })

  it('refuses to sign a response that changed the fee', async function tamperedFee() {
    this.timeout(120000)
    sendNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.fee = '100000000'
        return response
      },
    }
    const {code, out} = await runSendInProcess(sendArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/different fee/.test(out), out)
  })

  it('refuses to sign a response that changed the attached message', async function tamperedMessage() {
    this.timeout(120000)
    sendNode = {
      tamper: response => {
        const {tx} = response.extended_transaction_unsigned
        tx.transfer.message_data = Buffer.from('something else entirely')
        return response
      },
    }
    const {code, out} = await runSendInProcess(sendArgs(['-M', 'hello chain']))
    assert.strictEqual(code, 1, out)
    assert.ok(/different message/.test(out), out)
  })

  it('reports a node that rejects the push', async function pushRejected() {
    this.timeout(120000)
    sendNode = {pushResponse: {error_code: 'INVALID', error_description: 'OTS key reused'}}
    const {code, out} = await runSendInProcess(sendArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/OTS key reused/.test(out), out)
  })

  it('refuses a transaction id that is not the one it signed', async function hashMismatch() {
    this.timeout(120000)
    // A node that accepts the push but reports a different id has not submitted
    // the transaction that was signed; saying "submitted" here would be a lie.
    sendNode = {wrongHash: true}
    const {code, out} = await runSendInProcess(sendArgs())
    assert.strictEqual(code, 1, out)
    assert.ok(/Node transaction hash 1111/.test(out), out)
  })

  describe('--loadfromfile', () => {
    before(async function buildOfflineTx() {
      this.timeout(120000)
      // Sign offline first, exactly as a cold-wallet user would, so the file
      // being loaded is one this command produced rather than a hand-written
      // fixture that might not match the format it writes.
      const {code, out} = await runSendInProcess(
        ['2', '-r', RECIPIENT_A, '-i', '1', '-w', SEND_NODE_WALLET, '-T', SEND_NODE_TX_FILE]
      )
      assert.strictEqual(code, 0, out)
      assert.ok(fs.existsSync(SEND_NODE_TX_FILE), 'the offline transaction file was not written')
    })

    it('pushes a transaction signed offline without signing it again', async function pushesFile() {
      this.timeout(120000)
      const {code, out} = await runSendInProcess(
        ['-F', SEND_NODE_TX_FILE, '-g', DEAD_NODE]
      )
      assert.strictEqual(code, 0, out)
      assert.ok(/Successfully loaded from the file/.test(out), out)
      // No transaction is built and nothing is re-signed: the file already
      // carries the signature, and re-signing would spend a second OTS key.
      assert.strictEqual(sendCalls.filter(c => c.name === 'TransferCoins').length, 0)
      assert.ok(!/Transaction signed with OTS key/.test(out), out)
      const push = sendCalls.find(c => c.name === 'PushTransaction')
      const saved = JSON.parse(fs.readFileSync(SEND_NODE_TX_FILE))
      assert.strictEqual(push.request.transaction_signed.transaction_hash, saved.tx.transaction_hash)
    })

    it('pushes a transaction with an attached message signed offline', async function messageFile() {
      this.timeout(120000)
      // A message transaction is rebuilt from the file down a different branch,
      // because message_data has to be carried through as well.
      const messageFile = '/tmp/send-node-offline-message-tx.json'
      try {
        const saved = await runSendInProcess(
          ['2', '-r', RECIPIENT_A, '-i', '2', '-M', 'signed offline', '-w', SEND_NODE_WALLET, '-T', messageFile]
        )
        assert.strictEqual(saved.code, 0, saved.out)

        const {code, out} = await runSendInProcess(
          ['-F', messageFile, '-g', DEAD_NODE]
        )
        assert.strictEqual(code, 0, out)
        const push = sendCalls.find(c => c.name === 'PushTransaction')
        assert.strictEqual(
          Buffer.from(push.request.transaction_signed.transfer.message_data).toString(),
          'signed offline'
        )
      } finally {
        try {
          fs.unlinkSync(messageFile)
        } catch (err) {
          // never created; nothing to clean up
        }
      }
    })

    it('rejects a transaction file that is not JSON', async function notJson() {
      this.timeout(120000)
      const {code, out} = await runSendInProcess(
        ['-F', SEND_NODE_NOT_JSON, '-g', DEAD_NODE]
      )
      assert.strictEqual(code, 1, out)
    })
  })
  describe('at a terminal', () => {
    const promptEncWallet = '/tmp/send-node-prompt-enc-wallet.json'
    const WALLET_PASSWORD = 'prompted-password'

    before(() => {
      // A wallet whose address and hexseed both decrypt with the same password,
      // so the command gets past the address check and on to signing.
      const aes = require('../../src/utils/aes') // eslint-disable-line global-require
      fs.writeFileSync(
        promptEncWallet,
        JSON.stringify([
          {
            encrypted: true,
            address: aes.encrypt(WALLET_PASSWORD, nodeWallet.address),
            hexseed: aes.encrypt(WALLET_PASSWORD, nodeWallet.hexseed),
          },
        ])
      )
    })

    after(() => {
      try {
        fs.unlinkSync(promptEncWallet)
      } catch (err) {
        // never created; nothing to clean up
      }
    })

    it('asks for recipient, amount, OTS index and wallet when none are given', async function prompts() {
      this.timeout(120000)
      const seen = []
      const {code, out} = await runSendInteractive([], {
        fakePrompts: answering(
          {recipient: RECIPIENT_A, quantity: 2, otsindex: 3, walletType: 'file', walletFile: SEND_NODE_WALLET},
          seen
        ),
      })
      assert.strictEqual(code, 0, out)
      assert.deepStrictEqual(
        seen.map(o => o.name),
        ['recipient', 'quantity', 'otsindex', 'walletType', 'walletFile']
      )
      // the answers, not defaults, are what got sent and signed
      const build = sendCalls.find(c => c.name === 'TransferCoins')
      assert.strictEqual(`Q${Buffer.from(build.request.addresses_to[0]).toString('hex')}`, RECIPIENT_A)
      assert.deepStrictEqual(build.request.amounts, ['2000000000'])
      assert.ok(/Transaction signed with OTS key 3/.test(out), out)
    })

    it('validates what is typed at each prompt', async function validators() {
      this.timeout(120000)
      const seen = []
      await runSendInteractive([], {
        fakePrompts: answering(
          {recipient: RECIPIENT_A, quantity: 1, otsindex: 0, walletType: 'file', walletFile: SEND_NODE_WALLET},
          seen
        ),
      })
      const byName = Object.fromEntries(seen.map(o => [o.name, o]))
      assert.strictEqual(byName.recipient.validate('not-an-address'), 'Invalid QRL address')
      assert.strictEqual(byName.recipient.validate(RECIPIENT_A), true)
      assert.strictEqual(byName.quantity.validate(0), 'Quantity must be positive')
      assert.strictEqual(byName.quantity.validate(1), true)
      assert.strictEqual(byName.otsindex.validate(-1), 'OTS index must be 0 or greater')
      assert.strictEqual(byName.otsindex.validate(0), true)
      assert.strictEqual(byName.walletFile.validate('/no/such/wallet.json'), 'File does not exist')
      assert.strictEqual(byName.walletFile.validate(SEND_NODE_WALLET), true)
    })

    it('takes a hexseed typed at the prompt instead of a wallet file', async function seedPrompt() {
      this.timeout(120000)
      const seen = []
      const {code, out} = await runSendInteractive([], {
        fakePrompts: answering(
          {recipient: RECIPIENT_A, quantity: 1, otsindex: 0, walletType: 'seed', hexseed: nodeWallet.hexseed},
          seen
        ),
      })
      assert.strictEqual(code, 0, out)
      const seedPromptOptions = seen.find(o => o.name === 'hexseed')
      assert.strictEqual(seedPromptOptions.type, 'password', 'a seed must not be echoed to the terminal')
      assert.strictEqual(seedPromptOptions.validate('   '), 'Hexseed/Mnemonic is required')
      assert.strictEqual(seedPromptOptions.validate(nodeWallet.hexseed), true)
    })

    it('exits when the recipient prompt is cancelled', async function cancelRecipient() {
      this.timeout(120000)
      const {code, out} = await runSendInteractive([], {
        fakePrompts: async () => ({}),
      })
      assert.strictEqual(code, 1, out)
      assert.strictEqual(sendCalls.length, 0, 'no node is contacted without a recipient')
    })

    it('exits cleanly when the amount prompt is cancelled', async function cancelQuantity() {
      this.timeout(120000)
      // A cancelled numeric prompt answers with nothing, and the conversion to a
      // string used to throw a TypeError before the cancellation was noticed.
      const seen = []
      const {code, out} = await runSendInteractive([], {
        fakePrompts: answering({recipient: RECIPIENT_A}, seen),
      })
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.ok(!/TypeError/.test(out), out)
      assert.strictEqual(sendCalls.length, 0, 'no node is contacted without an amount')
    })

    it('exits cleanly when the OTS index prompt is cancelled', async function cancelOts() {
      this.timeout(120000)
      const seen = []
      const {code, out} = await runSendInteractive([], {
        fakePrompts: answering({recipient: RECIPIENT_A, quantity: 1}, seen),
      })
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.ok(!/TypeError/.test(out), out)
    })

    it('treats a blank OTS index as a cancellation', async function blankOts() {
      this.timeout(120000)
      // The OTS validator reads `value >= 0`, and a blank answer coerces to 0, so it
      // gets past validation as an empty string. Stopping on it is what keeps the
      // command from signing with an index the user never chose.
      const seen = []
      const {code, out} = await runSendInteractive([], {
        fakePrompts: answering({recipient: RECIPIENT_A, quantity: 1, otsindex: ''}, seen),
      })
      assert.strictEqual(code, 1, out)
      assert.ok(/Operation cancelled/.test(out), out)
      assert.strictEqual(sendCalls.length, 0, 'nothing is signed with an index that was never chosen')
    })

    it('accepts OTS index zero, which is a valid answer', async function otsZero() {
      this.timeout(120000)
      // 0 is falsy, so it has to survive the cancellation check rather than be
      // mistaken for no answer at all.
      const seen = []
      const {code, out} = await runSendInteractive([], {
        fakePrompts: answering(
          {recipient: RECIPIENT_A, quantity: 1, otsindex: 0, walletType: 'file', walletFile: SEND_NODE_WALLET},
          seen
        ),
      })
      assert.strictEqual(code, 0, out)
      assert.ok(/Transaction signed with OTS key 0/.test(out), out)
    })

    it('exits when neither wallet option is chosen', async function cancelWallet() {
      this.timeout(120000)
      const seen = []
      const {code, out} = await runSendInteractive([], {
        fakePrompts: answering({recipient: RECIPIENT_A, quantity: 1, otsindex: 0}, seen),
      })
      assert.strictEqual(code, 1, out)
      assert.strictEqual(sendCalls.length, 0, 'no node is contacted without a key to sign with')
    })

    it('asks for the wallet password when --password is not given', async function passwordPrompt() {
      this.timeout(120000)
      const {code, out, asked} = await runSendInteractive(
        ['1', '-r', RECIPIENT_A, '-i', '0', '-w', promptEncWallet, '-g', DEAD_NODE],
        {fakePassword: WALLET_PASSWORD}
      )
      assert.strictEqual(code, 0, out)
      assert.strictEqual(asked.length, 1)
      assert.ok(/Enter password for wallet file/.test(asked[0].message))
      assert.strictEqual(asked[0].options.type, 'hide', 'the password must not be echoed')
      assert.ok(out.includes(`Sending from: ${nodeWallet.address}`), out)
    })

    it('refuses a wrong password typed at the wallet prompt', async function wrongPassword() {
      this.timeout(120000)
      const {code, out} = await runSendInteractive(
        ['1', '-r', RECIPIENT_A, '-i', '0', '-w', promptEncWallet, '-g', DEAD_NODE],
        {fakePassword: 'not-the-password'}
      )
      assert.strictEqual(code, 1, out)
      assert.strictEqual(sendCalls.length, 0, 'nothing is signed or sent for a wallet that never opened')
    })
  })
})
