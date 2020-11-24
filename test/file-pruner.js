(typeof describe === 'function') && describe("file-pruner", function() {
    const should = require("should");
    const fs = require('fs');
    const path = require('path');
    const { logger, LogInstance } = require('log-instance');
    const {
        FilePruner,
    } = require("../index");
    const LOCAL = path.join(__dirname, '..', 'local');
    var TEST_SOUNDS = path.join(__dirname, 'data', 'sounds');
    var TEST_SOUNDS2 = path.join(__dirname, 'data', 'sounds2');
    logger.level = 'info';
    this.timeout(5*1000);

    it("TESTTESTdefault ctor", ()=>{
        should.throws(()=>{ // root is required
            var fp = new FilePruner();
        }); 
        var root = TEST_SOUNDS;
        var fp = new FilePruner({root});
        should(fp.pruneDays).equal(180);
        should(fp.pruning).equal(0);
        should(fp.logger).equal(logger);
        should(fp.onPrune).equal(FilePruner.onPrune);
        should(fp.started).equal(undefined);
        should(fp.done).equal(undefined);
        should(fp.bytesScanned).equal(0);
        should(fp.bytesPruned).equal(0);
        should(fp.filesPruned).equal(0);
    });
    it("custom ctor", ()=>{
        var root = TEST_SOUNDS;
        var onPrune = (oldPath=>false);
        var pruneDays = 100;
        var fp = new FilePruner({root, pruneDays, onPrune});
        should(fp.pruneDays).equal(pruneDays);
        should(fp.pruning).equal(0);
        should(fp.onPrune).equal(onPrune);
        should(fp.started).equal(undefined);
        should(fp.done).equal(undefined);
    });
    it("TESTTESTpruneOldFiles() handles errors ", async()=>{
        var root = TEST_SOUNDS2;
        var fp = new FilePruner({ root, });
        var promise = fp.pruneOldFiles();

        // Only one pruner exists at a time;
        var eCaught = null;
        try {
            await fp.pruneOldFiles();
            should.fail("Expected reject");
        } catch(e) {
            should(e.message).match(/ignored \(busy\)/);
        }
        var res = await promise;

        // Subsequent pruning is a different promise
        should(fp.pruneOldFiles()).not.equal(promise);

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
        should(filesPruned).equal(2);
        should(bytesScanned).equal(174138);
        should(bytesPruned).equal(21);
        should(fp).properties({
            bytesScanned: 174138,
            bytesPruned: 21,
            filesPruned: 2,
            pruning: 0,
        });
        should(earliest.toString()).equal(jan1.toString());
        should(done - started).above(0).below(5000);

        should(fs.existsSync(dummy1)).equal(false);
        should(fs.existsSync(dummy3)).equal(false);
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
            should(fp.pruning).above(0).below(5);
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
        should(oldFiles.length).equal(2);
        should(oldFiles[0]).match(/dummy3/);
        should(oldFiles[1]).match(/dummy1/);
        should(res.done - res.started).above(2*MSTEST).below(5000);
        should(res).properties({
            bytesScanned: 174138,
            bytesPruned: 0,
            filesPruned: 0,
        });
        should(prunable).equal(21); // dummy1+dummy3 file sizes
        should(fp.pruning).equal(0);

        // nothing pruned
        should(res).properties({
            bytesScanned: 174138,
            bytesPruned: 0,
            filesPruned: 0,
        });
        should(fs.existsSync(dummy1)).equal(true);
        should(fs.existsSync(dummy2)).equal(true);
        should(fs.existsSync(dummy3)).equal(true);
    } finally {
        fs.existsSync(dummy1) && fs.unlinkSync(dummy1); 
        fs.existsSync(dummy2) && fs.unlinkSync(dummy2); 
        fs.existsSync(dummy3) && fs.unlinkSync(dummy3); 
    }});
})
