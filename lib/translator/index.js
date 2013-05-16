var Translator = require('./translator');
var interpreter = require('../interpreter');
var hook = require('../hook');

exports.translate = function(ast, options){
    if(typeof ast == 'string'){
        ast = interpreter.interpret(ast);
    }
    if(options.hooks && options.hooks.length) ast = hook.hook(ast, options);
    return new Translator(options).translate(ast)
}
