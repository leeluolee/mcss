/**
 * Example csscss.js 
 * 60 line code base on mcss we can have a more powerful csscss
 * @type {[type]}
 */
var mcss = require('../../');
var path = require('path');
var node = mcss.node;
// 改变颜色帮助识别console.log
var color = mcss.helper.color;


var rulesets = [], 
    // 允许的delaration最大重复率
    MAX_DUPLICATES = 6,
    // 自定义walker，在这里我们只对rulset感兴趣
    walkers = {
        'ruleset': function(ast){
            // 获取ruleset的块中的declaration列表
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
            });

            rulesets.push(res);
        }
    }
// use a map, achieve O(n) to find duplicates.
function findDupls(a, b){
    var alist = a.map,
        blist = b.map,
        duplicates = [];

    for(var i in blist){
        if(alist[i]) duplicates.push(i)
    }
    return duplicates;
}


// mcss 实例创建
var instance = mcss({
    // 这个css 来自 github.com 官网 的css  ... 重复率惊人
    filename: path.join(__dirname, '../css/_large.css'),
    // 传入我们的自定义walker
    walkers: [walkers]
})

// 所有mcss操作(解释、翻译、词法)都由统一的instance开始
// 以下是解释
instance.interpret().done(function(ast){
    var len = rulesets.length, 
        mapa, mapb, jlen, duplicates;

    for(; len-- ;){

        jlen = len; 
        mapa = rulesets[len];

        for(; jlen--;){
            mapb = rulesets[jlen];
            duplicates = findDupls(mapa, mapb);
            if(duplicates.length > MAX_DUPLICATES){
                console.log(
                    color(mapa.selector, 'red') + ' at ('+ color(mapa.filename + ':' + mapa.lineno, 'yellow') + ') and \n' +
                    color(mapb.selector, 'red') + ' at ('+ color(mapb.filename + ':' + mapb.lineno, 'yellow') + ') has ' + color(duplicates.length, 'blue') + ' duplicates:\n\t' +
                    duplicates.join(',\n\t')
                    )
            }
        }
    }
}).fail(function(err){
    throw err;
})
