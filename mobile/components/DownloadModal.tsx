import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MediaFormat } from '@/services/mediaService';

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  formats: {
    video: MediaFormat[];
    audio: MediaFormat[];
  };
  onDownload: (format: MediaFormat) => Promise<void>;
  downloading: boolean;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  visible,
  onClose,
  title,
  formats,
  onDownload,
  downloading,
}) => {
  const formatSize = (contentLength: string) => {
    const size = parseInt(contentLength);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const renderFormatButton = (format: MediaFormat, type: 'video' | 'audio', index: number) => (
    <TouchableOpacity
      key={`${type}-${format.itag}-${index}`}
      style={styles.formatButton}
      onPress={() => onDownload(format)}
      disabled={downloading}
    >
      <Text style={styles.formatText}>
        {type === 'video' ? 'Video' : 'Ses'} - {format.quality}
      </Text>
      <Text style={styles.formatDetails}>
        {formatSize(format.contentLength)} • {format.container}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formatsContainer}>
            {formats.video.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Video Formatları</Text>
                {formats.video.map((format, index) => renderFormatButton(format, 'video', index))}
              </View>
            )}

            {formats.audio.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ses Formatları</Text>
                {formats.audio.map((format, index) => renderFormatButton(format, 'audio', index))}
              </View>
            )}
          </ScrollView>

          {downloading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff0000" />
              <Text style={styles.loadingText}>İndiriliyor...</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  formatsContainer: {
    maxHeight: 400,
  },
  section: {
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
  },
  formatText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  formatDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
}); 