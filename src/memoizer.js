(function(exports) {
    const { MerkleJson } = require('merkle-json');
    const MemoCache = require('./memo-cache');

    class Memoizer {
        constructor(opts={}) {
            this.mj = new MerkleJson();
            this.cache = opts.cache || new MemoCache();
        }

        memoize(instance, method) {
            var { mj, cache } = this;
            var fbody = method.toString();
            var f = (...args)=>{
                var key = {
                    instance,
                    fbody,
                    args,
                };
                var guid = mj.hash(key);
                var methodName = method && method.name;
                var className = instance && instance.constructor.name || 
                    "function";
                var volume = `${className}.${methodName}`;
                var value = this.cache.get({guid, volume});
                if (value === undefined) {
                    value = method.apply(instance, args);
                    this.cache.put({guid, volume, value});
                }
                return value;
            };
            return f;
        }

    }

    module.exports = exports.Memoizer = Memoizer;
})(typeof exports === "object" ? exports : (exports = {}));
