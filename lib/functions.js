var fs = require('fs');
var path = require('path');
var slice = [].slice;

var functions = {
    add: function(options){
        return options.args.reduce(function(a, b){
            return a + b;
        });
    },
    base64: function(options){
        var dirname = options.dirname;
        if(!fs){
            return 'url('+options.args[0]+')'
        }else{
            
        }
    }
}



exports.functions = functions
exports.names = Object.keys(functions);














var mediatypes = {
    '.eot'       : 'application/vnd.ms-fontobject',
    '.gif'       : 'image/gif',
    '.ico'       : 'image/vnd.microsoft.icon',
    '.jpg'       : 'image/jpeg',
    '.jpeg'      : 'image/jpeg',
    '.otf'       : 'application/x-font-opentype',
    '.png'       : 'image/png',
    '.svg'       : 'image/svg+xml',
    '.ttf'       : 'application/x-font-ttf',
    '.webp'      : 'image/webp',
    '.woff'      : 'application/x-font-woff'
}


function converToBase64(imagePath){
    imagePath = imagePath.replace(/[?#].*/g, '');
    var extname = path.extname(imagePath),
        stat, img;
    try{
        stat = fs.statSync(imagePath)
        if(stat.size > 4096){
            return false
        }
        img = fs.readFileSync(imagePath, 'base64');
        return 'data:' + mediatypes[extname] + ';base64,' + img
    }catch(e){
        return false; 
    }
}



