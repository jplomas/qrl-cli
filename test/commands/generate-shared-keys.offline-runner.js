// //////////////////////////////////////////////////////////////////////////
// Offline driver for `generate-shared-keys`
//
// `generate-shared-keys` unconditionally opens a gRPC connection to a QRL
// node (src/commands/generate-shared-keys.js, section "0.b") *before* it runs
// any of the Kyber/Dilithium maths, so with no node reachable the command
// exits at that point and none of the lattice crypto is ever executed.
//
// This runner executes the command in-process with the two network methods of
// the Qrlnode class replaced by local stubs, so the offline crypto can be
// driven without a node and without a single byte crossing the network. It is
// *not* a mock node: no socket is opened, no server is started, and only the
// two methods below are replaced.
//
// Behaviour is controlled with environment variables:
//   GSK_API     'notfound' | 'nolattice' | 'lattice'  canned GetObject reply
//   GSK_PUBFILE path of a public lattice key JSON file used to build the
//               'lattice' reply
//   GSK_PROMPT_PASSWORD  answer to give at the hidden lattice-password prompt,
//               standing in for what a person would type at a terminal
//   GSK_CONNECT_ON  attempt number on which connect() first succeeds, so the
//               command's retry loop can be driven (default 1: straight away)
//
// Everything after the flags is passed through to the command as argv.
// //////////////////////////////////////////////////////////////////////////

const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..', '..')
const log = (msg) => process.stderr.write(`${msg}\n`)

// qrllib installs its own `unhandledRejection` handler that silently calls
// process.exit(1); ours is registered first so the reason is at least visible.
process.on('unhandledRejection', (err) => {
  log(`runner unhandledRejection: ${(err && (err.stack || err.message)) || err}`)
})

const Qrlnode = require('../../src/functions/grpc')

const hexBuf = (hex) => Buffer.from(hex, 'hex')

const apiResponse = () => {
  const mode = process.env.GSK_API || 'notfound'
  if (mode === 'notfound') {
    return {found: false}
  }
  if (mode === 'nolattice') {
    return {
      found: true,
      transaction: {addr_from: hexBuf('0102030405'), tx: {}},
    }
  }
  // 'lattice': a lattice transaction carrying the public keys of GSK_PUBFILE
  const pub = JSON.parse(fs.readFileSync(process.env.GSK_PUBFILE))[1]
  return {
    found: true,
    transaction: {
      addr_from: hexBuf('0102030405'),
      tx: {
        latticePK: {
          pk1: hexBuf(pub.pk1),
          pk2: hexBuf(pub.pk2),
          pk3: hexBuf(pub.pk3),
        },
        transaction_hash: hexBuf(pub.tx_hash),
      },
    },
  }
}

let connectAttempts = 0
Qrlnode.prototype.connect = async function stubConnect() {
  connectAttempts += 1
  const connectsOn = parseInt(process.env.GSK_CONNECT_ON || '1', 10)
  if (connectAttempts >= connectsOn) {
    this.connection = true
    this.client = {}
  }
  return this.client
}

Qrlnode.prototype.api = async function stubApi() {
  return apiResponse()
}

// cli-ux exposes `prompt` as a getter, so it has to be redefined rather than assigned.
// The command asks for the lattice password whenever -d is absent, which needs a terminal.
if (process.env.GSK_PROMPT_PASSWORD !== undefined) {
  const {cli} = require('cli-ux') // eslint-disable-line global-require
  Object.defineProperty(cli, 'prompt', {
    configurable: true,
    get: () => async () => process.env.GSK_PROMPT_PASSWORD,
  })
}

// required *after* the stubs are installed so the command picks them up
const {LatticeShared} = require('../../src/commands/generate-shared-keys')

// run() awaits every one of the command's key-derivation callbacks, so by the time it
// resolves the key list and cyphertext files are on disk. This used not to be true, and
// the runner had to poll for them before it could exit.
const main = async () => {
  await LatticeShared.run(process.argv.slice(2), projectRoot)
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    log(`runner error: ${(err && err.message) || err}`)
    const exitCode = (err && err.oclif && err.oclif.exit) || 1
    process.exit(exitCode)
  })
