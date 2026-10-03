import { StyleSheet, Text, View } from "react-native";
import type { IrrigationDecision } from "../logic/irrigationLogic";
import { colors } from "../theme/colors";
import { GlassCard } from "./ui";

export function MotorStatusCard({
  decision,
  cropName,
  stageName,
}: {
  decision: IrrigationDecision;
  cropName: string;
  stageName: string;
}) {
  const label = decision.decided ? decision.motor : "—";
  const on = decision.decided && decision.motor === "ON";

  return (
    <GlassCard>
      <Text style={styles.kicker}>Motor</Text>
      <View style={[styles.pill, on ? styles.pillOn : styles.pillOff]}>
        <Text style={[styles.pillText, on ? styles.pillTextOn : styles.pillTextOff]}>
          {label}
        </Text>
      </View>
      <Text style={styles.reason} maxFontSizeMultiplier={1.25}>
        {decision.reason}
      </Text>
      <Text style={styles.rule}>
        For {cropName} at {stageName.toLowerCase()}, water when moisture is below{" "}
        {decision.lowThreshold}%.
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  pill: {
    alignSelf: "flex-start",
    marginTop: 10,
    minWidth: 96,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  pillOn: {
    backgroundColor: colors.accent,
  },
  pillOff: {
    backgroundColor: colors.primarySoft,
  },
  pillText: {
    fontSize: 28,
    fontWeight: "800",
  },
  pillTextOn: {
    color: colors.white,
  },
  pillTextOff: {
    color: colors.primary,
  },
  reason: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  rule: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
