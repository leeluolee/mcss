var fs = require('fs');
var path = require('path');
var slice = [].slice;
var tree = require('../node');
var Color = require('../helper/color');



exports.add = function(){
    return options.args.reduce(function(a, b){
        return a + b;
    });
}

exports.base64 = function(){
    var dirname = options.dirname;
    if(!fs){
        return 'url('+options.args[0]+')'
    }else{
        
    }
}

exports.u = function(string){
    if(string.type !== 'STRING'){throw Error('mcss function "u" only accept string')}
    return string.val;
}


// color
// ======================================
exports.lighen = function(){

}

exports.darken = function(){

}
















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



