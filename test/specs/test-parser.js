var tk = mcss.tokenizer;
var ps = mcss.parser;
var tl = mcss.translator;
var it = mcss.interpreter;



this.parser = {}

mcss.interpret(input, {}, function(){
    
})

http('../data/parse.mcss',function(text){
    var date = +new Date()
    // console.log(tk.tokenize(text))
    ps.parse(text, {}, function(error, ast){
        var ast = it.interpret(ast)
        console.log(ast)
    })
    // var text = mcss.parse(text, {
    //     hooks: ['csscomb', 'prefixr']
    // }, function(error, text){
    //     console.log(text)
    //     console.log(+new Date - date)
    // });

});
