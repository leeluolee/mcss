var tk = mcss.tokenizer;
var ps = mcss.parser;




this.parser = {

}

http('../data/parse.mcss',function(text){
    var parser = ps(text);
    console.log(parser.parse())

});
