var tk = mcss.tokenizer;
var ps = mcss.parser;




this.parser = {

}

http('../data/parse.mcss',function(text){
    // console.log(tk(text).pump())
    console.log(ps(text));
});
