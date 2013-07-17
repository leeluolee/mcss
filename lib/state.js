var _ = require('./helper/util');
module.exports = {
  //最多保存20个远程文件, 内存中
  remoteFileCache: _.cache(20)
}