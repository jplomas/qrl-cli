// ///////////////////////////////////////////////////////////////////////////
// tx-binding test
//
// Regression tests for the request/response binding added to every command that
// signs a node-built transaction.
//
// The defect these cover: the commands used to build the XMSS signing preimage out of
// the *node's* response — fee, recipients and amounts — and then push that same response
// object. Digest and pushed transaction were derived from one object, so they always
// agreed, and a malicious or on-path-modified node could get a valid victim signature
// over a recipient and amount the user never asked for. The gRPC channel is plaintext
// (`createInsecure()`) and the no-flag default endpoint is remote, so the response is not
// trustworthy input.
//
// Every test below drives the real `signBoundTransaction` / `boundBytesFor` with a stub
// QRLLIB, so `sign()` calls are counted: the assertion is not merely that an error is
// raised, but that **no signature is ever produced** on a substituted response.
//
// The first block is the pre-fix demonstration — it reproduces the old construction and
// shows it signing the attacker's values, which is what these tests would do without the
// fix.
// ///////////////////////////////////////////////////////////////////////////

const assert = require('assert')

const {
  signBoundTransaction,
  boundBytesFor,
  ResponseBindingError,
  concatenateTypedArrays,
  toBigendianUint64BytesUnsigned,
} = require('../../src/functions/tx-binding')

// --- stub QRLLIB -----------------------------------------------------------------------
// tx-binding only touches QRLLIB inside function bodies, so a stub is enough to exercise
// the whole signing path offline and to count sign() calls.

let signCalls = 0

function makeVector(bytes) {
  return {
    bytes: Array.from(bytes),
    size() {
      return this.bytes.length
    },
    get(i) {
      return this.bytes[i]
    },
    push_back(v) {
      this.bytes.push(v)
    },
  }
}

// Nothing else in this suite runs QRLLIB in-process — the other tests spawn ./bin/run as a
// child. Save and restore the global anyway, so this file stays self-contained if that
// changes.
let realQRLLIB
before(() => {
  realQRLLIB = global.QRLLIB
})
after(() => {
  global.QRLLIB = realQRLLIB
})

function installStubQRLLIB() {
  signCalls = 0
  global.QRLLIB = {
    Uint8Vector: function Uint8Vector() {
      return makeVector([])
    },
    // Not a real digest — the tests care about which bytes reach it, not the hash value.
    sha2_256: vec => makeVector(vec.bytes.slice(0, 32)),
    bin2hstr: vec => Buffer.from(vec.bytes).toString('hex'),
  }
}

function makeXmss() {
  return {
    index: null,
    setIndex(i) {
      this.index = i
    },
    sign() {
      signCalls += 1
      return makeVector(new Array(8).fill(0xaa))
    },
  }
}

const PUBLIC_KEY = Buffer.alloc(67, 0x11)

// --- fixtures --------------------------------------------------------------------------

const ALICE = Buffer.from('0105000f8ab0b2a0c0e3d1a7a1e7d1f8c9b2a3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5', 'hex')
const MALLORY = Buffer.from('0105001122334455667788990011223344556677889900112233445566778899001122334455', 'hex')
const TOKEN_HASH = Buffer.alloc(32, 0x77)

// token:transfer — QRL core TransferTokenTransaction.get_data_bytes():
//   master_addr || fee || token_txhash || (address || amount)*
function transferTokenParts(overrides = {}) {
  const remote = {
    master_addr: Buffer.alloc(0),
    fee: '100',
    token_txhash: TOKEN_HASH,
    addrs_to: [ALICE],
    amounts: ['1'],
    ...overrides,
  }
  return [
    { name: 'master address', kind: 'bytes', local: Buffer.alloc(0), remote: remote.master_addr },
    { name: 'fee', kind: 'uint64', local: 100, remote: remote.fee },
    { name: 'token hash', kind: 'bytes', local: TOKEN_HASH, remote: remote.token_txhash },
    {
      name: 'transfer',
      kind: 'pairs',
      local: { addresses: [ALICE], amounts: [1] },
      remote: { addresses: remote.addrs_to, amounts: remote.amounts },
    },
  ]
}

// send — TransferTransaction.get_data_bytes(): fee || message_data || (address || amount)*
function transferParts(overrides = {}) {
  const remote = { fee: '100', addrs_to: [ALICE], amounts: ['1000000000'], ...overrides }
  return [
    { name: 'fee', kind: 'uint64', local: 100, remote: remote.fee },
    {
      name: 'transfer',
      kind: 'pairs',
      local: { addresses: [ALICE], amounts: ['1000000000'] },
      remote: { addresses: remote.addrs_to, amounts: remote.amounts },
    },
  ]
}

// token:create — TokenTransaction.get_data_bytes():
//   master_addr || fee || symbol || name || owner || decimals || (address || amount)*
function tokenCreateParts(overrides = {}) {
  const remote = {
    fee: '100',
    symbol: Buffer.from('TEST'),
    name: Buffer.from('Test Token'),
    owner: ALICE,
    decimals: '2',
    initial_balances: [{ address: ALICE, amount: '1000' }],
    ...overrides,
  }
  return [
    { name: 'fee', kind: 'uint64', local: 100, remote: remote.fee },
    { name: 'token symbol', kind: 'bytes', local: Buffer.from('TEST'), remote: remote.symbol },
    { name: 'token name', kind: 'bytes', local: Buffer.from('Test Token'), remote: remote.name },
    { name: 'token owner', kind: 'bytes', local: ALICE, remote: remote.owner },
    { name: 'decimals', kind: 'uint64', local: 2, remote: remote.decimals },
    {
      name: 'initial balances',
      kind: 'pairs',
      local: { addresses: [ALICE], amounts: [1000] },
      remote: {
        addresses: remote.initial_balances.map(b => b.address),
        amounts: remote.initial_balances.map(b => b.amount),
      },
    },
  ]
}

function sign(parts) {
  return signBoundTransaction({
    parts,
    xmss: makeXmss(),
    otsIndex: 0,
    publicKey: PUBLIC_KEY,
  })
}

// Assert that a substituted response is refused *and* that nothing was signed.
function assertRefuses(parts, expected) {
  installStubQRLLIB()
  assert.throws(
    () => sign(parts),
    err => err instanceof ResponseBindingError && new RegExp(expected).test(err.message),
    `expected a ResponseBindingError matching /${expected}/`
  )
  assert.strictEqual(signCalls, 0, 'the XMSS key must not be used when the node response was substituted')
}

// ---------------------------------------------------------------------------------------

describe('tx-binding: the pre-fix construction (demonstration, not the shipped path)', () => {
  // This is what every command used to do — build the preimage out of the node's response.
  // It is reproduced here so the regression tests below have something to fail against:
  // remove the binding and this is the behaviour you get back.
  const preFixPreimageFromResponse = response => {
    let out = concatenateTypedArrays(
      Uint8Array,
      Buffer.alloc(0),
      toBigendianUint64BytesUnsigned(response.fee),
      TOKEN_HASH
    )
    response.addrs_to.forEach((addr, i) => {
      out = concatenateTypedArrays(
        Uint8Array,
        out,
        addr,
        toBigendianUint64BytesUnsigned(response.amounts[i])
      )
    })
    return Buffer.from(out)
  }

  it('signed the attacker recipient and amount when the node substituted them', () => {
    const honest = preFixPreimageFromResponse({ fee: '100', addrs_to: [ALICE], amounts: ['1'] })
    const hostile = preFixPreimageFromResponse({ fee: '900', addrs_to: [MALLORY], amounts: ['7'] })

    // Different preimage => a different digest => a signature over values the user never asked
    // for. Nothing rejected it, because the digest and the pushed transaction agreed.
    assert.ok(!honest.equals(hostile))
    assert.ok(hostile.includes(MALLORY), 'the old preimage committed to the attacker address')
  })

  it('the bound path refuses that same substituted response and signs nothing', () => {
    assertRefuses(
      transferTokenParts({ addrs_to: [MALLORY], amounts: ['7'], fee: '900' }),
      'the node returned a different'
    )
  })
})

describe('tx-binding: token:transfer response substitution', () => {
  it('accepts a response that matches the request', () => {
    installStubQRLLIB()
    const { signature } = sign(transferTokenParts())
    assert.ok(signature.length > 0)
    assert.strictEqual(signCalls, 1)
  })

  it('refuses a substituted recipient', () => {
    assertRefuses(transferTokenParts({ addrs_to: [MALLORY] }), 'transfer recipient at position 0')
  })

  it('refuses a substituted amount', () => {
    assertRefuses(transferTokenParts({ amounts: ['7'] }), 'transfer amount at position 0')
  })

  it('refuses an inflated fee', () => {
    assertRefuses(transferTokenParts({ fee: '900' }), 'fee')
  })

  it('refuses a substituted token hash', () => {
    assertRefuses(transferTokenParts({ token_txhash: Buffer.alloc(32, 0x66) }), 'token hash')
  })

  it('refuses an injected master address', () => {
    assertRefuses(transferTokenParts({ master_addr: MALLORY }), 'master address')
  })

  it('refuses an extra recipient appended by the node', () => {
    assertRefuses(
      transferTokenParts({ addrs_to: [ALICE, MALLORY], amounts: ['1', '7'] }),
      'recipient count'
    )
  })

  it('refuses a dropped recipient', () => {
    assertRefuses(transferTokenParts({ addrs_to: [], amounts: [] }), 'recipient count')
  })
})

describe('tx-binding: send (native QRL) response substitution', () => {
  it('accepts a response that matches the request', () => {
    installStubQRLLIB()
    sign(transferParts())
    assert.strictEqual(signCalls, 1)
  })

  it('refuses a substituted recipient', () => {
    assertRefuses(transferParts({ addrs_to: [MALLORY] }), 'transfer recipient at position 0')
  })

  it('refuses a substituted amount', () => {
    assertRefuses(transferParts({ amounts: ['999000000000'] }), 'transfer amount at position 0')
  })

  it('refuses an inflated fee', () => {
    assertRefuses(transferParts({ fee: '900' }), 'fee')
  })
})

describe('tx-binding: token:create response substitution', () => {
  it('accepts a response that matches the request', () => {
    installStubQRLLIB()
    sign(tokenCreateParts())
    assert.strictEqual(signCalls, 1)
  })

  it('refuses substituted initial balance holders', () => {
    assertRefuses(
      tokenCreateParts({ initial_balances: [{ address: MALLORY, amount: '1000' }] }),
      'initial balances recipient at position 0'
    )
  })

  it('refuses a substituted initial balance amount', () => {
    assertRefuses(
      tokenCreateParts({ initial_balances: [{ address: ALICE, amount: '999999' }] }),
      'initial balances amount at position 0'
    )
  })

  it('refuses a substituted owner', () => {
    assertRefuses(tokenCreateParts({ owner: MALLORY }), 'token owner')
  })

  it('refuses substituted symbol, name or decimals', () => {
    assertRefuses(tokenCreateParts({ symbol: Buffer.from('EVIL') }), 'token symbol')
    assertRefuses(tokenCreateParts({ name: Buffer.from('Evil Token') }), 'token name')
    assertRefuses(tokenCreateParts({ decimals: '9' }), 'decimals')
  })
})

describe('tx-binding: the signed bytes come from the request, not the response', () => {
  it('builds the preimage out of local values', () => {
    // Same value on both sides, but distinct objects: the bytes handed back must be the
    // caller's, so that a field can never be checked and then signed in another form.
    const local = Buffer.from(ALICE)
    const remote = Buffer.from(ALICE)
    const [bytes] = boundBytesFor({ name: 'address', kind: 'bytes', local, remote })
    assert.strictEqual(bytes, local)
    assert.notStrictEqual(bytes, remote)
  })

  it('compares uint64 exactly rather than through the signing encoding', () => {
    // The signing encoding narrows through a double, so these two amounts encode to the same
    // eight bytes. Comparison must still reject them, or the narrowing becomes a bypass.
    const a = '9007199254740993'
    const b = '9007199254740992'
    assert.deepStrictEqual(
      Array.from(toBigendianUint64BytesUnsigned(a)),
      Array.from(toBigendianUint64BytesUnsigned(b)),
      'precondition: these encode identically'
    )
    assertRefuses(transferParts({ amounts: [a] }).map(p => (p.kind === 'pairs'
      ? { ...p, local: { addresses: [ALICE], amounts: [b] } }
      : p)), 'transfer amount at position 0')
  })

  it('rejects a malformed uint64 from the node instead of coercing it', () => {
    assertRefuses(transferParts({ fee: '1e1' }), "malformed fee in the node's response")
  })

  it('rejects a malformed uint64 in our own request rather than signing a truncation', () => {
    installStubQRLLIB()
    assert.throws(
      () => sign(transferParts().map(p => (p.name === 'fee' ? { ...p, local: '1.5' } : p))),
      err => err instanceof ResponseBindingError && /malformed requested fee/.test(err.message)
    )
    assert.strictEqual(signCalls, 0)
  })
})
