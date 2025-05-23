// @ts-nocheck
import express from 'express';
import cors from 'cors';
import ytdl from 'ytdl-core';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

interface FormatInfo {
  itag: number;
  quality?: string;
  qualityLabel?: string;
  audioQuality?: string;
  mimeType: string;
  contentLength: string;
  hasAudio: boolean;
  hasVideo: boolean;
  container: string;
  bitrate?: number;
  fps?: number;
  audioBitrate?: number;
}

const app = express();
const port = process.env.PORT ?? 3000;

// Geçici dosyalar için klasör
const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// 1 saat sonra geçici dosyaları temizle
const cleanupTempFiles = () => {
  fs.readdir(TEMP_DIR, (err, files) => {
    if (err) {
      console.error('Geçici dosyalar okunamadı:', err);
      return;
    }

    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error('Dosya bilgisi alınamadı:', err);
          return;
        }

        // 1 saatten eski dosyaları sil
        if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
          fs.unlink(filePath, err => {
            if (err) {
              console.error('Dosya silinemedi:', err);
            } else {
              console.log('Geçici dosya silindi:', file);
            }
          });
        }
      });
    });
  });
};

// Her saat başı temizlik yap
setInterval(cleanupTempFiles, 60 * 60 * 1000);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('YouTube Downloader API');
});
// Medya bilgilerini getir
app.post('/api/media-info', async (req, res) => {
  try {
    const { mediaUrl } = req.body;

    if (!ytdl.validateURL(mediaUrl)) {
      return res.status(400).json({
        error: 'Invalid URL',
        details: 'Geçersiz YouTube URL\'si',
      });
    }

    const info = await ytdl.getInfo(mediaUrl);
    const formats = info.formats;

    // Video ve ses formatlarını ayır ve tekilleştir
    const uniqueVideoFormats = new Map<string, FormatInfo>();
    formats
      .filter(format => format.hasVideo && format.hasAudio && format.qualityLabel) // Sadece kalitesi bilinenleri al
      .forEach(format => {
        const quality = format.qualityLabel!;
        const currentFormat: FormatInfo = {
          itag: format.itag,
          quality: format.qualityLabel || 'Unknown',
          mimeType: format.mimeType || '',
          contentLength: format.contentLength || '0',
          hasAudio: format.hasAudio,
          hasVideo: format.hasVideo,
          container: format.container || 'mp4',
          bitrate: format.bitrate,
          fps: format.fps,
          audioBitrate: format.audioBitrate,
        };

        // Eğer bu kalitede bir format yoksa veya mevcut formatın bitrate'i daha düşükse ekle/güncelle
        const existing = uniqueVideoFormats.get(quality);
        if (!existing || (currentFormat.bitrate && existing.bitrate && currentFormat.bitrate > existing.bitrate)) {
          uniqueVideoFormats.set(quality, currentFormat);
        }
      });

    const uniqueAudioFormats = new Map<string, FormatInfo>();
    formats
      .filter(format => format.hasAudio && !format.hasVideo && format.audioBitrate) // Sadece audioBitrate'i olanları al
      .forEach(format => {
        // Kaliteyi audioBitrate'e göre belirleyelim, daha tutarlı bir gruplama için
        const qualityKey = `${format.audioBitrate}kbps`; // Benzersiz anahtar oluştur
        const currentFormat: FormatInfo = {
          itag: format.itag,
          // quality alanını audioBitrate olarak ayarlayabiliriz veya audioQuality kullanabiliriz
          quality: format.audioQuality || `${format.audioBitrate}kbps`,
          mimeType: format.mimeType || '',
          contentLength: format.contentLength || '0',
          hasAudio: format.hasAudio,
          hasVideo: format.hasVideo,
          container: format.container || 'mp3', // veya 'm4a', 'webm' etc.
          audioBitrate: format.audioBitrate,
        };

        // Eğer bu kalitede bir format yoksa veya mevcut formatın audioBitrate'i daha düşükse ekle/güncelle
        // (Genelde en yüksek bitrate tercih edilir, bu yüzden '>' kullanıyoruz)
        const existing = uniqueAudioFormats.get(qualityKey);
        if (!existing || (currentFormat.audioBitrate && existing.audioBitrate && currentFormat.audioBitrate > existing.audioBitrate)) {
          uniqueAudioFormats.set(qualityKey, currentFormat);
        }
      });

    // Map'lerden array oluştur
    const videoFormats = Array.from(uniqueVideoFormats.values()).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)); // Kaliteye göre sırala (yüksekten düşüğe)
    const audioFormats = Array.from(uniqueAudioFormats.values()).sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0)); // Bitrate'e göre sırala (yüksekten düşüğe)


    res.json({
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[0].url,
      duration: info.videoDetails.lengthSeconds,
      formats: {
        video: videoFormats,
        audio: audioFormats,
      },
    });
  } catch (error) {
    console.error('Medya bilgisi alma hatası:', error);
    res.status(500).json({
      error: 'Server Error',
      details: error instanceof Error ? error.message : 'Medya bilgisi alınamadı',
    });
  }
});

// Medya URL'si al
app.post('/api/media-url', async (req, res) => {
  try {
    const { mediaUrl, itag, mediaType } = req.body;
    console.log('Medya URL isteği alındı:', { mediaUrl, itag, mediaType });

    if (!ytdl.validateURL(mediaUrl)) {
      return res.status(400).json({
        error: 'Invalid URL',
        details: 'Geçersiz YouTube URL\'si',
      });
    }

    const info = await ytdl.getInfo(mediaUrl);
    console.log('Video bilgileri alındı:', info.videoDetails.title);

    // Formatı bul (video veya ses)
    const formats = info.formats;
    let selectedFormat: ytdl.videoFormat | undefined = undefined;

    if (mediaType === 'video') {
      // Video formatı için hem video hem ses içeren formatı ara
      selectedFormat = formats.find(f => f.itag === parseInt(itag) && f.hasVideo && f.hasAudio);
    } else {
      // Ses formatı için sadece ses içeren formatı ara
      selectedFormat = formats.find(f => f.itag === parseInt(itag) && f.hasAudio && !f.hasVideo);
    }

    if (!selectedFormat) {
      return res.status(400).json({
        error: 'Format Not Found',
        details: `İstenen itag: ${itag}, Medya tipi: ${mediaType}`,
        availableFormats: {
          video: formats.filter(f => f.hasVideo && f.hasAudio).map(f => f.itag),
          audio: formats.filter(f => f.hasAudio && !f.hasVideo).map(f => f.itag),
        },
      });
    }

    // Benzersiz dosya adı oluştur
    const fileExtension = mediaType === 'video' ? 'mp4' : 'mp3';
    const fileName = `${uuidv4()}.${fileExtension}`;
    const tempFilePath = path.join(TEMP_DIR, fileName);
    console.log('Geçici dosya yolu:', tempFilePath);

    // Medyayı indir
    const stream = ytdl(mediaUrl, {
      format: selectedFormat,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    });

    const fileStream = fs.createWriteStream(tempFilePath);
    console.log('Dosya stream oluşturuldu');

    await new Promise<void>((resolve, reject) => {
      stream.pipe(fileStream);

      fileStream.on('finish', () => {
        console.log('Dosya indirme tamamlandı');
        resolve();
      });

      fileStream.on('error', (error) => {
        console.error('Dosya yazma hatası:', error);
        reject(error);
      });

      stream.on('error', (error) => {
        console.error('Stream hatası:', error);
        reject(error);
      });
    });

    // Dosya boyutunu kontrol et
    const stats = fs.statSync(tempFilePath);
    console.log('Dosya boyutu:', stats.size);

    if (stats.size === 0) {
      throw new Error('İndirilen dosya boş');
    }

    const mimeType = mediaType === 'video' ? 'video/mp4' : 'audio/mpeg';

    res.json({
      fileName,
      filePath: tempFilePath,
      mimeType,
      contentLength: stats.size.toString(),
      downloadUrl: `/media/${fileName}`, // /api öneki olmadan
    });
  } catch (error) {
    console.error('Medya URL alma hatası:', error);

    res.status(500).json({
      error: 'Server Error',
      details: error instanceof Error ? error.message : 'Medya URL\'si alınamadı',
    });
  }
});

// Geçici dosyayı indir
app.get('/media/:fileName', (req, res) => {
  try {
    const filePath = path.join(TEMP_DIR, req.params.fileName);
    console.log('Dosya indirme isteği:', filePath);

    if (!fs.existsSync(filePath)) {
      console.error('Dosya bulunamadı:', filePath);
      return res.status(404).json({
        error: 'File Not Found',
        details: 'Dosya bulunamadı',
      });
    }

    const stats = fs.statSync(filePath);
    console.log('Dosya boyutu:', stats.size);

    if (stats.size === 0) {
      console.error('Dosya boş:', filePath);
      return res.status(500).json({
        error: 'Empty File',
        details: 'Dosya boş',
      });
    }

    const mimeType = req.params.fileName.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg';
    console.log('MIME Type:', mimeType);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.fileName}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // İndirme tamamlandığında veya hata olduğunda dosyayı sil
    fileStream.on('end', () => {
      console.log('Dosya indirme tamamlandı:', req.params.fileName);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Geçici dosya silinemedi:', err);
        } else {
          console.log('Geçici dosya silindi:', req.params.fileName);
        }
      });
    });

    fileStream.on('error', (error) => {
      console.error('Dosya stream hatası:', error);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Geçici dosya silinemedi:', err);
        } else {
          console.log('Geçici dosya silindi:', req.params.fileName);
        }
      });
    });
  } catch (error) {
    console.error('Dosya indirme hatası:', error);
    res.status(500).json({
      error: 'Server Error',
      details: error instanceof Error ? error.message : 'Dosya indirilemedi',
    });
  }
});



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 