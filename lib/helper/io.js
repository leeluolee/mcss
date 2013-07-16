var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var promise = require('./promise');
var Parser = require('../parser');

exports.get = function(path){
    var server, pr;

    if(/^http/.test(path) && http){
        server = ~path.indexOf('https')? https : http;
        console.log(!path.indexOf('https'))
        pr = promise();
        server.get(path,function(res){
            res.on('error', function(error){
                pr.reject(error);
            })
            var content = '';
            res.on('data', function(chunk){
                content += chunk;
            })
            res.on('end', function(){
                pr.resolve(content);
            })
        })
        return pr;
    }else{
        if(fs){
            return file(path, 'utf8');
        }else{
            return http(path);
        }
    }

}

// exports.get("https://rawgithub.com/twitter/bootstrap/master/less/bootstrap.less").done(function(content){
//     console.log(content);
// }).fail(function(error){
//     // console.log(error);
// })

exports.parse = function(path, options){
    var p = promise();
    options.filename = path;
    exports.get(path).done(function(text){
        new Parser(options).parse(text).always(p);
    }).fail(p)
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

var file = function(path){
    var p = promise();
    fs.readFile(path, 'utf8', function(error, content){
        if(error) return p.reject(error);
        p.resolve(content);
    })
    return p;
}

