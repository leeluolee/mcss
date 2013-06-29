/**
 * Example csscss.js 
 * 60 line code base on mcss we can have a more powerful csscss
 * @type {[type]}
 */
var mcss = require('../../');
var path = require('path');
var node = mcss.node;
var color = require('../../lib/helper/color');
// sign: [ruleset]
// 内存还速度

var rulesets = [], MAX_DUPLICATES = 6;

// use a map, achieve O(n) to find duplicates.
function findDupls(a, b){
    // 以a为准绳
    var alist = a.map,
        blist = b.map,
        duplicates = [];

    for(var i in blist){
        if(alist[i]) duplicates.push(i)
    }
    return duplicates;
}

var instance = mcss({
    // 这个css 来自 github.com 官网
    filename: path.join(__dirname, '../mcss/_large.mcss'),
    walkers: [{
        'ruleset': function(ast){
            var list = ast.block.list,
                selector = node.toStr(ast.selector),
                res = {
                    selector:selector, 
                    filename:ast.filename,
                    lineno: ast.lineno,
                    map:{}
                },
                sign, map = res.map;
            list.forEach(function(declaration){
                if(declaration.type === 'declaration'){
                    sign = node.toStr(declaration.property)+':'+mcss.node.toStr(declaration.value);
                    if(!map[sign]) map[sign] = true;
                }
            })
            rulesets.push(res);
        }
    }]
})


// 获取节点
var date = +new Date();
instance.interpret().done(function(ast){
    var len = rulesets.length, 
        mapa, mapb, jlen, duplicates;
    for(; len-- ;){
        jlen = len; 
        mapa = rulesets[len];
        for(; jlen--;){
            mapb = rulesets[jlen];
            duplicates = findDupls(mapa, mapb);
            if(duplicates.length > MAX_DUPLICATES)
                console.log(
                    color(mapa.selector, 'red') + ' at ('+ color(mapa.filename + ':' + mapa.lineno, 'yellow') + ') and \n' +
                    color(mapb.selector, 'red') + ' at ('+ color(mapb.filename + ':' + mapb.lineno, 'yellow') + ') has ' + color(duplicates.length, 'blue') + ' duplicates:\n\t' +
                    duplicates.join(',\n\t')
                    )
        }
    }
}).fail(function(err){
    console.log(err)
})
