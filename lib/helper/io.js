var fs = require('fs');
var path = require('path');
var state = require('../state');

exports.get = function(path, callback){
    if(fs){
        fs.readFile(path, 'utf8', callback);
    }else{
        http(path, callback);
    }
}


exports.join = function(){
    for(var i = 0 ; i < len; i++){
        var sep = arguments[i];
    }
}


var http = function(url, callback){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.onreadystatechange = function(e){
        if(xhr.readyState === 4 && xhr.status === 200){
            callback(null, xhr.responseText);
        }
    }
    xhr.send();
}
