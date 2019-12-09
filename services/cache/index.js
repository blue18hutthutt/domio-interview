const { CacheProvider } = require('./cache_provider');
const { HashCache } = require('./hashcache_adapter');

module.exports.HashCache = HashCache;
module.exports.CacheProvider = CacheProvider;