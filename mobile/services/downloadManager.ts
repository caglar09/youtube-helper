import { EventEmitter } from 'events';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { getMediaInfo, downloadMedia } from './mediaService';
import dbService from './dbService';

export interface DownloadJob {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  format: any;
  mediaType: 'video' | 'audio';
  progress: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  filePath?: string;
  createdAt: Date;
  updatedAt: Date;
}

class DownloadManager {
  private static instance: DownloadManager;
  private jobs: DownloadJob[] = [];
  private eventEmitter: EventEmitter;
  private maxConcurrentDownloads: number = 2;
  private activeDownloads: number = 0;
  private tempDir: string = `${FileSystem.cacheDirectory}youtube-downloads/`;

  private constructor() {
    this.eventEmitter = new EventEmitter();
    this.initTempDirectory();
    this.loadJobsFromDatabase();
  }

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  private async initTempDirectory() {
    const dirInfo = await FileSystem.getInfoAsync(this.tempDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.tempDir, { intermediates: true });
    }
  }

  // Veritabanından tüm işleri yükler
  private async loadJobsFromDatabase() {
    try {
      const savedJobs = await dbService.getAllJobs();
      this.jobs = savedJobs;
      console.log(`${this.jobs.length} iş veritabanından yüklendi`);
      
      // Yarım kalan işleri tekrar kuyruğa ekle
      this.jobs.forEach(job => {
        if (job.status === 'downloading') {
          // İndirme durumundaki işleri yeniden kuyruğa al
          this.updateJobStatus(job.id, 'queued');
        }
      });
      
      // Kuyruğu kontrol et
      this.checkQueue();
    } catch (error) {
      console.error('İşleri veritabanından yükleme hatası:', error);
    }
  }

  // İndirme işini kuyruğa ekler
  public async addToQueue(
    videoUrl: string,
    format: any,
    mediaType: 'video' | 'audio'
  ): Promise<DownloadJob> {
    try {
      // Video bilgilerini al
      const mediaInfo = await getMediaInfo(videoUrl);
      
      // Yeni indirme işi oluştur
      const job: DownloadJob = {
        id: `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: mediaInfo.title || 'Bilinmeyen Başlık',
        url: videoUrl,
        thumbnail: mediaInfo.thumbnail || '',
        format,
        mediaType,
        progress: 0,
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // İşi kuyruğa ekle
      this.jobs.push(job);
      
      // Veritabanına kaydet
      await dbService.saveJob(job);
      
      // İndirme kuyruğunu kontrol et ve gerekirse indirmeyi başlat
      this.checkQueue();
      
      // İş eklendiğini bildir
      this.eventEmitter.emit('job-added', job);
      
      return job;
    } catch (error) {
      console.error('Kuyruğa ekleme hatası:', error);
      throw error;
    }
  }

  // İndirme kuyruğunu kontrol eder ve sıradaki işi başlatır
  private async checkQueue() {
    // Eğer aktif indirme sayısı maksimumu aşmıyorsa ve bekleyen işler varsa
    if (this.activeDownloads < this.maxConcurrentDownloads) {
      // Sıradaki 'queued' durumundaki işi bul
      const nextJob = this.jobs.find(job => job.status === 'queued');
      
      if (nextJob) {
        // İndirmeyi başlat
        this.startDownload(nextJob);
      }
    }
  }

  // İndirme işlemini başlatır
  private async startDownload(job: DownloadJob) {
    try {
      // İş durumunu güncelle
      this.updateJobStatus(job.id, 'downloading');
      
      // Aktif indirme sayısını artır
      this.activeDownloads += 1;
      
      // Güvenli bir dosya adı oluştur
      const fileExtension = job.mediaType === 'video' ? 'mp4' : 'mp3';
      const safeName = job.title
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 50); // Çok uzun isimlerden kaçınmak için kısalt
      
      const fileName = `${safeName}_${Date.now()}.${fileExtension}`;
      const filePath = `${this.tempDir}${fileName}`;
      
      console.log('İndirme başlıyor:', { job: job.id, title: job.title, filePath });
      
      try {
        // Sunucudan medya URL'sini al
        console.log(`İndirme URL'si talep ediliyor: URL=${job.url}, itag=${job.format.itag}, mediaType=${job.mediaType}`);
        const downloadUrl = await downloadMedia(job.url, job.format.itag, job.mediaType);
        console.log('İndirme URL\'si alındı:', downloadUrl);
        
        if (!downloadUrl) {
          throw new Error('Geçerli bir indirme URL\'si alınamadı');
        }
        
        // İndirme işlemini başlat
        const downloadResumable = FileSystem.createDownloadResumable(
          downloadUrl,
          filePath,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          },
          (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            this.updateJobProgress(job.id, progress);
          }
        );
        
        // İndirmeyi gerçekleştir
        console.log('İndirme başlatılıyor...');
        const result = await downloadResumable.downloadAsync();
        console.log('İndirme sonucu:', result);
        
        if (!result) {
          throw new Error('İndirme başarısız oldu: Sonuç alınamadı');
        }
        
        // İndirilen dosyanın gerçekten var olup olmadığını kontrol et
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        if (!fileInfo.exists || fileInfo.size === 0) {
          throw new Error('İndirilen dosya bulunamadı veya boş');
        }
        
        // İndirme başarılı olduysa, işi güncelle
        this.updateJob(job.id, {
          status: 'completed',
          progress: 1,
          filePath: result.uri,
          updatedAt: new Date()
        });
        
        // İndirme tamamlandı bildirimini yayınla
        this.eventEmitter.emit('job-completed', this.getJob(job.id));
      } catch (downloadError: any) {
        console.error(`Medya indirme hatası (${job.id}):`, downloadError);
        throw new Error(`İndirme hatası: ${downloadError.message}`);
      }
      
    } catch (error: any) {
      console.error(`İndirme hatası (${job.id}):`, error);
      
      // Hata mesajını hazırla
      let errorMessage = error.message || 'Bilinmeyen hata';
      
      // Hata durumunda işi güncelle
      this.updateJob(job.id, {
        status: 'failed',
        error: errorMessage,
        updatedAt: new Date()
      });
      
      // Hata bildirimini yayınla
      this.eventEmitter.emit('job-error', this.getJob(job.id));
    } finally {
      // Aktif indirme sayısını azalt
      this.activeDownloads -= 1;
      
      // Kuyruğu tekrar kontrol et
      this.checkQueue();
    }
  }

  // İş durumunu günceller
  private updateJobStatus(jobId: string, status: DownloadJob['status']) {
    this.updateJob(jobId, { status, updatedAt: new Date() });
    this.eventEmitter.emit('job-updated', this.getJob(jobId));
  }

  // İş ilerleme durumunu günceller
  private updateJobProgress(jobId: string, progress: number) {
    this.updateJob(jobId, { progress, updatedAt: new Date() });
    this.eventEmitter.emit('job-progress', this.getJob(jobId));
  }

  // İşi günceller
  private async updateJob(jobId: string, updates: Partial<DownloadJob>) {
    const jobIndex = this.jobs.findIndex(job => job.id === jobId);
    
    if (jobIndex !== -1) {
      // Hafızadaki işi güncelle
      this.jobs[jobIndex] = {
        ...this.jobs[jobIndex],
        ...updates,
        updatedAt: new Date()
      };
      
      // Veritabanındaki işi güncelle
      try {
        await dbService.updateJob(jobId, updates);
      } catch (error) {
        console.error(`İş veritabanı güncelleme hatası (${jobId}):`, error);
      }
    }
  }

  // İşi getirir
  public async getJob(jobId: string): Promise<DownloadJob | undefined> {
    // Önce hafızada ara
    let job = this.jobs.find(job => job.id === jobId);
    
    // Bulunamadıysa veritabanında ara
    if (!job) {
      try {
        const dbJob = await dbService.getJob(jobId);
        if (dbJob) {
          job = dbJob;
          // Hafızaya da ekle
          this.jobs.push(dbJob);
        }
      } catch (error) {
        console.error(`İş getirme hatası (${jobId}):`, error);
      }
    }
    
    return job;
  }

  // Tüm işleri getirir
  public async getAllJobs(): Promise<DownloadJob[]> {
    // Tüm işleri veritabanından yenile
    try {
      const dbJobs = await dbService.getAllJobs();
      this.jobs = dbJobs;
    } catch (error) {
      console.error('İşleri getirme hatası:', error);
    }
    
    return [...this.jobs];
  }

  // İşi siler
  public async removeJob(jobId: string): Promise<boolean> {
    const jobIndex = this.jobs.findIndex(job => job.id === jobId);
    
    if (jobIndex !== -1) {
      // Tamamlanmış işlere ait dosyaları sil
      const job = this.jobs[jobIndex];
      if (job.filePath) {
        FileSystem.deleteAsync(job.filePath, { idempotent: true }).catch(err => {
          console.error(`Dosya silme hatası (${job.id}):`, err);
        });
      }
      
      // İşi listeden çıkar
      this.jobs.splice(jobIndex, 1);
      
      // Veritabanından sil
      try {
        await dbService.deleteJob(jobId);
      } catch (error) {
        console.error(`İş veritabanı silme hatası (${jobId}):`, error);
      }
      
      // Bildirim yayınla
      this.eventEmitter.emit('job-removed', job);
      return true;
    }
    
    return false;
  }

  // İşi iptal eder
  public async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    
    if (job && (job.status === 'queued' || job.status === 'downloading')) {
      this.updateJobStatus(jobId, 'cancelled');
      return true;
    }
    
    return false;
  }

  // Dosyayı kullanıcı ile paylaş
  public async shareFile(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    
    if (!job || !job.filePath || job.status !== 'completed') {
      throw new Error('Paylaşılacak tamamlanmış bir dosya bulunamadı');
    }
    
    try {
      if (await Sharing.isAvailableAsync()) {
        // Dosya bilgilerini kontrol et
        const fileInfo = await FileSystem.getInfoAsync(job.filePath);
        if (!fileInfo.exists) {
          throw new Error('Dosya bulunamadı: Geçici dosya silinmiş olabilir');
        }
        
        console.log('Paylaşılacak dosya:', job.filePath);
        console.log('Dosya bilgileri:', fileInfo);
        
        // MIME tipini belirle
        let mimeType = job.mediaType === 'video' ? 'video/mp4' : 'audio/mpeg';
        
        // Paylaşım dialogunu aç
        await Sharing.shareAsync(job.filePath, {
          mimeType,
          dialogTitle: `${job.title} paylaşılıyor`,
          UTI: job.mediaType === 'video' ? 'public.mpeg-4' : 'public.mp3'
        });
        
        console.log('Paylaşım dialog açıldı');
      } else {
        throw new Error('Dosya paylaşımı bu cihazda desteklenmiyor');
      }
    } catch (error) {
      console.error('Paylaşım hatası:', error);
      throw error;
    }
  }

  // Dosyayı medya kütüphanesine kaydet
  public async saveToMediaLibrary(jobId: string): Promise<string> {
    const job = await this.getJob(jobId);
    
    if (!job || !job.filePath || job.status !== 'completed') {
      throw new Error('Kaydedilecek tamamlanmış bir dosya bulunamadı');
    }
    
    // Dosya varlığını kontrol et
    const fileInfo = await FileSystem.getInfoAsync(job.filePath);
    if (!fileInfo.exists) {
      throw new Error('Dosya bulunamadı: Geçici dosya silinmiş olabilir');
    }
    
    console.log('Kaydedilecek dosya:', job.filePath);
    console.log('Dosya bilgileri:', fileInfo);
    
    try {
      // Gerekli izinleri iste
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        throw new Error('Medya kütüphanesine erişim izni verilmedi');
      }
      
      // Dosyayı medya kütüphanesine kaydet
      const asset = await MediaLibrary.createAssetAsync(job.filePath);
      console.log('Asset yaratıldı:', asset);
      
      // Album oluştur veya var olan albüme ekle
      const albumName = job.mediaType === 'video' ? 'YouTube Videos' : 'YouTube Music';
      const album = await MediaLibrary.getAlbumAsync(albumName);
      
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }
      
      console.log('Medya kütüphanesine kaydedildi');
      return asset.uri;
    } catch (error: any) {
      console.error('Medya kütüphanesine kaydetme hatası:', error);
      throw error;
    }
  }

  // Belirli durumdaki işleri filtreler
  public async filterJobsByStatus(status: DownloadJob['status']): Promise<DownloadJob[]> {
    // Tüm işleri veritabanından yenile
    await this.getAllJobs();
    
    // Duruma göre filtrele
    return this.jobs.filter(job => job.status === status);
  }

  // Olaylara abone ol
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  // Olay aboneliğini kaldır
  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}

export default DownloadManager.getInstance(); 