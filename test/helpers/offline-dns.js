// ///////////////////////////////////////////////////////////////////////////
// offline-dns
//
// A --require preload for CLI child processes: every hostname that is not an
// IP literal or `localhost` fails to resolve, exactly as it would on a machine
// with no network.
//
// Commands that take -t/--testnet or -m/--mainnet hard-code the public QRL
// endpoints and ignore --grpc, so there is no flag that keeps those code paths
// on the machine. Preloading this means the connection-failure path can be
// tested for real without the test ever reaching mainnet or testnet.
// ///////////////////////////////////////////////////////////////////////////

const dns = require('dns')

const notFound = () =>
  Object.assign(new Error('getaddrinfo ENOTFOUND (blocked: offline test)'), {code: 'ENOTFOUND'})

const isRemoteName = host =>
  typeof host === 'string' && host !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)

const realLookup = dns.lookup
dns.lookup = function lookup(host, ...rest) {
  const callback = rest[rest.length - 1]
  if (isRemoteName(host) && typeof callback === 'function') {
    process.nextTick(() => callback(notFound()))
    return undefined
  }
  return realLookup.call(dns, host, ...rest)
}

if (dns.promises) {
  const realLookupAsync = dns.promises.lookup
  dns.promises.lookup = (host, ...rest) =>
    (isRemoteName(host)
      ? Promise.reject(notFound())
      : realLookupAsync.call(dns.promises, host, ...rest))
}

const RESOLVERS = ['resolve', 'resolve4', 'resolve6', 'resolveTxt', 'resolveSrv']

RESOLVERS.forEach(name => {
  const real = dns[name]
  if (!real) {
    return
  }
  dns[name] = function resolver(host, ...rest) {
    const callback = rest[rest.length - 1]
    if (isRemoteName(host) && typeof callback === 'function') {
      process.nextTick(() => callback(notFound()))
      return undefined
    }
    return real.call(dns, host, ...rest)
  }
})
