(function(exports) {
    const { MerkleJson } = require('merkle-json');
    const MemoCache = require('./memo-cache');
    const { logger } = require("log-instance");

    class Memoizer {
        constructor(opts={}) {
            (opts.logger || logger).logInstance(this);
            this.mj = new MerkleJson();
            this.cache = opts.cache || new MemoCache({
                logger:this,
                writeMem: opts.writeMem,
                writeFile: opts.writeFile,
            });
        }

        volumeOf(method, context=this.context) {
            var methodName = method && method.name || "lambda";
            var contextName = typeof context === 'string' && context
                || context && context.name 
                || "global";
            return `${contextName}.${methodName}`;
        }

        memoize(method, context) {
            var { mj, cache } = this;
            var volume = this.volumeOf(method, context);
            var fbody = method.toString();
            var fmemo = (...args)=>{
                var key = {
                    volume,
                    fbody,
                    args,
                };
                var guid = mj.hash(key);
                var value = this.cache.get({guid, args, volume});
                if (value === undefined) {
                    value = method.apply(undefined, args);
                    this.cache.put({guid, args, volume, value});
                }
                return value;
            };
            return fmemo;
        }

        async clearMemo(method, context) {
            var volume = this.volumeOf(method, context);
            await this.cache.clearVolume(volume);
        }

    }

    module.exports = exports.Memoizer = Memoizer;
})(typeof exports === "object" ? exports : (exports = {}));
