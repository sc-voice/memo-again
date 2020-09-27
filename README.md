Serializable [memoizer](https://en.wikipedia.org/wiki/Memoization) with promises.


### Files
File iterators and more...

##### Iterate over all files in directory
```
    var files = [];
    for await (let f of Files.files(FILES_DIR)) {
        files.unshift(f);
    }
    // [ "hello", "sub/basement", "universe", ]
```

##### Application folder
The application that uses this library
```
console.log(Files.APP_DIR);
// /home/somebody/myapp
```

##### Local folder
Use "local" folder for application data. 
Remember to add it to `.gitignore`
```
console.log(Files.LOCAL_DIR);
// /home/somebody/myapp/local
```
    it("TESTTESTfilesSync(root) => generator", ()=>{
        // Specify root path
        var files = [...Files.filesSync(FILES_DIR)];
        should.deepEqual(files, [
            "universe",
            "hello", 
        ]);

        // Default is source folder
        var files = [...Files.filesSync()];
        should.deepEqual(files, [
            "memoizer.js",
            "guid-store.js",
            "files.js",
        ]);
    });
    it("TESTTESTfilesSync(root) => absolute path", ()=>{
        // absolute path 
        var files = [...Files.filesSync({root: FILES_DIR, absolute:true})];
        should.deepEqual(files.map(f=>f.replace(APP_DIR,'...')), [
            ".../test/data/files/universe",
            ".../test/data/files/hello", 
        ]);

        // absolute path undefined
        var files = [...Files.filesSync({absolute:true})];
        should.deepEqual(files.map(f=>f.replace(APP_DIR,'...')), [
            ".../src/memoizer.js",
            ".../src/guid-store.js",
            ".../src/files.js",
        ]);
    });
    it("TESTTESTfilesSync(root) => stats", ()=>{
        var files = [...Files.filesSync({root: FILES_DIR, stats:true})];
        should.deepEqual(files.map(f=>f.path.replace(APP_DIR,'...')), [
            "universe",
            "hello",
        ]);
        should.deepEqual(files.map(f=>f.stats.size), [ 9, 6, ]);
    });
