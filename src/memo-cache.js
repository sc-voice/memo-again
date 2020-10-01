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
            this.serialize = opts.serialize || MemoCache.serialize;
            this.deserialize = opts.deserialize || MemoCache.deserialize;
        }

        static serialize(obj) {
            return JSON.stringify(obj, null, 2);
        }

        static deserialize(json) {
            return JSON.parse(json);
        }

        get({guid, volume=this.store.volume}) {
            let { map, } = this;
            let writeMem = this.isWrite(this.writeMem);
            let writeFile = this.isWrite(this.writeFile);
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
                        let json = this.deserialize(data);
                        value = json.isPromise
                            ? Promise.resolve(json.value)
                            : json.value;
                        writeMem && (mapVolume[guid] = value);
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

        isWrite(flag) {
            return typeof flag === 'function' 
                ? flag()
                : flag === true;
        }

        put({guid, args, volume=this.store.volume, value}) {
            let { map, } = this;
            let mapVolume = map[volume] = map[volume] || {};
            let writeMem = this.isWrite(this.writeMem);
            let writeFile = this.isWrite(this.writeFile);
            
            writeMem && (mapVolume[guid] = value);
            let fpath = this.store.guidPath({ guid, volume, });
            let isPromise = value instanceof Promise;
            if (writeFile) {
                let cacheValue = {
                    isPromise,
                    volume,
                    args,
                    value,
                };
                if (isPromise) {
                    value.then(actualValue=>{
                        cacheValue.value = actualValue;
                        let json = this.serialize(cacheValue);
                        fs.writeFileSync(fpath, json);
                    });
                } else {
                    let json = this.serialize(cacheValue);
                    fs.writeFileSync(fpath, json);
                }
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
