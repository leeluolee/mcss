var tk = mcss.tokenizer;
var ps = mcss.parser;
var tl = mcss.translator;



this.parser = {
    
}


http('../data/parse.mcss',function(text){
    var node = ps.parse(text);
    console.log(node)
    // console.log(parser.parse())
    console.log(tl.translate(node));

});
