// Root stub for legacy (node10) module resolution, which ignores the "exports"
// map: makes require('fastdecimal/big') resolve for old TypeScript/bundler setups.
module.exports = require('./dist/big.js');
