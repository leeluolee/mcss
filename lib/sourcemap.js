/*/
// a small wrapper around fitzgen's source-map library
var sourceMap = require('source-map');
var _ = require('./helper/util');

// function SourceMap(options) {
//     this.options = _.extend(options || {}, {
//         sourceRoot:'',
//         file:'',
//         orig: ''
//     })
//     this.generator = new sourceMap.SourceMapGenerator({this.options);
//     this.consumer = orig_map = options.orig && new sourceMap.SourceMapConsumer(options.orig);
//     function add(source, gen_line, gen_col, orig_line, orig_col, name) {
//         if (orig_map) {
//             var info = orig_map.originalPositionFor({
//                 line: orig_line,
//                 column: orig_col
//             });
//             source = info.source;
//             orig_line = info.line;
//             orig_col = info.column;
//             name = info.name;
//         }
//         generator.addMapping({
//             generated : { line: gen_line, column: gen_col },
//             original  : { line: orig_line, column: orig_col },
//             source    : source,
//             name      : name
//         });
//     };
//     return {
//         add        : add,
//         get        : function() { return generator },
//         toString   : function() { return generator.toString() }
//     };
// };

// var _ = module.exports = function(options){
//     return new SourceMap(options)
// }

// _.add = function(){

// }

var map = new sourceMap.SourceMapGenerator({
    file: 'generated-foo.js',
    sourceRoot: '.'
});

map.addMapping({
    generated: { line: 1, column: 1 },
    source: 'bar.js',
    original: { line: 1, column: 1 }
});
{"version":3,"file":"generated-foo.js","sources":["bar.js","bar2.js"],"names":[],"mappings":"CAAC;;;CCEA","sourceRoot":"."}
map.addMapping({
    generated: { line: 4, column: 1 },
    source: 'bar2.js',
    original: { line: 3, column: 1 },
});


