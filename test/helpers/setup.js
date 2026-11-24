'use strict';
// Loaded first by every test file. Pins the timezone used in production (Docker sets TZ=Asia/Taipei)
// and points `require('../config')` inside server/ at a test config, so tests never touch the real
// token or database even when server/config.js exists locally.
process.env.TZ = 'Asia/Taipei';

const path = require('node:path');
const Module = require('node:module');

const SERVER = path.join(__dirname, '..', '..', 'server');
const TEST_CONFIG = path.join(__dirname, 'config.js');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
    if (/(^|\/)config$/.test(request) && parent?.filename?.startsWith(SERVER + path.sep)) return TEST_CONFIG;
    return originalResolve.call(this, request, parent, ...rest);
};

module.exports = {
    SERVER,
    // Require a module from server/, e.g. src('plugin/mysql').
    src: name => require(path.join(SERVER, name)),
};
