(typeof describe === 'function') && describe("memo-cache", function() {
    const should = require("should");
    const fs = require('fs');
    const path = require('path');
    const { MerkleJson } = require("merkle-json");
    const {
        GuidStore,
        MemoCache,
    } = require("../index");
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
        should(mc).properties({
            map: {},
        });
        should(mc.store).instanceOf(GuidStore);
        should(mc.store.storePath).equal(path.join(LOCAL_DIR, "memo"));
    });
    it("custom ctor", ()=>{
        var store = new GuidStore();
        var writeMem = false;
        var writeFile = false;
        var mc = new MemoCache({
            store,
            writeMem,
            writeFile,
        });
        should(mc).properties({
            map: {},
            store,
            writeMem,
            writeFile,
        });
        should(mc.store).equal(store);
    });
    it("put(...) adds cache entry", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid1";
        var volume = "volume1";
        var value = "value1";
        var res = mc.put({ guid, volume, value });
        should(mc.map.volume1.guid1).equal(value);
        should(res).equal(value);
    });
    it("EwriteMem suppresses memory cache", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: false, // only use file cache
        });
        var guid = "guid1";
        var volume = "volume1";
        var value = "value1";
        var res = mc.put({ guid, volume, value });
        should(mc.map.volume1.guid1).equal(undefined);
        should(res).equal(value);
        should(mc.get({ guid, volume})).equal(value); // file cache
        should(mc.map.volume1.guid1).equal(undefined);

        var mc2 = new MemoCache({
            store: TEST_STORE,
        });
        should(mc2.get({ guid, volume})).equal(value); // file cache
    });
    it("get(...) retrieves cache entry", ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid2";
        var volume = "volume2";
        var value = "value2";
        mc.put({ guid, volume, value });
        should.deepEqual(mc.get({guid, volume}), value);
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
        should.deepEqual(mc2.get({guid, volume}), value);
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
        should(fs.existsSync(fpath)).equal(false);

        // wait for file cache 
        var pval = await promise; // wait for file write
        var fpath = mc.store.guidPath({guid, volume});
        should(fs.existsSync(fpath)).equal(true);
        should(pval).equal(await value);
        should(mc.logger.lastLog()).match(/put\(volume4,guid4\)/);

        // New cache will reuse saved values
        var mc2 = new MemoCache({ store: mc.store });
        var v2 = mc2.get({guid, volume});
        should(v2).instanceOf(Promise);
        should(await v2).equal("value4");
        should(mc2.map[volume][guid]).equal(v2); // in memory map
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
        should(mc.logger.lastLog()).match(/clearVolume\(volume5\)/);

        mc.put({ guid, volume, value }); // deleted value
        mc.put({ guid: "guid6", volume: "volume6", value:"value6" }); 
        should(mc.map[volume][guid]).equal(value);
        var fpath = mc.store.guidPath({guid, volume});
        should(fs.existsSync(fpath)).equal(true);

        await mc.clearVolume(volume);
        should(mc.map[volume]).equal(undefined);
        should(fs.existsSync(fpath)).equal(false);
        should(mc.get({guid:"guid6",volume:"volume6"})).equal("value6");
    });
    it("get(...) touches serialized cache entry", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid7";
        var volume = "volume7";
        var value = new Promise(r=> setTimeout(()=>r("value7"), 100));
        mc.put({ guid, volume, value }); // wait for file write
        var fpath = mc.store.guidPath({guid,volume});
        var stats1 = fs.statSync(fpath);
        should(mc.get({guid,volume})).equal(value);
        await new Promise(r=>setTimeout(r,1)); // wait 1ms for utimes
        var stats2 = fs.statSync(fpath);
        should(stats1.atime).below(stats2.atime);
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
        should.deepEqual(mc.get({guid, volume}), value); // memory

        // New cache instance doesn't remember
        var mc2 = new MemoCache({ store: mc.store });
        should.deepEqual(mc2.get({guid, volume}), undefined); 
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
        should(mc.isWrite(mc.writeMem)).equal(false);
        should(mc.isWrite(mc.writeFile)).equal(false);
        mc.put({ guid, volume, value }); // wait for file write
        should.deepEqual(mc.get({guid, volume}), undefined);

        write = true;
        should(mc.isWrite(mc.writeMem)).equal(true);
        should(mc.isWrite(mc.writeFile)).equal(true);
        mc.put({ guid, volume, value }); // wait for file write
        should.deepEqual(mc.get({guid, value}), undefined);
    });
    it("TESTTESTvolumes() => [volumeNames]", async()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: true,
            writeFile: false,
        });
        var guid = "guid10";
        var volume = "volume10";
        var value = "value10";
        mc.put({ guid, volume, value }); // wait for file write
        should(mc.volumes().find(v=>v===volume)).equal(volume);

        var mc = new MemoCache({
            store: TEST_STORE,
            writeMem: false,
            writeFile: true,
        });
        var guid = "guid11";
        var volume = "volume11";
        var value = "value11";
        mc.put({ guid, volume, value }); // wait for file write
        should(mc.volumes().find(v=>v===volume)).equal(volume);
    });


})
