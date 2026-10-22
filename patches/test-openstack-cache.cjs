const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {PassThrough} = require('node:stream');
const {spawnSync} = require('node:child_process');
const {createRequire} = require('node:module');

const adapterPath = path.resolve(process.argv[2]);
const scenario = process.argv[3];

if (!scenario) {
    for (const name of ['offline', 'success', 'transform-error', 'serve-offline']) {
        const child = spawnSync(process.execPath, [__filename, adapterPath, name], {
            encoding: 'utf8', timeout: 10000
        });
        assert.equal(child.status, 0, `${name}: ${child.stderr || child.error || child.stdout}`);
        console.log(`PASS ${name}`);
    }
} else {
    const Cache = require(path.join(adapterPath, 'cache.js'));
    const sharp = createRequire(path.join(adapterPath, 'cache.js'))('sharp');
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'openstack-cache-test-'));
    let input;
    const cache = new Cache(folder, {
        download() {
            input = new PassThrough();
            setImmediate(async () => {
                if (scenario.endsWith('offline')) {
                    input.destroy(Object.assign(new Error('storage unreachable'), {code: 'EHOSTUNREACH'}));
                } else if (scenario === 'transform-error') {
                    input.end('not an image');
                } else {
                    try {
                        input.end(await sharp({
                            create: {width: 2, height: 2, channels: 3, background: 'red'}
                        }).png().toBuffer());
                    } catch (err) {
                        input.destroy(err);
                    }
                }
            });
            return input;
        }
    }, 'test-container');

    (async () => {
        try {
            if (scenario === 'serve-offline') {
                const Adapter = require(adapterPath);
                let status;
                await Adapter.prototype.serve.call({cache})(
                    {path: '/image.png', query: {}},
                    {sendStatus(code) { status = code; }},
                    () => assert.fail('unexpected next()')
                );
                assert.equal(status, 404);
            } else {
                const operation = cache.createCache('image.png', {width: null, webp: false});
                if (scenario === 'success') {
                    assert.ok((await operation).size > 0);
                    const metadata = await sharp(path.join(folder, 'image.png')).metadata();
                    assert.equal(metadata.width, 2);
                    assert.equal(metadata.height, 2);
                } else {
                    await assert.rejects(operation, scenario === 'offline'
                        ? {code: 'EHOSTUNREACH'} : /unsupported image format/i);
                }
            }
            assert.ok(input.destroyed);
        } finally {
            fs.rmSync(folder, {recursive: true, force: true});
        }
    })().catch((err) => {
        console.error(err);
        process.exitCode = 1;
    });
}
