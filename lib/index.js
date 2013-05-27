var tokenizer = require('./tokenizer');
var parser = require('./parser');
var translator = require('./translator');
var util = require('./helper/util');
var interpreter = require('./interpreter');
var fs = require('fs');

exports.Tokenizer = tokenizer;
exports.Parser = Parser;
exports._ = util;
exports.translator = translator;
exports.interpreter = interpreter;


exports.parse = function(text, options, callback){
    parser.parse(text, options , function(error, ast){
        console.log(ast) 
    })
    // translator.translate(fs.readFileSync(path,'utf8'), {}, callback)
}

module.exports = function(options){
    return new Mcss(options)
}

function Mcss(options){
    this.set(options || {});
}

var $ = Mcss.prototype

// set options
$.set = function(key, value){

}


// outport function
$.render = function(input, callback){

}

//
$.interpret = function(input, callback){

}

// parse

$.parse = function(input, callback){
    if(!callback){
        callback = input
        input = null;
    }
}















