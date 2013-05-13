var tk = mcss.tokenizer;
var ps = mcss.parser;
var tl = mcss.translator;
var it = mcss.interpreter;



this.parser = {}


http('../data/parse.mcss',function(text){
    var date = +new Date()
    var node = ps.parse(text);
    // console.log(node)
    // tl.translate(node, {
    //     hooks: ['csscomb', 'prefixr']
    // });
    console.log(it.interpret(node));
    console.log(+new Date - date)

});
