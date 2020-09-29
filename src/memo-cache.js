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
        }

        get({guid, volume=this.store.volume}) {
            if (guid == null) {
                throw new Error("guid expected");
            }
            let mapVolume = this.map[volume] = this.map[volume] || {};
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
                if (fs.existsSync(fpath)) {
                    let atime = new Date();
                    let mtime = atime;
                    fs.utimesSync(fpath, atime, mtime);
                }
            }
            return value;
        }

        async put({guid, args, volume=this.store.volume, value}) {
            let mapVolume = this.map[volume] = this.map[volume] || {};
            mapVolume[guid] = value;
            var fpath = this.store.guidPath({ guid, volume, });
            if (value instanceof Promise) {
                var actualValue = await value;
                await fs.promises.writeFile(fpath, JSON.stringify({
                    isPromise: true,
                    volume,
                    args,
                    value: actualValue,
                }, null, 2));
                value = actualValue;
            } else {
                await fs.promises.writeFile(fpath, JSON.stringify({
                    isPromise: false,
                    volume,
                    args,
                    value,
                }, null, 2));
            }
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
