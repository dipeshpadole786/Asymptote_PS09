import { StyleSheet, Text, View } from "react-native";
import type { FarmAlert } from "../logic/plannerLogic";
import { colors } from "../theme/colors";
import { GlassCard } from "./ui";

const TONE = {
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.accentSoft, fg: colors.primary },
  ok: { bg: colors.okSoft, fg: colors.primary },
} as const;

export function AlertCard({ alerts }: { alerts: FarmAlert[] }) {
  const [first, ...rest] = alerts;

  return (
    <GlassCard>
      <Text style={styles.kicker}>Today's alert</Text>
      {first ? (
        <View style={[styles.banner, { backgroundColor: TONE[first.tone].bg }]}>
          <Text style={[styles.title, { color: TONE[first.tone].fg }]} maxFontSizeMultiplier={1.2}>
            {first.title}
          </Text>
          <Text style={styles.message} maxFontSizeMultiplier={1.25}>
            {first.message}
          </Text>
        </View>
      ) : (
        <Text style={styles.message}>No alert yet.</Text>
      )}
      {rest.map((alert) => (
        <View key={alert.id} style={styles.extra}>
          <Text style={[styles.extraTitle, { color: TONE[alert.tone].fg }]}>{alert.title}</Text>
          <Text style={styles.extraMessage}>{alert.message}</Text>
        </View>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  banner: {
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  message: {
    marginTop: 4,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  extra: {
    marginTop: 12,
  },
  extraTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  extraMessage: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
});
