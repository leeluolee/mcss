var mcss = require('../../lib/mcss')
var path = require('path');
var fs = require('fs');


mcss.io.parse('/home/luobo/code/mcss/test/data/parse.mcss')
    .always(function(ast){
        console.log(ast);
    })