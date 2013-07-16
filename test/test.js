/**
 * switch to mocha
 */


var mcss = require('../'),
    fs = require('fs'),
    color = require('../lib/helper/color'),
    assert = require('assert'),
    path = require('path');

var not_compare = process.argv[2];
describe('Array', function(){
    var cases = fs.readdirSync(__dirname + '/mcss').filter(function(file){
        return /^[^_][-\w]*\.mcss$/.test(file);
    }).map(function(file){
        return __dirname + '/mcss/' +file;
    }).forEach(function(fullpath){
        var content = fs.readFileSync(fullpath, 'utf8');
        var csspath = __dirname+'/css/'+ path.basename(fullpath, '.mcss') +'.css';
        try{
            var csscontent = fs.readFileSync(csspath, 'utf8');
        }catch(e){
            console.log(color('! the css file ' + csspath + ' is not found', 'yellow'));

        }
        mcss({
            filename: fullpath
        }).include(__dirname+'/mcss/include')
            .translate(content)
            .done(function(content){
                console.log(fullpath)
                if(csscontent&&!not_compare){
                    it(fullpath + 'compile result should equal css outport', function(done){
                        assert.equal(content, csscontent);
                        done();
                    })
                }
            }).fail(function(error){
                mcss.error.format(error)
                console.log(error.message);
            })
    })
})



