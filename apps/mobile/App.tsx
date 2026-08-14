import { StatusBar } from "expo-status-bar";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const metrics = [
  { label: "Sales today", value: "₹48,250", trend: "+12%" },
  { label: "Purchases", value: "₹18,900", trend: "6 bills" },
  { label: "Low stock", value: "14", trend: "Needs refill" },
  { label: "GST payable", value: "₹7,842", trend: "This month" },
];

const actions = [
  "Add sale",
  "Add purchase",
  "Add product",
  "Open POS",
];

const recent = [
  { title: "INV-2026-0042", subtitle: "Even Better Stores", amount: "₹12,400" },
  { title: "PUR-2026-0018", subtitle: "Kumar Distributors", amount: "₹8,920" },
  { title: "INV-2026-0041", subtitle: "Walk-in POS", amount: "₹2,310" },
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>GSTFY Mobile</Text>
            <Text style={styles.title}>Store operations</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>GF</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Emergency POS</Text>
          <Text style={styles.heroTitle}>Bill fast when the counter is busy.</Text>
          <Text style={styles.heroBody}>
            Create quick sales, add products, and keep branch activity synced with
            the web dashboard.
          </Text>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start POS session</Text>
          </Pressable>
        </View>

        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricTrend}>{metric.trend}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionHint}>Counter-ready shortcuts</Text>
        </View>
        <View style={styles.actionGrid}>
          {actions.map((action) => (
            <Pressable key={action} style={styles.actionButton}>
              <Text style={styles.actionText}>{action}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Text style={styles.sectionHint}>Sales and purchases</Text>
        </View>
        <View style={styles.list}>
          {recent.map((item) => (
            <View key={item.title} style={styles.listItem}>
              <View>
                <Text style={styles.listTitle}>{item.title}</Text>
                <Text style={styles.listSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.listAmount}>{item.amount}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f7f4",
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 4,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  hero: {
    backgroundColor: "#102a24",
    borderRadius: 28,
    gap: 10,
    overflow: "hidden",
    padding: 22,
  },
  heroLabel: {
    color: "#8ee6c5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 31,
  },
  heroBody: {
    color: "#c8d8d3",
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#102a24",
    fontSize: 13,
    fontWeight: "800",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    padding: 16,
  },
  metricLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  metricTrend: {
    color: "#1d9e75",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  sectionHint: {
    color: "#6b7280",
    fontSize: 13,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    paddingVertical: 16,
  },
  actionText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  list: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  listItem: {
    alignItems: "center",
    borderBottomColor: "#f0f1f2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  listTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  listSubtitle: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  listAmount: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
});
