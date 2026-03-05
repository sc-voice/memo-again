import { describe, it, expect } from '@sc-voice/vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, LogInstance } from 'log-instance';
import { FilePruner } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = path.join(__dirname, '..', 'local');
var TEST_SOUNDS = path.join(__dirname, 'data', 'sounds');
var TEST_SOUNDS2 = path.join(__dirname, 'data', 'sounds2');
logger.level = 'info';

describe("file-pruner", () => {

    it("TESTTESTdefault ctor", ()=>{
        expect(()=>{ // root is required
            var fp = new FilePruner();
        }).toThrow();
        var root = TEST_SOUNDS;
        var fp = new FilePruner({root});
        expect(fp.pruneDays).toBe(180);
        expect(fp.pruning).toBe(0);
        expect(fp.logger).toBe(logger);
        expect(fp.onPrune).toBe(FilePruner.onPrune);
        expect(fp.started).toBe(undefined);
        expect(fp.done).toBe(undefined);
        expect(fp.bytesScanned).toBe(0);
        expect(fp.bytesPruned).toBe(0);
        expect(fp.filesPruned).toBe(0);
    });
    it("custom ctor", ()=>{
        var root = TEST_SOUNDS;
        var onPrune = (oldPath=>false);
        var pruneDays = 100;
        var fp = new FilePruner({root, pruneDays, onPrune});
        expect(fp.pruneDays).toBe(pruneDays);
        expect(fp.pruning).toBe(0);
        expect(fp.onPrune).toBe(onPrune);
        expect(fp.started).toBe(undefined);
        expect(fp.done).toBe(undefined);
    });
    it("TESTTESTpruneOldFiles() handles errors ", async()=>{
        var root = TEST_SOUNDS2;
        var fp = new FilePruner({ root, });
        var promise = fp.pruneOldFiles();

        // Only one pruner exists at a time;
        var eCaught = null;
        try {
            await fp.pruneOldFiles();
            throw new Error("Expected reject");
        } catch(e) {
            expect(e.message).toMatch(/ignored \(busy\)/);
        }
        var res = await promise;

        // Subsequent pruning is a different promise
        expect(fp.pruneOldFiles()).not.toBe(promise);

    });
    it("TESTTESTpruneOldFiles() ", async()=>{ try {
        var root = TEST_SOUNDS;
        var fp = new FilePruner({ root, });
        var jan1 = new Date(2020,0,1);
        var dummy1 = path.join(root, "dummy1"); // pruned
        var dummy2 = path.join(root, "dummy2"); // not pruned
        var dummy3 = path.join(root, "dummy3"); // pruned
        fs.writeFileSync(dummy1, "dummy1.json");
        try { // touch jan1
            fs.utimesSync(dummy1, jan1, jan1);
        } catch (err) {
            fs.closeSync(fs.openSync(dummy1, 'w'));
        }
        fs.writeFileSync(dummy2, "dummy2");
        fs.writeFileSync(dummy3, "dummy3.mp3");
        try { // touch jan1
            fs.utimesSync(dummy3, jan1, jan1);
        } catch (err) {
            fs.closeSync(fs.openSync(dummy3, 'w'));
        }

        var promise = fp.pruneOldFiles();

        var {
            filesPruned,
            bytesPruned,
            bytesScanned,
            done,
            started,
            earliest,
        } = await promise;
        expect(filesPruned).toBe(2);
        expect(bytesScanned).toBe(174138);
        expect(bytesPruned).toBe(21);
        expect(fp).properties({
            bytesScanned: 174138,
            bytesPruned: 21,
            filesPruned: 2,
            pruning: 0,
        });
        expect(earliest.toString()).toBe(jan1.toString());
        expect(done - started).toBeGreaterThanOrEqual(0);
        expect(done - started).toBeLessThan(5000);

        expect(fs.existsSync(dummy1)).toBe(false);
        expect(fs.existsSync(dummy3)).toBe(false);
    } finally {
        fs.existsSync(dummy1) && fs.unlinkSync(dummy1);
        fs.existsSync(dummy2) && fs.unlinkSync(dummy2);
        fs.existsSync(dummy3) && fs.unlinkSync(dummy3);
    }});
    it("TESTTESTpruneOldFiles() custom onPrune", async()=>{ try {
        var root = TEST_SOUNDS;
        var aug262020 = new Date(2020,7,26);
        const MSDAY = 24 * 3600 * 1000;
        var pruneDays = (new Date() - aug262020)/MSDAY + 1;
        var fp = new FilePruner({ root, pruneDays, });
        const MSTEST = 100;
        var prunable = 0;
        const onPrune = async (oldPath,stats)=> {
            // custom async prune callback
            oldFiles.push(oldPath);
            prunable += stats.size;
            await new Promise(resolve=>setTimeout(()=>resolve(1),MSTEST));
            expect(fp.pruning).toBeGreaterThan(0);
            expect(fp.pruning).toBeLessThan(5);
            return false; // don't delete old file
        };
        var pruneDate = new Date(pruneDays*MSDAY);
        var dummy1 = path.join(root, "dummy1"); // pruned
        var dummy2 = path.join(root, "dummy2"); // not pruned
        var dummy3 = path.join(root, "dummy3"); // pruned
        fs.writeFileSync(dummy1, "dummy1.json");
        try { // touch pruneDate
            fs.utimesSync(dummy1, pruneDate, pruneDate);
        } catch (err) {
            fs.closeSync(fs.openSync(dummy1, 'w'));
        }
        fs.writeFileSync(dummy2, "dummy2");
        fs.writeFileSync(dummy3, "dummy3.mp3");
        try { // touch pruneDate
            fs.utimesSync(dummy3, pruneDate, pruneDate);
        } catch (err) {
            fs.closeSync(fs.openSync(dummy3, 'w'));
        }

        const oldFiles = [];
        var promise = fp.pruneOldFiles(onPrune);

        var res = await promise;
        expect(oldFiles.length).toBe(2);
        expect(oldFiles[0]).toMatch(/dummy3/);
        expect(oldFiles[1]).toMatch(/dummy1/);
        expect(res.done - res.started).toBeGreaterThan(2*MSTEST);
        expect(res.done - res.started).toBeLessThan(5000);
        expect(res).properties({
            bytesScanned: 174138,
            bytesPruned: 0,
            filesPruned: 0,
        });
        expect(prunable).toBe(21); // dummy1+dummy3 file sizes
        expect(fp.pruning).toBe(0);

        // nothing pruned
        expect(res).properties({
            bytesScanned: 174138,
            bytesPruned: 0,
            filesPruned: 0,
        });
        expect(fs.existsSync(dummy1)).toBe(true);
        expect(fs.existsSync(dummy2)).toBe(true);
        expect(fs.existsSync(dummy3)).toBe(true);
    } finally {
        fs.existsSync(dummy1) && fs.unlinkSync(dummy1);
        fs.existsSync(dummy2) && fs.unlinkSync(dummy2);
        fs.existsSync(dummy3) && fs.unlinkSync(dummy3);
    }});
})
