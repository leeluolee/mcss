function Outport = function(indent, stack){
    this.indent = 0 
    this.stack = stack || [];
}

var o = Outport.prototype;

// add line
o.add = function(str){

}
o.toStr = function(){
    
}

module.exports = function(indent, stack){
    return new Outport
}