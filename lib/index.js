var tokenizer = require('./tokenizer');
var parser = require('./parser');
var translator = require('./translator');
var util = require('./helper/util');
var interpreter = require('./interpreter');
var fs = require('fs');

exports.tokenizer = tokenizer;
exports.parser = parser;
exports.util = util;
exports.translator = translator;
exports.interpreter = interpreter;


exports.parse = function(text, options, callback){
    parser.parse(text, options , function(error, ast){
        console.log(ast) 
    })
    // translator.translate(fs.readFileSync(path,'utf8'), {}, callback)
}
