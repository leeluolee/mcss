


http('../data/parse.mcss',function(text){
    var date = Date.now();
    mcss.translate(text,{
        filename: '/test/data/parse.mcss'
    }).done(function(ast){
        console.log(ast) 
        console.log(Date.now() - date)
    })
})



