(function(exports) {
    const fs = require('fs');
    const path = require('path');
    const { logger } = require('log-instance');
    const Files = require('./files');
    const MS_MINUTE = 60 * 1000;
    const MS_DAY = 24 * 60 * MS_MINUTE;
    const PRUNE_DAYS = 180;

    var instances = 0;

    class FilePruner { 
        constructor(opts={}) {
            var that = this;

            // options
            that.name = `${that.constructor.name}_${++instances}`;
            (opts.logger || logger).logInstance(this);
            if (!fs.existsSync(opts.root)) {
                throw new Error(`Expected file path for root:${opts.root}`);
            }
            that.root = opts.root;
            that.pruneDays = opts.pruneDays || PRUNE_DAYS;
            that.onPrune = opts.onPrune || FilePruner.onPrune;

            // instance
            that.started = undefined;
            that.done = undefined;
            that.earliest = undefined;
            that.pruning = 0;
            that.size = {
                total: 0,
                pruned: 0,
            };
        }

        static onPrune(oldPath, stats) {
            logger.debug("prune", oldPath);
            return true;
        }

        async pruneOldFiles(onPrune = this.onPrune) {
            var that = this;
            var {
                root,
                pruning,
            } = that;
            if (pruning) {
                return Promise.reject(new Error(
                    `pruneOldFiles() ignored (busy)`));
            }
            that.pruning = 1;
            var pruneDays = that.pruneDays || 180;
            var pruned = [];
            that.started = new Date();
            that.size.total = 0;
            that.size.pruned = 0;
            that.earliest = Date.now();
            var pruneDate = new Date(Date.now()-pruneDays*MS_DAY);
            that.log(`pruneOldFiles() started:${that.started}`);
            var pruneOpts = { root, stats:true, absolute:true };
            that.pruning = 1;
            for await (let f of Files.files(pruneOpts)) {
                var { stats, path:fpath } = f;
                that.size.total += stats.size;
                stats.mtime < that.earliest && 
                    (that.earliest = stats.mtime);
                if (stats.mtime <= pruneDate) {
                    if (await onPrune(fpath, stats)) { // qualified delete
                        pruned.push(fpath);
                        that.debug(`pruneOldFiles() unlink:${fpath}`);
                        await fs.promises.unlink(fpath);
                        that.size.pruned += stats.size;
                    }
                }
            }
            that.pruning = 0;
            that.done = new Date();
            var elapsed = ((that.done - that.started)/1000).toFixed(1);
            that.log(`pruneOldFiles() done:${elapsed}s`);
            return {
                started: that.started,
                earliest: that.earliest,
                done: that.done,
                size: that.size,
                pruning: that.pruning,
                pruned,
            }
        }

    }

    module.exports = exports.FilePruner = FilePruner;
})(typeof exports === "object" ? exports : (exports = {}));

