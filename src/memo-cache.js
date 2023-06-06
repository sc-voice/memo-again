(function(exports) {
    const fs = require('fs');
    const path = require('path');
    const { MerkleJson } = require('merkle-json');
    const { LOCAL_DIR } = require('./files');
    const GuidStore = require("./guid-store");
    const Files = require('./files');
    const { logger } = require("log-instance");

    class MemoCache {
        constructor(opts={}) {
            (opts.logger || logger).logInstance(this);
            this.map = {};
            this.suffix = opts.suffix || ".json";
            this.store = opts.store || new GuidStore({
                storeName: opts.storeName || "memo",
                storePath: opts.storePath,
                suffix: this.suffix,
                logger: this,
            });
            this.writeMem = opts.writeMem == null ? true : opts.writeMem;
            this.writeFile = opts.writeFile == null ? true : opts.writeFile;
            this.readFile = opts.readFile == null 
                ? this.writeFile 
                : opts.readFile;
            this.serialize = opts.serialize || MemoCache.serialize;
            this.deserialize = opts.deserialize || MemoCache.deserialize;
            this.fileReads = 0;
            this.fileWrites = 0;
        }

        static serialize(obj) {
            return JSON.stringify(obj, null, 2);
        }

        static deserialize(json) {
            return JSON.parse(json);
        }

        get({guid, volume=this.store.volume}) {
            const msg = 'MemoCache.get() ';
            let { map, } = this;
            let readFile = this.isFlag(this.readFile);
            let writeMem = this.isFlag(this.writeMem);
            let writeFile = this.isFlag(this.writeFile);
            if (guid == null) {
                throw new Error("guid expected");
            }
            let mapVolume = map[volume] = map[volume] || {};
            let value = mapVolume[guid];
            if (value == undefined) {
                var fpath = this.store.guidPath({ guid, volume, });
                if (readFile && fs.existsSync(fpath)) {
                    try {
                        let data = fs.readFileSync(fpath).toString();
                        this.fileReads++;
                        let json = this.deserialize(data);
                        value = json.isPromise
                            ? Promise.resolve(json.value)
                            : json.value;
                        writeMem && (mapVolume[guid] = value);
                    } catch(e) {
                        this.error(`get(`, {guid, volume}, ')',
                            e.message);
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

        isFlag(flag) {
            return typeof flag === 'function' 
                ? flag()
                : flag === true;
        }

        put({guid, args, volume=this.store.volume, value}) {
            let { map, } = this;
            let mapVolume = map[volume] = map[volume] || {};
            let writeMem = this.isFlag(this.writeMem);
            let writeFile = this.isFlag(this.writeFile);
            
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
                this.debug(`put() writeFile:${fpath}`);
                if (isPromise) {
                    var promise = value;
                    value = (async ()=>{
                        let actualValue = await promise;
                        cacheValue.value = actualValue;
                        let json = this.serialize(cacheValue);
                        this.log(`put(${volume},${guid}) async`,
                            `args:${JSON.stringify(args)}`, 
                            `writeFileSync:${json.length}`);
                        // We can't use async writeFile here because
                        // we want to block all reads on the file
                        // until it is written
                        fs.writeFileSync(fpath, json);
                        this.fileWrites++;
                        return actualValue;
                    })();
                } else {
                    let json = this.serialize(cacheValue);
                    this.log(`put(${volume},${guid}) sync`,
                        `args:${JSON.stringify(args)}`, 
                        `writeFileSync:${json.length}`);
                    fs.writeFileSync(fpath, json);
                    this.fileWrites++;
                }
            } 
            return value;
        }

        volumes() {
            let writeMem = this.isFlag(this.writeMem);
            let writeFile = this.isFlag(this.writeFile);

            if (writeMem) {
                return Object.keys(this.map);
            }
            if (writeFile) {
                return fs.readdirSync(this.store.storePath);
            }
            return [];
        }

        async clearVolume(volume=this.store.volume) { try {
            this.log(`clearVolume(${volume})`);
            delete this.map[volume];
            await this.store.clearVolume(volume);
        } catch(e) {
            this.warn(`clearVolume(${volume})`, e.message);
            throw e;
        }}

        async fileSize() { try {
            let root = this.store.storePath;
            let bytes = 0;
            for await (let f of Files.files({root, stats:true})) {
                bytes += f.stats.size;
            }
            return bytes;
        } catch(e) {
            this.warn('fileSize()', e.message);
            throw e;
        }}

    }

    module.exports = exports.MemoCache = MemoCache;
})(typeof exports === "object" ? exports : (exports = {}));
