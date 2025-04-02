import * as FileSystem from 'expo-file-system';
import { DownloadJob } from './downloadManager';

// In-memory hafıza depolama çözümü
class DBService {
  private static instance: DBService;
  private storageFile: string;
  private jobs: { [key: string]: DownloadJob } = {};
  private initialized: boolean = false;

  private constructor() {
    this.storageFile = `${FileSystem.documentDirectory}youtube_downloads.json`;
    this.initStorage();
  }

  public static getInstance(): DBService {
    if (!DBService.instance) {
      DBService.instance = new DBService();
    }
    return DBService.instance;
  }

  private async initStorage(): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.storageFile);
      
      if (fileInfo.exists) {
        // Dosyadan verileri yükle
        const content = await FileSystem.readAsStringAsync(this.storageFile);
        const savedJobs = JSON.parse(content);
        
        // JSON'dan düzgün nesnelere dönüştür
        Object.keys(savedJobs).forEach(key => {
          const job = savedJobs[key];
          this.jobs[key] = {
            ...job,
            createdAt: new Date(job.createdAt),
            updatedAt: new Date(job.updatedAt)
          };
        });
        
        console.log(`${Object.keys(this.jobs).length} iş yüklendi`);
      } else {
        // Dosya yoksa oluştur
        await this.saveToStorage();
        console.log('Yeni indirme veritabanı oluşturuldu');
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Depolama başlatma hatası:', error);
      this.initialized = true; // Hata olsa bile başlatılmış say
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(
        this.storageFile, 
        JSON.stringify(this.jobs)
      );
    } catch (error) {
      console.error('Verileri dosyaya yazma hatası:', error);
    }
  }

  // İndirme işlerini kaydet
  public async saveJob(job: DownloadJob): Promise<void> {
    try {
      // Henüz başlatılmadıysa bekle
      if (!this.initialized) {
        await new Promise<void>(resolve => {
          const checkInterval = setInterval(() => {
            if (this.initialized) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }
      
      this.jobs[job.id] = job;
      await this.saveToStorage();
    } catch (error) {
      console.error('İş kaydetme hatası:', error);
    }
    return Promise.resolve();
  }

  // Tüm indirme işlerini getir
  public async getAllJobs(): Promise<DownloadJob[]> {
    try {
      // Henüz başlatılmadıysa bekle
      if (!this.initialized) {
        await new Promise<void>(resolve => {
          const checkInterval = setInterval(() => {
            if (this.initialized) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }
      
      return Object.values(this.jobs);
    } catch (error) {
      console.error('İşleri getirme hatası:', error);
      return [];
    }
  }

  // Bir indirme işini sil
  public async deleteJob(jobId: string): Promise<void> {
    try {
      if (this.jobs[jobId]) {
        delete this.jobs[jobId];
        await this.saveToStorage();
      }
    } catch (error) {
      console.error('İş silme hatası:', error);
    }
    return Promise.resolve();
  }

  // Bir indirme işini güncelle
  public async updateJob(jobId: string, updates: Partial<DownloadJob>): Promise<void> {
    try {
      const existingJob = await this.getJob(jobId);
      if (!existingJob) {
        return;
      }

      // Güncellenmiş iş nesnesi oluştur
      const updatedJob: DownloadJob = {
        ...existingJob,
        ...updates,
        updatedAt: new Date()
      };

      // Kaydet
      await this.saveJob(updatedJob);
    } catch (error) {
      console.error('İş güncelleme hatası:', error);
    }
    return Promise.resolve();
  }

  // Bir indirme işini getir
  public async getJob(jobId: string): Promise<DownloadJob | null> {
    try {
      // Henüz başlatılmadıysa bekle
      if (!this.initialized) {
        await new Promise<void>(resolve => {
          const checkInterval = setInterval(() => {
            if (this.initialized) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }
      
      return this.jobs[jobId] || null;
    } catch (error) {
      console.error('İş getirme hatası:', error);
      return null;
    }
  }
}

export default DBService.getInstance(); 