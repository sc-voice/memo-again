import { describe, it, expect } from '@sc-voice/vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MerkleJson } from 'merkle-json';
import { GuidStore, MemoCache } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("memo-cache", () => {
    const APP_DIR = path.join(__dirname, '..');
    const SRC_DIR = path.join(__dirname, '..', 'src');
    const FILES_DIR = path.join(__dirname, 'data', 'files');
    const LOCAL_DIR = path.join(APP_DIR, 'local');
    const TEST_DIR = path.join(LOCAL_DIR, "test");
    var mj = new MerkleJson();
    var TEST_STORE = new GuidStore({
        storePath: TEST_DIR,
        suffix: ".json",
    });

    it("default ctor", ()=>{
        var mc = new MemoCache();
        expect(mc).properties({
            map: {},
        });
        expect(mc.store).toBeInstanceOf(GuidStore);
        expect(mc.store.storePath).toBe(path.join(LOCAL_DIR, "memo"));
        expect(mc.writeMem).toBe(true);
        expect(mc.writeFile).toBe(true);
        expect(mc.readFile).toBe(true);
    });
    it("custom ctor", ()=>{
        var store = new GuidStore();
        var writeMem = ()=>false;
        var writeFile = ()=>false;
        var readFile = ()=>false;
        var mc = new MemoCache({
            store,
            writeMem,
            writeFile,
            readFile,
        });
        expect(mc).properties({
            map: {},
            store,
            writeMem,
            writeFile,
            readFile,
        });
        expect(mc.store).toBe(store);
    });
    it("put(...) adds cache entry", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid1";
        var volume = "volume1";
        var value = "value1";
        var res = mc.put({ guid, volume, value });
        expect(mc.map.volume1.guid1).toBe(value);
        expect(res).toBe(value);
    });
    it("writeMem suppresses memory cache", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: false, // only use file cache
        });
        var guid = "guid1";
        var volume = "volume1";
        var value = "value1";
        var res = mc.put({ guid, volume, value });
        expect(mc.map.volume1.guid1).toBe(undefined);
        expect(res).toBe(value);
        expect(mc.get({ guid, volume})).toBe(value); // file cache
        expect(mc.map.volume1.guid1).toBe(undefined);

        var mc2 = new MemoCache({
            store: TEST_STORE,
        });
        expect(mc2.get({ guid, volume})).toBe(value); // file cache
    });
    it("get(...) retrieves cache entry", ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid2";
        var volume = "volume2";
        var value = "value2";
        mc.put({ guid, volume, value });
        expect(mc.get({guid, volume})).toEqual(value);
    });
    it("get(...) retrieves serialized cache entry", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid3";
        var volume = "volume3";
        var value = "value3";
        mc.put({ guid, volume, value }); // wait for file write

        // New cache instance remembers
        var mc2 = new MemoCache({ store: mc.store });
        expect(mc2.get({guid, volume})).toEqual(value);
    });
    it("get/put handle Promises", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        mc.logLevel = 'info';
        var guid = "guid4";
        var volume = "volume4";
        var value = new Promise(r=>setTimeout(()=>r("value4"),100));
        await mc.clearVolume(volume); // Clear for testing

        // file cache will be written when value is resolved
        var promise = mc.put({ guid, volume, value });
        var fpath = mc.store.guidPath({guid, volume});
        expect(fs.existsSync(fpath)).toBe(false);

        // wait for file cache
        var pval = await promise; // wait for file write
        expect(fs.existsSync(fpath)).toBe(true);
        expect(pval).toBe(await value);
        expect(mc.logger.lastLog()).toMatch(/put\(volume4,guid4\)/);

        // New cache will reuse saved values
        var mc2 = new MemoCache({ store: mc.store });
        var v2 = mc2.get({guid, volume});
        expect(v2).toBeInstanceOf(Promise);
        expect(await v2).toBe("value4");
        expect(mc2.map[volume][guid]).toBe(v2); // in memory map
    });
    it("clearVolume() clears cache", async()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        mc.logLevel = 'info';
        var guid = "guid5";
        var volume = "volume5";
        var value = "value5";
        await mc.clearVolume(volume); // Clear for testing
        expect(mc.logger.lastLog()).toMatch(/clearVolume\(volume5\)/);

        mc.put({ guid, volume, value }); // deleted value
        mc.put({ guid: "guid6", volume: "volume6", value:"value6" });
        expect(mc.map[volume][guid]).toBe(value);
        var fpath = mc.store.guidPath({guid, volume});
        expect(fs.existsSync(fpath)).toBe(true);

        await mc.clearVolume(volume);
        expect(mc.map[volume]).toBe(undefined);
        expect(fs.existsSync(fpath)).toBe(false);
        expect(mc.get({guid:"guid6",volume:"volume6"})).toBe("value6");
    });
    it("TESTTESTget(...) touches serialized cache entry", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: false,
        });
        mc.logLevel = 'debug';
        var guid = "guid7";
        var volume = "volume7";
        var value = "value7";
        expect(mc).properties({fileReads:0, fileWrites:0});
        mc.put({ guid, volume, value }); // wait for file write
        expect(mc).properties({fileReads:0, fileWrites:1});
        var fpath = mc.store.guidPath({guid,volume});
        await new Promise(r=>setTimeout(()=>r(),100));

        mc.get({ guid, volume}); // touch
        expect(mc).properties({fileReads:1, fileWrites:1});
    });
    it("writeFile suppresses file cache", async()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
            writeFile: false, // only use memory cache
        });
        var guid = "guid8";
        var volume = "volume8";
        var value = "value8";
        await mc.clearVolume(volume);
        mc.put({ guid, volume, value }); // wait for file write

        // Original cache instance remembers
        expect(mc.get({guid, volume})).toEqual(value); // memory

        // New cache instance doesn't remember
        var mc2 = new MemoCache({ store: mc.store });
        expect(mc2.get({guid, volume})).toEqual(undefined);
    });
    it("writeMem and writeFile can be functions", async ()=>{
        var write;
        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: ()=>write,
            writeFile: ()=>write,
        });
        var guid = "guid9";
        var volume = "volume9";
        var value = "value9";
        mc.clearVolume(volume);

        write = false;
        expect(mc.isFlag(mc.writeMem)).toBe(false);
        expect(mc.isFlag(mc.writeFile)).toBe(false);
        mc.put({ guid, volume, value }); // wait for file write
        expect(mc.get({guid, volume})).toEqual(undefined);

        write = true;
        expect(mc.isFlag(mc.writeMem)).toBe(true);
        expect(mc.isFlag(mc.writeFile)).toBe(true);
        mc.put({ guid, volume, value }); // wait for file write
        expect(mc.get({guid, value})).toEqual(undefined);
    });
    it("volumes() => [volumeNames]", async()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: true,
            writeFile: false,
        });
        var guid = "guid10";
        var volume = "volume10";
        var value = "value10";
        mc.put({ guid, volume, value }); // wait for file write
        expect(mc.volumes().find(v=>v===volume)).toBe(volume);

        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: false,
            writeFile: true,
        });
        var guid = "guid11";
        var volume = "volume11";
        var value = "value11";
        mc.put({ guid, volume, value }); // wait for file write
        expect(mc.volumes().find(v=>v===volume)).toBe(volume);
    });
    it("fileSize() => total file size", async()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid12";
        var volume = "volume12";
        var value = "value12";
        await mc.clearVolume(volume);
        var bytesBefore = await mc.fileSize();
        mc.put({ guid, volume, value }); // wait for file write
        var bytesAfter = await mc.fileSize();
        expect(bytesAfter-bytesBefore).toBe(70);
    });
    it("readFile can disable file cache read", async()=>{
        var store = TEST_STORE;
        var mc = new MemoCache({ store, writeMem: false, });
        var guid = "guid13";
        var volume = "volume13";
        var value = "value13";
        mc.put({ guid, volume, value }); // wait for file write
        expect(mc.get({guid, volume})).toBe(value);

        var mcNoRead = new MemoCache({ store, readFile: false });
        expect(mcNoRead.get({guid, volume})).toBe(undefined);
    });

})
