// ///////////////////////////////////////////////////////////////////////////
// aes test
//
// src/utils/aes.js is what stands between a stolen wallet file and the seed
// inside it, so its error paths matter as much as its happy path: a v2 blob
// that fails authentication must throw rather than return plausible garbage,
// and legacy blobs written by the old `aes256` package must still open.
//
// Offline and deterministic — no node, no network, no wallet files.
// ///////////////////////////////////////////////////////////////////////////

const assert = require('assert')
const crypto = require('crypto')

const aes = require('../../src/utils/aes')

const PASSWORD = 'correct horse battery staple'
const SEED = '000300020923544f0c2ec545e1646999f0a1b2c3d4e5f60718293a4b5c6d7e8f'

// Build a blob in the format the old `aes256` package produced:
// key = sha256(password), AES-256-CTR, base64(iv(16) || ciphertext).
function legacyEncrypt(password, plaintext) {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(String(password)).digest()
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  return Buffer.concat([iv, ciphertext]).toString('base64')
}

describe('utils/aes', () => {
  describe('encrypt', () => {
    it('round-trips through decrypt', () => {
      assert.strictEqual(aes.decrypt(PASSWORD, aes.encrypt(PASSWORD, SEED)), SEED)
    })

    it('writes the v2 envelope: v2:salt:iv:tag:ciphertext', () => {
      const parts = aes.encrypt(PASSWORD, SEED).split(':')
      assert.strictEqual(parts.length, 5)
      assert.strictEqual(parts[0], 'v2')
      assert.strictEqual(Buffer.from(parts[1], 'base64').length, 16, 'salt is 16 bytes')
      assert.strictEqual(Buffer.from(parts[2], 'base64').length, 12, 'iv is 12 bytes')
      assert.strictEqual(Buffer.from(parts[3], 'base64').length, 16, 'GCM tag is 16 bytes')
    })

    it('salts per file, so the same secret never encrypts to the same blob', () => {
      assert.notStrictEqual(aes.encrypt(PASSWORD, SEED), aes.encrypt(PASSWORD, SEED))
    })

    it('rejects a missing or non-string password rather than deriving from one', () => {
      assert.throws(() => aes.encrypt('', SEED), TypeError)
      assert.throws(() => aes.encrypt(undefined, SEED), TypeError)
      assert.throws(() => aes.encrypt(12345, SEED), TypeError)
    })
  })

  describe('decrypt', () => {
    it('fails closed on the wrong password instead of returning garbage', () => {
      const blob = aes.encrypt(PASSWORD, SEED)
      assert.throws(
        () => aes.decrypt('wrong password', blob),
        /Decryption failed: incorrect password or corrupted file/
      )
    })

    it('fails closed on a tampered ciphertext', () => {
      // GCM authenticates, so flipping one ciphertext byte must be detected. This is the
      // property the legacy CTR format did not have.
      const parts = aes.encrypt(PASSWORD, SEED).split(':')
      const ciphertext = Buffer.from(parts[4], 'base64')
      ciphertext[0] = (ciphertext[0] + 1) % 256
      parts[4] = ciphertext.toString('base64')
      assert.throws(() => aes.decrypt(PASSWORD, parts.join(':')), /Decryption failed/)
    })

    it('fails closed on a tampered auth tag', () => {
      const parts = aes.encrypt(PASSWORD, SEED).split(':')
      const tag = Buffer.from(parts[3], 'base64')
      tag[0] = (tag[0] + 1) % 256
      parts[3] = tag.toString('base64')
      assert.throws(() => aes.decrypt(PASSWORD, parts.join(':')), /Decryption failed/)
    })

    it('still reads legacy aes256 blobs, so old wallet files keep opening', () => {
      assert.strictEqual(aes.decrypt(PASSWORD, legacyEncrypt(PASSWORD, SEED)), SEED)
    })

    it('accepts a non-string blob, since wallet JSON values are not always strings', () => {
      const blob = aes.encrypt(PASSWORD, SEED)
      assert.strictEqual(aes.decrypt(PASSWORD, {toString: () => blob}), SEED)
    })
  })

  describe('format discrimination', () => {
    it('routes on the v2 prefix, which base64 can never produce', () => {
      // Legacy blobs are plain base64 and so can never contain a ':'. That is what makes the
      // prefix an unambiguous discriminator rather than a guess.
      for (let i = 0; i < 50; i += 1) {
        assert.ok(!legacyEncrypt(PASSWORD, SEED).includes(':'))
      }
    })

    it('legacy decryption is unauthenticated, so callers must validate the plaintext', () => {
      // Documents the reason every command re-validates the decrypted address instead of
      // trusting decrypt() to have failed. A wrong password on a legacy blob returns bytes.
      const legacy = legacyEncrypt(PASSWORD, SEED)
      let out
      assert.doesNotThrow(() => {
        out = aes.decrypt('wrong password', legacy)
      })
      assert.notStrictEqual(out, SEED)
    })
  })
})
