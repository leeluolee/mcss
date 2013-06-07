var fs = require('fs'),
  globule = require('globule'),
  path = require('path'),
  mcss = require('./'),
  _ = require('./helper/util'),
  cwd = process.cwd(),
  version = fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8').version;

var isWin = process.platform === 'win32';


var program = require('commander')
  .version(version || '0.0.1')
  .usage('[options] <file>')
  .option('--format <n>', 'the outport format, 1: common | 2: compress | 3:online', parseInt)
  .option('-w, --watch', 'watch the file change and build')
  .option('-o, --outport <filename>', 'the outport filename or dirname')
  .option('-i, --indent <indent>', 'the indent string default "\\t"')
  .parse(process.argv);

if(!program.args.length) throw 'the <file> arguments to build is required'



var watch = program.watch;
if(program.outport)  var outport = path.resolve(cwd, program.outport);

var file = path.resolve(cwd, program.args[0]);

var stat = fs.statSync(file); 
// is directory
if(stat.isDirectory()){
  var files = globule.find(path.join(file , '**/*.mcss'))
  .map(function(rpath){
    return path.resolve(cwd, rpath);
  });
  var inputDir = file;
}else if(stat.isFile()){
  var files = [file];
}else{
  throw 'unsupported <file> type'
}

if(!files.length) throw 'no matched mcss file';



var building;
function build(fullpath, first){
  if(building){
    console.log('is busy building')
    return;
  }
  // is in building step
  building = true;
  var promises = files.map(function(file){
    var fullpath = path.resolve(cwd, file);
    return mcss({
      format: program,
      filename: fullpath,
    }).translate(fs.readFileSync(fullpath, 'utf8')).done(function(content){
      if(!outport) return console.log(file + '\n' +content);
      if(inputDir){
        var rpath = path.relative(inputDir, file);
        var dest = path.join(outport, rpath).replace(/\.mcss/,'.css');
      }else{
        dest = outport;
      }
      _.writeFile(dest, content, function(err){
        if(err) throw err;
        console.log(dest + ' writed')
      })
    })
  })
  mcss.promise.when.apply(mcss.promise, promises).done(function(){
    building = false;
    console.log('done')
    if(first && watch){
      var watchers = _.slice(files);
      mcss.state.requires.forEach(function(file){
        if(!~watchers.indexOf(file)){
          watchers.push(file); 
        }
      })
      watchers.forEach(function(fullpath){
        _.watch(fullpath, _.throttle(build, 300))
      })
    }
  })
}


build(null,true);










