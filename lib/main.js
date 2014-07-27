var mcss = module.exports = require('./mcss');
mcss.sourcemap = require('source-map');
mcss.request = require('request');

delete Function.prototype.__accept;
delete Function.prototype.__msetter;
delete Number.prototype.__limit;