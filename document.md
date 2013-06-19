## Writing abstract and modular CSS with MCSS

MCSS是一个CSS Preprocessor, 语法上是基于[CSS3 Syntax](http://dev.w3.org/csswg/css3-syntax/#parsing)的超集(标准css即标准mcss), 提供 **Nested Ruleset**, **Variable**, **first-class function(or mixin)**, **custom atrule**(@extend、@import、@abstract...)等等特性来填补原生CSS的抽象能力弱的缺陷, 帮助我们书写抽象化的CSS

MCSS是有丰富的语言特性的一个DSL, 它甚至允许扩展`@atrule`(SCSS中也称之为directive)去定义出输出你自己的新语法; 与此同时MCSS是一个易用使用的CSS Parser, 并提供便利化的方式去操作树形结构, 以实现csscomb、prefixr等CSS工具.



MCSS完全使用javascript构建, 你可以分别在browser(ES5 support needed)和nodejs中使用它




## 安装

### Nodejs
```bash
npm install -g mcss
```

### Browser

```html
<script src="https://github.com/leeluolee/mcss/blob/master/dist/mcss.js"></script>
```
需要支持ES5的浏览器，绝对只建议在线上环境使用compile后的css文件，而不是即时compile;


## 使用
API请参考([API使用指南](dada))

### 命令行
```bash
ubuntu-10:12 ~ $ mcss -h

  Usage: mcss [options] <file>

  Options:

    -h, --help                print usage information
    -v, --version             print the version number
    -f, --format <n>          the outport format, 1: common | 2: compress | 3:online
    -w, --watch               watch the file change and build
    -s, --sourcemap           generate the sourcemap(if the outport is specify)
    -o, --outport <filename>  the outport filename or dirname
    -i, --indent <indent>     the indent string default "\t"
    -t, --test                just for test , ignored or underscore started file

```

__注意__: 当file参数为文件夹时, 会compile目录下的所有.mcss文件, 此时outport参数会视为是一个文件夹, 并将所有css输入到此文件夹


### 浏览器端
Browser环境时, 除了可以使用对应的API, mcss还会自动解释在mcss.js所在script标签前的所有`style[type='test/mcss']`与`link[rel='stylesheet/mcss']`的标签, 而其后的mcss文件不会生效. 如:

```html
<link rel="stylesheet/mcss" href="test.mcss"/>
<style type = 'text/mcss'>
  $color = #fff;
  $border-radius = ($radius = 5px){
    -webkit-border-radius: 5px;
    -moz-border-radius: 5px;
    border-radius: 5px;
  }
  p{
    border: 2px solid hsla(10, 90%, 21%, 0.1);
    $border-radius: 5px; 
  }
</style>
<script src="../../dist/mcss-0.0.1.js"></script>
<link rel="stylesheet/mcss" href="test2.mcss"/>
```
其中test2.mcss不会生效 

## 语言特性描述
了解特性之前，需要了解下mcss的基本数据类型(与css syntax对应) [MCSS的数据类型]()

### nested ruleset

mcss支持层级嵌套的ruleset以及 & (父引用符号)
<!-- {{nested_ruleset.mcss}} -->

```css

```

__输出__

```css

```

### 赋值操作

mcss中的variable与以 `$` 开头(与SCSS一致如$length), 这也是mcss引入的唯一一个非css规范的词法类型, 目的是`防止潜在冲突`和`视觉上更易识别`;
mcss支持两种赋值操作 `=` 与 `?=`, 其中`?=` 只在变量未赋值或null时生效, 所有的值类型都可以被赋值,包括函数

<!-- {{assign.md}} -->



### 强大的function (mixin)
函数是mcss中除了css syntax中定义的值类型之外, 引入的唯一一种数据类型, 与js一样 mcss中的函数, 可以传递给函数，也可以在函数中被返回, 并保留定义时的作用域链(所谓的闭包)。

#### 1. 作为mixin混入使用
当function没有返回值时，函数成为一个mixin, 会将解释后的 function block输出，实现SCSS中的@include, 这也是最常用的方式

{{function_basic.md}}

#### 2. 作为函数使用

在解释function block时, 遇到了 @return 语句, 则中断返回. 注意返回值可以是另外一个函数. mcss 函数本质上与mcss的javascript实现的内建函数是一致的，优势是 __不需要树节点操作__ 。并且维护在mcss file中更易模块化。
```css
$abs = ($value){
    @if $value < 0 {
        @return -$value; }
    @return $value;
}
$min = (){
    $res = index($arguments, 1);
    @for $item of $arguments{
        @if $item < $res {
            $res = $item; }}
    @return $res;
}
@debug $min(1, 2, 3, 4, 0); // -> 0

@debug $abs(-100px);   // 100px
```
#### 3. transparent call
mcss支持类似**stylus**的transparent call (只适用于作为mixin使用的function)的调用方式 ,区别是此时以$开头 更易区分。当以transparent调用时，如果只有一个空格分割的values, 会自动提升为valueslist，以跟普通declaration相对应

<!-- {{function_transparent.mcss}} -->




#### 4. 参数

mcss支持__rest param__ 以及 __default param__

<!-- {{function_param.md}} -->



#### 4. 作为一种数据类型的函数
函数可以被传入函数, 也可以被函数返回. 

{{function_closure.md}}

#### 5. 内省机制、$arguments以及其他
既然一个function可能是一个mixin或是函数, 所以需要让函数体知道自定被谁调用, mcss采用了stylus的解决方案也就是所谓的内省机制(Introspection)


mcss不支持类似`arguments[0]`下标操作, 不过你可以通过`args(0)`来得到同样的效果
```css
$foo = {
  left: args(0);
  right: args(1);
}
$foo(10px, 20px);
```

### 注释
支持行注释`//` 和块注释`/**/`


### @extend

### @import

### @abstract

### @if, @ifelse , @else, @for

#### 条件语句@if


#### 循环语句@for


### Scope


### Auto Prefixr

实验性质前缀一直是个噩梦，也是阻碍我们使用css3的罪魁祸首，除了使用function 封装差异之外，mcss也支持自动的 prefixr, 目前的版本prefixr只提供declration和atrule的自动前缀, 你可以通过function,封装类似gradient这种前缀

### Operator
mcss支持一元运算符(- ! +), 二元运算符( + - * / %), 逻辑运算符(|| 和 &&), 关系运算符(== >= <= > < !=)以及括号'()' 运算符优先级与javascript完全一致
{{operator.md}}

在使用时，需要注意的是 `-` ， `/` 两个作为二元操作符时， 在css中 分数(14px/12) 以及 负数(10px -10px) 都是一种合法的输出。mcss中定义操作符周围留空视为算术操作， 而取消空格则保留原输出.
{{operator_conflict.md}}

mcss的运算符优先级与javascript的表现一致

### 插值intepolate

MCSS的插值语法与SCSS一致，使用`#{ .. }`, 可在任何表达式、选择器、属性中使用，在选择器插值时，支持list类型(valueslist、values)插入, 简化我们的迭代操作

__表达式属性插值__
插值内容可以是一个变量，也可以是一个mcss 表达式的值

__选择器插值__
选择器插值与表达式插值一直，区别是此时可以传入一个list类型的插值

__字符串插值__
当作为字串插值时， 只接受变量插值

__Printf__
mcss支持类似python的print格式化操作


### 丰富的buildin function
MCSS拥有丰富的内建函数，旨在提供语法提供不了的操作

#### __color操作__: mcss支持三种格式的色值 1. hash: #ffffff 2. rgba or rgb   3. hsl or hsla 但是最终的输出视alpha通道是否为1输出 hash 或者 rgba.

#### 其他内建函数
移步[内建函数](/#)


### @keyframe 以及其它 标准css atrule

### directive (@debug 以及其它 非标准atrule)


### 友好的error输出

### sourcemap支持
MCSS的sourcemap 不是类似stylus、less是基于@sass-debug-info的伪装形势, 而是标准的[sourcemap v3]() 格式, 可提供更小的格式和更精确的对应(同时也是未来趋势) 这个在chrome 的开发者工具中刚刚被启用为支持css，所以暂时只支持chrome

### 多种输出格式
mcss默认支持三种输出格式 1. 常规; 2. 压缩 ; 3. 单行

对应如下这段mcss
```css
.m-home{
  display: block;
  div, ul{
    border: 2px solid #ccc;
    a{
      color: #fff;
      &:hover{
        text-decoration: none; 
      }
      span{
        display: block;
      }
    }
  }
}

```


__1. 常规__
```css
.m-home{
  display:block;
}
.m-home div,.m-home ul{
  border:2px solid #cccccc;
}
.m-home div a,.m-home ul a{
  color:#ffffff;
}
.m-home div a:hover,.m-home ul a:hover{
  text-decoration:none;
}
.m-home div a span,.m-home ul a span{
  display:block;
}
```

__2. 压缩__ : 无空格压缩到一行
```css
.m-home{display:block;}.m-home div,.m-home ul{border:2px solid #cccccc;}.m-home div a,.m-home ul a{color:#ffffff;}.m-home div a:hover,.m-home ul a:hover{text-decoration:none;}.m-home div a span,.m-home ul a span{display:block;}
```

__3. 隔行__ : [NEC](http://nec.netease.com/)的推荐css书写格式
```css
.m-home{display:block;}
.m-home div,.m-home ul{border:2px solid #cccccc;}
.m-home div a,.m-home ul a{color:#ffffff;}
.m-home div a:hover,.m-home ul a:hover{text-decoration:none;}
.m-home div a span,.m-home ul a span{display:block;}
```





## 接口风格
mcss的接口都是promise风格(通过内部的微型mcss.promise封装), 帮助我们在各个部件间传递断言对象, 同时输出一致的API,
支持类似(done, fail, always, when, then, or, not)等操作。

## 接口详解

## 参数详解
一般构建完实例后, 我们只需要调用translate方法. 值得注意的是参数
``` javascript
var mcss = require('mcss') // browser 则直接在全局找到mcss;
var instance = mcss({
  options.....
})// get a mcss instance
Options参数详解会在下一小节阐述

.set('filename', '/path/to/foo.mcss')// 后续修改mcss文件
.include('/build/in/path')// 使用include引入对应

// 解释并输出AST
instance.interpret().done(function(){
}).fail(function(){
})

// 词法是一个同步的过程，所以可以直接获得tokens
var tokens = instance.tokenize()

```
此外, mcss也暴露了内部的组成部分 `mcss.Tokenizer`, `mcss.Parser`, `mcss.Interpreter`, `mcss.Translator`分别对应内部词法分析、解析器、解释器、翻译器的构造函数 
#### 参数


## 感谢
MCSS从SCSS、LESS、Stylus获取了很多灵感, 特别是一些既有的最佳实践, 感谢它们！！





## 如何参与
MCSS目前仍在开发阶段, 如果你能提出宝贵意见甚至贡献代码, 万分感谢。不过仍要说明贡献代码时的须知

1. 较大修改请开一个issue, 详细说明情况, 并加入测试案例
2. 提交前确定`npm test`无误

