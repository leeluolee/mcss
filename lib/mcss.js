var Parser = require('./parser');
var Interpreter = require('./interpreter');
var Translator = require('./translator');
var tk = require('./tokenizer');
var promise = require('./helper/promise');
var _ = require('./helper/util');
var io = require('./helper/io');
var options = require('./helper/options');
var error = require('./error');


/**
 * 包装成stylus一样的接口口
 */


function Mcss(options){
    this.options = _.extend(options, {
        imports: {},
        pathes: [],
        format: 1
    });
}

var m = options.mixTo(Mcss);

/**
 * set options
 * @return {[type]} [description]
 */


m.include = function(path){
    this.get('pathes').push(path);
    return this;
}


m.tokenize = function(text){
    return tk.tokenize(text, this.options);
}

m.parse = function(text){
    var options = this.options;
    var parser = new Parser(this.options);
    var fp, pr = promise();
    if(text === undefined){
        if(this.get('filename')){
            fp = io.parse(this.options.filename, this.options);
        }else{
            throw Error('text or filename is required') 
        }
    }else{
        fp = parser.parse(text)
    }
    fp.always(pr)
    return pr;
}

m.interpret = function(text){
    var options  = this.options;
    var interpreter = new Interpreter(options);
    var pr = promise();
    this.parse(text).done(function(ast){
        try{
            ast = interpreter.interpret(ast)
            pr.resolve(ast)
        }catch(e){
            pr.reject(e);
        }
    }).fail(pr)
    return pr;
}

m.translate = function(text){
    var options = this.options;
    var translator = new Translator(options);
    var interpreter = new Interpreter(options);
    var pr = promise();
    this.parse(text).done(function(ast){
        try{
            ast = interpreter.interpret(ast)
            pr.resolve(translator.translate(ast));
        }catch(e){
            pr.reject(e);
        }
    }).fail(pr);
    return pr;
}

var mcss = module.exports = function(options){
    return new Mcss(options || {})
}

// constructor
mcss.Parser = Parser;
mcss.Interpreter = Interpreter;
mcss.Translator = Translator;
mcss.Tokenizer = tk.Tokenizer;


// usefull util
mcss.io = io;
mcss.promise = promise;
mcss._ = _;
mcss.error = error;

