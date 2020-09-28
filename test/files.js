(typeof describe === 'function') && describe("files", function() {
    const should = require("should");
    const fs = require('fs');
    const path = require('path');
    const { MerkleJson } = require("merkle-json");
    const {
        Files,
    } = require("../index");
    const APP_DIR = path.join(__dirname, '..');
    const SRC_DIR = path.join(__dirname, '..', 'src');
    const FILES_DIR = path.join(__dirname, 'data', 'files');
    const LOCAL_DIR = path.join(APP_DIR, 'local');
    var mj = new MerkleJson();

    it("LOCAL_DIR", ()=>{
        should(Files.LOCAL_DIR).equal(LOCAL_DIR);
    });
    it("APP_DIR", ()=>{
        should(Files.APP_DIR).equal(APP_DIR);
    });
    it("filesSync(root) => generator", ()=>{
        // Specify root path
        var files = [...Files.filesSync(FILES_DIR)];
        should.deepEqual(files, [
            "universe",
            "sub/basement",
            "hello", 
        ]);

        // Default is source folder
        var files = [...Files.filesSync()];
        should.deepEqual(files, [
            "memoizer.js",
            "memo-cache.js",
            "guid-store.js",
            "files.js",
            "file-pruner.js",
        ]);
    });
    it("filesSync(root) => absolute path", ()=>{
        // absolute path 
        var files = [...Files.filesSync({root: FILES_DIR, absolute:true})];
        should.deepEqual(files.map(f=>f.replace(APP_DIR,'...')), [
            ".../test/data/files/universe",
            ".../test/data/files/sub/basement",
            ".../test/data/files/hello", 
        ]);

        // absolute path undefined
        var files = [...Files.filesSync({absolute:true})];
        should.deepEqual(files.map(f=>f.replace(APP_DIR,'...')), [
            ".../src/memoizer.js",
            ".../src/memo-cache.js",
            ".../src/guid-store.js",
            ".../src/files.js",
            ".../src/file-pruner.js",
        ]);
    });
    it("filesSync(root) => stats", ()=>{
        var files = [...Files.filesSync({root: FILES_DIR, stats:true})];
        should.deepEqual(files.map(f=>f.path.replace(APP_DIR,'...')), [
            "universe",
            "sub/basement",
            "hello",
        ]);
        should.deepEqual(files.map(f=>f.stats.size), [ 9, 13, 6, ]);
    });
    it("files(root) => async generator", async()=>{
        // The async generator has best performance
        // but Javascript does not yet support spread syntax
        var files = [];
        for await (let f of Files.files(FILES_DIR)) {
            files.unshift(f);
        }
        should.deepEqual(files, [
            "hello", 
            "sub/basement",
            "universe",
        ]);
    });

})
