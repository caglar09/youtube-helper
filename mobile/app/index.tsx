import { StyleSheet, View, Alert, TouchableOpacity, Text } from "react-native";
import {
	WebView,
	WebViewMessageEvent,
	WebViewNavigation,
} from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	downloadMedia,
	getMediaInfo,
	MediaInfo,
	MediaFormat,
} from "@/services/mediaService";
import { useRef, useState } from "react";
import * as FileSystem from "expo-file-system";
import { DownloadModal } from "@/components/DownloadModal";
import { Ionicons } from "@expo/vector-icons";

const INJECTED_JAVASCRIPT = `
      window.ReactNativeWebView.postMessage(document.querySelector("body").innerHTML)
      true; // note: this is required, or you'll sometimes get silent failures
`;

export default function HomeScreen() {
	const [canGoBack, setCanGoBack] = useState(false);
	const [canGoForward, setCanGoForward] = useState(false);
	const [showDownloadModal, setShowDownloadModal] = useState(false);
	const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
	const webViewRef = useRef<WebView>(null);

	const handleMessage = async (event: WebViewMessageEvent) => {
		/*try {
			const data = event.nativeEvent.data;
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const fileName = `webview_data_${timestamp}.html`;
			const filePath = `${FileSystem.documentDirectory}${fileName}`;
			
			await FileSystem.writeAsStringAsync(filePath, data);
			console.log(`Veri başarıyla kaydedildi: ${filePath}`);
			Alert.alert('Başarılı', `Veri başarıyla kaydedildi: ${filePath}`);
		} catch (error) {
			console.error('Dosya yazma hatası:', error);
			Alert.alert('Hata', 'Veri kaydedilirken bir hata oluştu');
		}*/
	};

	const handleLoadEnd = () => {
		// Sayfa yüklendiğinde JavaScript'i tekrar enjekte et
	};

	const handleNavigationStateChange = async (navState: WebViewNavigation) => {
		console.log("navState.url", navState.url);
		setCanGoBack(navState.canGoBack);
		setCanGoForward(navState.canGoForward);

		// URL'de "watch?" içeriyorsa video sayfasındayız demektir
		if (navState.url.includes("watch?")) {
			setCurrentVideoUrl(navState.url);
			try {
				const info = await getMediaInfo(navState.url);
				setMediaInfo(info);
			} catch (error) {
				Alert.alert("Hata", "Video bilgileri alınamadı.");
			}
		} else {
			setCurrentVideoUrl(null);
			setMediaInfo(null);
		}
	};

	const handleDownload = async (format: MediaFormat) => {
		if (!currentVideoUrl) return;

		try {
			setDownloading(true);
			const mediaType = format.hasVideo ? 'video' : 'audio';
			const filePath = await downloadMedia(currentVideoUrl, format.itag, mediaType);
			Alert.alert("Başarılı", `${mediaType === 'video' ? 'Video' : 'Ses'} başarıyla indirildi: ${filePath}`);
			setShowDownloadModal(false);
		} catch (error) {
			Alert.alert("Hata", error instanceof Error ? error.message : "İndirme işlemi başarısız oldu.");
		} finally {
			setDownloading(false);
		}
	};

	const goBack = () => {
		if (webViewRef.current) {
			webViewRef.current.goBack();
		}
	};

	const goForward = () => {
		if (webViewRef.current) {
			webViewRef.current.goForward();
		}
	};

	return (
		<SafeAreaView style={styles.container} edges={["left", "right","top"]}>
			<View style={styles.webviewContainer}>
				<WebView
					ref={webViewRef}
					source={{ uri: "https://m.youtube.com" }}
					style={styles.webview}
					onMessage={handleMessage}
					onNavigationStateChange={handleNavigationStateChange}
					javaScriptEnabled={true}
					injectedJavaScript={INJECTED_JAVASCRIPT}
					allowsInlineMediaPlayback={true}
					mediaPlaybackRequiresUserAction={false}
					allowsFullscreenVideo={true}
					contentInset={{ bottom: 80 }}
				/>
				<View style={styles.navigationContainer}>
					<TouchableOpacity
						style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
						onPress={goBack}
						disabled={!canGoBack}
					>
						<Text
							style={[
								styles.navButtonText,
								!canGoBack && styles.navButtonTextDisabled,
							]}
						>
							←
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[
							styles.navButton,
							!canGoForward && styles.navButtonDisabled,
						]}
						onPress={goForward}
						disabled={!canGoForward}
					>
						<Text
							style={[
								styles.navButtonText,
								!canGoForward && styles.navButtonTextDisabled,
							]}
						>
							→
						</Text>
					</TouchableOpacity>
				</View>
			</View>

			{mediaInfo && (
				<>
					<TouchableOpacity
						style={styles.fabButton}
						onPress={() => setShowDownloadModal(true)}
					>
						<Ionicons name="download" size={24} color="#fff" />
					</TouchableOpacity>
					<DownloadModal
						visible={showDownloadModal}
						onClose={() => setShowDownloadModal(false)}
						title={mediaInfo.title}
						formats={mediaInfo.formats}
						onDownload={handleDownload}
						downloading={downloading}
					/>
				</>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		width: "100%",
		height: "100%",
		backgroundColor: "#fff",
	},
	webviewContainer: {
		flex: 1, 
	},
	webview: {
		flex: 1,
		paddingBottom: 80, 
	},
	navigationContainer: {
		position: "absolute",
		bottom: 20,
		left: 0,
		right: 0,
		flexDirection: "row",
		justifyContent: "space-around",
		padding: 10,
		backgroundColor: "rgba(255, 255, 255, 0.95)",
		borderTopWidth: 1,
		borderTopColor: "#ddd",
		zIndex: 1000,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: -2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 5,
	},
	navButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#ff0000",
		justifyContent: "center",
		alignItems: "center",
		elevation: 5,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
	navButtonDisabled: {
		backgroundColor: "#ccc",
	},
	navButtonText: {
		color: "#fff",
		fontSize: 20,
		fontWeight: "bold",
	},
	navButtonTextDisabled: {
		color: "#666",
	},
	fabButton: {
		position: "absolute",
		bottom: 100,
		right: 20,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#ff0000",
		justifyContent: "center",
		alignItems: "center",
		elevation: 8,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.3,
		shadowRadius: 4.65,
		zIndex: 1001,
	},
});
