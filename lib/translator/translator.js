// the latest walker for output the translate css;
// add before an after event hook;
// @ dont outport block.length === 0

var Walker = require('../walker');
var tree = require('../node');
var u = require('../helper/util');
var tmpl = require('../helper/templayed');


function Translator(options){
    this.options = options || {};
}

var _ = Translator.prototype = new Walker();


var walk = _.walk;


_.translate = function(ast){
    this.ast = ast; 
    this.indent = 0;
    return this.walk(ast);
}

_.walk_stylesheet = function(ast, brac){
    var indent = this.idt2str();
    var start = (brac ? '{\n': '')+indent;
    this.index++;
    var bodyText = this.walk(ast.list)
        .join('\n' + this.idt2str());
    this.index--;
    var end = brac? '\n}': '';
    return start + bodyText + end;
}


_.walk_ruleset = function(ast){
    if(!ast.block.list.length) return '';
    var slist = ast.getSelectors();
    if(!slist.length) return '';
    var cssTexts = [this.walk(slist).join(',\n')];
    cssTexts.push(this.walk(ast.block));
    return cssTexts.join('');
}

_.walk_selectorlist = function(ast){
    return this.walk(ast.list).join(',\n');
}
_.walk_complexselector = function(ast){
    return ast.string;
}

_.walk_block = function(ast){
    var res = ['{\n'], rulesets = [], self = this;
    // sub ast
    ast.list.forEach(function(sast){
        if(tree.inspect(sast) === 'ruleset') rulesets.push(sast)
        else res.push('\t' + self.walk(sast) + '\n');
    })
    rulesets.forEach(function(ruleset){
        res.push(self.walk(ruleset));
    })
    res.push('}\n')
    var text = res.join('');
    return text;
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

_.walk_media = function(ast){
    var str = '@media ';
    str += this.walk(ast.queryList).join(',\n');
    str += ' {\n'
    str += this.walk(ast.stylesheet);
    str += '}\n'
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


//@TODO indent 值的自定义
_.idt2str = function(){
    return Array(this.indent+1).join('\t');
}








module.exports = Translator;
