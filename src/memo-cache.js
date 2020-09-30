(function(exports) {
    const fs = require('fs');
    const path = require('path');
    const { MerkleJson } = require('merkle-json');
    const { LOCAL_DIR } = require('./files');
    const GuidStore = require("./guid-store");
    const { logger } = require("log-instance");

    class MemoCache {
        constructor(opts={}) {
            (opts.logger || logger).logInstance(this);
            this.map = {};
            this.suffix = opts.suffix || ".json";
            this.store = opts.store || new GuidStore({
                storeName: "memo",
                suffix: this.suffix,
                logger: this,
            });
            this.writeMem = opts.writeMem == null ? true : opts.writeMem;
            this.writeFile = opts.writeFile == null ? true : opts.writeFile;
        }

        get({guid, volume=this.store.volume}) {
            let { 
                map,
                writeFile,
            } = this;
            if (guid == null) {
                throw new Error("guid expected");
            }
            let mapVolume = map[volume] = map[volume] || {};
            let value = mapVolume[guid];
            if (value == undefined) {
                var fpath = this.store.guidPath({ guid, volume, });
                if (fs.existsSync(fpath)) {
                    let data = fs.readFileSync(fpath).toString();
                    try {
                        let json = JSON.parse(data);
                        value = json.isPromise
                            ? Promise.resolve(json.value)
                            : json.value;
                        mapVolume[guid] = value;
                    } catch(e) {
                        console.error(e, data);
                    }
                }
            } else {
                var fpath = this.store.guidPath({ guid, volume, });

                // Touch file 
                if (writeFile && fs.existsSync(fpath)) {
                    let atime = new Date();
                    let mtime = atime;
                    fs.utimesSync(fpath, atime, mtime);
                }
            }
            return value;
        }

        async put({guid, args, volume=this.store.volume, value}) {
            let {
                map,
                writeMem,
                writeFile,
            } = this;
            let mapVolume = map[volume] = map[volume] || {};
            writeMem && (mapVolume[guid] = value);
            let fpath = this.store.guidPath({ guid, volume, });
            let isPromise = value instanceof Promise;
            let cacheValue = {
                isPromise,
                volume,
                args,
                value,
            };
            if (isPromise) {
                value = cacheValue.value = await value;
            }
            let json = JSON.stringify(cacheValue, null, 2);
            writeFile && (await fs.promises.writeFile(fpath, json));
            return value;
        }

        async clearVolume(volume=this.store.volume) {
            this.log("clearVolume(${volume})");
            delete this.map[volume];
            await this.store.clearVolume(volume);
        }
    }

    module.exports = exports.MemoCache = MemoCache;
})(typeof exports === "object" ? exports : (exports = {}));
