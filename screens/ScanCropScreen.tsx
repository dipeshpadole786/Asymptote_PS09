import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { AppHeader, GlassCard, PrimaryButton, Screen, SecondaryButton } from "../components/ui";
import { useFarm } from "../context/FarmContext";
import { useRequireSession } from "../hooks/useRequireSession";
import { predictCropImage, type CropScan } from "../services/predictService";
import { colors } from "../theme/colors";
import type { RootStackParamList } from "./WelcomeScreen";

type Props = NativeStackScreenProps<RootStackParamList, "ScanCrop">;

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ScanCropScreen({ navigation }: Props) {
  const { setScan } = useFarm();
  useRequireSession();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CropScan | null>(null);

  const takePhoto = async (useCamera: boolean) => {
    setError(null);
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera permission is needed to photograph the crop. You can still choose a saved photo.");
        return;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo permission is needed to choose a saved picture.");
        return;
      }
    }
    const picked = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.5,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.5,
          base64: true,
        });
    if (picked.canceled || !picked.assets[0]) {
      return;
    }
    const asset = picked.assets[0];
    if (!asset.base64) {
      setError("This photo could not be prepared. Try another one.");
      return;
    }
    setPhotoUri(asset.uri);
    setPhotoBase64(asset.base64);
    setResult(null);
  };

  const detect = async () => {
    if (!photoBase64) {
      setError("Take a photo or choose one first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const prediction = await predictCropImage(photoBase64);
      setResult(prediction);
      setScan(prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The crop check failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader title="Scan crop" subtitle="Photo, then the existing model" onBack={() => navigation.goBack()} />
        <Text style={styles.help}>
          Photograph one leaf in daylight, or choose a photo already on the phone.
        </Text>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}
        <SecondaryButton label="Take photo" icon="camera" onPress={() => void takePhoto(true)} disabled={busy} />
        <SecondaryButton label="Choose photo" icon="image" onPress={() => void takePhoto(false)} disabled={busy} />
        <PrimaryButton label={busy ? "Checking the leaf..." : "Detect disease"} onPress={() => void detect()} disabled={busy || !photoBase64} />
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {result ? (
          <GlassCard>
            <Text style={styles.kicker}>Model result</Text>
            <Text style={styles.line}>Crop: {titleCase(result.crop)}</Text>
            <Text style={styles.line}>Disease: {titleCase(result.disease)}</Text>
            <Text style={styles.line}>Confidence: {Math.round(result.confidence * 100)}%</Text>
            {result.diseaseConfidence > 0 ? (
              <Text style={styles.note}>Disease confidence: {Math.round(result.diseaseConfidence * 100)}%</Text>
            ) : null}
            {result.note ? <Text style={styles.note}>{result.note}</Text> : null}
          </GlassCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  help: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
  },
  error: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.danger,
  },
  kicker: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  line: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  note: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },
});
