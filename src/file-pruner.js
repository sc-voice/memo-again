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
            // options
            this.name = `${this.constructor.name}_${++instances}`;
            (opts.logger || logger).logInstance(this);
            if (!fs.existsSync(opts.root)) {
                throw new Error(`Expected file path for root:${opts.root}`);
            }
            this.root = opts.root;
            this.pruneDays = opts.pruneDays || PRUNE_DAYS;
            this.onPrune = opts.onPrune || FilePruner.onPrune;

            // instance
            this.started = undefined;
            this.done = undefined;
            this.earliest = undefined;
            this.pruning = 0;
            this.size = {
                total: 0,
                pruned: 0,
            };
        }

        static onPrune(oldPath, stats) {
            logger.debug("prune", oldPath);
            return true;
        }

        async pruneOldFiles(onPrune = this.onPrune) { try {
            var {
                root,
                pruning,
            } = this;
            if (pruning) {
                throw new Error(`pruneOldFiles() ignored (busy)`);
            }
            this.pruning = 1;
            var pruneDays = this.pruneDays || 180;
            var pruned = [];
            this.started = new Date();
            this.size.total = 0;
            this.size.pruned = 0;
            this.earliest = Date.now();
            var pruneDate = new Date(Date.now()-pruneDays*MS_DAY);
            this.log(`pruneOldFiles() started:${this.started}`);
            var pruneOpts = { root, stats:true, absolute:true };
            this.pruning = 1;
            for await (let f of Files.files(pruneOpts)) {
                var { stats, path:fpath } = f;
                this.size.total += stats.size;
                stats.mtime < this.earliest && 
                    (this.earliest = stats.mtime);
                if (stats.mtime <= pruneDate) {
                    if (await onPrune(fpath, stats)) { // qualified delete
                        pruned.push(fpath);
                        this.debug(`pruneOldFiles() unlink:${fpath}`);
                        await fs.promises.unlink(fpath);
                        this.size.pruned += stats.size;
                    }
                }
            }
            this.pruning = 0;
            this.done = new Date();
            var elapsed = ((this.done - this.started)/1000).toFixed(1);
            this.log(`pruneOldFiles() done:${elapsed}s`);
            return {
                started: this.started,
                earliest: this.earliest,
                done: this.done,
                size: this.size,
                pruning: this.pruning,
                pruned,
            }
        } catch(e) {
            this.warn(`pruneOldFiles()`, e.message);
            throw e;
        }}

    }

    module.exports = exports.FilePruner = FilePruner;
})(typeof exports === "object" ? exports : (exports = {}));

