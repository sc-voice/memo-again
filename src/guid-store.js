(function(exports) {
    const fs = require('fs');
    const path = require('path');
    const { LOCAL_DIR } = require('./files');
    const Files = require('./files');
    const { logger } = require('log-instance');

    class GuidStore {
        constructor(opts={}) {
            (opts.logger || logger).logInstance(this);
            this.type = opts.type || 'GuidStore';
            this.folderPrefix = opts.folderPrefix || 2;

            this.suffix = opts.suffix || '';
            this.volume = opts.volume || 'common';
            this.storeName = opts.storeName || 'guid-store';

            // Unserialized properties
            var storePath = opts.storePath ||  
                path.join(LOCAL_DIR, this.storeName);
            Object.defineProperty(this, 'storePath', {
                value: storePath,
            });
            fs.mkdirSync(storePath, {recursive: true});
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

        async clearVolume(volume=this.volume) {
            let count = 0;
            let root = path.join(this.storePath, volume);
            if (fs.existsSync(root)) {
                for await (let fname of Files.files({root, absolute:true})) {
                    await fs.promises.unlink(fname);
                    count++;
                }
            }
            return count;
        }
    }

    module.exports = exports.GuidStore = GuidStore;
})(typeof exports === "object" ? exports : (exports = {}));

