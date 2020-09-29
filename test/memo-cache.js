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
        var mc = new MemoCache({
            store,
        });
        should(mc).properties({
            map: {},
            store,
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
        var res = await mc.put({ guid, volume, value });
        should(mc.map.volume1.guid1).equal(value);
        should(res).equal(value);
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
        await mc.put({ guid, volume, value }); // wait for file write

        // New cache instance remembers
        var mc2 = new MemoCache({ store: mc.store });
        should.deepEqual(mc2.get({guid, volume}), value);
    });
    it("get/put handle Promises", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid4";
        var volume = "volume4";
        var value = new Promise(resolve=>
            setTimeout(()=>resolve("value4"),100));
        await mc.put({ guid, volume, value }); // wait for file write

        var mc2 = new MemoCache({ store: mc.store });
        var v2 = mc2.get({guid, volume});
        should(v2).instanceOf(Promise);
        should(await v2).equal("value4");
        should(mc2.map[volume][guid]).equal(v2); // in memory map
    });
    it("TESTTESTclearVolume() clears cache", async()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid5";
        var volume = "volume5";
        var value = "value5";
        await mc.put({ guid, volume, value }); // deleted value
        await mc.put({ guid: "guid6", volume: "volume6", value:"value6" }); 
        should(mc.map[volume][guid]).equal(value);
        var fpath = mc.store.guidPath({guid, volume});
        should(fs.existsSync(fpath)).equal(true);

        await mc.clearVolume(volume);
        should(mc.map[volume]).equal(undefined);
        should(fs.existsSync(fpath)).equal(false);
        should(mc.get({guid:"guid6",volume:"volume6"})).equal("value6");
    });
    it("TESTTESTget(...) touches serialized cache entry", async ()=>{
        var mc = new MemoCache({
            store: TEST_STORE,
        });
        var guid = "guid7";
        var volume = "volume7";
        var value = new Promise(resolve=>
            setTimeout(()=>resolve("value7"), 100));
        await mc.put({ guid, volume, value }); // wait for file write
        var fpath = mc.store.guidPath({guid,volume});
        var stats1 = fs.statSync(fpath);
        await new Promise(resolve=>setTimeout(()=>resolve(1),100));
        should(mc.get({guid,volume})).equal(value);
        var stats2 = fs.statSync(fpath);
        should(stats1.atime).below(stats2.atime);
    });


})
