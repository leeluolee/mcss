var Parser = require('./parser');
var Interpreter = require('./interpreter');
var Translator = require('./translator');
var _ = require('./helper/util');

var defaults= {
    minify: false,
    o_folder: 'css',
    i_folder: 'mcss'
}


var parse = exports.parse = function(text, options, callback){
    // @TODO
    if(typeof text === 'object'){
        options = text;
        callback = options;
        text = null;
    }
    var parser = new Parser(options);
    parser.parse(text, callback);
}

var interpret = exports.interpret = function(text, options, callback){
    if(typeof text === 'object'){
        options = text;
        callback = options;
        text = null;
    }
    var interpreter = new Interpreter(options);
    parse(text, options , function(err, ast){
        if(err) return callback(err)
        callback(null, interpreter.interpret(ast));
    })
}

var translate = exports.translate = function(text, options, callback){
    if(typeof text === 'object'){
        options = text;
        callback = options;
        text = null;
    }
    if(!text){

    }
    if(!callback && options.outport) callback = function(err, text){
        fs.writeFileSync(options.outport, text, 'utf8');
    }
    var translator = new Translator(options);
    interpret(text, options, function(err, ast){
        if(err) return callback(err);
        callback(null, translator.translate(ast));
    })
}

