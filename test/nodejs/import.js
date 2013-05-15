var mcss = require('../../lib/index')
var path = require('path');
var fs = require('fs');

var p = path.join(__dirname ,'../data/import1.mcss');
mcss.parse(fs.readFileSync(p,'utf8'), function(err, text){
    console.log(text)
});