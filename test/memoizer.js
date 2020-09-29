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

    class TestCache {
        constructor() {
            this.map = {};
        }

        get({guid, volume="common"}) {
            var key = `${guid}-${volume}`;
            return this.map[key];
        }

        async put({guid, volume="common", value}) {
            var key = `${guid}-${volume}`;
            this.map[key] = value;
        }
    }

    it("default ctor", ()=>{
        var mzr = new Memoizer();
        should(mzr.cache).instanceOf(MemoCache);
    });
    it("custom ctor", ()=>{
        var cache = new TestCache();
        var mzr = new Memoizer({ cache, });
        should(mzr.cache).equal(cache);
    });
    it("TESTTESTmemoizer stores non-promise results", async()=>{
        var mzr = new Memoizer();

        // memoize function
        var f1 = function(arg){return `${arg}-41`};
        var m1 = mzr.memoize(f1);
        should(m1('test')).equal('test-41');
        should(m1('test')).equal('test-41');

        // memoize arrow function
        var f2 = arg=>`${arg}-42`;
        var m2 = mzr.memoize(f2);
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
        var mzr = new Memoizer({
            cache: new TestCache(),
        });
        var fp = async arg=>new Promise((resolve, reject)=>{
            setTimeout(()=>{resolve(`${arg}-42`)}, DELAY);
        });
        var m = mzr.memoize(fp);

        var ms0 = Date.now();
        var p = m('test');
        should(p).instanceOf(Promise);
        should(await p).equal('test-42');
        var ms1 = Date.now();
        should(await m('test')).equal('test-42');
        var ms2 = Date.now();
        should(ms1-ms0).above(DELAY-1);
        should(ms2-ms1).above(-1).below(DELAY);
    });
    it("TESTTESTvolumeOf(...)=>volume name", ()=>{
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

});
