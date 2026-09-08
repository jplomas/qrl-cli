/* global QRLLIB, BigInt */
//
// Request/response binding for node-built transactions.
//
// Every `qrl-cli` command that spends asks a node to build an unsigned transaction, then signs
// it. The node is not trusted: the default endpoint is remote and the gRPC channel is plaintext
// (`network-helper.js`, `grpc.js` use `createInsecure()`), so anything on the path — or a node
// the user pointed us at — can rewrite the response before we see it.
//
// The signature commits to a preimage. If any part of that preimage is read out of the node's
// response, the node chooses what the user's key signs, and the honest network accepts the
// result because the digest and the pushed transaction agree with each other. Substituting the
// recipient and the amount is then enough to redirect a payment under a valid signature.
//
// `signBoundTransaction` is the only place in this codebase that calls `xmss.sign()` for a
// node-built transaction. It walks a caller-supplied list of preimage parts and, for each one,
// compares what we asked for against what came back and then appends *our* value to the digest.
// Verification and construction are the same loop on purpose: a field cannot be checked and
// then signed in a different form, and a field cannot reach the digest without being checked.
// Adding a new spending command means describing its preimage here, not writing a fresh signer.
//
const ResponseBindingError = require('./tx-binding-error')

const toUint8Vector = (arr) => {
  const vec = new QRLLIB.Uint8Vector()
  for (let i = 0; i < arr.length; i += 1) {
    vec.push_back(arr[i])
  }
  return vec
}

function concatenateTypedArrays(resultConstructor, ...arrays) {
  let totalLength = 0
  arrays.forEach((arr) => {
    totalLength += arr.length
  })
  // eslint-disable-next-line new-cap
  const result = new resultConstructor(totalLength)
  let offset = 0
  arrays.forEach((arr) => {
    result.set(arr, offset)
    offset += arr.length
  })
  return result
}

// Kept byte-for-byte identical to the per-command copies it replaces: this function decides the
// bytes that get signed, so changing it would change every signature the CLI produces.
// NOTE: the `parseInt` narrows through a double, so values above 2^53 Shor cannot be encoded
// exactly. That is pre-existing and is *not* a binding weakness — comparison below is exact
// (BigInt) and rejects any difference this encoding would otherwise hide.
function toBigendianUint64BytesUnsigned(i) {
  let input = i
  if (!Number.isInteger(input)) {
    input = parseInt(input, 10)
  }

  const byteArray = [0, 0, 0, 0, 0, 0, 0, 0]

  for (let index = 0; index < byteArray.length; index += 1) {
    // eslint-disable-next-line no-bitwise
    const byte = input & 0xff
    byteArray[index] = byte
    input = (input - byte) / 256
  }

  byteArray.reverse()

  return new Uint8Array(byteArray)
}

function binaryToBytes(convertMe) {
  const thisBytes = new Uint8Array(convertMe.size())
  for (let i = 0; i < convertMe.size(); i += 1) {
    thisBytes[i] = convertMe.get(i)
  }
  return thisBytes
}

// Normalise anything protobuf hands back for a `bytes` field — Buffer, Uint8Array, plain array
// — into a Buffer, so comparison is over bytes rather than over object identity or shape.
function asBytes(value) {
  if (value === undefined || value === null) {
    return Buffer.alloc(0)
  }
  if (Buffer.isBuffer(value)) {
    return value
  }
  if (value instanceof Uint8Array || Array.isArray(value)) {
    return Buffer.from(value)
  }
  throw new ResponseBindingError(`unsupported bytes value of type ${typeof value}`)
}

// uint64 arrives as a String (the gRPC loader is configured with `longs: String`) and is held
// locally as a Number. Compare the values exactly rather than the encodings: two different
// amounts must never be allowed to look equal because the signing encoding narrows them.
function asUint64(value, source) {
  if (value === undefined || value === null) {
    throw new ResponseBindingError(`missing ${source}`)
  }
  const text = typeof value === 'string' ? value.trim() : String(value)
  if (!/^\d+$/.test(text)) {
    throw new ResponseBindingError(`malformed ${source}: ${JSON.stringify(value)}`)
  }
  return BigInt(text)
}

function describe(part, detail) {
  return `${part.name}${detail === undefined ? '' : ` ${detail}`}`
}

function refuse(part, detail, requested, returned) {
  throw new ResponseBindingError(
    `the node returned a different ${describe(part, detail)} than was requested ` +
      `(requested ${requested}, node returned ${returned})`
  )
}

// Check one part, and return the bytes it contributes to the preimage. The returned bytes are
// always derived from `local` — never from the node's copy.
//
// Every field path used by a caller is a real field of `Transaction` in QRL core's `qrl.proto`,
// and every preimage order matches that transaction type's `get_data_bytes()` in core — both
// checked against the node source rather than inferred, so a legitimate response always
// compares equal and the CLI never refuses a transaction the node built correctly.
function boundBytesFor(part) {
  if (part.kind === 'bytes') {
    const local = asBytes(part.local)
    const remote = asBytes(part.remote)
    if (!local.equals(remote)) {
      refuse(part, undefined, local.toString('hex'), remote.toString('hex'))
    }
    return [local]
  }

  if (part.kind === 'uint64') {
    const local = asUint64(part.local, `requested ${part.name}`)
    const remote = asUint64(part.remote, `${part.name} in the node's response`)
    if (local !== remote) {
      refuse(part, undefined, local.toString(), remote.toString())
    }
    return [toBigendianUint64BytesUnsigned(part.local)]
  }

  if (part.kind === 'pairs') {
    // Addresses and amounts are signed as an interleaved, ordered sequence, so count and order
    // are as security-relevant as the values: dropping a recipient or swapping two of them
    // changes who gets paid without changing any individual field.
    const localAddrs = part.local.addresses.map(asBytes)
    const remoteAddrs = part.remote.addresses.map(asBytes)
    const localAmounts = part.local.amounts
    const remoteAmounts = part.remote.amounts

    if (localAddrs.length !== localAmounts.length) {
      throw new ResponseBindingError(
        `${part.name}: ${localAddrs.length} addresses but ${localAmounts.length} amounts were requested`
      )
    }
    if (remoteAddrs.length !== localAddrs.length) {
      refuse(part, 'recipient count', localAddrs.length, remoteAddrs.length)
    }
    if (remoteAmounts.length !== localAmounts.length) {
      refuse(part, 'amount count', localAmounts.length, remoteAmounts.length)
    }

    const bytes = []
    for (let i = 0; i < localAddrs.length; i += 1) {
      if (!localAddrs[i].equals(remoteAddrs[i])) {
        refuse(part, `recipient at position ${i}`, localAddrs[i].toString('hex'), remoteAddrs[i].toString('hex'))
      }
      const localAmount = asUint64(localAmounts[i], `requested amount at position ${i}`)
      const remoteAmount = asUint64(remoteAmounts[i], `amount at position ${i} in the node's response`)
      if (localAmount !== remoteAmount) {
        refuse(part, `amount at position ${i}`, localAmount.toString(), remoteAmount.toString())
      }
      bytes.push(localAddrs[i])
      bytes.push(toBigendianUint64BytesUnsigned(localAmounts[i]))
    }
    return bytes
  }

  throw new ResponseBindingError(`unknown preimage part kind: ${part.kind}`)
}

// Build the preimage from locally held values, having first confirmed the node agrees with
// every one of them, then sign it.
//
//   parts:    ordered preimage description; see the callers for each transaction type. Order
//             must match QRL core's `get_data_bytes()` for that type or the network rejects the
//             signature.
//   xmss:     the loaded QRLLIB XMSS object
//   otsIndex: OTS index to sign with
//
// Throws ResponseBindingError before any signature exists if the node changed anything. Nothing
// is signed and nothing is pushed on that path — the OTS index is untouched and stays spendable.
function signBoundTransaction({ parts, xmss, otsIndex, publicKey }) {
  const preimageParts = []
  parts.forEach((part) => {
    boundBytesFor(part).forEach((bytes) => preimageParts.push(bytes))
  })

  const concatenated = concatenateTypedArrays(Uint8Array, ...preimageParts)
  const shaSum = QRLLIB.sha2_256(toUint8Vector(concatenated))

  xmss.setIndex(parseInt(otsIndex, 10))
  const signature = binaryToBytes(xmss.sign(shaSum))

  // Transaction hash as the node computes it: sha256(digest || signature || public key).
  const txnHashConcat = concatenateTypedArrays(
    Uint8Array,
    binaryToBytes(shaSum),
    signature,
    publicKey
  )
  const txnHash = QRLLIB.bin2hstr(QRLLIB.sha2_256(toUint8Vector(txnHashConcat)))

  return { signature, shaSum, txnHash, preimage: concatenated }
}

module.exports = {
  ResponseBindingError,
  signBoundTransaction,
  boundBytesFor,
  concatenateTypedArrays,
  toBigendianUint64BytesUnsigned,
  toUint8Vector,
  binaryToBytes,
  asBytes,
  asUint64,
}
