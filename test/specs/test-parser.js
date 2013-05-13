var tk = mcss.tokenizer;
var ps = mcss.parser;
var tl = mcss.translator;
var it = mcss.interpreter;



this.parser = {}


http('../data/simple.mcss',function(text){
    var date = +new Date()
    var node = ps.parse(text);
    var node = it.interpret(node)
    // console.log(node)
    tl.translate(node, {
        hooks: ['csscomb', 'prefixr']
    });
    console.log(+new Date - date)

});
