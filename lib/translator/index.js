var Translator = require('./translator');
var Parser = require('../parser');
var hook = require('../hook');

exports.translate = function(ast, options){
    if(typeof ast == 'string'){
        ast = Parser.parse(ast);
    }
    ast = hook.hook(ast, options);
    return new Translator(options).translate(ast)
}
