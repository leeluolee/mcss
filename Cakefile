path = require 'path'
fs = require 'fs'
{spawn, exec} = require 'child_process'


chokidar = require 'chokidar'
{reporters} = require 'nodeunit'

# npm information
info = JSON.parse fs.readFileSync __dirname + '/package.json', 'utf8'


option '-m', '--mode [Mode]', 'watcher mode'

test = () ->
# 每次都清理require.cache
  delete require.cache[mod_id] for mod_id of require.cache
  process.chdir __dirname
  reporters.default.run ['test/specs']

build = () ->
  wrup = do require "wrapup"
  wrup.require("mcss", __dirname + "/lib/browser.js")
    .options(
      # globalize: info.name
      # compress: false
      # sourceMap: __dirname + "/dist/sourceMap.js"
    ).up (err, source) -> 
      fs.writeFile path.join(__dirname, "dist/#{info.name}-#{info.version}.js"), source, (err) ->
        if err 
          console.error(err)
        else 
          console.log 'build complele'
  


task 'doc', 'Generate annotated source code with Docco', ->
  docco = exec 'docco lib/*.js', (err) ->
    throw err if err
  docco.stdout.on 'data', (data) -> console.log data.toString()
  docco.stderr.on 'data', (data) -> console.log data.toString()
  docco.on 'exit', (status) -> callback?() if status is 0

task 'build', '', ->
  build()

task 'watch', 'run the test when lib files modified', (options) ->
  console.log "watcher on in #{options.mode} mode"
  watcher = chokidar.watch __dirname + '/lib', persistent: true
  watcher.add __dirname + '/test' if options.mode is 'test'
  watcher.on 'change', build
  watcher.on 'change', test if options.mode is 'test'

task 'test', 'Run the test suite', ->
  do test
