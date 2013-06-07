// the latest walker for output the translate css;
// add before an after event hook;

// @TODO: format === 3;

var Walker = require('../walker');
var tree = require('../node');
var u = require('../helper/util');
var options = require('../helper/options');
var tmpl = require('../helper/templayed');


function Translator(options){
    this.options = options || {};
}

var _ = Translator.prototype = new Walker();


var walk = _.walk;

options.mixTo(_);

var formats = {
    COMMON: 1,
    COMPRESS: 2,
    ONELINE: 3
}

_.translate = function(ast){
    this.ast = ast; 
    // 层级
    this.level = 0;
    this.indent = this.get('indent') || '\t';
    this.newline = (this.get('format') > 1)? '': '\n';
    return this.walk_stylesheet(ast, true);
}

_.walk_stylesheet = function(ast, blank){
    return this.walk_block(ast, blank);

    // if(this.level){
    //     var indent = this.indent,
    //         start = '{\n'+indent,
    //         end = this.newline + indent + '}'
    // }else{
    //     var indent = '', 
    //         start = '',
    //         end = '';
    // }
    // var list = ast.list;
    // var res = []
    // return start + res.join(
    //    this.newline + indent) + end;
}


_.walk_ruleset = function(ast){
    if(!ast.block.list.length) return '';
    var slist = ast.getSelectors();
    if(!slist.length) return '';
    var cssTexts = [this.walk(slist).join(',')];
    cssTexts.push(this.walk(ast.block));
    return cssTexts.join('');
}

_.walk_selectorlist = function(ast){
    return this.walk(ast.list).join(','+this.newline);
}
_.walk_complexselector = function(ast){
    return ast.string;
}

_.walk_block = function(ast, blank){
    this.level++;
    var indent = this.indents();
    var res = [];
    if(!blank) res.push('{')
    var list = ast.list;
    for(var i=0,len=list.length; i<len;i++){
        var item = this.walk(list[i]);
        if(item){
            //@remove format 3
            if(list[i].type!=='declaration'
                && this.has('format', 3)){
                item+='\n';
            }
            res.push(item)
        }
    }
    var str = res.join(this.newline + indent);
    this.level--;
    if(!blank){
        str += this.newline +this.indents() + '}'
    }
    return str;
}
_.walk_valueslist = function(ast){
    var text = this.walk(ast.list).join(',');
    return text;
}

_.walk_values = function(ast){
    var text = this.walk(ast.list).join(' ');
    return text;
}

_.walk_import = function(ast){
    var outport = ['@import ',this.walk_url(ast.url)]
    if(ast.queryList && ast.queryList.length){
        outport.push(this.walk(ast.queryList).join(','))
    }
    return outport.join(' ') + ';';
}

_.walk_debug = function(ast){
    console.debug(this.walk(ast.value))
}

_.walk_media = function(ast){
    var str = '@media ';
    str += this.walk(ast.queryList).join(',');
    str += this.walk_stylesheet(ast.stylesheet);
    return str;
}

_.walk_mediaquery = function(ast){
    var outport = this.walk(ast.expressions);
    if(ast.mediaType) outport.unshift(ast.mediaType);
    return outport.join(' and ');
}

_.walk_mediaexpression = function(ast){
    var str = '';
    str += this.walk(ast.feature);
    if(ast.value) str += ': ' + this.walk(ast.value);
    return '(' + str + ')'
}


var declaration_t = tmpl('{{property}}')
_.walk_declaration = function(ast){
    var text = this.walk(ast.property);
    var value = this.walk(ast.value);
    return text + ': ' + value + ';';
}


_.walk_string = function(ast){
    return '"' + ast.value + '"';
}

_['walk_='] = function(ast){
    return '=';
}
_['walk_/'] = function(ast){
    return '/';
}


_.walk_unknown = function(ast){
    return ast.name;
}


_.walk_url = function(ast){
    return 'url("' + ast.value + '")';
}

_.walk_rgba = function(ast){
    return ast.tocss();
}

_.walk_directive = function(ast){
    var str = "@" + ast.name + ' ';
    if(ast.value){
        str += this.walk(ast.value);
    }
    if(ast.block){
        str += this.walk(ast.block);
    }
    return str;
}

_.walk_call = function(ast){
    return ast.name + '(' +
        this.walk(ast.args).join(',') + ')';
}


_.walk_default = function(ast){
    if(!ast) return '';
    // u.error('no '+ ast.type + " walker founded");
    var str = tree.toStr(ast);
    if(typeof str !== 'string'){
        return ''
    }
    return str
}



_.indents = function(){
    if(this.get('format') > 1){
        return '';
    }else{
        return Array(this.level).join(this.indent);
    }
}









module.exports = Translator;
