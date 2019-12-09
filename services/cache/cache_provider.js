// naive cache provider - probably overkill for this project but wanted to
// be consistent with general philosophy of abstracting implementations with
// a lightweight API
module.exports.CacheProvider = class CacheProvider {
    constructor(cache_imp) {
        this.cache = cache_imp;
    }

    get(key) {
        return this.cache.get(key);
    }

    set(key, value) {
        this.cache.set(key, value);
    }
}