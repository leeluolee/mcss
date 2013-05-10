// the latest walker for output the translate css;

var Walker = require('../walker');


function Translator(){}

var _ = Translator.prototype = new Walker();



_.translate = function(tree){
    this.tree = tree; 
    this.walk(tree);
    this.indent = 1;
}


_.walk_stylesheet = function(tree){
    var cssText = '';
    var bodyText = this.walk(tree.body);
    console.log(bodyText.join('\n'))
}


_.walk_ruleset = function(tree){
    var cssTexts = [this.walk(tree.selector)];
    cssTexts.push(this.walk(tree.block));
    return cssTexts.join('');
}

_.walk_selectorlist = function(tree){
    return this.walk(tree.list).join(', ');
}
_.walk_complexselector = function(tree){
    return tree.string;
}

_.walk_block = function(tree){
    var text = this.walk(tree.list).join('; ') + ';';
    return '{' + text + '}';
}
_.walk_componentvalues = function(tree){
    var text = this.walk(tree.list).join(' ');
    return text;
}

_.walk_declaration = function(tree){
    var text = tree.property;
    var value = this.walk(tree.value);
    return text + ': ' + value;
}
// componentValue
_.walk_ident = function(tree){
    console.log(tree)
    return tree.val;
}


_.walk_string = function(tree){
    return '"' + tree.val + '"';
}

_['walk_,'] = function(tree){
    return ',';
}

_.walk_rgba = function(tree){
    
}

_.walk_unknown = function(tree){

}

_.walk_e = function(){
    
}

_.walk_uri = function(tree){
    return 'url(' + tree.val + ')';
}

_.walk_rgba = function(tree){
    console.log(tree.color)
    return tree.color.css();
}


_.walk_dimension = function(tree){
    var val = tree.val;
    return val.number + (val.unit? val.unit: '');
}






module.exports = Translator;
