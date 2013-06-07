


var date = Date.now();
mcss({
    filename: '/test/data/parse.mcss'
}).translate().done(function(ast){
    console.log(ast) 
    console.log(Date.now() - date)
})



