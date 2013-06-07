var Parser = require('./parser');
var Interpreter = require('./interpreter');
var Translator = require('./translator');
var Tokenizer = require('./tokenizer');
var promise = require('./helper/promise');
var _ = require('./helper/util');
var io = require('./helper/io');
var options = require('./helper/options');
var state = require('./state');


/**
 * 包装成stylus一样的接口口
 */


function Mcss(options){
    this.options = _.extend(options || {}, {
        pathes: [],
        format: 1
    });
}
var m = Mcss.prototype;

options.mixTo(m);

/**
 * set options
 * @return {[type]} [description]
 */


m.include = function(path){
    this.get('paths').push(path);
    return this;
}

/**
 * Error 处理
 */
m.parse = function(text){
    var parser = new Parser(this.options);
    if(!text){
        if(this.get('filename')){
            return io.parse(this.options.filename, this.options)
        }
        throw Error('text or filename is required') 
    }
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

var mcss = module.exports = function(options){
    return new Mcss(options)
}

// constructor
mcss.Parser = Parser;
mcss.Interpreter = Interpreter;
mcss.Translator = Translator;
mcss.Tokenizer = Tokenizer;


// usefull util
mcss.io = io;
mcss.promise = promise;
mcss._ = _;
mcss.state = state;

