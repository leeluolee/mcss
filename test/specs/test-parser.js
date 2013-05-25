var tk = mcss.tokenizer;
var ps = mcss.parser;
var tl = mcss.translator;
var it = mcss.interpreter;



this.parser = {}


http('../data/simple.mcss',function(text){
    var date = +new Date()
    console.log(tk.tokenize(text))
    ps.parse(text, {}, function(error, ast){
        console.log(ast)
        console.log(+new Date - date)
    })
    // var text = mcss.parse(text, {
    //     hooks: ['csscomb', 'prefixr']
    // }, function(error, text){
    //     console.log(text)
    //     console.log(+new Date - date)
    // });

});
