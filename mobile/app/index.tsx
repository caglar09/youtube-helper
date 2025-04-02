import React, { useState, useRef } from 'react';
import { 
	StyleSheet, 
	View, 
	TouchableOpacity, 
	SafeAreaView,
	Alert,
	Text,
	ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { getMediaInfo } from '../services/mediaService';
import DownloadModal from '../components/DownloadModal';

export default function HomeScreen() {
	const webViewRef = useRef<WebView>(null);
	const [currentUrl, setCurrentUrl] = useState<string>('https://m.youtube.com');
	const [canGoBack, setCanGoBack] = useState<boolean>(false);
	const [canGoForward, setCanGoForward] = useState<boolean>(false);
	const [isVideoPage, setIsVideoPage] = useState<boolean>(false);
	const [videoInfo, setVideoInfo] = useState<any>(null);
	const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);

	const handleNavigationStateChange = (navState: any) => {
		setCurrentUrl(navState.url);
		setCanGoBack(navState.canGoBack);
		setCanGoForward(navState.canGoForward);

		// URL'yi kontrol ederek video sayfasında olup olmadığımızı belirle
		const isYoutubeVideoPage = navState.url.includes('youtube.com/watch') || 
								  navState.url.includes('youtu.be/');
		
		console.log('Sayfa yüklendi:', navState.url);
		console.log('Video sayfası mı?', isYoutubeVideoPage);
		
		setIsVideoPage(isYoutubeVideoPage);

		if (isYoutubeVideoPage) {
			fetchVideoInfo(navState.url);
		} else {
			// Video sayfasından çıktıysak, bilgileri temizle
			setVideoInfo(null);
		}
	};

	const fetchVideoInfo = async (url: string) => {
		try {
			console.log('Video bilgisi getiriliyor:', url);
			setLoading(true);
			const info = await getMediaInfo(url);
			console.log('Video bilgisi alındı, başlık:', info.title);
			
			// Sonuçlarda format var mı kontrol et
			const hasVideoFormats = info.videoFormats?.length > 0 || info.formats?.video?.length > 0;
			const hasAudioFormats = info.audioFormats?.length > 0 || info.formats?.audio?.length > 0;
			
			if (!hasVideoFormats && !hasAudioFormats) {
				console.warn('İndirilebilir format bulunamadı!');
			}
			
			setVideoInfo(info);
			setLoading(false);
		} catch (error: any) {
			setLoading(false);
			console.error('Video bilgisi alınamadı:', error);
			Alert.alert('Hata', `Video bilgisi alınamadı: ${error.message}`);
		}
	};

	const goBack = () => {
		if (webViewRef.current && canGoBack) {
			webViewRef.current.goBack();
		}
	};

	const goForward = () => {
		if (webViewRef.current && canGoForward) {
			webViewRef.current.goForward();
		}
	};

	const refreshCurrentPage = () => {
		if (webViewRef.current) {
			setVideoInfo(null);
			webViewRef.current.reload();
		}
	};

	const goHome = () => {
		if (webViewRef.current) {
			webViewRef.current.injectJavaScript(`
				window.location.href = 'https://m.youtube.com';
				true;
			`);
		}
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<WebView
				ref={webViewRef}
				source={{ uri: 'https://m.youtube.com' }}
				style={styles.webView}
				onNavigationStateChange={handleNavigationStateChange}
				allowsBackForwardNavigationGestures
				allowsInlineMediaPlayback={true}
				mediaPlaybackRequiresUserAction={false}
				javaScriptEnabled={true}
			/>

			<View style={styles.navigationBar}>
				<TouchableOpacity onPress={goBack} disabled={!canGoBack} style={styles.navButton}>
					<Ionicons name="arrow-back" size={24} color={canGoBack ? '#333' : '#ccc'} />
				</TouchableOpacity>
				<TouchableOpacity onPress={goForward} disabled={!canGoForward} style={styles.navButton}>
					<Ionicons name="arrow-forward" size={24} color={canGoForward ? '#333' : '#ccc'} />
				</TouchableOpacity>
				<TouchableOpacity onPress={refreshCurrentPage} style={styles.navButton}>
					<Ionicons name="refresh" size={24} color="#333" />
				</TouchableOpacity>
				<TouchableOpacity onPress={goHome} style={styles.navButton}>
					<Ionicons name="home" size={24} color="#333" />
				</TouchableOpacity>
			</View>

			{isVideoPage && (
				<TouchableOpacity 
					style={styles.downloadButton}
					onPress={() => setShowDownloadModal(true)}
				>
					<Ionicons name="cloud-download" size={24} color="#fff" />
				</TouchableOpacity>
			)}

			<DownloadModal 
				videoInfo={videoInfo}
				isVisible={showDownloadModal}
				onClose={() => setShowDownloadModal(false)}
				url={currentUrl}
			/>
			
			{loading && (
				<View style={styles.loadingOverlay}>
					<ActivityIndicator size="large" color="#ff0000" />
				</View>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#fff',
	},
	webView: {
		flex: 1,
	},
	navigationBar: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		backgroundColor: '#fff',
		height: 50,
		borderTopWidth: 1,
		borderTopColor: '#e1e1e1',
	},
	navButton: {
		padding: 10,
	},
	downloadButton: {
		position: 'absolute',
		right: 20,
		bottom: 70,
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: '#ff0000',
		justifyContent: 'center',
		alignItems: 'center',
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 3,
		zIndex: 1000,
	},
	loadingOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(255, 255, 255, 0.7)',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 1001,
	},
});
