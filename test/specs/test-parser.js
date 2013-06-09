



http('/test/mcss/abstract.mcss', function(text){
    var date = Date.now();
    mcss({
        filename: '/test/mcss/abstract.mcss'
    }).translate(text).done(function(ast){
        console.log(ast)
        console.log(Date.now() - date)
    })
})




