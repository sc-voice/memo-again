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
                var time = new Date();
                fs.utimesSync(fpath, time, time);
            }
            return value;
        }

        async put({guid, volume=this.store.volume, value}) {
            let mapVolume = this.map[volume] = this.map[volume] || {};
            mapVolume[guid] = value;
            var fpath = this.store.guidPath({ guid, volume, });
            if (value instanceof Promise) {
                let actualValue = await value;
                value = actualValue;
                await fs.promises.writeFile(fpath, JSON.stringify({
                    isPromise: true,
                    value,
                }));
            } else {
                await fs.promises.writeFile(fpath, JSON.stringify({
                    isPromise: false,
                    value,
                }));
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
