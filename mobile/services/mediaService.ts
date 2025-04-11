import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

// API URL'sini platformlara göre ayarla
const getApiUrl = () => {
  return `${(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000')}/api`;
};

const API_URL = getApiUrl();
console.log(`API URL: ${API_URL} (Platform: ${Platform.OS})`);

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
  videoFormats?: MediaFormat[];
  audioFormats?: MediaFormat[];
  author?: {
    name: string;
    id: string;
  };
  description?: string;
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
    console.log('Medya bilgisi isteniyor:', mediaUrl);

    const response = await fetch(`${API_URL}/media-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaUrl }),
    });

    console.log('API yanıtı alındı. Status:', response.status);

    const responseData = await response.json();
    console.log('API yanıt verisi:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('API hata yanıtı:', responseData);
      const errorData: MediaError = responseData;
      throw new Error(errorData.details || 'Medya bilgisi alınamadı');
    }

    // API yanıtını doğrula ve dönüştür
    const result: MediaInfo = {
      title: responseData.title || '',
      thumbnail: responseData.thumbnail || '',
      duration: responseData.duration || '',
      formats: {
        video: [],
        audio: []
      }
    };

    // videoFormats ve audioFormats alanlarını kontrol et
    if (responseData.videoFormats && Array.isArray(responseData.videoFormats)) {
      result.formats.video = responseData.videoFormats;
      console.log(`${responseData.videoFormats.length} video formatı bulundu`);
    } else if (responseData.formats && responseData.formats.video && Array.isArray(responseData.formats.video)) {
      result.formats.video = responseData.formats.video;
      console.log(`${responseData.formats.video.length} video formatı bulundu`);
    } else {
      console.warn('Video formatları bulunamadı veya geçersiz formatta');
    }

    if (responseData.audioFormats && Array.isArray(responseData.audioFormats)) {
      result.formats.audio = responseData.audioFormats;
      console.log(`${responseData.audioFormats.length} ses formatı bulundu`);
    } else if (responseData.formats && responseData.formats.audio && Array.isArray(responseData.formats.audio)) {
      result.formats.audio = responseData.formats.audio;
      console.log(`${responseData.formats.audio.length} ses formatı bulundu`);
    } else {
      console.warn('Ses formatları bulunamadı veya geçersiz formatta');
    }

    // API yanıtını doğrudan dön (formatları uyumluluk için de ekleyerek)
    return {
      ...responseData,
      formats: result.formats
    };
  } catch (error) {
    console.error('Medya bilgisi alma hatası:', error);
    if (error instanceof Error) {
      throw new Error(`Medya bilgisi alınamadı: ${error.message}`);
    }
    throw new Error('Beklenmeyen bir hata oluştu');
  }
};

export const downloadMedia = async (mediaUrl: string, itag: string, mediaType: 'video' | 'audio'): Promise<string> => {
  try {
    console.log('Medya indirme isteği başlatılıyor:', { mediaUrl, itag, mediaType });

    // Sunucuya indirme isteği gönder
    console.log('Sunucuya indirme isteği gönderiliyor...');
    const response = await fetch(`${API_URL}/media-url`, {
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

    console.log('Sunucu yanıtı alındı:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    // Yanıt içeriği kontrolü
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Sunucu JSON yanıtı vermedi:', contentType);

      // İçeriği text olarak al ve logla
      const textResponse = await response.text();
      console.error('Sunucu yanıt içeriği (text):', textResponse);

      throw new Error(`Sunucu geçersiz yanıt verdi. İçerik tipi: ${contentType}`);
    }

    if (!response.ok) {
      const errorData: MediaError = await response.json();
      console.error('Sunucu indirme hatası:', errorData);
      throw new Error(errorData.details || 'Medya indirilemedi');
    }

    // Sunucudan indirme URL'sini al
    const responseData = await response.json();
    console.log('Sunucu indirme yanıtı:', responseData);

    // İndirme URL'sini döndür
    const { downloadUrl } = responseData;

    if (!downloadUrl) {
      throw new Error('Sunucudan geçerli bir indirme URL\'si alınamadı');
    }

    // URL'yi düzgün şekilde oluştur
    // Sunucu downloadUrl /media/file-name.mp4 formatında dönüyor
    // API_URL sonunda /api var, ama bunu çıkarıp sunucu kök URL'sine eklememiz gerekiyor
    const serverBaseUrl = API_URL.replace(/\/api$/, ''); // /api son ekini kaldır
    const fullDownloadUrl = `${serverBaseUrl}${downloadUrl}`;
    console.log('İndirme için tam URL:', fullDownloadUrl);

    return fullDownloadUrl;
  } catch (error) {
    console.error('Medya indirme hatası:', error);
    if (error instanceof Error) {
      throw new Error(`Medya indirme hatası: ${error.message}`);
    }
    throw new Error('Beklenmeyen bir hata oluştu');
  }
};
