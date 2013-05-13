var Interpreter = require('./interpreter');
var Parser = require('../parser');
var Hook = require('../hook');


exports.interpret = function(ast, options){
    if(typeof ast === 'string'){
        ast = Parser.parse(ast, options);
    }
    console.log(ast);
    return new Interpreter(options).interpret(ast);
}

exports.Interpreter = Interpreter;