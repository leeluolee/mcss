/**
 * switch to mocha
 */

var mcss = require('../'),
    fs = require('fs'),
    path = require('path');

var cases = fs.readdirSync(__dirname + '/mcss').filter(function(file){
    return /^[^_]\w*\.mcss$/.test(file);
}).map(function(file){
    return __dirname + '/mcss/' +file;
}).forEach(function(file){
    var content = fs.readFileSync(file, 'utf8');
    mcss({filename: file})
        .translate(content)
        .done(function(content){
            console.log("file:" + file+'\n');
            console.log(content)
        })
})



