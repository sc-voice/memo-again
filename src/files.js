(function(exports) {
    const fs = require('fs');
    const path = require('path');

    class Files {
        static get LOCAL_DIR() {
            var fs = eval("require('fs')"); // Fool nuxt
            var path = require('path');
            var appdir = __dirname.replace(/\/node_modules\/.*/, '');
            if (appdir === __dirname) {
                appdir = path.join(__dirname, '..');
            }
            var local = path.join(appdir, 'local');
            if (!fs.existsSync(local)) {
                fs.mkdirSync(local);
            }

            return local;
        }
    }

    module.exports = exports.Files = Files;
})(typeof exports === "object" ? exports : (exports = {}));
