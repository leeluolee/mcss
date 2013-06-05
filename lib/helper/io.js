var fs = require('fs');
var path = require('path');
var promise = require('./promise');
var state = require('../state');
var parser = require('../parser');

exports.get = function(path){
    if(fs){
        return file(path, 'utf8');
    }else{
        return http(path);
    }
}

exports.parse = function(path, options){
    var p = promise();
    exports.get(path).done(function(text){
        parser.parse(text, options).always(p.resolve.bind(p));
    }).fail(p.resolve.bind(p));
    return p;
}



var http = function(url){
    var p = promise();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onreadystatechange = function(){
        if(xhr.readyState !== 4) return;
        var status = xhr.status;
        if((status >= 200 && status < 300)){
            p.resolve(xhr.responseText)
        }else{
            p.reject(xhr);
        }
    }
    xhr.send();
    return p;
}

var file = function(path, callback){
    var p = promise();
    fs.readFile(path, 'utf8', function(error, content){
        if(error) return p.reject(error);
        p.resolve(content);
    })
    return p;
}