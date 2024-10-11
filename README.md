# springbok

![springbok](./asset/springbok-demo.png)

`springbok`提供了压缩与转换图片格式的功能，使用非常简单拖动图片至程序区域后即可自动压缩图片，最后一列`差异`值是基于人眼分辨的压缩前后图片比对，若比对的值大于1则可能图片质量较差，可选择恢复原图。

- webp暂时仅支持无损压缩版本，因此暂不建议勾选jepg -> webp
- 差异值使用dssim比较压缩前后图片人类视觉上的差异，一般小于1的则无明显差别
- webp与avif均是通过png或jepg转换得出，转换后保存在与原图片同一层目录


## macos

> If you can't open it after installation, exec the following command then reopen:<br>`sudo xattr -rd com.apple.quarantine /Applications/Springbok.app`

# License

This project is Licensed under [Apache License, Version 2.0](./LICENSE).
