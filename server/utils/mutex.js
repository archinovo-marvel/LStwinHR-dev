/**
 * KeyedMutex — per-key mutual exclusion using spin-wait + Promise locks.
 * Replaces the inline while/has/get/set/delete/release pattern used across the codebase.
 */
class KeyedMutex {
  constructor() {
    this._locks = new Map();
  }

  /**
   * Acquire the lock for `key`, run `fn`, then release.
   * Concurrent calls with the same key are serialized; different keys run in parallel.
   * @param {string|number} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async withLock(key, fn) {
    while (this._locks.has(key)) {
      await this._locks.get(key);
    }
    let release;
    const lock = new Promise(r => { release = r; });
    this._locks.set(key, lock);
    try {
      return await fn();
    } finally {
      this._locks.delete(key);
      release();
    }
  }
}

module.exports = { KeyedMutex };
