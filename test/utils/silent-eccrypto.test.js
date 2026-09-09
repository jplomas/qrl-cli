// ///////////////////////////////////////////////////////////////////////////
// silent-eccrypto test
//
// src/utils/silent-eccrypto.js exists to stop eccrypto's
// "secp256k1 unavailable, reverting to browser version" notice from landing in
// the middle of CLI output, while still recording *which* implementation was
// resolved. That record is the only signal a user gets that key generation has
// dropped from the native secp256k1 binding to the pure-JS elliptic fallback,
// so the capture, the reporting and the pass-through all need to be pinned.
//
// Which implementation this machine actually resolves is a property of the
// platform, not of the loader, so the interesting cases are driven by faking
// the eccrypto require rather than by hoping the host is (or is not) missing
// ecdh.node. Offline and deterministic: no node, no network, no wallet files.
// ///////////////////////////////////////////////////////////////////////////

/* eslint-disable no-console */

const assert = require('assert')
const Module = require('module')

const LOADER = require.resolve('../../src/utils/silent-eccrypto')
const FALLBACK_NOTICE = 'secp256k1 unavailable, reverting to browser version'
const NATIVE = 'native (secp256k1 ecdh.node)'
const BROWSER = 'browser (elliptic, pure JS)'

// Load a fresh copy of the loader.
//
// When `emit` is given, `require('eccrypto')` is intercepted and `emit` runs in
// its place -- that is the exact window in which the loader has console.info
// hooked, so whatever `emit` prints stands in for what eccrypto itself would
// print while initialising. Returning a stub also keeps the real eccrypto
// module (and its cached export object) untouched.
function loadLoader(emit) {
  delete require.cache[LOADER]
  const realRequire = Module.prototype.require
  if (emit) {
    Module.prototype.require = function patchedRequire(...args) {
      if (args[0] === 'eccrypto') {
        emit()
        return {stubbedEccrypto: true}
      }
      return realRequire.apply(this, args)
    }
  }
  try {
    return require('../../src/utils/silent-eccrypto') // eslint-disable-line global-require
  } finally {
    Module.prototype.require = realRequire
  }
}

// Run `fn` with console.info replaced, and hand back everything it was called
// with. The loader snapshots console.info as it loads, so a stub installed here
// is the "original" it restores and forwards to.
function capturingConsoleInfo(fn) {
  const calls = []
  const real = console.info
  console.info = (...args) => {
    calls.push(args)
  }
  try {
    fn()
  } finally {
    console.info = real
  }
  return calls
}

describe('utils/silent-eccrypto', () => {
  // The loader must not leave its hook installed, whatever happened during load.
  afterEach(() => {
    delete require.cache[LOADER]
  })

  describe('loading the real module', () => {
    it('exports a usable eccrypto and restores console.info', () => {
      const before = console.info
      const eccrypto = loadLoader()
      assert.strictEqual(console.info, before, 'console.info was left hooked')
      assert.strictEqual(typeof eccrypto.generatePrivate, 'function')
      assert.strictEqual(typeof eccrypto.getPublic, 'function')
    })

    it('reports the implementation it resolved', () => {
      const eccrypto = loadLoader()
      assert.strictEqual(typeof eccrypto.usingFallback, 'boolean')
      assert.strictEqual(eccrypto.implementation, eccrypto.usingFallback ? BROWSER : NATIVE)
    })
  })

  describe('the fallback notice', () => {
    it('is swallowed, and recorded as the browser implementation', () => {
      let loaded
      const printed = capturingConsoleInfo(() => {
        loaded = loadLoader(() => console.info(FALLBACK_NOTICE))
      })
      assert.deepStrictEqual(printed, [], 'the notice reached the console')
      assert.strictEqual(loaded.usingFallback, true)
      assert.strictEqual(loaded.implementation, BROWSER)
    })

    it('is matched anywhere in the message, not only at the start', () => {
      let loaded
      const printed = capturingConsoleInfo(() => {
        loaded = loadLoader(() => console.info(`eccrypto: ${FALLBACK_NOTICE} (v1.1.6)`))
      })
      assert.deepStrictEqual(printed, [])
      assert.strictEqual(loaded.implementation, BROWSER)
    })

    it('is absent when eccrypto says nothing, and the native binding is reported', () => {
      let loaded
      const printed = capturingConsoleInfo(() => {
        loaded = loadLoader(() => {})
      })
      assert.deepStrictEqual(printed, [])
      assert.strictEqual(loaded.usingFallback, false)
      assert.strictEqual(loaded.implementation, NATIVE)
    })
  })

  describe('unrelated console.info output during load', () => {
    it('is passed through, arguments and all', () => {
      let loaded
      const printed = capturingConsoleInfo(() => {
        loaded = loadLoader(() => console.info('loading %s', 'something else'))
      })
      assert.deepStrictEqual(printed, [['loading %s', 'something else']])
      assert.strictEqual(loaded.usingFallback, false)
    })

    it('is passed through when the message is not a string', () => {
      const notAString = {code: 'ENOENT'}
      let loaded
      const printed = capturingConsoleInfo(() => {
        loaded = loadLoader(() => console.info(notAString))
      })
      assert.deepStrictEqual(printed, [[notAString]])
      assert.strictEqual(loaded.usingFallback, false)
    })
  })

  describe('verbose reporting', () => {
    const originalEnv = process.env.QRL_CLI_VERBOSE

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.QRL_CLI_VERBOSE
      } else {
        process.env.QRL_CLI_VERBOSE = originalEnv
      }
    })

    // Each of the three triggers is checked on its own: they are OR'd together,
    // so a broken one is invisible while any other is also set.
    it('says nothing by default', () => {
      delete process.env.QRL_CLI_VERBOSE
      const printed = capturingConsoleInfo(() => loadLoader(() => {}))
      assert.deepStrictEqual(printed, [])
    })

    it('names the implementation when QRL_CLI_VERBOSE=1', () => {
      process.env.QRL_CLI_VERBOSE = '1'
      const printed = capturingConsoleInfo(() => loadLoader(() => console.info(FALLBACK_NOTICE)))
      assert.deepStrictEqual(printed, [[`eccrypto secp256k1 implementation: ${BROWSER}`]])
    })

    it('stays quiet for any other value of QRL_CLI_VERBOSE', () => {
      process.env.QRL_CLI_VERBOSE = 'true'
      const printed = capturingConsoleInfo(() => loadLoader(() => {}))
      assert.deepStrictEqual(printed, [])
    })

    it('names the implementation when --verbose is on the command line', () => {
      delete process.env.QRL_CLI_VERBOSE
      process.argv.push('--verbose')
      try {
        const printed = capturingConsoleInfo(() => loadLoader(() => {}))
        assert.deepStrictEqual(printed, [[`eccrypto secp256k1 implementation: ${NATIVE}`]])
      } finally {
        process.argv.pop()
      }
    })

    it('names the implementation when -v is on the command line', () => {
      delete process.env.QRL_CLI_VERBOSE
      process.argv.push('-v')
      try {
        const printed = capturingConsoleInfo(() => loadLoader(() => {}))
        assert.deepStrictEqual(printed, [[`eccrypto secp256k1 implementation: ${NATIVE}`]])
      } finally {
        process.argv.pop()
      }
    })
  })
})
