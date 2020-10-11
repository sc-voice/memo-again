(typeof describe === 'function') && describe("memoizer", function() {
    const fs = require("fs");
    const path = require("path");
    const should = require("should");
    const {
        MemoCache,
        Memoizer,
    } = require("../index");
    const LOCAL = path.join(__dirname, "..", "local");
    this.timeout(5*1000);
    const CONTEXT = "test";
    const STORENAME = "test-memo";

    class TestCache {
        constructor() {
            this.map = {};
        }

        get({guid, volume="common"}) {
            var key = `${guid}-${volume}`;
            return this.map[key];
        }

        put({guid, volume="common", value}) {
            var key = `${guid}-${volume}`;
            this.map[key] = value;
        }
    }

    it("default ctor", ()=>{
        var mzr = new Memoizer();
        should(mzr.cache).instanceOf(MemoCache);
        should(mzr.cache.writeMem).equal(true);
        should(mzr.cache.writeFile).equal(true);
        should(mzr.cache.readFile).equal(true);
        should(mzr.cache.store.storeName).equal('memo');
        should(mzr.cache.store.storePath).equal(`${LOCAL}/memo`);
    });
    it("custom ctor", ()=>{
        var cache = new TestCache();
        var mzr = new Memoizer({ cache });
        should(mzr.cache).equal(cache);

        var storePath = path.join(LOCAL, `custom`, `here`);
        var mzr = new Memoizer({ storePath});
        should(mzr.cache.store.storePath).equal(storePath);
        should(fs.existsSync(storePath)).equal(true);

        var mzr = new Memoizer({ writeMem: false });
        should(mzr.cache.writeMem).equal(false);
        should(mzr.cache.writeFile).equal(true);
        should(mzr.cache.readFile).equal(true);

        var mzr = new Memoizer({ writeFile: false });
        should(mzr.cache.writeMem).equal(true);
        should(mzr.cache.writeFile).equal(false);
        should(mzr.cache.readFile).equal(false);

        var mzr = new Memoizer({ readFile: false });
        should(mzr.cache.writeMem).equal(true);
        should(mzr.cache.writeFile).equal(true);
        should(mzr.cache.readFile).equal(false);

        var storeName = 'test-memo';
        var mzr = new Memoizer({ storeName });
        should(mzr.cache.store.storeName).equal(storeName);
    });
    it("memoizer stores non-promise results", async()=>{
        var mzr = new Memoizer({storeName: STORENAME});
        mzr.logLevel = 'info';

        // memoize function
        var f1 = function(arg){return `${arg}-41`};
        var m1 = mzr.memoize(f1, CONTEXT);
        should(m1('test')).equal('test-41');
        should(m1('test')).equal('test-41');

        // memoize arrow function
        var f2 = arg=>`${arg}-42`;
        var m2 = mzr.memoize(f2, CONTEXT);
        should(m2('test')).equal('test-42');
        should(m2('test')).equal('test-42');

        // memoize class method
        var calls = 0;
        class TestClass {
            static someMethod(arg) { 
                calls++;
                return `${arg}-43`; 
            }
        }
        var tst = new TestClass();
        await mzr.clearMemo(TestClass.someMethod, TestClass);
        var m3 = mzr.memoize(TestClass.someMethod, TestClass);
        should(m3('test')).equal('test-43');
        should(calls).equal(1);
        should(m3('test')).equal('test-43');
        should(calls).equal(1);
    });
    it("memoizer stores promise results", async()=>{
        const DELAY = 100;
        var mzr = new Memoizer();
        var fp = async arg=>new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve(`${arg}-42`)}, DELAY);
        });
        await mzr.clearMemo(fp, CONTEXT);
        var m = mzr.memoize(fp, CONTEXT);

        var ms0 = Date.now();
        var p = m('test');
        should(p).instanceOf(Promise);
        should(await p).equal('test-42');
        var FUDGE = 2; 
        should(Date.now()-ms0).above(DELAY-FUDGE); 

        var ms1 = Date.now();
        should(await m('test')).equal('test-42');
        should(Date.now()-ms1).above(-1).below(DELAY);
    });
    it("volumeOf(...)=>volume name", ()=>{
        class TestClass {
            static staticMethod(arg) { 
                return "a static method";
            }

            instanceMethod(arg) { 
                // DO NOT MEMOIZE INSTANCE METHODS
            }
        }
        var mzr = new Memoizer();
        var fun = ()=>'fun!';
        var tst = new TestClass();
        should(mzr.volumeOf(()=>true)).equal("global.lambda");
        should(mzr.volumeOf(fun, "Polygon")).equal("Polygon.fun");
        should(mzr.volumeOf(TestClass.staticMethod, TestClass))
            .equal("TestClass.staticMethod");

    });
    it("custom serialization", async()=>{
        let lastSerialized;
        class TestClass {
            constructor(opts={}) {
                this.answer = opts.answer || 0;
            }

            static serialize(obj) {
                return lastSerialized = JSON.stringify(obj);
            }

            static deserialize(obj) {
                var cached = JSON.parse(obj);
                cached.value = new TestClass(cached.value);
                return cached;
            }
        }
        let add1 = x=>new TestClass({answer:x+1});
        let mzr = new Memoizer({
            serialize: TestClass.serialize, 
            deserialize: TestClass.deserialize,
            writeMem: false,
        });
        await mzr.clearMemo(add1, "test");
        let add1Memo = mzr.memoize(add1, CONTEXT);
        var ans = add1Memo(42);
        should(lastSerialized).equal(JSON.stringify({
            isPromise: false,
            volume: 'test.add1',
            args:[42],
            value:{answer:43},
        }));
        var expected = new TestClass({answer:43});
        should.deepEqual(add1Memo(42), expected); // computed
        await new Promise(r=>setTimeout(r,100));
        should.deepEqual(add1Memo(42), expected); // cached
    });

});
