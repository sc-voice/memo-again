(function(exports) {
    const fs = require('fs');
    const path = require('path');
    const { LOCAL_DIR } = require('./files');

    class GuidStore {
        constructor(opts={}) {
            this.type = opts.type || 'GuidStore';
            this.folderPrefix = opts.folderPrefix || 2;

            this.suffix = opts.suffix || '';
            this.volume = opts.volume || 'common';
            this.storeName = opts.storeName || 'guid-store';

            // Unserialized properties
            Object.defineProperty(this, 'storePath', {
                value: opts.storePath ||  path.join(LOCAL_DIR, this.storeName),
            });
            fs.existsSync(this.storePath) || fs.mkdirSync(this.storePath);
        }

        guidPath(...args) {
            if (args[0] === Object(args[0])) { // (opts); (opts1,opts2)
                var opts = Object.assign({}, args[0], args[1]);
            } else if (args[1] === Object(args[1])) { // (guid, opts)
                var opts = Object.assign({
                    guid: args[0],
                }, args[1]);
            } else { // (guid, suffix)
                var opts = {
                    guid: args[0],
                    suffix: args[1],
                };
            }

            // set up volume folder
            var volume = opts.volume || this.volume;
            var volumePath = path.join(this.storePath, volume);
            fs.existsSync(volumePath) || fs.mkdirSync(volumePath);

            // set up chapter folder
            var guid = opts.guid;
            var chapter = opts.chapter || guid.substr(0,this.folderPrefix);
            var chapterPath = path.join(this.storePath, volume, chapter);
            fs.existsSync(chapterPath) || fs.mkdirSync(chapterPath);

            // define path
            var suffix = opts.suffix == null ? this.suffix : opts.suffix;
            return path.join(chapterPath, `${guid}${suffix}`);
        }

        signaturePath(sigObj, opts) {
            var guidOpts = Object.assign({}, sigObj);
            if (opts === Object(opts)) {
                Object.assign(guidOpts, opts);
            } else if (typeof opts === 'string') {
                guidOpts.suffix = opts;
            }
            return this.guidPath(guidOpts);
        }

        pruneOldFiles(opts={}) {
            var that = this;
            if (that.prunerStats) {
                return Promise.reject(new Error(
                    `pruneOldFiles() ignored (busy)`));
            }
            var prune = opts.prune || (oldPath=>{
                that.info(oldPath);
                return true;
            });
            var prunedStats = that.prunerStats = {
                prune,
                started: new Date(),
                done: undefined,
                pruned: [],
            };
            var pruner = that.entries();
            var pruneDays = opts.pruneDays || this.pruneDays;
            var pruneDate = opts.pruneDate || new Date(Date.now()-pruneDays*MS_DAY);
            var pbody = async (resolve, reject) => { try {
                let next;
                while((next=pruner.next()) && !next.done) {
                    var fpath = next.value;
                    await new Promise((resolve,reject)=>setTimeout(()=>resolve(true),100));
                    var stats = await fs.promises.stat(fpath);
                    if (stats.mtime <= pruneDate) {
                        if (prune(fpath)) { // qualified delete
                            prunedStats.pruned.push(fpath);
                            await fs.promises.unlink(fpath);
                        }
                    }
                }
                prunedStats.done = new Date();
                resolve(prunedStats);
                that.prunerStats = undefined;
            } catch(e) { reject(e); }};
            return new Promise(pbody);
        }

    }

    module.exports = exports.GuidStore = GuidStore;
})(typeof exports === "object" ? exports : (exports = {}));

