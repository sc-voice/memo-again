import { describe, it, expect } from '@sc-voice/vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MemoCache, Memoizer } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = path.join(__dirname, "..", "local");
const CONTEXT = "test";
const STORENAME = "test-memo";

describe("memoizer", () => {

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
        expect(mzr.cache).toBeInstanceOf(MemoCache);
        expect(mzr.cache.writeMem).toBe(true);
        expect(mzr.cache.writeFile).toBe(true);
        expect(mzr.cache.readFile).toBe(true);
        expect(mzr.cache.store.storeName).toBe('memo');
        expect(mzr.cache.store.storePath).toBe(`${LOCAL}/memo`);
    });
    it("custom ctor", ()=>{
        var cache = new TestCache();
        var mzr = new Memoizer({ cache });
        expect(mzr.cache).toBe(cache);

        var storePath = path.join(LOCAL, `custom`, `here`);
        var mzr = new Memoizer({ storePath});
        expect(mzr.cache.store.storePath).toBe(storePath);
        expect(fs.existsSync(storePath)).toBe(true);

        var mzr = new Memoizer({ writeMem: false });
        expect(mzr.cache.writeMem).toBe(false);
        expect(mzr.cache.writeFile).toBe(true);
        expect(mzr.cache.readFile).toBe(true);

        var mzr = new Memoizer({ writeFile: false });
        expect(mzr.cache.writeMem).toBe(true);
        expect(mzr.cache.writeFile).toBe(false);
        expect(mzr.cache.readFile).toBe(false);

        var mzr = new Memoizer({ readFile: false });
        expect(mzr.cache.writeMem).toBe(true);
        expect(mzr.cache.writeFile).toBe(true);
        expect(mzr.cache.readFile).toBe(false);

        var storeName = 'test-memo';
        var mzr = new Memoizer({ storeName });
        expect(mzr.cache.store.storeName).toBe(storeName);
    });
    it("memoizer stores non-promise results", async()=>{
        var mzr = new Memoizer({storeName: STORENAME});
        mzr.logLevel = 'info';

        // memoize function
        var f1 = function(arg){return `${arg}-41`};
        var m1 = mzr.memoize(f1, CONTEXT);
        expect(m1('test')).toBe('test-41');
        expect(m1('test')).toBe('test-41');

        // memoize arrow function
        var f2 = arg=>`${arg}-42`;
        var m2 = mzr.memoize(f2, CONTEXT);
        expect(m2('test')).toBe('test-42');
        expect(m2('test')).toBe('test-42');

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
        expect(m3('test')).toBe('test-43');
        expect(calls).toBe(1);
        expect(m3('test')).toBe('test-43');
        expect(calls).toBe(1);
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
        expect(p).toBeInstanceOf(Promise);
        expect(await p).toBe('test-42');
        var FUDGE = 2;
        expect(Date.now()-ms0).toBeGreaterThanOrEqual(DELAY-FUDGE);

        var ms1 = Date.now();
        expect(await m('test')).toBe('test-42');
        var elapsed = Date.now()-ms1;
        expect(elapsed).toBeGreaterThanOrEqual(-1);
        expect(elapsed).toBeLessThan(DELAY);
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
        expect(mzr.volumeOf(()=>true)).toBe("global.lambda");
        expect(mzr.volumeOf(fun, "Polygon")).toBe("Polygon.fun");
        expect(mzr.volumeOf(TestClass.staticMethod, TestClass))
            .toBe("TestClass.staticMethod");

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
        expect(lastSerialized).toBe(JSON.stringify({
            isPromise: false,
            volume: 'test.add1',
            args:[42],
            value:{answer:43},
        }));
        var expected = new TestClass({answer:43});
        expect(add1Memo(42)).toEqual(expected); // computed
        await new Promise(r=>setTimeout(r,100));
        expect(add1Memo(42)).toEqual(expected); // cached
    });

});
