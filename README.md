# springbok

图片转换器，支持`jpeg`, `png`的压缩以及转换为对应的`webp`或`avif`。`avif`为了更好的压缩效果，因此选择的是最低速度，其速度会较慢。

需要注意，选择目录会自动过滤目录下所有符合的图片，图片处理会覆盖原有文件，对于已有`jpeg`或`png`图片，如果无写权限会增加写权限。

程序日志文件可查看`~/.springbok/springbok.log`

因为无苹果开发者账号，因此macos需要执行以下命令：

```bash
sudo xattr -rd com.apple.quarantine /Applications/ImageConverter.app
```

## 功能说明

![](./assets/springbok.png)

选择目录后则根据是否勾选了`jpeg`与`png`选项，读取该目录下所有符合的图片。若勾选了对应的`webp`或`avif`，则会将对应的图片转换，每种图片的压缩质量可按需调整。

表格中的栏目均较为直观，其中最后一项`差异`用于计算转换压缩后的图片与原图片的差异，个人感觉千分之五以内肉眼较难区分。

## TODO

- [x] 图片需要有读写权限
- [x] 日志输出至文件
- [ ] 支持文件夹与图片一起选择(macos已支持)