// add line and exports style.map
var sourceMap = require('source-map');
var path = require('path');
module.exports = function(options){
    var options = options || {};
    var buffers = [];
    var mapper = {};
    var generator = sourceMap? new sourceMap.SourceMapGenerator({
        file: path.basename(options.filename)
    }): null;
    this.lines = 1;
    this.column = 1;
    this.content = '';
    return {
        add: function(content){
            var newline = (content.match(/\n/g) || '').length;
            this.lines += newline;
            this.content += content;
            var clen = content.length;
            if(newline){
                this.column = clen - content.lastIndex('\n') - 1
            }else{
                this.column += clen;
            }
        },
        addMap: function(map){
            generator.addMapping({
                generated: {column: this.column, line: this.lines},
                source: path.relative(options.filename, map.source),
                original: {column: 1, line: map.line}
            });
        },
        toString: function(){
            return buffers.join('\n');
        },
        genMap: function(){
            // browser
            if(!generator) return null;
            return generator.toString();
        }
    }
}