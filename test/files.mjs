import { describe, it, expect } from '@sc-voice/vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MerkleJson } from 'merkle-json';
import { Files } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(__dirname, '..', 'src');
const FILES_DIR = path.join(__dirname, 'data', 'files');
const LOCAL_DIR = path.join(APP_DIR, 'local');
var mj = new MerkleJson();

describe("files", () => {

    it("LOCAL_DIR", ()=>{
        expect(Files.LOCAL_DIR).toBe(LOCAL_DIR);
    });
    it("APP_DIR", ()=>{
        expect(Files.APP_DIR).toBe(APP_DIR);
    });
    it("filesSync(root) => generator", ()=>{
        // Specify root path
        var files = [...Files.filesSync(FILES_DIR)];
        expect(files).toEqual([
            "universe",
            "sub/basement",
            "hello",
        ]);

        // Default is source folder
        var files = [...Files.filesSync()];
        expect(files).toEqual([
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
        expect(files.map(f=>f.replace(APP_DIR,'...'))).toEqual([
            ".../test/data/files/universe",
            ".../test/data/files/sub/basement",
            ".../test/data/files/hello",
        ]);

        // absolute path undefined
        var files = [...Files.filesSync({absolute:true})];
        expect(files.map(f=>f.replace(APP_DIR,'...'))).toEqual([
            ".../src/memoizer.js",
            ".../src/memo-cache.js",
            ".../src/guid-store.js",
            ".../src/files.js",
            ".../src/file-pruner.js",
        ]);
    });
    it("filesSync(root) => stats", ()=>{
        var files = [...Files.filesSync({root: FILES_DIR, stats:true})];
        expect(files.map(f=>f.path.replace(APP_DIR,'...'))).toEqual([
            "universe",
            "sub/basement",
            "hello",
        ]);
        expect(files.map(f=>f.stats.size)).toEqual([ 9, 13, 6, ]);
    });
    it("files(root) => async generator", async()=>{
        // The async generator has best performance
        // but Javascript does not yet support spread syntax
        var files = [];
        for await (let f of Files.files(FILES_DIR)) {
            files.unshift(f);
        }
        expect(files).toEqual([
            "hello",
            "sub/basement",
            "universe",
        ]);
    });

})
