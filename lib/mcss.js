var Parser = exports.Parser = require('./parser');
var Interpreter = exports.Interpreter = require('./interpreter');
var Translator = exports.Translator =require('./translator');
var promise = require('./helper/promise');
var _ = require('./helper/util');
var io = require('./helper/io');

/**
 * 包装成stylus一样的接口口
 */


function Mcss(options){
    this.options = options || {};
}
var m = Mcss.prototype;

/**
 * set options
 * @return {[type]} [description]
 */
m.set = function(name, value){
    this.options[name] = value;
    return this;
}.__msetter();

m.get = function(name){
    return this.options[name];
}

m.include = function(path){
    this.get('paths').push(path);
    return this;
}

/**
 * Error 处理
 */
m.parse = function(text){
    var parser = new Parser(this.options);
    return parser.parse(text);
}

m.interpret = function(text){
    var interpreter = new Interpreter(this.options);
    var pr = promise();
    this.parse(text).done(function(ast){
        pr.resolve(interpreter.interpret(ast));
    })
    return pr;
}

m.translate = function(text){
    var translator = new Translator(this.options);
    var pr = promise();
    this.interpret(text).done(function(ast){
        pr.resolve(translator.translate(ast));
    })
    return pr;
}


exports.io = io;
exports.promise = promise;
exports._ = _;

