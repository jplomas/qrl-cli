//
// Raised when a node's unsigned-transaction response does not match what we asked it to build.
//
// Kept in its own module so commands can catch it by identity — `err instanceof
// ResponseBindingError` — and report a substitution attempt distinctly from an ordinary gRPC
// or wallet failure. It is always thrown *before* anything is signed.
//
class ResponseBindingError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ResponseBindingError'
  }
}

module.exports = ResponseBindingError
