import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import downloadManager from '../services/downloadManager';
import { MediaFormat, downloadMedia } from '@/services/mediaService';

interface DownloadModalProps {
  videoInfo: any;
  isVisible: boolean;
  onClose: () => void;
  url: string;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ videoInfo, isVisible, onClose, url }) => {
  const [selectedFormat, setSelectedFormat] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [formatsLoaded, setFormatsLoaded] = useState(false);
  const [videoFormats, setVideoFormats] = useState<any[]>([]);
  const [audioFormats, setAudioFormats] = useState<any[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  
  // videoInfo değiştiğinde formatları ayarla
  useEffect(() => {
    if (videoInfo) {
      console.log('Modal videoInfo:', JSON.stringify(videoInfo, null, 2));
      
      try {
        // Video formatlarını kontrol et
        let vFormats: any[] = [];
        if (videoInfo.videoFormats && Array.isArray(videoInfo.videoFormats)) {
          vFormats = videoInfo.videoFormats;
        } else if (videoInfo.formats && videoInfo.formats.video && Array.isArray(videoInfo.formats.video)) {
          vFormats = videoInfo.formats.video;
        }
        
        // Ses formatlarını kontrol et
        let aFormats: any[] = [];
        if (videoInfo.audioFormats && Array.isArray(videoInfo.audioFormats)) {
          aFormats = videoInfo.audioFormats;
        } else if (videoInfo.formats && videoInfo.formats.audio && Array.isArray(videoInfo.formats.audio)) {
          aFormats = videoInfo.formats.audio;
        }
        
        console.log(`Video formatları: ${vFormats.length}, Ses formatları: ${aFormats.length}`);
        
        setVideoFormats(vFormats);
        setAudioFormats(aFormats);
        setFormatsLoaded(true);
        setModalError(null);
        
        // Hiç format yoksa hata göster
        if (vFormats.length === 0 && aFormats.length === 0) {
          setModalError('Kullanılabilir indirme formatı bulunamadı');
        }
      } catch (error) {
        console.error('Format ayıklama hatası:', error);
        setModalError('Video formatları işlenirken bir hata oluştu');
      }
    } else {
      setVideoFormats([]);
      setAudioFormats([]);
      setFormatsLoaded(false);
      setModalError(null);
    }
  }, [videoInfo]);

  const renderFormatButton = (format: any, type: 'video' | 'audio', index: number) => {
    if (!format) {
      console.warn(`Geçersiz format nesnesi: ${JSON.stringify(format)}`);
      return null;
    }
    
    const isSelected = selectedFormat && selectedFormat.itag === format.itag;
    const formattedSize = format.contentLength 
      ? `${(parseInt(format.contentLength) / (1024 * 1024)).toFixed(1)} MB` 
      : 'Bilinmiyor';

    let quality = format.qualityLabel || format.quality || 'Standart';
    if (type === 'audio') {
      quality = format.audioBitrate ? `${format.audioBitrate}kbps` : 'Standart Kalite';
    }

    return (
      <TouchableOpacity
        key={`${type}-${format.itag || index}-${index}`}
        style={[styles.formatButton, isSelected && styles.selectedFormat]}
        onPress={() => setSelectedFormat({ ...format, mediaType: type })}
      >
        <Ionicons 
          name={type === 'video' ? 'videocam' : 'musical-notes'} 
          size={20} 
          color={isSelected ? '#fff' : '#333'} 
        />
        <View style={styles.formatInfo}>
          <Text style={[styles.formatQuality, isSelected && styles.selectedText]}>
            {quality}
          </Text>
          <Text style={[styles.formatSize, isSelected && styles.selectedText]}>
            {formattedSize}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    );
  };

  const handleDownload = async () => {
    if (!selectedFormat) {
      Alert.alert('Uyarı', 'Lütfen bir indirme formatı seçin');
      return;
    }

    try {
      setIsDownloading(true);
      
      // İndirme işini kuyruğa ekle
      const job = await downloadManager.addToQueue(
        url,
        selectedFormat,
        selectedFormat.mediaType
      );
      
      setIsDownloading(false);
      onClose();
      
      // Kullanıcıya bildirim göster
      Alert.alert(
        'İndirme Başlatıldı',
        'İndirme işi kuyruğa eklendi. İndirilenler sayfasında görebilir ve tamamlandığında paylaşabilirsiniz.',
        [
          { 
            text: 'İndirilenler Sayfasına Git', 
            onPress: () => {
              // İndirilenler sayfasına yönlendirme
              router.push("/downloads");
            } 
          },
          { text: 'Tamam' }
        ]
      );
    } catch (error: any) {
      setIsDownloading(false);
      Alert.alert('İndirme Hatası', error.message || 'Bilinmeyen bir hata oluştu');
    }
  };

  const renderFormats = () => {
    if (modalError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#f44336" />
          <Text style={styles.errorText}>{modalError}</Text>
        </View>
      );
    }
    
    return (
      <ScrollView style={styles.formatList}>
        {videoFormats.length > 0 && (
          <View style={styles.formatSection}>
            <Text style={styles.sectionTitle}>Video</Text>
            {videoFormats.map((format, index) => 
              renderFormatButton(format, 'video', index)
            )}
          </View>
        )}

        {audioFormats.length > 0 && (
          <View style={styles.formatSection}>
            <Text style={styles.sectionTitle}>Ses</Text>
            {audioFormats.map((format, index) => 
              renderFormatButton(format, 'audio', index)
            )}
          </View>
        )}
        
        {videoFormats.length === 0 && audioFormats.length === 0 && formatsLoaded && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#f44336" />
            <Text style={styles.errorText}>İndirilebilir format bulunamadı</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>İndirme Seçenekleri</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {videoInfo ? (
            <>
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {videoInfo.title || 'Video Başlığı Yok'}
                </Text>
                {videoInfo.author && (
                  <Text style={styles.videoAuthor}>
                    {videoInfo.author.name}
                  </Text>
                )}
              </View>

              {renderFormats()}

              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  (!selectedFormat || isDownloading || modalError) && styles.disabledButton
                ]}
                onPress={handleDownload}
                disabled={!selectedFormat || isDownloading || !!modalError}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.downloadButtonText}>İndir</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Video bilgileri yükleniyor...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 5,
  },
  videoInfo: {
    marginBottom: 20,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  videoAuthor: {
    fontSize: 14,
    color: '#666',
  },
  formatList: {
    maxHeight: 400,
  },
  formatSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  formatButton: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedFormat: {
    backgroundColor: '#0066cc',
  },
  formatInfo: {
    flex: 1,
    marginLeft: 10,
  },
  formatQuality: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedText: {
    color: '#fff',
  },
  formatSize: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  downloadButton: {
    backgroundColor: '#0066cc',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 200,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
});

export default DownloadModal; 