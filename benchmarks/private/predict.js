var perf = function(fn, times, args){
  var date = +new Date;
  for(var i = 0; i < times; i++){
      fn.apply(this, args || []);
  }
  return +new Date - date;
}


