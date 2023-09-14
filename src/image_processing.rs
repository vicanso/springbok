use avif_decode::Decoder;
use dssim::Dssim;
use image::codecs::avif;
use image::codecs::webp;
use image::{DynamicImage, ImageEncoder, ImageFormat, RgbaImage};
use lodepng::Bitmap;
use rgb::{ComponentBytes, FromSlice, RGBA8, RGB8};
use snafu::{ResultExt, Snafu};
use std::io::{Cursor, Read};
use std::{fs, fs::File, path::PathBuf};

#[derive(Debug, Snafu)]
pub enum ImageError {
    #[snafu(display("Handle image fail, category:{category}, message:{source}"))]
    Image {
        category: String,
        source: image::ImageError,
    },
    #[snafu(display("Handle image fail, category:{category}, message:{source}"))]
    ImageQuant {
        category: String,
        source: imagequant::Error,
    },
    #[snafu(display("Handle image fail, category:{category}, message:{source}"))]
    AvifDecode {
        category: String,
        source: avif_decode::Error,
    },
    #[snafu(display("Handle image fail, category:{category}, message:{source}"))]
    LodePNG {
        category: String,
        source: lodepng::Error,
    },
    #[snafu(display("Handle image fail, category:mozjpeg, message:unknown"))]
    Mozjpeg {},
    #[snafu(display("Io fail, {source}"))]
    Io { source: std::io::Error },
    #[snafu(display("Handle image fail"))]
    Unknown,
}

type Result<T, E = ImageError> = std::result::Result<T, E>;

pub struct ImageInfo {
    // rgba像素
    pub buffer: Vec<RGBA8>,
    /// Width in pixels
    pub width: usize,
    /// Height in pixels
    pub height: usize,
}

impl From<Bitmap<RGBA8>> for ImageInfo {
    fn from(info: Bitmap<RGBA8>) -> Self {
        ImageInfo {
            buffer: info.buffer,
            width: info.width,
            height: info.height,
        }
    }
}

impl From<RgbaImage> for ImageInfo {
    fn from(img: RgbaImage) -> Self {
        let width = img.width() as usize;
        let height = img.height() as usize;
        let mut buffer = Vec::with_capacity(width * height);

        for ele in img.chunks(4) {
            buffer.push(RGBA8 {
                r: ele[0],
                g: ele[1],
                b: ele[2],
                a: ele[3],
            })
        }

        ImageInfo {
            buffer,
            width,
            height,
        }
    }
}
pub fn load(path: &PathBuf) -> Result<ImageInfo> {
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let mut file = File::open(path).context(IoSnafu {})?;
    let mut contents = vec![];
    file.read_to_end(&mut contents).context(IoSnafu {})?;

    let format = ImageFormat::from_extension(ext).unwrap_or(ImageFormat::Jpeg);
    let c = Cursor::new(contents);
    let result = image::load(c, format).context(ImageSnafu { category: "load" })?;
    let img = result.to_rgba8();
    Ok(img.into())
}
pub fn avif_decode(data: &[u8]) -> Result<DynamicImage> {
    let avif_result = Decoder::from_avif(data)
        .context(AvifDecodeSnafu {
            category: "decode".to_string(),
        })?
        .to_image()
        .context(AvifDecodeSnafu {
            category: "decode".to_string(),
        })?;
    match avif_result {
        avif_decode::Image::Rgb8(img) => {
            let width = img.width();
            let height = img.height();
            let mut buf = Vec::with_capacity(width * height * 3);
            for item in img.buf() {
                buf.push(item.r);
                buf.push(item.g);
                buf.push(item.b);
            }
            let rgb_image = image::RgbImage::from_raw(width as u32, height as u32, buf)
                .ok_or(ImageError::Unknown)?;
            Ok(DynamicImage::ImageRgb8(rgb_image))
        }
        avif_decode::Image::Rgba8(img) => {
            let width = img.width();
            let height = img.height();
            let mut buf = Vec::with_capacity(width * height * 4);
            for item in img.buf() {
                buf.push(item.r);
                buf.push(item.g);
                buf.push(item.b);
                buf.push(item.a);
            }
            let rgba_image = image::RgbaImage::from_raw(width as u32, height as u32, buf)
                .ok_or(ImageError::Unknown)?;
            Ok(DynamicImage::ImageRgba8(rgba_image))
        }
        avif_decode::Image::Rgba16(img) => {
            let width = img.width();
            let height = img.height();
            let mut buf = Vec::with_capacity(width * height * 4);
            for item in img.buf() {
                buf.push((item.r / 257) as u8);
                buf.push((item.g / 257) as u8);
                buf.push((item.b / 257) as u8);
                buf.push((item.a / 257) as u8);
            }
            let rgba_image = image::RgbaImage::from_raw(width as u32, height as u32, buf)
                .ok_or(ImageError::Unknown)?;
            Ok(DynamicImage::ImageRgba8(rgba_image))
        }
        avif_decode::Image::Rgb16(img) => {
            let width = img.width();
            let height = img.height();
            let mut buf = Vec::with_capacity(width * height * 3);
            for item in img.buf() {
                buf.push((item.r / 257) as u8);
                buf.push((item.g / 257) as u8);
                buf.push((item.b / 257) as u8);
            }
            let rgb_image = image::RgbImage::from_raw(width as u32, height as u32, buf)
                .ok_or(ImageError::Unknown)?;
            Ok(DynamicImage::ImageRgb8(rgb_image))
        }
        _ => Err(ImageError::Unknown),
    }
}

impl ImageInfo {
    // 转换获取rgb颜色
    fn get_rgb8(&self) -> Vec<RGB8> {
        let mut output_data: Vec<RGB8> = Vec::with_capacity(self.width * self.height);

        let input = self.buffer.clone();

        for ele in input {
            output_data.push(ele.rgb())
        }

        output_data
    }
    fn diff(&self, img: &DynamicImage) -> f64 {
        let attr = Dssim::new();
        let gp1 = attr.create_image_rgba(&self.buffer, self.width, self.height);
        let gp2 =
            attr.create_image_rgba(img.to_rgba8().as_raw().as_rgba(), self.width, self.height);
        if gp1.is_none() || gp2.is_none() {
            return -1.0;
        }
        // 已保证不为空
        let (diff, _) = attr.compare(&gp1.unwrap(), gp2.unwrap());
        diff.into()
    }
    pub fn to_png(&self, quality: u8) -> Result<(Vec<u8>, f64)> {
        let mut liq = imagequant::new();
        liq.set_quality(0, quality).context(ImageQuantSnafu {
            category: "png_set_quality",
        })?;

        let mut img = liq
            .new_image(self.buffer.as_ref(), self.width, self.height, 0.0)
            .context(ImageQuantSnafu {
                category: "png_new_image",
            })?;

        let mut res = liq.quantize(&mut img).context(ImageQuantSnafu {
            category: "png_quantize",
        })?;

        res.set_dithering_level(1.0).context(ImageQuantSnafu {
            category: "png_set_level",
        })?;

        let (palette, pixels) = res.remapped(&mut img).context(ImageQuantSnafu {
            category: "png_remapped",
        })?;
        let mut enc = lodepng::Encoder::new();
        enc.set_palette(&palette).context(LodePNGSnafu {
            category: "png_encoder",
        })?;

        let buf = enc
            .encode(&pixels, self.width, self.height)
            .context(LodePNGSnafu {
                category: "png_encode",
            })?;

        let c = Cursor::new(&buf);
        let format = ImageFormat::from_extension("png");
        let img = image::load(c, format.unwrap()).context(ImageSnafu { category: "load" })?;
        let diff = self.diff(&img);

        Ok((buf, diff))
    }
    pub fn to_webp(&self, quality: u8) -> Result<(Vec<u8>, f64)> {
        let mut buf = Vec::new();

        let q = match quality {
            100 => webp::WebPQuality::lossless(),
            _ => webp::WebPQuality::lossy(quality),
        };
        let img = webp::WebPEncoder::new_with_quality(&mut buf, q);

        img.encode(
            self.buffer.as_bytes(),
            self.width as u32,
            self.height as u32,
            image::ColorType::Rgba8,
        )
        .context(ImageSnafu {
            category: "webp_encode",
        })?;

        let c = Cursor::new(&buf);
        let format = ImageFormat::from_extension("webp");
        let img = image::load(c, format.unwrap()).context(ImageSnafu { category: "load" })?;
        let diff = self.diff(&img);

        Ok((buf, diff))
    }
    pub fn to_avif(&self, quality: u8, speed: u8) -> Result<(Vec<u8>, f64)> {
        let mut buf = Vec::new();
        let mut sp = speed;
        if sp == 0 {
            sp = 3;
        }

        let img = avif::AvifEncoder::new_with_speed_quality(&mut buf, sp, quality);
        img.write_image(
            self.buffer.as_bytes(),
            self.width as u32,
            self.height as u32,
            image::ColorType::Rgba8,
        )
        .context(ImageSnafu {
            category: "avif_encode",
        })?;

        let img = avif_decode(&buf)?;
        let diff = self.diff(&img);

        Ok((buf, diff))
    }
    pub fn to_mozjpeg(&self, quality: u8) -> Result<(Vec<u8>, f64)> {
        let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
        comp.set_size(self.width, self.height);
        comp.set_quality(quality as f32);
        let mut comp = comp.start_compress(Vec::new()).context(IoSnafu {})?;
        comp.write_scanlines(self.get_rgb8().as_bytes())
            .context(IoSnafu {})?;
        let buf = comp.finish().context(IoSnafu {})?;
        let c = Cursor::new(&buf);
        let format = ImageFormat::from_extension("jpeg");
        let img = image::load(c, format.unwrap()).context(ImageSnafu { category: "load" })?;
        let diff = self.diff(&img);

        Ok((buf, diff))
    }
}

pub fn save_file(file: &PathBuf, data: &[u8]) -> Result<()> {
    fs::write(file, data).context(IoSnafu {})
}
