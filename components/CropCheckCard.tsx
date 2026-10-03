import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CropScan } from "../services/predictService";
import { colors } from "../theme/colors";
import { GlassCard } from "./ui";

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function CropCheckCard({
  scan,
  onScan,
  onMap,
}: {
  scan: CropScan | null;
  onScan: () => void;
  onMap: () => void;
}) {
  return (
    <GlassCard>
      <Text style={styles.kicker}>Crop check</Text>
      {scan ? (
        <View>
          <Text style={styles.line}>Crop: {titleCase(scan.crop)}</Text>
          <Text style={styles.line}>Disease: {titleCase(scan.disease)}</Text>
          <Text style={styles.line}>Confidence: {percent(scan.confidence)}</Text>
          {scan.diseaseConfidence > 0 ? (
            <Text style={styles.note}>Disease confidence: {percent(scan.diseaseConfidence)}</Text>
          ) : null}
          {scan.note ? <Text style={styles.note}>{scan.note}</Text> : null}
        </View>
      ) : (
        <Text style={styles.note}>Take or choose a leaf photo to check the crop.</Text>
      )}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Scan crop" onPress={onScan} style={styles.button}>
          <Text style={styles.buttonText}>Scan crop</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Field map" onPress={onMap} style={styles.button}>
          <Text style={styles.buttonText}>Field map</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
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
  actions: {
    marginTop: 12,
    gap: 8,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
});
