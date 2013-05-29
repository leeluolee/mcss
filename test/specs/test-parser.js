var tk = mcss.tokenizer;
var ps = mcss.parser;
var tl = mcss.translator;
var it = mcss.interpreter;



this.parser = {}

http('../data/parse.mcss',function(text){
    var date = Date.now();
    mcss.interpret(text,{},function(error, ast){
        console.log(ast) 
        console.log(Date.now() - date)
    })
})



