import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type FormErrors = {
  identifier?: string;
  password?: string;
};

export default function App() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const nextErrors: FormErrors = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Enter your email or mobile number.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);
    setSubmitted(Object.keys(nextErrors).length === 0);
  };

  return (
    <GluestackUIProvider mode="light">
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Text style={styles.logoText}>G</Text>
              </View>
              <View>
                <Text style={styles.brandName}>GSTFY</Text>
                <Text style={styles.brandCaption}>Business workspace</Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroAccent} />
              <Text style={styles.heroEyebrow}>GST billing for stores</Text>
              <Text style={styles.heroTitle}>Sign in to your business account</Text>
              <Text style={styles.heroBody}>
                Open sales, purchases, inventory, and GST summaries from your mobile
                counter app.
              </Text>
              <View style={styles.trustRow}>
                <View style={styles.trustPill}>
                  <View style={styles.trustDot} />
                  <Text style={styles.trustText}>Secure login</Text>
                </View>
                <View style={styles.trustPill}>
                  <View style={styles.trustDot} />
                  <Text style={styles.trustText}>Branch ready</Text>
                </View>
              </View>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Welcome back</Text>
                <Text style={styles.formSubtitle}>
                  Use the same business login you use on the GSTFY web dashboard.
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email or mobile number</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={(value) => {
                    setIdentifier(value);
                    setErrors((current) => ({ ...current, identifier: undefined }));
                    setSubmitted(false);
                  }}
                  placeholder="owner@gstfy.in or 9876543210"
                  placeholderTextColor="#9ca3af"
                  style={[
                    styles.input,
                    errors.identifier ? styles.inputError : undefined,
                  ]}
                  value={identifier}
                />
                {errors.identifier ? (
                  <Text style={styles.errorText}>{errors.identifier}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <Pressable hitSlop={8}>
                    <Text style={styles.textAction}>Forgot?</Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.passwordShell,
                    errors.password ? styles.inputError : undefined,
                  ]}
                >
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(value) => {
                      setPassword(value);
                      setErrors((current) => ({ ...current, password: undefined }));
                      setSubmitted(false);
                    }}
                    placeholder="Enter password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                    value={password}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => setShowPassword((visible) => !visible)}
                  >
                    <Text style={styles.textAction}>
                      {showPassword ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed ? styles.primaryButtonPressed : undefined,
                ]}
              >
                <Text style={styles.primaryButtonText}>Login to business</Text>
              </Pressable>

              {submitted ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>
                    UI validated. Backend login integration will be connected next.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.footerCard}>
              <Text style={styles.footerTitle}>Business login only</Text>
              <Text style={styles.footerText}>
                Registration and CA login will stay separate, so shop staff only see
                the business flow here.
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </GluestackUIProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f5ef",
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 18,
    justifyContent: "center",
    padding: 20,
    paddingBottom: 28,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  logoText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  brandName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  brandCaption: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: "#172a24",
    borderRadius: 30,
    gap: 12,
    overflow: "hidden",
    padding: 22,
  },
  heroAccent: {
    backgroundColor: "#1d9e75",
    borderRadius: 999,
    height: 5,
    width: 54,
  },
  heroEyebrow: {
    color: "#8ee6c5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  heroBody: {
    color: "#c8d8d3",
    fontSize: 14,
    lineHeight: 21,
  },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 4,
  },
  trustPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  trustDot: {
    backgroundColor: "#2dd4a3",
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  trustText: {
    color: "#ecfdf5",
    fontSize: 12,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e7e3d8",
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  formHeader: {
    gap: 5,
  },
  formTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  formSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
  },
  field: {
    gap: 7,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#fbfaf7",
    borderColor: "#ded8cc",
    borderRadius: 16,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
    height: 48,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: "#dc2626",
  },
  passwordShell: {
    alignItems: "center",
    backgroundColor: "#fbfaf7",
    borderColor: "#ded8cc",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
  },
  passwordInput: {
    color: "#111827",
    flex: 1,
    fontSize: 15,
    height: 48,
  },
  textAction: {
    color: "#1d6fe8",
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    marginTop: 2,
  },
  primaryButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  successBox: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  successText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  footerCard: {
    backgroundColor: "#fffaf0",
    borderColor: "#efe3c8",
    borderRadius: 22,
    borderWidth: 1,
    gap: 4,
    padding: 15,
  },
  footerTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 17,
  },
});
