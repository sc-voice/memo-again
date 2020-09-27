(function(exports) {
    const fs = require('fs');
    const path = require('path');
    const { MerkleJson } = require('merkle-json');
    const { LOCAL_DIR } = require('./files');

    class Cache {
        constructor() {
            this.map = {};
        }

        get(key) {
            return this.map[key];
        }

        put(key, value) {
            this.map[key] = value;
        }
    }

    class Memoizer {
        constructor(opts={}) {
            this.root = opts.root || 
                path.join(LOCAL_DIR, "memo");
            this.mj = new MerkleJson();
            this.cache = opts.cache || new Cache();
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
                var hash = mj.hash(key);
                var hashValue = this.cache.get(hash);
                if (hashValue !== undefined) {
                    return hashValue.isPromise
                        ? Promise.resolve(hashValue.value)
                        : hashValue.value;
                }
                var value = method.apply(instance, args);
                var isPromise = value instanceof Promise;
                this.cache.put(hash, {
                    key,
                    isPromise,
                    value,
                });
                if (isPromise) {
                    var p = value;
                    p.then(r=>{
                        this.cache.put(hash, {
                            key,
                            value: r,
                            isPromise,
                        });
                    });
                }
                return value;
            };
            return f;
        }


    }

    module.exports = exports.Memoizer = Memoizer;
})(typeof exports === "object" ? exports : (exports = {}));
