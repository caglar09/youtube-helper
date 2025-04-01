import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const API_URL = 'http://localhost:3000/api';

export interface MediaFormat {
  itag: string;
  quality: string;
  mimeType: string;
  contentLength: string;
  hasAudio: boolean;
  hasVideo: boolean;
  container: string;
  bitrate?: number;
  fps?: number;
  audioBitrate?: number;
}

export interface MediaInfo {
  title: string;
  thumbnail: string;
  duration: string;
  formats: {
    video: MediaFormat[];
    audio: MediaFormat[];
  };
}

export interface MediaError {
  error: string;
  details: string;
  availableFormats?: {
    video: string[];
    audio: string[];
  };
}

export const getMediaInfo = async (mediaUrl: string): Promise<MediaInfo> => {
  try {
    const response = await fetch(`${API_URL}/media-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaUrl }),
    });

    if (!response.ok) {
      const errorData: MediaError = await response.json();
      throw new Error(errorData.details || 'Medya bilgisi alınamadı');
    }

    return await response.json();
  } catch (error) {
    console.error('Medya bilgisi alma hatası:', error);
    throw error;
  }
};

export const downloadMedia = async (mediaUrl: string, itag: string, mediaType: 'video' | 'audio'): Promise<string> => {
  try {
    console.log('İndirme işlemi başlatılıyor:', { mediaUrl, itag, mediaType });

    // Önce medya bilgilerini al
    const mediaInfo = await getMediaInfo(mediaUrl);
    console.log('Medya bilgileri alındı:', mediaInfo);

    // Seçilen formatın geçerli olup olmadığını kontrol et
    const isValidFormat = mediaType === 'video'
      ? mediaInfo.formats.video.some(f => f.itag === itag)
      : mediaInfo.formats.audio.some(f => f.itag === itag);

    if (!isValidFormat) {
      console.error('Geçersiz format:', { itag, mediaType, availableFormats: mediaInfo.formats });
      throw new Error(`${mediaType === 'video' ? 'Video' : 'Ses'} formatı bulunamadı. Lütfen geçerli bir format seçin.`);
    }

    // Sunucuya indirme isteği gönder
    console.log('Sunucuya indirme isteği gönderiliyor...');
    const response = await fetch(`${API_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mediaUrl,
        itag,
        mediaType
      }),
    });

    if (!response.ok) {
      const errorData: MediaError = await response.json();
      console.error('Sunucu indirme hatası:', errorData);
      throw new Error(errorData.details || 'Medya indirilemedi');
    }

    const { downloadUrl, mimeType, contentLength } = await response.json();
    console.log('Sunucu indirme yanıtı:', { downloadUrl, mimeType, contentLength });

    // Geçici dosya adını ve uzantısını belirle
    const fileExtension = mediaType === 'video' ? 'mp4' : 'mp3';
    const tempFileName = `temp_${mediaType}_${Date.now()}.${fileExtension}`;
    const tempFilePath = `${FileSystem.cacheDirectory}${tempFileName}`;
    console.log('Geçici dosya yolu:', tempFilePath);

    // Dosyayı sunucudan indir
    console.log('Dosya sunucudan indiriliyor...');
    const fullDownloadUrl = `${API_URL}${downloadUrl}`;
    console.log('Tam indirme URL\'si:', fullDownloadUrl);
    const downloadResult = await FileSystem.downloadAsync(fullDownloadUrl, tempFilePath);
    console.log('İndirme sonucu:', downloadResult);

    if (downloadResult.status !== 200) {
      console.error('İndirme başarısız:', downloadResult);
      throw new Error(`İndirme başarısız oldu. Durum kodu: ${downloadResult.status}`);
    }

    // Dosya kaydetme dialogunu aç
    console.log('Dosya kaydetme dialogu açılıyor...');
    const result = await DocumentPicker.getDocumentAsync({
      type: mimeType,
      copyToCacheDirectory: true,
    });
    console.log('Dosya seçim sonucu:', result);

    if (result.assets && result.assets.length > 0) {
      const selectedFile = result.assets[0];
      console.log('Seçilen dosya:', selectedFile);

      // Seçilen konuma dosyayı kopyala
      console.log('Dosya kopyalanıyor...');
      await FileSystem.copyAsync({
        from: tempFilePath,
        to: selectedFile.uri,
      });
      console.log('Dosya kopyalandı');

      // Geçici dosyayı sil
      console.log('Geçici dosya siliniyor...');
      await FileSystem.deleteAsync(tempFilePath);
      console.log('Geçici dosya silindi');

      return selectedFile.uri;
    } else {
      // Kullanıcı iptal ettiyse geçici dosyayı sil
      console.log('Kullanıcı iptal etti, geçici dosya siliniyor...');
      await FileSystem.deleteAsync(tempFilePath);
      throw new Error('Dosya kaydetme işlemi iptal edildi');
    }
  } catch (error) {
    console.error('Medya indirme hatası:', error);
    if (error instanceof Error) {
      throw new Error(`Medya indirme hatası: ${error.message}`);
    }
    throw new Error('Beklenmeyen bir hata oluştu');
  }
};
