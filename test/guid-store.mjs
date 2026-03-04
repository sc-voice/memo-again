import { describe, it, expect } from '@sc-voice/vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MerkleJson } from 'merkle-json';
import { logger, LogInstance } from 'log-instance';
import { GuidStore } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const local = path.join(__dirname, '..', 'local');
var mj = new MerkleJson();

describe("guid-store", () => {

    it("default ctor", ()=>{
        var store = new GuidStore();
        expect(store.storePath).toBe(path.join(local, 'guid-store'));
        expect(fs.existsSync(store.storePath)).toBe(true);
        expect(store.logger).toBe(logger);
    });
    it("custom ctor", ()=>{
        var logger2 = new LogInstance();
        var store = new GuidStore({
            type: 'SoundStore',
            storeName: 'sounds',
            logger: logger2,
        });
        expect(store.storePath).toBe(path.join(local, 'sounds'));
        expect(store.volume).toBe('common');
        expect(fs.existsSync(store.storePath)).toBe(true);
        expect(store.logger).toBe(logger2);
    });
    it("guidPath(guid) returns file path of guid", function() {
        var store = new GuidStore();
        var guid = mj.hash("hello world");
        var guidDir = guid.substring(0,2);
        var commonPath = path.join(local, 'guid-store', 'common', guidDir);
        var dirPath = path.join(commonPath, guid);
        expect(store.guidPath(guid,'.gif')).toBe(`${dirPath}.gif`);

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
        expect(store.guidPath(id,opts)).toBe(idPath);
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
        expect(store.signaturePath(signature,'.txt'))
            .toBe(`${sigPath}.txt`);

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
        expect(store.signaturePath(signature)).toBe(expectedPath);
    });
    it("clearVolume() removes files in volume", async()=>{
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
        expect(fs.existsSync(fDel1)).toBe(true);
        expect(fs.existsSync(fDel2)).toBe(true);
        expect(fs.existsSync(fSave)).toBe(true);
        var count = await store.clearVolume("clear");
        expect(count).toBe(2);
        expect(fs.existsSync(fDel1)).toBe(false);
        expect(fs.existsSync(fDel2)).toBe(false);
        expect(fs.existsSync(fSave)).toBe(true);
    });

})
