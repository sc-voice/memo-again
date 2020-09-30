Two-level [memoizer](https://en.wikipedia.org/wiki/Memoization) 
with promises stores function values in memory and/or file caches.
Writes to memory and file caches can be independently 
changed on demand. 
The file cache is stored in the application `local` folder
by default, so you may want to add `local/` to `.gitignore`.

### Memoizer
For more examples, see [test/memoizer.js](https://github.com/sc-voice/memo-again/blob/master/test/memoizer.js)

```
const { Memoizer } = require("memo-again");
var f = x=>42+x;
var mzr = new Memoizer();
var fmemo = mzr.memoize(f);

fmemo(0); // 42 
fmemo(0); // 42 (cached)
fmemo(1); // 43
fmemo(1); // 43 (cached)
```

### Files
File iterators and more...

##### Iterate over all files in directory (async)
Async generator permits precise control of thread usage.
```
    var files = [];
    for await (let f of Files.files(FILES_DIR)) {
        files.unshift(f);
    }
    // [ "hello", "sub/basement", "universe", ]
```

##### Customize file iteration
Async generator provides fs.Stats
```
    var opts = {
        root: FILES_DIR,
        stats: true, // return fs.Stats object
        absolute: true, // return absolute filepath
    }
    for await (let f of Files.files(FILES_DIR)) {
        console.log(JSON.stringify(f));
        // {path:..., stats:...}
    }
```

##### Spread-syntax initialization (sync-only)
Sync generator uses fs sync methods and can be slower.
```
    var files = [...Files.filesSync(FILES_DIR)];
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
