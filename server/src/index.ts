import express from 'express';
import cors from 'cors';
import ytdl from 'ytdl-core';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = 3000;

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

    // Video ve ses formatlarını ayır
    const videoFormats = formats
      .filter(format => format.hasVideo && format.hasAudio)
      .map(format => ({
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
      }));

    const audioFormats = formats
      .filter(format => format.hasAudio && !format.hasVideo)
      .map(format => ({
        itag: format.itag,
        quality: format.audioQuality || 'Unknown',
        mimeType: format.mimeType || '',
        contentLength: format.contentLength || '0',
        hasAudio: format.hasAudio,
        hasVideo: format.hasVideo,
        container: format.container || 'mp3',
        audioBitrate: format.audioBitrate,
      }));

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

// Medyayı indir ve geçici dosya olarak sakla
app.post('/api/download', async (req, res) => {
  let fileStream: fs.WriteStream | null = null;
  let tempFilePath: string | null = null;

  try {
    const { mediaUrl, itag, mediaType } = req.body;
    console.log('İndirme isteği alındı:', { mediaUrl, itag, mediaType });

    if (!ytdl.validateURL(mediaUrl)) {
      return res.status(400).json({
        error: 'Invalid URL',
        details: 'Geçersiz YouTube URL\'si',
      });
    }

    const info = await ytdl.getInfo(mediaUrl);
    console.log('Video bilgileri alındı:', info.videoDetails.title);

    const format = info.formats.find(f => f.itag === parseInt(itag));
    console.log('Seçilen format:', format);

    if (!format) {
      return res.status(400).json({
        error: 'Format Not Found',
        details: `İstenen format bulunamadı: ${itag}`,
        availableFormats: {
          video: info.formats.filter(f => f.hasVideo).map(f => f.itag),
          audio: info.formats.filter(f => f.hasAudio).map(f => f.itag),
        },
      });
    }

    // Format tipini kontrol et
    if (mediaType === 'video' && !format.hasVideo) {
      return res.status(400).json({
        error: 'Invalid Format Type',
        details: 'Seçilen format video formatı değil',
      });
    }

    if (mediaType === 'audio' && !format.hasAudio) {
      return res.status(400).json({
        error: 'Invalid Format Type',
        details: 'Seçilen format ses formatı değil',
      });
    }

    // Benzersiz dosya adı oluştur
    const fileExtension = mediaType === 'video' ? 'mp4' : 'mp3';
    const fileName = `${uuidv4()}.${fileExtension}`;
    tempFilePath = path.join(TEMP_DIR, fileName);
    console.log('Geçici dosya yolu:', tempFilePath);

    // Medyayı indir
    const stream = ytdl(mediaUrl, { 
      format,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    });

    fileStream = fs.createWriteStream(tempFilePath);
    console.log('Dosya stream oluşturuldu');

    // Stream hata yönetimi
    stream.on('error', (error) => {
      console.error('Stream hatası:', error);
      if (fileStream) {
        fileStream.end();
      }
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });

    // İndirme işlemi
    await new Promise<void>((resolve, reject) => {
      stream.pipe(fileStream!);
      
      fileStream!.on('finish', () => {
        console.log('Dosya indirme tamamlandı');
        resolve();
      });

      fileStream!.on('error', (error) => {
        console.error('Dosya yazma hatası:', error);
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
      downloadUrl: `/media/${fileName}`,
    });
  } catch (error) {
    console.error('İndirme hatası:', error);
    
    // Hata durumunda geçici dosyayı sil
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.status(500).json({
      error: 'Server Error',
      details: error instanceof Error ? error.message : 'Medya indirilemedi',
    });
  } finally {
    // Stream'i kapat
    if (fileStream) {
      fileStream.end();
    }
  }
});

// Geçici dosyayı indir
app.get('/api/media/:fileName', (req, res) => {
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