var Hook = require('./hook');

exports.hook = function(ast, options){
    new Hook(options).walk(ast)
    return ast;
}