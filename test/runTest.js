"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const path = require("path");
const Mocha = require("mocha");
const glob_1 = require("glob");
function run() {
    console.log('Starting test run...');
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });
    const testsRoot = path.resolve(__dirname);
    console.log('Tests root:', testsRoot);
    return new Promise((resolve, reject) => {
        (0, glob_1.glob)('**/*.test.ts', { cwd: testsRoot }).then((files) => {
            console.log('Test files found:', files);
            // Add files to the test suite
            files.forEach((f) => {
                console.log('Adding test file:', f);
                mocha.addFile(path.resolve(testsRoot, f));
            });
            try {
                // Run the mocha test
                mocha.run((failures) => {
                    console.log('Mocha run completed with failures:', failures);
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (err) {
                console.error('Error running mocha:', err);
                reject(err);
            }
        }).catch((err) => {
            console.error('Error finding test files:', err);
            reject(err);
        });
    });
}
exports.run = run;
//# sourceMappingURL=runTest.js.map