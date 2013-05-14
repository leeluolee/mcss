// namespace
var _ = {};

_.debugger = 1;

// thx acorn.js http://marijnhaverbeke.nl/acorn/ 
_.makePredicate = function(words, prefix)  {
    if(typeof words === 'string'){
      words = words.split(" ");
    }
    var f = "", cats = [];
    out: for (var i = 0; i < words.length; ++i) {
      for (var j = 0; j < cats.length; ++j)
        if (cats[j][0].length == words[i].length) {
          cats[j].push(words[i]);
          continue out;
        }
      cats.push([words[i]]);
    }
    function compareTo(arr) {
      if (arr.length == 1) return f += "return str === '" + arr[0] + "';";
      f += "switch(str){";
      for (var i = 0; i < arr.length; ++i) f += "case '" + arr[i] + "':";
      f += "return true}return false;";
    }

    // When there are more than three length categories, an outer
    // switch first dispatches on the lengths, to save on comparisons.

    if (cats.length > 3) {
      cats.sort(function(a, b) {return b.length - a.length;});
      f += "var prefix = " + (prefix?"true":"false") +
      ";if(prefix) str = str.replace(/^-(?:\\w+)-/,'');switch(str.length){";
      for (var i = 0; i < cats.length; ++i) {
        var cat = cats[i];
        f += "case " + cat[0].length + ":";
        compareTo(cat);
      }
      f += "}";

    // Otherwise, simply generate a flat `switch` statement.

    } else {
      compareTo(words);
    }
    return new Function("str", f);
}

_.makePredicate2 = function(words){
  if(typeof words !== 'string'){
    words = words.join(' ');
  }
  return function(word){
    return (~words.indexOf(word))
  }
}

_.perf = function(fn, times, args){
  var date = +new Date;
  for(var i = 0; i < times; i++){
      fn.apply(this, args || []);
  }
  return +new Date - date;
}


_.extend = function(o1, o2, override){
  for(var j in o2){
    if(o1[j] == null || override) o1[j] = o2[j];
  }
  return o1;
}

// debuger
_.log = function(){
  if(_.debugger <3) return;
  console.log.apply(console, arguments);
}
_.warn = function(){
  if(_.debugger <2) return;
  console.warn.apply(console, arguments);
}
_.error = function(){
  if(_.debugger <1) return;
  console.error.apply(console, arguments);
}


//




module.exports = _;