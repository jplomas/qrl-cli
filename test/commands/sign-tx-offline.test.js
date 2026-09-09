// ///////////////////////////////////////////////////////////////////////////
// sign-tx-offline tests
//
// sign-tx-offline is the one send-style command with every gRPC call commented
// out: it builds, signs and writes a transaction entirely locally. That makes
// the whole command — validation ladder, wallet/hexseed loading, the XMSS
// signing callback and the file write — reachable without a node, yet it was
// the least covered file in the repo.
//
// Nothing here touches the network and nothing is ever pushed to a node, so no
// OTS key is spent on chain. The wallets are throwaway height-4 trees built in
// before() and used nowhere else.
// ///////////////////////////////////////////////////////////////////////////

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {spawn} = require('child_process')

// Own scratch directory: several test files run in parallel and must not share
// fixture paths.
const TMP = path.join(os.tmpdir(), 'signtx-offline-tests')
const WALLET = path.join(TMP, 'wallet.json')
const ENC_WALLET = path.join(TMP, 'enc-wallet.json')
const LEGACY_WALLET = path.join(TMP, 'legacy-wallet.json')
const NOT_A_WALLET = path.join(TMP, 'not-a-wallet.json')
const RECIPIENTS = path.join(TMP, 'recipients.json')
const BAD_JSON_FILE = path.join(TMP, 'not-json.txt')
const EMPTY_TX_FILE = path.join(TMP, 'empty-tx.json')
const MISSING_FILE = path.join(TMP, 'does-not-exist.json')
const UNWRITABLE_OUT = path.join(path.sep, 'signtx-no-such-dir', 'out.json')

const ENC_PASS = 'signtx-test-password'
const LEGACY_PASS = 'legacy-test-password'

const TO_A = 'Q000300cc040d28c309c8e82d1397aa0d9b74666b492f77b485d327bf5496a725b7b8a3c024b9ee'
const TO_B = 'Q0103001d65d7e59aed5efbeae64246e0f3184d7c42411421eb385ba30f2c1c005a85ebc4419cfd'

let wallet // the plaintext wallet as written by create-wallet

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

// Every refusal case must fail for the stated reason: asserting on the message
// stops a command that starts failing earlier (a missing flag, a bad fixture)
// from silently keeping the test green.
async function refuses(args, expected) {
  const {code, out} = await run(args)
  assert.notStrictEqual(code, 0, `expected a non-zero exit for: ${args.join(' ')}`)
  assert.ok(expected.test(out), `expected output to match ${expected}\n--- actual ---\n${out}`)
}

// Signing succeeds but the process still exits non-zero (see the exit-code test
// below), so success is judged on the messages and the file that was written.
async function signs(args) {
  const {out} = await run(args)
  assert.ok(
    /Transaction written to /.test(out),
    `expected a signed transaction for: ${args.join(' ')}\n--- actual ---\n${out}`
  )
  return out
}

// A wallet file in the pre-v2 format written by the old `aes256` package:
// unauthenticated AES-256-CTR, so a wrong password decrypts to garbage instead
// of throwing. That is the only way to reach the "invalid password" branch —
// v2 blobs fail authentication first and land on "invalid wallet file".
function legacyEncrypt(password, plaintext) {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(String(password)).digest()
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  return Buffer.concat([iv, ciphertext]).toString('base64')
}

describe('sign-tx-offline', () => {
  before(async () => {
    fs.mkdirSync(TMP, {recursive: true})
    // Height 4 keeps key generation and signing fast; the tree height has no
    // bearing on any path this file exercises.
    await run(['create-wallet', '-h', '4', '-f', WALLET])
    await run(['create-wallet', '-h', '4', '-p', ENC_PASS, '-f', ENC_WALLET])
    ;[wallet] = JSON.parse(fs.readFileSync(WALLET))

    fs.writeFileSync(
      LEGACY_WALLET,
      JSON.stringify([
        {
          encrypted: true,
          address: legacyEncrypt(LEGACY_PASS, wallet.address),
          hexseed: legacyEncrypt(LEGACY_PASS, wallet.hexseed),
        },
      ])
    )
    fs.writeFileSync(NOT_A_WALLET, JSON.stringify([{nothing: 'useful'}]))
    fs.writeFileSync(
      RECIPIENTS,
      JSON.stringify({tx: [{to: TO_A, shor: '100'}, {to: TO_B, shor: '200'}]})
    )
    fs.writeFileSync(BAD_JSON_FILE, 'this is not json')
    fs.writeFileSync(EMPTY_TX_FILE, JSON.stringify({tx: []}))
    // Wiped, not just created: the fixture directory has a fixed name, so a file
    // left by an earlier run would make "this was never written" assertions pass
    // or fail on history rather than on what the command did.
    fs.rmSync(path.join(TMP, 'out'), {recursive: true, force: true})
    fs.mkdirSync(path.join(TMP, 'out'), {recursive: true})
  })

  // Signed transactions go in their own directory: an output path that collided
  // with a fixture would quietly overwrite the wallet under test.
  const out = name => path.join(TMP, 'out', name)

  describe('recipient selection', () => {
    it('refuses to sign with no recipient at all', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET],
        /Unable to send: no recipients/
      )
    })

    it('refuses when a recipient and a JSON object are both given', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-r', TO_A, '-j', '{"tx":[]}'],
        /use either recipient \(-r\)/
      )
    })

    it('rejects -s alongside -j, where the amounts are already in Shor', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-s', '-j', '{"tx":[]}'],
        /-s flag is redundant/
      )
    })

    it('rejects -s alongside -R, where the amounts are already in Shor', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-s', '-R', RECIPIENTS],
        /-s flag is redundant/
      )
    })

    it('refuses to sign without a wallet or a hexseed', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-r', TO_A],
        /no wallet json file or hexseed specified/
      )
    })

    it('rejects an invalid recipient address', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-r', 'Qdeadbeef'],
        /Unable to send: invalid recipient address/
      )
    })
  })

  // The -j/-R output arrays are user-supplied and go straight into the signed
  // payload, so each rejection in checkTxJSON is worth pinning individually.
  describe('output JSON validation', () => {
    const withJson = json => ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-j', json]

    it('rejects a -j value that is not JSON', async () => {
      await refuses(withJson('not-json-at-all'), /invalid output data \(not-json-at-all\)/)
    })

    it('rejects a -j object with no tx array', async () => {
      await refuses(withJson('{"foo":1}'), /array is undefined/)
    })

    it('rejects an empty tx array', async () => {
      await refuses(withJson('{"tx":[]}'), /length of array is 0/)
    })

    it("rejects an output with no 'to' key", async () => {
      await refuses(withJson('{"tx":[{"shor":"100"}]}'), /Output #0 does not have a 'to' key/)
    })

    it('rejects an output whose address is not a QRL address', async () => {
      await refuses(
        withJson('{"tx":[{"to":"Qdeadbeef","shor":"100"}]}'),
        /Output #0 does not contain a valid QRL address/
      )
    })

    it("rejects an output with no 'shor' key", async () => {
      await refuses(withJson(`{"tx":[{"to":"${TO_A}"}]}`), /Output #0 does not have a 'shor' key/)
    })

    it('rejects a -R file that is not JSON', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-R', BAD_JSON_FILE],
        /invalid output data \(this is not json/
      )
    })

    it('rejects a -R file whose tx array is empty', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-R', EMPTY_TX_FILE],
        /json file contains invalid output data \(No transactions found/
      )
    })

    it('reports a missing -R file rather than signing', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', WALLET, '-R', MISSING_FILE],
        /ENOENT/
      )
    })
  })

  describe('key material', () => {
    it('rejects a JSON file that is not a wallet', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', NOT_A_WALLET, '-r', TO_A],
        /Unable to open wallet file: invalid wallet file/
      )
    })

    it('rejects the wrong password for an encrypted wallet', async () => {
      // The wallet is fine; the password is not, and the message says so. It used to
      // report "invalid wallet file", because the decryption error was caught by the
      // same handler that reports an unreadable file.
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-w', ENC_WALLET, '-p', 'not-the-password', '-r', TO_A],
        /Unable to open wallet file: invalid password/
      )
    })

    it('rejects a wallet file that is not JSON, rather than crashing', async () => {
      // The read used to sit outside the try, so a file that is not JSON escaped as a
      // raw SyntaxError instead of reaching the message below.
      await refuses(
        ['sign-tx-offline', '1', out('b.json'), '-i', '0', '-w', BAD_JSON_FILE, '-r', TO_A],
        /Unable to open wallet file: invalid wallet file/
      )
    })

    it('rejects a truncated hexseed', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-h', '000200aabbcc', '-r', TO_A],
        /Hexseed invalid: too short/
      )
    })

    it('rejects a mnemonic without 34 words', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-h', 'aback bunny unfair', '-r', TO_A],
        /Mnemonic phrase invalid: too short/
      )
    })
  })

  describe('ots index and fee', () => {
    it('rejects a non-numeric OTS index', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', 'not-a-number', '-w', WALLET, '-r', TO_A],
        /OTS key is invalid/
      )
    })

    it('accepts an explicit fee of 0', async () => {
      // Unlike the other spending commands this one defaults to 100, but 0 is still a
      // fee the network accepts, and parseInt('0') being falsy is no reason to refuse it.
      const file = out('zero-fee.json')
      await signs(['sign-tx-offline', '1', file, '-i', '0', '-f', '0', '-w', WALLET, '-r', TO_A])
      assert.strictEqual(JSON.parse(fs.readFileSync(file)).fee, 0)
    })

    it('rejects a negative fee', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('neg-fee.json'), '-i', '0', '-f', '-5', '-w', WALLET, '-r', TO_A],
        /Fee is invalid/
      )
    })

    it('reports a hexseed the XMSS library cannot use, rather than failing silently', async () => {
      // The right length but not hex: it clears the length check and only fails inside
      // QRLLIB, where the throw used to escape uncaught with nothing printed.
      await refuses(
        ['sign-tx-offline', '1', out('bad-seed.json'), '-i', '0', '-h', '020200cb68ca52ae4aff1d2ac10a2cc03f2325b95ab4610d2c6fd2af684aa1427766ac0b96b05942734d254fb9dba5fcb139HG', '-r', TO_A],
        /Failed to recreate XMSS wallet object/
      )
    })

    it('rejects a non-numeric fee', async () => {
      await refuses(
        ['sign-tx-offline', '1', out('a.json'), '-i', '0', '-f', 'free', '-w', WALLET, '-r', TO_A],
        /Fee is invalid/
      )
    })

    it('signs with a custom fee in Shor', async () => {
      const file = out('fee.json')
      const output = await signs([
        'sign-tx-offline', '1000', file, '-i', '1', '-s', '-f', '250', '-w', WALLET, '-r', TO_A,
      ])
      assert.ok(/Fee: 250 Shor/.test(output), output)
      const tx = JSON.parse(fs.readFileSync(file))
      assert.strictEqual(tx.fee, 250)
      // -s means the quantity is already Shor and must not be multiplied up.
      assert.deepStrictEqual(tx.amounts, ['1000'])
    })

    // An empty --otsindex satisfies oclif's `required` check but is falsy, so it
    // used to skip the validation above and sign with parseInt('') === NaN,
    // writing a transaction whose OTS index was null.
    it('rejects an empty OTS index rather than signing with NaN', async () => {
      const file = out('empty-ots.json')
      await refuses(
        ['sign-tx-offline', '1', file, '-i', '', '-w', WALLET, '-r', TO_A],
        /OTS key is invalid/
      )
      assert.strictEqual(fs.existsSync(file), false, 'nothing may be written for an unusable OTS index')
    })
  })

  describe('signing', () => {
    it('signs from a plaintext wallet and converts Quanta to Shor', async () => {
      const file = out('wallet.json')
      const output = await signs(['sign-tx-offline', '1', file, '-i', '0', '-w', WALLET, '-r', TO_A])
      assert.ok(output.includes(`Sending from: ${wallet.address}`), output)
      assert.ok(/Transaction signed with OTS key 0/.test(output), output)
      assert.ok(output.includes(`Transaction written to ${file}`), output)

      const tx = JSON.parse(fs.readFileSync(file))
      assert.match(tx.hash, /^[0-9a-f]{64}$/)
      assert.deepStrictEqual(tx.amounts, ['1000000000'])
      assert.strictEqual(tx.fee, 100)
      assert.strictEqual(tx.ots, 0)
      assert.strictEqual(tx.addrs_to.length, 1)
      // The public key travels with the transaction: a node cannot verify the
      // signature without it, so a wrong one here would push an unusable tx.
      assert.strictEqual(Buffer.from(tx.public_key.data).toString('hex'), wallet.pk)
    })

    it('signs a multi-output transaction from a -R file', async () => {
      const file = out('multi.json')
      const output = await signs([
        'sign-tx-offline', '1', file, '-i', '1', '-w', WALLET, '-R', RECIPIENTS,
      ])
      assert.ok(output.includes(`address to: ${TO_A}`), output)
      assert.ok(output.includes(`address to: ${TO_B}`), output)
      const tx = JSON.parse(fs.readFileSync(file))
      assert.deepStrictEqual(tx.amounts, ['100', '200'])
      assert.strictEqual(tx.addrs_to.length, 2)
    })

    it('signs a multi-output transaction from a -j object', async () => {
      const file = out('json-object.json')
      await signs([
        'sign-tx-offline', '1', file, '-i', '2', '-w', WALLET,
        '-j', JSON.stringify({tx: [{to: TO_A, shor: '1'}, {to: TO_B, shor: '2'}]}),
      ])
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(file)).amounts, ['1', '2'])
    })

    it('signs from a hexseed with no wallet file', async () => {
      const file = out('hexseed.json')
      await signs(['sign-tx-offline', '1', file, '-i', '3', '-h', wallet.hexseed, '-r', TO_A])
      assert.match(JSON.parse(fs.readFileSync(file)).hash, /^[0-9a-f]{64}$/)
    })

    it('signs from a mnemonic', async () => {
      const file = out('mnemonic.json')
      await signs(['sign-tx-offline', '1', file, '-i', '4', '-h', wallet.mnemonic, '-r', TO_A])
      const tx = JSON.parse(fs.readFileSync(file))
      // Same key, reached by a different constructor: the public key must match
      // the one the hexseed produces.
      assert.strictEqual(Buffer.from(tx.public_key.data).toString('hex'), wallet.pk)
    })

    it('signs from an encrypted wallet given the password', async () => {
      const file = out('encrypted.json')
      const encAddress = JSON.parse(fs.readFileSync(ENC_WALLET))[0].address
      const output = await signs([
        'sign-tx-offline', '1', file, '-i', '0', '-w', ENC_WALLET, '-p', ENC_PASS, '-r', TO_A,
      ])
      assert.ok(/Sending from: Q[0-9a-f]{78}/.test(output), output)
      assert.ok(!output.includes(encAddress), 'the encrypted address must not be echoed verbatim')
      assert.match(JSON.parse(fs.readFileSync(file)).hash, /^[0-9a-f]{64}$/)
    })

    // The command signs inside a QRLLIB callback that run() awaits, so the
    // this.exit(0) at the end of it reaches oclif and the process exits cleanly.
    // Before that, a successful signing reported failure to anything checking $?.
    it('exits zero when the transaction is signed and written', async () => {
      const file = out('exit-code.json')
      const {code, out: output} = await run([
        'sign-tx-offline', '1', file, '-i', '5', '-w', WALLET, '-r', TO_A,
      ])
      assert.ok(output.includes(`Transaction written to ${file}`), output)
      assert.strictEqual(code, 0, output)
    })

    it('fails cleanly when the output file cannot be written', async () => {
      await refuses(
        ['sign-tx-offline', '1', UNWRITABLE_OUT, '-i', '0', '-w', WALLET, '-r', TO_A],
        /Writing transaction to file .* failed/
      )
    })
  })

  // cli-ux's hidden prompt shells out to `read -s` and needs a TTY, so the
  // no-password path cannot be driven through a spawned child. Run the command
  // in-process instead with the prompt stubbed.
  describe('password prompt', () => {
    const {cli} = require('cli-ux') // eslint-disable-line global-require
    const {SignTxOffline} = require('../../src/commands/sign-tx-offline') // eslint-disable-line global-require

    it('prompts for the password when none is given, and rejects a wrong one', async () => {
      const promptDescriptor = Object.getOwnPropertyDescriptor(cli, 'prompt')
      const write = process.stdout.write.bind(process.stdout)
      let logged = ''
      let prompted = false
      Object.defineProperty(cli, 'prompt', {
        configurable: true,
        get: () => async () => {
          prompted = true
          return 'wrong-password'
        },
      })
      process.stdout.write = chunk => {
        logged += chunk
        return true
      }
      let error
      try {
        await SignTxOffline.run([
          '1', path.join(TMP, 'prompted.json'), '-i', '0', '-w', LEGACY_WALLET, '-r', TO_A,
        ])
      } catch (e) {
        error = e
      } finally {
        process.stdout.write = write
        Object.defineProperty(cli, 'prompt', promptDescriptor)
      }
      assert.ok(prompted, 'expected the command to prompt for a wallet password')
      assert.ok(error, 'expected a non-zero exit')
      assert.strictEqual(error.oclif.exit, 1)
      // A legacy blob decrypts to garbage under the wrong password, so the
      // address check is the only thing catching it.
      assert.ok(/invalid password/.test(logged), logged)
    })
  })
})
