# image-converter

图片转换器，支持`jpeg`, `png`的压缩以及转换为对应的`webp`或`avif`。`avif`为了更好的压缩效果，因此选择的是最低速度，其速度会较慢。

需要注意，图片处理会覆盖原有文件，对于已有`jpeg`或`png`图片，需要有读写权限，否则会写入失败。

程序日志文件可查看`~/.image-converter/image-converter.log`

## TODO

[ ] 图片需要有读写权限
[*] 日志输出至文件