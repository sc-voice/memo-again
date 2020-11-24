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
            this.bytesScanned = 0;
            this.bytesPruned = 0;
            this.filesPruned = 0;
        }

        static onPrune(oldPath, stats) {
            logger.debug("FilePruner.onPrune()", oldPath);
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
            this.started = new Date();
            this.bytesScanned = 0;
            this.bytesPruned = 0;
            this.earliest = Date.now();
            var pruneDate = new Date(Date.now()-pruneDays*MS_DAY);
            this.info(`pruneOldFiles() started:${this.started}`);
            var pruneOpts = { root, stats:true, absolute:true };
            this.pruning = 1;
            let filesPruned = 0;
            let bytesPruned = 0;
            let bytesScanned = 0;
            for await (let f of Files.files(pruneOpts)) {
                var { stats, path:fpath } = f;
                bytesScanned += stats.size;
                this.bytesScanned += stats.size;
                stats.mtime < this.earliest && 
                    (this.earliest = stats.mtime);
                if (stats.mtime <= pruneDate) {
                    if (await onPrune(fpath, stats)) { // qualified delete
                        filesPruned++;
                        this.filesPruned++;
                        this.debug(`pruneOldFiles() unlink:${fpath}`);
                        await fs.promises.unlink(fpath);
                        bytesPruned += stats.size;
                        this.bytesPruned += stats.size;
                    }
                }
            }
            this.pruning = 0;
            this.done = new Date();
            var elapsed = ((this.done - this.started)/1000).toFixed(1);
            this.info(`pruneOldFiles() done:${elapsed}s`);
            return {
                started: this.started,
                earliest: this.earliest,
                done: this.done,
                bytesScanned,
                bytesPruned,
                filesPruned,
                pruning: this.pruning,
            }
        } catch(e) {
            this.warn(`pruneOldFiles()`, e.message);
            throw e;
        }}

    }

    module.exports = exports.FilePruner = FilePruner;
})(typeof exports === "object" ? exports : (exports = {}));

