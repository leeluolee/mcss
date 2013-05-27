var path = require('path');
var fs = require('fs');
var mcss = require('./index');
var argumentum = require('argumentum');
var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
var cwd = process.cwd() 
var argv = process.argv;
var options = {};

if(argv[2]){
    var filepath = path.join(cwd, argv[2]);
    var folder = path.dirname(filepath);
    options.filepath = filepath;
    options.folder = folder;
    var file = fs.readFileSync(path.join(cwd, argv[2]), 'utf8')
}else{
    console.log('mcss [file]: file is required')
    process.exit(0);
}



var config = {
    script: 'mcss',
    options: {
        version: {
            abbr: 'v',
            help: 'display mcss version',
            flag: true,
            callback: function(){
                console.log('version ' + pkg.version);
            }
        },
        outport: {
            abbr: 'o',
            help: 'specify the outport css filepath',
            callback: function(p){
                options.outport = path.join(cwd, p); 
            }
        }
    }
}

exports.run = function(){
    argumentum.load(config).parse()
    mcss.translate(options);


