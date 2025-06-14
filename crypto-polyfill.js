const crypto = require('crypto')

if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || {
    subtle: crypto.webcrypto?.subtle || {
      digest: async (algorithm, data) => {
        const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''))
        hash.update(data)
        return hash.digest()
      },
      importKey: async () => { throw new Error('importKey not implemented') },
      sign: async () => { throw new Error('sign not implemented') },
      verify: async () => { throw new Error('verify not implemented') },
      encrypt: async () => { throw new Error('encrypt not implemented') },
      decrypt: async () => { throw new Error('decrypt not implemented') },
      generateKey: async () => { throw new Error('generateKey not implemented') },
      deriveKey: async () => { throw new Error('deriveKey not implemented') },
      deriveBits: async () => { throw new Error('deriveBits not implemented') },
      wrapKey: async () => { throw new Error('wrapKey not implemented') },
      unwrapKey: async () => { throw new Error('unwrapKey not implemented') }
    },
    getRandomValues: (array) => {
      return crypto.randomFillSync(array)
    }
  }
}

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer
}

module.exports = {}