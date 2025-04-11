import React, { useState, useEffect } from "react";
import {
	StyleSheet,
	View,
	Text,
	FlatList,
	Image,
	TouchableOpacity,
	Alert,
	Share,
	SafeAreaView,
	ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import downloadManager, { DownloadJob } from "../services/downloadManager";

export default function DownloadsScreen() {
	const [jobs, setJobs] = useState<DownloadJob[]>([]);
	const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState<boolean>(false);

	// İndirme işlerini yükle
	useEffect(() => {
		loadJobs();

		// İndirme durumu değişikliklerini dinle
		const events = [
			"job-added",
			"job-updated",
			"job-progress",
			"job-completed",
			"job-error",
			"job-removed",
		];

		const updateJobs = () => {
			loadJobs();
		};

		events.forEach((event) => {
			downloadManager.on(event, updateJobs);
		});

		return () => {
			events.forEach((event) => {
				downloadManager.off(event, updateJobs);
			});
		};
	}, []);

	const loadJobs = async () => {
		try {
			const allJobs = await downloadManager.getAllJobs();
			console.log("allJobs", JSON.stringify(allJobs, null, 4));

			setJobs(
				allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			);
		} catch (error) {
			console.error("İndirme işleri yüklenemedi:", error);
		}
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		await loadJobs();
		setRefreshing(false);
	};

	const handleShareFile = async (job: DownloadJob) => {
		try {
			if (job.status !== "completed") {
				Alert.alert("Uyarı", "Yalnızca tamamlanmış dosyalar paylaşılabilir.");
				return;
			}

			await downloadManager.shareFile(job.id);
		} catch (error: any) {
			Alert.alert("Paylaşım Hatası", error.message);
		}
	};

	const handleSaveToGallery = async (job: DownloadJob) => {
		try {
			if (job.status !== "completed") {
				Alert.alert("Uyarı", "Yalnızca tamamlanmış dosyalar kaydedilebilir.");
				return;
			}

			const uri = await downloadManager.saveToMediaLibrary(job.id);
			Alert.alert("Başarılı", "Dosya medya kütüphanesine kaydedildi.");
		} catch (error: any) {
			Alert.alert("Kaydetme Hatası", error.message);
		}
	};

	const handleDeleteJob = (job: DownloadJob) => {
		Alert.alert(
			"İndirme İşini Sil",
			"Bu indirme işini silmek istediğinizden emin misiniz?",
			[
				{ text: "İptal", style: "cancel" },
				{
					text: "Sil",
					style: "destructive",
					onPress: async () => {
						await downloadManager.removeJob(job.id);
						loadJobs();
					},
				},
			]
		);
	};

	const handleCancelDownload = async (job: DownloadJob) => {
		if (job.status === "queued" || job.status === "downloading") {
			await downloadManager.cancelJob(job.id);
			loadJobs();
		}
	};

	const renderStatus = (status: DownloadJob["status"]) => {
		let icon: any;
		let color: string;
		let text: string;

		switch (status) {
			case "queued":
				icon = "time-outline";
				color = "#666";
				text = "Kuyrukta";
				break;
			case "downloading":
				icon = "cloud-download-outline";
				color = "#0066cc";
				text = "İndiriliyor";
				break;
			case "completed":
				icon = "checkmark-circle-outline";
				color = "#4CAF50";
				text = "Tamamlandı";
				break;
			case "failed":
				icon = "alert-circle-outline";
				color = "#F44336";
				text = "Başarısız";
				break;
			case "cancelled":
				icon = "close-circle-outline";
				color = "#FF9800";
				text = "İptal Edildi";
				break;
			default:
				icon = "help-circle-outline";
				color = "#999";
				text = "Bilinmiyor";
		}

		return (
			<View style={[styles.statusContainer, { borderColor: color }]}>
				<Ionicons
					name={icon}
					size={16}
					color={color}
					style={styles.statusIcon}
				/>
				<Text style={[styles.statusText, { color }]}>{text}</Text>
			</View>
		);
	};

	const renderJobItem = ({ item }: { item: DownloadJob }) => {
		const isSelected = selectedJobId === item.id;

		return (
			<View style={styles.jobItem}>
				<TouchableOpacity
					style={styles.jobContent}
					onPress={() => setSelectedJobId(isSelected ? null : item.id)}
				>
					<Image
						source={{
							uri: item.thumbnail || "https://via.placeholder.com/120x68",
						}}
						style={styles.thumbnail}
						resizeMode="cover"
					/>
					<View style={styles.jobInfo}>
						<Text style={styles.jobTitle} numberOfLines={2}>
							{item.title}
						</Text>
						<Text style={styles.jobType}>
							{item.mediaType === "video" ? "Video" : "Ses"}
						</Text>
						<View style={styles.jobMeta}>
							{renderStatus(item.status)}
							<Text style={styles.jobDate}>
								{new Date(item.createdAt).toLocaleDateString()}
							</Text>
						</View>
					</View>
					<Ionicons
						name={isSelected ? "chevron-up" : "chevron-down"}
						size={20}
						color="#666"
					/>
				</TouchableOpacity>

				{item.status === "downloading" && (
					<View style={styles.progressContainer}>
						<View
							style={[styles.progressBar, { width: `${item.progress * 100}%` }]}
						/>
						<Text style={styles.progressText}>
							{Math.round(item.progress * 100)}%
						</Text>
					</View>
				)}

				{isSelected && (
					<View style={styles.actionsContainer}>
						{item.status === "completed" && (
							<>
								<TouchableOpacity
									style={styles.actionButton}
									onPress={() => handleShareFile(item)}
								>
									<Ionicons name="share-outline" size={20} color="#0066cc" />
									<Text style={styles.actionText}>Paylaş</Text>
								</TouchableOpacity>
								{item.mediaType === "video" && (
									<TouchableOpacity
										style={styles.actionButton}
										onPress={() => handleSaveToGallery(item)}
									>
										<Ionicons name="save-outline" size={20} color="#4CAF50" />
										<Text style={styles.actionText}>Galeriye Kaydet</Text>
									</TouchableOpacity>
								)}
							</>
						)}
						{(item.status === "queued" || item.status === "downloading") && (
							<TouchableOpacity
								style={styles.actionButton}
								onPress={() => handleCancelDownload(item)}
							>
								<Ionicons
									name="stop-circle-outline"
									size={20}
									color="#FF9800"
								/>
								<Text style={styles.actionText}>İptal Et</Text>
							</TouchableOpacity>
						)}
						<TouchableOpacity
							style={styles.actionButton}
							onPress={() => handleDeleteJob(item)}
						>
							<Ionicons name="trash-outline" size={20} color="#F44336" />
							<Text style={styles.actionText}>Sil</Text>
						</TouchableOpacity>
					</View>
				)}

				{item.status === "failed" && item.error && (
					<View style={styles.errorContainer}>
						<Text style={styles.errorText}>{item.error}</Text>
					</View>
				)}
			</View>
		);
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>İndirilenler</Text>
			</View>

			{jobs.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Ionicons name="cloud-download-outline" size={64} color="#ccc" />
					<Text style={styles.emptyText}>İndirme listeniz boş</Text>
					<Text style={styles.emptySubtext}>
						YouTube'dan indirmek istediğiniz videoları burada göreceksiniz
					</Text>
				</View>
			) : (
				<FlatList
					data={jobs}
					renderItem={renderJobItem}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.listContainer}
					refreshing={refreshing}
					onRefresh={handleRefresh}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f5f5",
	},
	header: {
		paddingVertical: 16,
		paddingHorizontal: 20,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e1e1",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#333",
	},
	listContainer: {
		padding: 16,
	},
	jobItem: {
		backgroundColor: "#fff",
		borderRadius: 10,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	jobContent: {
		flexDirection: "row",
		padding: 12,
		alignItems: "center",
	},
	thumbnail: {
		width: 80,
		height: 45,
		borderRadius: 4,
		backgroundColor: "#f0f0f0",
	},
	jobInfo: {
		flex: 1,
		marginLeft: 12,
	},
	jobTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
		marginBottom: 4,
	},
	jobType: {
		fontSize: 12,
		color: "#666",
		marginBottom: 4,
	},
	jobMeta: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	jobDate: {
		fontSize: 11,
		color: "#999",
	},
	statusContainer: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	statusIcon: {
		marginRight: 4,
	},
	statusText: {
		fontSize: 10,
		fontWeight: "500",
	},
	progressContainer: {
		height: 4,
		backgroundColor: "#e0e0e0",
		width: "100%",
		position: "relative",
	},
	progressBar: {
		height: "100%",
		backgroundColor: "#0066cc",
	},
	progressText: {
		position: "absolute",
		right: 6,
		top: 4,
		fontSize: 10,
		color: "#666",
	},
	actionsContainer: {
		flexDirection: "row",
		padding: 12,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
		justifyContent: "space-around",
	},
	actionButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	actionText: {
		marginLeft: 4,
		fontSize: 12,
		color: "#333",
	},
	errorContainer: {
		padding: 8,
		backgroundColor: "#ffebee",
		borderTopWidth: 1,
		borderTopColor: "#ffcdd2",
	},
	errorText: {
		fontSize: 12,
		color: "#F44336",
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	emptyText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#666",
		marginTop: 16,
	},
	emptySubtext: {
		fontSize: 14,
		color: "#999",
		textAlign: "center",
		marginTop: 8,
	},
});
