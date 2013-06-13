// add line and exports style.map
var sourceMap = require('source-map');
var path = require('path');
module.exports = function(options){
    var options = options || {};
    var buffers = [];
    var mapper = {};
    var generator = (path && options.sourceMap)? new sourceMap.SourceMapGenerator({
        file: path.basename(options.dest)
    }): null;
    var lines = 1;
    var column = 1;
    var outport = '';
    return {
        add: function(content){
            if(options.sourceMap){
                var newline = (content.match(/\n/g) || '').length;
                lines += newline;
                var clen = content.length;
                if(newline){
                    column = clen - content.lastIndexOf('\n') - 1;
                }else{
                    column += clen;
                }
            }
            outport += content;
        },
        addMap: function(map){
            if(options.sourceMap){
                generator.addMapping({
                    generated: {column: column, line: lines},
                    source: path.relative(path.dirname(options.dest), map.source),
                    original: {column: 1, line: map.line}
                });
            }
        },
        toString: function(){
            return outport;
        },
        getMap: function(){
            // browser
            if(!generator) return null;
            return generator.toString();
        }
    }
}