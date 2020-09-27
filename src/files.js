(function(exports) {
    const fs = require('fs');
    const path = require('path');


    class Files {
        static get APP_DIR() {
            var fs = eval("require('fs')"); // Fool nuxt
            var path = require('path');
            var appdir = __dirname.replace(/\/node_modules\/.*/, '');
            if (appdir === __dirname) {
                appdir = path.join(__dirname, '..');
            }
            return appdir;
        }
        static get LOCAL_DIR() {
            var fs = eval("require('fs')"); // Fool nuxt
            var path = require('path');
            var local = path.join(Files.APP_DIR, 'local');
            if (!fs.existsSync(local)) {
                fs.mkdirSync(local);
            }

            return local;
        }

        static *filesSync(arg) {
            var opts = typeof arg === 'string'
                ? {root:arg}
                : arg || {};
            var root = opts.root || __dirname;
            var stats = opts.stats;
            var absolute = opts.absolute;
            root = root.replace("/$", ""); // normalize
            let stack = [root];
            let reRoot = new RegExp(`^${root}/`);
            while (stack.length) {
                var fpath = stack.pop();
                if (fs.existsSync(fpath)) {
                    this.found++;
                    var fstats = fs.statSync(fpath);
                    if (fstats.isDirectory()) {
                        fs.readdirSync(fpath).forEach(dirEntry=>{
                            stack.push(path.join(fpath,dirEntry));
                        });
                    } else if (fstats.isFile()) {
                        let ypath = absolute 
                            ? fpath 
                            : fpath.replace(reRoot,'');
                        yield stats
                            ? { stats: fstats, path: ypath, }
                            : ypath;
                    }
                }
            }
        }

        static async *files(arg) {
            var opts = typeof arg === 'string'
                ? {root:arg}
                : arg || {};
            var root = opts.root || __dirname;
            var stats = opts.stats;
            var absolute = opts.absolute;
            root = root.replace("/$", ""); // normalize
            let stack = [root];
            let reRoot = new RegExp(`^${root}/`);
            while (stack.length) {
                var fpath = stack.pop();
                if (!fs.existsSync(fpath)) {
                    continue;
                }

                this.found++;
                var fstats = await fs.promises.stat(fpath);
                if (fstats.isDirectory()) {
                    var entries = await fs.promises.readdir(fpath);
                    entries.forEach(dirEntry=>{
                        stack.push(path.join(fpath,dirEntry));
                    });
                } else if (fstats.isFile()) {
                    let ypath = absolute 
                        ? fpath 
                        : fpath.replace(reRoot,'');
                    yield stats
                        ? { stats: fstats, path: ypath, }
                        : ypath;
                }
            }
        }

    }

    module.exports = exports.Files = Files;
})(typeof exports === "object" ? exports : (exports = {}));
