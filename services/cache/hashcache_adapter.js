// a glorified hashtable that implements the cache interface
module.exports.HashCache = class HashCache {
    constructor() {
        this.cache = {}
    }

    get(key) {
        return this.cache[key];
    }

    set(key, value) {
        this.cache[key] = value;
    }
}