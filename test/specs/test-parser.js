var tk = mcss.tokenizer;
var ps = mcss.parser;
var tl = mcss.translator;
var it = mcss.interpreter;



this.parser = {}


http('../data/parse.mcss',function(text){
    var date = +new Date()
    var text = mcss.parse(text, {
        hooks: ['csscomb', 'prefixr']
    }, function(error, text){
        console.log(text)
        console.log(+new Date - date)
    });

});
