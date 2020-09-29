(typeof describe === 'function') && describe("guid-store", function() {
    const should = require("should");
    const fs = require('fs');
    const path = require('path');
    const { MerkleJson } = require("merkle-json");
    const { logger, LogInstance } = require("log-instance");
    const {
        GuidStore,
    } = require("../index");
    const local = path.join(__dirname, '..', 'local');
    var mj = new MerkleJson();

    it("default ctor", ()=>{
        var store = new GuidStore();
        should(store.storePath).equal(path.join(local, 'guid-store'));
        should(fs.existsSync(store.storePath)).equal(true);
        should(store.logger).equal(logger);
    });
    it("custom ctor", ()=>{
        var logger2 = new LogInstance();
        var store = new GuidStore({
            type: 'SoundStore',
            storeName: 'sounds',
            logger: logger2,
        });
        should(store.storePath).equal(path.join(local, 'sounds'));
        should(store.volume).equal('common');
        should(fs.existsSync(store.storePath)).equal(true);
        should(store.logger).equal(logger2);
    });
    it("guidPath(guid) returns file path of guid", function() {
        var store = new GuidStore();
        var guid = mj.hash("hello world");
        var guidDir = guid.substring(0,2);
        var commonPath = path.join(local, 'guid-store', 'common', guidDir);
        var dirPath = path.join(commonPath, guid);
        should(store.guidPath(guid,'.gif')).equal(`${dirPath}.gif`);

        // volume and chapter can be specified
        var volume = 'test-volume';
        var chapter = 'test-chapter';
        var suffix = '.json';
        var opts = {
            volume,
            chapter,
            suffix,
        }
        var chapterPath = path.join(local, 'guid-store', volume, chapter);
        var id = 'tv-tc-1.2.3';
        var idPath = path.join(chapterPath, `${id}${suffix}`);
        should(store.guidPath(id,opts)).equal(idPath);
    });
    it("signaturePath(signature) => file path of signature", ()=>{
        var store = new GuidStore();
        var guid = mj.hash("hello world");
        var guidDir = guid.substring(0,2);
        var dirPath = path.join(local, 'guid-store', 'common', guidDir);
        var sigPath = path.join(dirPath, guid);
        var signature = {
            guid,
        };
        should(store.signaturePath(signature,'.txt'))
            .equal(`${sigPath}.txt`);

        var store = new GuidStore({
            type: 'SoundStore',
            storeName: 'sounds',
            suffix: '.ogg',
        });
        var guid = mj.hash("hello world");
        var commonPath = path.join(local, 'sounds', 'common', guidDir);
        var sigPath = path.join(commonPath, guid);
        var expectedPath = `${sigPath}.ogg`;
        var signature = {
            guid,
        };
        should(store.signaturePath(signature)).equal(expectedPath);
    });
    it("TESTTESTclearVolume() removes files in volume", async()=>{
        var store = new GuidStore();

        var fDel1 = store.guidPath({
            guid: "del1", 
            volume: "clear",
        });
        fs.writeFileSync(fDel1, "delete-me");
        var fDel2 = store.guidPath({
            guid: "del2", 
            volume: "clear",
        });
        fs.writeFileSync(fDel2, "delete-me");
        var fSave = store.guidPath({
            guid: "54321", 
            volume: "save",
        });
        fs.writeFileSync(fSave, "save-me");

        // Only delete files in volume
        should(fs.existsSync(fDel1)).equal(true);
        should(fs.existsSync(fDel2)).equal(true);
        should(fs.existsSync(fSave)).equal(true);
        var count = await store.clearVolume("clear");
        should(count).equal(2);
        should(fs.existsSync(fDel1)).equal(false);
        should(fs.existsSync(fDel2)).equal(false);
        should(fs.existsSync(fSave)).equal(true);
    });

})
