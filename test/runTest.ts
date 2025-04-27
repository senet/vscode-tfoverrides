import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
    console.log('Starting test run...');
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname);
    console.log('Tests root:', testsRoot);

    return new Promise((resolve, reject) => {
        glob('**/*.test.ts', { cwd: testsRoot }).then((files: string[]) => {
            console.log('Test files found:', files);
            // Add files to the test suite
            files.forEach((f: string) => {
                console.log('Adding test file:', f);
                mocha.addFile(path.resolve(testsRoot, f));
            });

            try {
                // Run the mocha test
                mocha.run((failures: number) => {
                    console.log('Mocha run completed with failures:', failures);
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                console.error('Error running mocha:', err);
                reject(err);
            }
        }).catch((err) => {
            console.error('Error finding test files:', err);
            reject(err);
        });
    });
}
