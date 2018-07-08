var fs = require('fs'),
    globule = require('globule'),
    path = require('path'),
    mcss = require('../'),
    _ = require('../lib/helper/util'),
    color = require('../lib/helper/color'),
    promise = require('../lib/helper/promise'),
    cwd = process.cwd(),
    isWin = process.platform === 'win32',
    version = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version;

// ensure is array
var ensureArray = function(host, keys){
    if(typeof keys === 'string') keys = keys.split(' ');
    keys.forEach(function(key){
        if(host[key]){
            if(!Array.isArray(host[key])) host[key] = [host[key]];
        }else{
            host[key] = []
        }
    })
}

function list(val) {
  return val.split(',');
}

//process mcss.json
var program = require('commander')
    .version(version || '0.0.1')
    .usage('[options]')
    .option('-i, --input <filename>', 'the input filename or folder. required!')
    .option('-o, --output <filename>', 'the output filename or dirname. [optional] (if not passed ,the result will be printed on the console)')
    .option('-f, --format <n>', 'the output format, 1: common | 2: compress | 3:oneline. [optional] defualt 1', parseInt, 1)
    .option('-w, --watch [flag]', 'watch the file change and build. 0: close | 1: open | 2: open and beep,[optional] default 0', parseInt, 0)
    .option('-s, --sourcemap', 'generate the sourcemap. [optional] default false', false)
    .option('-c, --config <file>', 'the config filepath. [optional]')
    .option('--indent <indent>', 'the indent string. [optional] default "\\t"', '\t')
    .option('--exclude <regexp>', 'a passed regexp to avoid any file match it been compiled.[optional]', '(\/|\\\\)_|^_|include')
    .option('--include <folder>', 'add path to include pathes. [optional]')
    .option('--units <units>', 'extra units, use `,` as separator. [optional]', list)
    .parse(process.argv);





var config = (function configJSON(){
    if(program.config){
        program.config = path.resolve(cwd, program.config)
    }else{
        if(fs.existsSync(path.resolve(cwd, 'mcss.json'))){
            program.config = path.resolve(cwd, 'mcss.json');
        }
    }
    
    if(program.config){
        try{
            var config = JSON.parse(fs.readFileSync(program.config))
            if(program.config) cwd = path.dirname(program.config);
        }catch(e){
            if(e.errno != 34) console.log(color('you have a mcss.json in pwd, but has Error: ' + e.message, 'red'))
        }
    }
    var config = config || {};
    // input file convert to array
    ensureArray(config, 'input include')
    return config;
})();



// init param
mcss.helper.util.extend(program, config, false);
program.output = program.output || program.outport;
ensureArray(program, 'input')


var watch = program.watch;
var sourceMap = program.sourcemap;
if(program.output) var output = path.resolve(cwd, program.output);
var exclude = new RegExp(program.exclude);
if(program.include){
        if(!Array.isArray(program.include)) program.include = [program.include]
        var include = program.include.map(function(p){
            return path.resolve(cwd, p)
        })
}



// if(!program.args.length) throw 'the <file> arguments to build is required'

// get the valid file
var inputDir,

    files = (function getFiles(){
    var files = [];
    ;(program.args.length? program.args: program.input).forEach(function(file){
        if(inputDir) throw "<file> type error, you call only passed single folder"
        file = path.resolve(cwd, file);
        var stat = fs.statSync(file);
        // is directory
        if(stat.isDirectory()){
            files = files.concat(globule.find(path.join(file , '**/*.mcss'))
            .map(function(rpath){
                return path.resolve(cwd, rpath);
            }))
            inputDir = file;
        }else if(stat.isFile()){
            files.push(file)
        }else{
            throw 'unsupported <file> type:' + file
        }
    })
    return files;
})().filter(function(file){
        if(exclude && exclude.test(file))  return false;
        else return true;
});

if(!files.length) throw 'no matched mcss file';



// start building
var building;
var importsMap = {};
var imports = [];
var build = function(fullpaths, first){
    fullpaths = (fullpaths || files).filter(function(file){
        if(exclude && exclude.test(file) || path.basename(file).indexOf('_')===0)  return false;
        else return true;
    });
    if(building){
        console.log('is busy building')
        return;
    }
    // is in building step
    building = true;
    var start = Date.now();
    var promises = fullpaths.map(function(file){
        var fullpath = path.resolve(cwd, file);
        if(inputDir){
            var rpath = path.relative(inputDir, file);
            var dest = path.join(output, rpath).replace(/\.mcss/,'.css');
        }else{
            if(output && !/\.css$/.test(output)){
                dest = path.join(output, path.basename(file,'.mcss') +'.css')
            }else{
                dest = output;
            }
            
        }
        var instance = mcss(mcss.helper.util.extend({
            filename: fullpath,
            dest: dest,
            sourceMap: sourceMap,
            // walkers: [{
            //   'url': function(ast){
            //       console.log(ast)
            //   }
            // }]
        // @TODO remove
        }, program));
        if(include) instance.include(include);

        return instance.translate().done(function(content){
            if(!output) return console.log(file + '\n' +content);
            _.writeFile(dest, content, function(err){
                if(err) return console.log(err)
                console.log(dest + ' writed')
            })
        }).always(function(){
            Object.keys(instance.get('imports')).forEach(function(ipt){
                if(first){
                    if(!~imports.indexOf(ipt)) imports.push(ipt);
                    // 这里放置ipt的顶层父文件
                    var parents = importsMap[ipt] || (importsMap[ipt]=[]);
                    if(!~parents.indexOf(fullpath)) parents.push(fullpath);
                }
            })
        })
    }).filter(promise.isPromise);
    if(!promises.length) console.log('No file matched to be compiled, or you can checkout your exclude param')
    mcss.promise.when.apply(mcss.promise, promises).always(function(){
        console.log(color('building complete in ' + (Date.now() - start) + 'ms', 'green'))
        building = false;
        if(first && watch){
            var watchers = _.slice(fullpaths);
            imports.forEach(function(file){
                if(!~watchers.indexOf(file) && !/^(https|http)/.test(file)){
                    watchers.push(file); 
                }
            })
            watchers.forEach(function(fullpath){
                var files
                if(importsMap[fullpath]&&importsMap[fullpath].length){
                    files = importsMap[fullpath] 
                }else{
                    files = [fullpath]
                }
                _.watch(fullpath, function(){
                    build(files)
                })
            })
        }
    }).fail(function(){
        var errors = {};
        for(var i =0 ;i<arguments.length;i++){
            var error = arguments[0];
            if(!errors[error.filename]) errors[error.filename] = error;
        }
        if(String(watch) === '2'){
            console.log('\u0007');
        }
        for(var i in errors){
            var err = errors[i]
            mcss.error.format(err)
            console.log(err.message);
        }
    })
}
build(null,true);
