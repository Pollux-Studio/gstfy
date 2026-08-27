"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  GalleryVerticalEndIcon,
  LinkIcon,
  Loader2Icon,
  SendIcon,
} from "lucide-react";

import LightRays from "@/components/light-rays";
import { GradientWaveText } from "@/components/gradient-wave-text";
import { Signature } from "@/components/signature";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/api";
import {
  getStoredAuthSession,
  subscribeToAuthSessionChange,
} from "@/lib/auth/session";
import {
  getFeedbackStatus,
  submitFeedback,
  type FeedbackCategory,
} from "@/lib/feedback/api";

type FeedbackFormState = {
  category: FeedbackCategory;
  rating: number;
  effortScore: number;
  message: string;
  contactConsent: boolean;
};

type SurveyStepId = "category" | "feeling" | "effort" | "feedback";

const surveySteps: Array<{
  id: SurveyStepId;
  title: string;
  description: string;
}> = [
  {
    id: "category",
    title: "What should we fix?",
    description: "Choose the area that needs attention first.",
  },
  {
    id: "feeling",
    title: "How did it feel?",
    description: "Tell us the overall experience in one tap.",
  },
  {
    id: "effort",
    title: "How much effort did it take?",
    description: "This helps us find the workflows that need simplification.",
  },
  {
    id: "feedback",
    title: "What should change?",
    description: "Write the exact issue or improvement. Keep it practical.",
  },
];

const categoryOptions: Array<{
  value: FeedbackCategory;
  label: string;
  emoji: string;
}> = [
  {
    value: "ease_of_use",
    label: "Ease of use",
    emoji: "✨",
  },
  {
    value: "billing_pos",
    label: "Billing or POS",
    emoji: "🧾",
  },
  {
    value: "gst_filing",
    label: "GST filing",
    emoji: "✅",
  },
  {
    value: "inventory",
    label: "Inventory",
    emoji: "📦",
  },
  {
    value: "payments",
    label: "Payments",
    emoji: "💸",
  },
  {
    value: "performance",
    label: "Speed",
    emoji: "⚡",
  },
  {
    value: "bug",
    label: "Bug",
    emoji: "🐞",
  },
  {
    value: "feature_request",
    label: "Feature",
    emoji: "💡",
  },
  {
    value: "other",
    label: "Other",
    emoji: "📝",
  },
];

const ratingOptions = [
  { value: 1, label: "Poor", emoji: "😣" },
  { value: 2, label: "Hard", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "🙂" },
  { value: 4, label: "Good", emoji: "😄" },
  { value: 5, label: "Great", emoji: "🤩" },
];

const effortOptions = [
  { value: 1, label: "Too hard", emoji: "🧱" },
  { value: 2, label: "Slow", emoji: "🐌" },
  { value: 3, label: "Manageable", emoji: "👌" },
  { value: 4, label: "Easy", emoji: "🚀" },
  { value: 5, label: "Very easy", emoji: "⚡" },
];

const initialFormState: FeedbackFormState = {
  category: "ease_of_use",
  rating: 4,
  effortScore: 4,
  message: "",
  contactConsent: true,
};

const confettiPieces = [
  { left: "18%", x: -70, y: -120, color: "bg-blue-500", delay: 0 },
  { left: "25%", x: -30, y: -160, color: "bg-emerald-500", delay: 0.03 },
  { left: "34%", x: 20, y: -130, color: "bg-amber-400", delay: 0.06 },
  { left: "43%", x: -45, y: -180, color: "bg-red-400", delay: 0.02 },
  { left: "51%", x: 45, y: -150, color: "bg-blue-400", delay: 0.07 },
  { left: "60%", x: 75, y: -125, color: "bg-emerald-400", delay: 0.04 },
  { left: "68%", x: 30, y: -175, color: "bg-amber-500", delay: 0.08 },
  { left: "76%", x: 95, y: -145, color: "bg-red-500", delay: 0.05 },
];

export function FeedbackPage() {
  const [form, setForm] = React.useState<FeedbackFormState>(initialFormState);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [surveyStarted, setSurveyStarted] = React.useState(false);
  const [surveyStepIndex, setSurveyStepIndex] = React.useState(0);
  const queryClient = useQueryClient();
  const sessionSnapshot = React.useSyncExternalStore(
    subscribeToAuthSessionChange,
    getStoredAuthSession,
    () => null,
  );
  const accountType = sessionSnapshot?.accountType ?? "business";
  const userId = sessionSnapshot?.user.id ?? "";
  const accessToken = sessionSnapshot?.session.accessToken ?? "";
  const messageLength = form.message.trim().length;
  const canSubmit = messageLength >= 10;
  const currentStep = surveySteps[surveyStepIndex] ?? surveySteps[0];
  const isLastStep = surveyStepIndex === surveySteps.length - 1;
  const canContinue = currentStep.id !== "feedback" || canSubmit;
  const feedbackStatusQueryKey = React.useMemo(
    () => [
      "feedback",
      "status",
      accountType,
      userId,
      sessionSnapshot?.tenant?.id ?? null,
    ],
    [accountType, userId, sessionSnapshot?.tenant?.id],
  );
  const { data: currentUser } = useQuery({
    queryKey: ["auth", "current-user", accountType, userId],
    queryFn: () => getCurrentUser(accessToken),
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const { data: feedbackStatus } = useQuery({
    queryKey: feedbackStatusQueryKey,
    queryFn: () => getFeedbackStatus(accessToken, accountType),
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60,
  });
  const primaryMembership =
    currentUser?.memberships.find(
      (membership) => membership.business_id === sessionSnapshot?.tenant?.id,
    ) ??
    currentUser?.memberships.find(
      (membership) => membership.status === "active",
    ) ??
    currentUser?.memberships[0] ??
    null;
  const workspaceLogoUrl = primaryMembership?.logo_url ?? null;
  const workspaceName =
    primaryMembership?.business_name ??
    sessionSnapshot?.tenant?.tradeName ??
    sessionSnapshot?.tenant?.legalName ??
    "GSTFY";
  const submittedFeedback =
    feedbackStatus && !feedbackStatus.canSubmit ?
      feedbackStatus.latestFeedback
    : null;
  const mutation = useMutation({
    mutationFn: () => {
      const session = getStoredAuthSession();

      if (!session) {
        throw new Error("Sign in again to send feedback.");
      }

      return submitFeedback(
        {
          accountType: session.accountType,
          category: form.category,
          rating: form.rating,
          effortScore: form.effortScore,
          message: form.message.trim(),
          pageUrl: getCurrentPageUrl(),
          contactConsent: form.contactConsent,
        },
        session.session.accessToken,
      );
    },
    onSuccess: (response) => {
      queryClient.setQueryData(feedbackStatusQueryKey, {
        canSubmit: false,
        latestFeedback: {
          id: response.feedback.id,
          status: response.feedback.status,
          category: form.category,
          rating: form.rating,
          effortScore: form.effortScore,
          createdAt: response.feedback.createdAt,
        },
        nextAllowedAt: response.nextAllowedAt,
      });
      setForm(initialFormState);
      setShowConfetti(true);
      setSurveyStarted(false);
      setSurveyStepIndex(0);
      toast.success("Feedback sent.", {
        description: "We received your survey response.",
      });
      window.setTimeout(() => setShowConfetti(false), 1200);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
  const startSurvey = () => {
    if (submittedFeedback) {
      return;
    }

    setSurveyStepIndex(0);
    setSurveyStarted(true);
  };
  const goBack = () => {
    if (mutation.isPending) {
      return;
    }

    if (surveyStepIndex === 0) {
      setSurveyStarted(false);
      return;
    }

    setSurveyStepIndex((current) => Math.max(current - 1, 0));
  };
  const goNext = () => {
    if (!canContinue || mutation.isPending) {
      return;
    }

    if (isLastStep) {
      mutation.mutate();
      return;
    }

    setSurveyStepIndex((current) =>
      Math.min(current + 1, surveySteps.length - 1),
    );
  };

  return (
    <main className="relative isolate h-[calc(100dvh-4rem)] w-full overflow-hidden bg-background px-4 py-2 text-foreground sm:px-6 lg:px-8">
      <AnimatePresence>
        {showConfetti ? <ConfettiBurst /> : null}
      </AnimatePresence>
      <LightRays
        intensity={38}
        rays={60}
        reach={38}
        position={46}
        backgroundColor="var(--background)"
        raysColor={{ mode: "multi", color1: "#93c5fd", color2: "#1d4ed8" }}
        className="opacity-100"
        style={{ zIndex: 0 }}
      />
      <AnimatePresence mode="wait">
        {submittedFeedback ? (
          <motion.section
            key="feedback-submitted"
            className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <FeedbackSubmittedPanel
              submittedAt={submittedFeedback.createdAt}
              nextAllowedAt={feedbackStatus?.nextAllowedAt ?? null}
            />
          </motion.section>
        ) : !surveyStarted ? (
          <motion.section
            key="feedback-start"
            className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <FeedbackHeroPanel
              logoUrl={workspaceLogoUrl}
              workspaceName={workspaceName}
              onStart={startSurvey}
            />
          </motion.section>
        ) : (
          <motion.form
            key="feedback-survey"
            className="relative z-10 mx-auto flex h-full w-full max-w-5xl items-center justify-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={(event) => {
              event.preventDefault();
              goNext();
            }}
          >
            <section className="w-full">
              <header className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-200">
                  Step {surveyStepIndex + 1} of {surveySteps.length}
                </p>
                <StepProgress activeIndex={surveyStepIndex} />
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-blue-950 dark:text-blue-50 sm:text-4xl">
                  {currentStep.title}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {currentStep.description}
                </p>
                <div className="mt-4">
                  <WorkspaceLogoMark
                    logoUrl={workspaceLogoUrl}
                    name={workspaceName}
                  />
                </div>
              </header>

              <AnimatePresence mode="wait">
                <SurveyStepContent
                  key={currentStep.id}
                  step={currentStep.id}
                  form={form}
                  messageLength={messageLength}
                  setForm={setForm}
                />
              </AnimatePresence>

              <footer className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 bg-white/56 backdrop-blur dark:bg-slate-950/40"
                  disabled={mutation.isPending}
                  onClick={goBack}
                >
                  {surveyStepIndex === 0 ? "Cancel" : "Back"}
                </Button>
                <Button
                  type="submit"
                  className="h-9 bg-blue-600 text-white hover:bg-blue-700 sm:min-w-32"
                  disabled={!canContinue || mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : isLastStep ? (
                    <>
                      <SendIcon className="size-4" />
                      Send
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </footer>
            </section>
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  );
}

function FeedbackHeroPanel({
  logoUrl,
  workspaceName,
  compact = false,
  onStart,
}: {
  logoUrl: string | null;
  workspaceName: string;
  compact?: boolean;
  onStart?: () => void;
}) {
  return (
    <motion.div
      className={cn(
        "flex flex-col items-center p-0 text-center",
        compact ? "items-center lg:items-start lg:text-left" : "max-w-2xl",
      )}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.06 }}
    >
      <WorkspaceLogoMark
        logoUrl={logoUrl}
        name={workspaceName}
        compact={compact}
      />
      <div className={cn("mt-4 space-y-0.5", compact && "mt-2 lg:text-left")}>
        <GradientWaveText
          align={compact ? "left" : "center"}
          repeat
          speed={0.62}
          bottomOffset={0}
          customColors={["#1d4ed8", "#38bdf8", "#2563eb", "#0f172a"]}
          className={cn(
            "h-auto min-h-0 text-3xl font-semibold leading-tight tracking-tight [--gradient-wave-base:rgb(15,23,42)] dark:[--gradient-wave-base:rgb(255,255,255)]",
            compact ? "text-2xl sm:text-3xl" : "sm:text-4xl",
          )}
        >
          Tell us what to fix next
        </GradientWaveText>
        <p className="text-sm font-medium leading-5 text-blue-900/75 dark:text-blue-100/85">
          Your feedback becomes fixes.
        </p>
      </div>
      <p
        className={cn(
          "mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground",
          compact && "max-w-sm",
        )}
      >
        {compact
          ? "Pick the area, rate the effort, and write the exact fix needed."
          : "Tell us what slowed down billing, GST filing, inventory, or payments. We use repeated feedback to decide the next product fix."}
      </p>
      {!compact ? (
        <>
          <p className="mt-3.5 text-xs font-medium text-blue-700 dark:text-blue-200">
            2 min survey · dealer-first fixes · no support ticket
          </p>
          <Button
            type="button"
            className="mt-3 h-9 bg-blue-600 px-5 text-white hover:bg-blue-700"
            onClick={onStart}
          >
            Start survey
            <ArrowRightIcon className="size-4" />
          </Button>
        </>
      ) : null}
    </motion.div>
  );
}

function FeedbackSubmittedPanel({
  submittedAt,
  nextAllowedAt,
}: {
  submittedAt: string;
  nextAllowedAt: string | null;
}) {
  return (
    <motion.div
      className="flex max-w-2xl flex-col items-center p-0 text-center"
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.06 }}
    >
      <div className="mt-5 flex size-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/45 dark:text-emerald-200">
        <CheckCircle2Icon className="size-7" />
      </div>
      <GradientWaveText
        align="center"
        repeat
        speed={0.62}
        bottomOffset={0}
        customColors={["#1d4ed8", "#38bdf8", "#2563eb", "#0f172a"]}
        className="mt-4 h-auto min-h-0 text-3xl font-semibold leading-tight tracking-tight [--gradient-wave-base:rgb(15,23,42)] dark:[--gradient-wave-base:rgb(255,255,255)] sm:text-4xl"
      >
        Your feedback is submitted
      </GradientWaveText>
      <p className="mt-2 text-sm font-medium text-blue-900/75 dark:text-blue-100/85">
        Sent on {formatFeedbackDate(submittedAt)}
      </p>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        We lock repeat feedback for 7 days so repeated signals stay clean. You
        can send the next feedback after {formatFeedbackDate(nextAllowedAt)}.
      </p>
      <div className="mt-5 flex items-center justify-center overflow-visible py-2">
        <Signature
          text="Gstfy"
          color="#2563eb"
          fontSize={28}
          duration={2}
          className="h-16 overflow-visible"
        />
      </div>
    </motion.div>
  );
}

function StepProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="mt-2 flex w-full max-w-56 items-center gap-2">
      {surveySteps.map((step, index) => (
        <span
          key={step.id}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            index <= activeIndex
              ? "bg-blue-600"
              : "bg-blue-100 dark:bg-blue-950/70",
          )}
        />
      ))}
    </div>
  );
}

function SurveyStepContent({
  step,
  form,
  messageLength,
  setForm,
}: {
  step: SurveyStepId;
  form: FeedbackFormState;
  messageLength: number;
  setForm: React.Dispatch<React.SetStateAction<FeedbackFormState>>;
}) {
  return (
    <motion.div
      className="mx-auto mt-6 flex min-h-[12rem] w-full max-w-4xl flex-wrap content-center items-center justify-center gap-x-3 gap-y-3 pt-2 text-center"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -18, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {step === "category" ? (
        <>
          {categoryOptions.map((option, index) => (
            <SurveyTile
              key={option.value}
              active={form.category === option.value}
              emoji={option.emoji}
              label={option.label}
              index={index}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  category: option.value,
                }))
              }
            />
          ))}
        </>
      ) : null}

      {step === "feeling" ? (
        <ScoreSelector
          groupId="experience"
          value={form.rating}
          options={ratingOptions}
          onChange={(rating) => setForm((current) => ({ ...current, rating }))}
        />
      ) : null}

      {step === "effort" ? (
        <ScoreSelector
          groupId="effort"
          value={form.effortScore}
          options={effortOptions}
          onChange={(effortScore) =>
            setForm((current) => ({ ...current, effortScore }))
          }
        />
      ) : null}

      {step === "feedback" ? (
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between gap-3 text-xs font-medium">
              <span>Feedback</span>
              <span
                className={cn(
                  "text-xs font-normal tabular-nums",
                  messageLength < 10
                    ? "text-amber-600"
                    : "text-muted-foreground",
                )}
              >
                {messageLength}/2000
              </span>
            </span>
            <Textarea
              value={form.message}
              maxLength={2000}
              rows={5}
              placeholder="Tell us the screen and what felt wrong."
              className="min-h-32 resize-none rounded-2xl border-blue-100 bg-white/64 text-sm backdrop-blur dark:border-blue-900/60 dark:bg-slate-950/52"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  message: event.target.value,
                }))
              }
            />
          </label>

          <button
            type="button"
            aria-pressed={form.contactConsent}
            className="mx-auto flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() =>
              setForm((current) => ({
                ...current,
                contactConsent: !current.contactConsent,
              }))
            }
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-md border",
                form.contactConsent
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-white/56 backdrop-blur dark:bg-slate-950/40",
              )}
            >
              {form.contactConsent ? (
                <CheckCircle2Icon className="size-3.5" />
              ) : null}
            </span>
            Contact me if needed
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}

function WorkspaceLogoMark({
  logoUrl,
  name,
  compact = false,
}: {
  logoUrl: string | null;
  name: string;
  compact?: boolean;
}) {
  const normalizedLogoUrl = logoUrl?.trim();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-blue-700 dark:text-blue-200",
        compact && "gap-1.5",
      )}
      aria-label={`${name} connected to GSTFY`}
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-blue-100 bg-white/64 text-blue-700 backdrop-blur dark:border-blue-900/60 dark:bg-slate-950/52 dark:text-blue-200",
          compact ? "size-9" : "size-12",
        )}
      >
        <GalleryVerticalEndIcon
          className={compact ? "size-4" : "size-6"}
          aria-hidden="true"
        />
        <span className="sr-only">GSTFY</span>
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-white",
          compact ? "size-5" : "size-6",
        )}
        aria-hidden="true"
      >
        <LinkIcon className="size-3" />
      </span>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-blue-100 bg-white/64 text-sm font-semibold text-blue-700 backdrop-blur dark:border-blue-900/60 dark:bg-slate-950/52 dark:text-blue-200",
          compact ? "size-9" : "size-12",
        )}
      >
        {normalizedLogoUrl ? (
          <Image
            src={normalizedLogoUrl}
            alt={`${name} logo`}
            fill
            sizes={compact ? "36px" : "48px"}
            className="rounded-[inherit] object-cover"
          />
        ) : (
          <span aria-hidden="true">{getInitials(name)}</span>
        )}
      </span>
    </span>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SurveyTile({
  active,
  emoji,
  label,
  index,
  onClick,
}: {
  active: boolean;
  emoji: string;
  label: string;
  index: number;
  onClick: () => void;
}) {
  const offsetClass = organicOptionClasses[index % organicOptionClasses.length];

  return (
    <motion.button
      type="button"
      aria-pressed={active}
      className={cn(
        "group relative flex min-w-32 items-center gap-2 overflow-hidden rounded-2xl border px-3 py-2 text-left shadow-sm backdrop-blur transition-colors",
        active
          ? "border-blue-300 bg-blue-50/90 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/45 dark:text-blue-50"
          : "border-blue-100 bg-white/54 hover:bg-white/76 dark:border-blue-900/50 dark:bg-slate-950/44 dark:hover:bg-slate-950/60",
        offsetClass,
      )}
      whileHover={{ y: -2, rotate: active ? 0 : 0.5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {active ? (
        <>
          <motion.span
            layoutId="active-feedback-category"
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/14 via-sky-400/14 to-cyan-300/12"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
          <motion.span
            className="absolute -right-5 -top-6 size-16 rounded-full bg-blue-500/20 blur-xl"
            initial={{ scale: 0.65, opacity: 0 }}
            animate={{ scale: [0.9, 1.15, 0.95], opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}
      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-xl text-base transition-transform group-hover:rotate-[-8deg]",
          active ? "bg-blue-600 text-white" : "bg-blue-50 text-foreground",
        )}
      >
        <motion.span
          key={`${label}-${active ? "active" : "idle"}`}
          animate={
            active
              ? { scale: [1, 1.2, 1], rotate: [0, -8, 5, 0] }
              : { scale: 1 }
          }
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          {emoji}
        </motion.span>
      </span>
      <span className="relative z-10 min-w-0">
        <span className="block text-sm font-medium">{label}</span>
      </span>
    </motion.button>
  );
}

const organicOptionClasses = [
  "-rotate-2 translate-y-0.5",
  "rotate-1 -translate-y-0.5",
  "-rotate-1 translate-y-1",
  "rotate-2",
  "translate-y-0.5",
  "-rotate-2 -translate-y-0.5",
  "rotate-1 translate-y-1",
  "-rotate-1",
  "rotate-2 -translate-y-0.5",
];

function ScoreSelector({
  groupId,
  value,
  options,
  onChange,
}: {
  groupId: string;
  value: number;
  options: Array<{ value: number; label: string; emoji: string }>;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-4">
      {options.map((option, index) => (
        <motion.button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(
            "relative min-w-24 overflow-hidden rounded-3xl border px-4 py-3 text-center shadow-sm backdrop-blur transition-colors",
            value === option.value
              ? "border-blue-300 bg-blue-50/90 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/45 dark:text-blue-50"
              : "border-blue-100 bg-white/54 text-muted-foreground hover:bg-white/76 dark:border-blue-900/50 dark:bg-slate-950/44 dark:hover:bg-slate-950/60",
            organicOptionClasses[index % organicOptionClasses.length],
          )}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onChange(option.value)}
        >
          {value === option.value ? (
            <motion.span
              layoutId={`${groupId}-active-score`}
              className="absolute inset-0 rounded-3xl bg-gradient-to-b from-blue-300/22 to-sky-300/16"
              transition={{ type: "spring", stiffness: 430, damping: 32 }}
            />
          ) : null}
          <motion.span
            key={`${groupId}-${option.value}-${value === option.value ? "active" : "idle"}`}
            className="relative z-10 block text-3xl leading-none"
            animate={
              value === option.value
                ? { y: [0, -3, 0], scale: [1, 1.16, 1] }
                : { y: 0, scale: 1 }
            }
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            {option.emoji}
          </motion.span>
          <span className="relative z-10 mt-2 block text-sm font-medium">
            {option.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

/*
 * Old survey card layout removed: the active survey is now a transparent
 * centered stage with organic option placement.
 */
/*
                <WorkspaceLogoMark
                  logoUrl={workspaceLogoUrl}
                  name={workspaceName}
                  compact
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-200">
                    Step {surveyStepIndex + 1} of {surveySteps.length}
                  </p>
                  <h2 className="truncate text-xl font-semibold tracking-tight">
                    {currentStep.title}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {currentStep.description}
                  </p>
                </div>
              </header>

              <StepProgress activeIndex={surveyStepIndex} />

              <AnimatePresence mode="wait">
                <SurveyStepContent
                  key={currentStep.id}
                  step={currentStep.id}
                  form={form}
                  messageLength={messageLength}
                  setForm={setForm}
                />
              </AnimatePresence>

              <footer className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  disabled={mutation.isPending}
                  onClick={goBack}
                >
                  {surveyStepIndex === 0 ? "Cancel" : "Back"}
                </Button>
                <Button
                  type="submit"
                  className="h-9 bg-blue-600 text-white hover:bg-blue-700 sm:min-w-32"
                  disabled={!canContinue || mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : isLastStep ? (
                    <>
                      <SendIcon className="size-4" />
                      Send
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </footer>
            </section>
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  );
}

function FeedbackHeroPanel({
  logoUrl,
  workspaceName,
  compact = false,
  onStart,
}: {
  logoUrl: string | null;
  workspaceName: string;
  compact?: boolean;
  onStart?: () => void;
}) {
  return (
    <motion.div
      className={cn(
        "flex flex-col items-center p-0 text-center",
        compact ? "items-center lg:items-start lg:text-left" : "max-w-2xl",
      )}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.06 }}
    >
      <WorkspaceLogoMark
        logoUrl={logoUrl}
        name={workspaceName}
        compact={compact}
      />
      <div className={cn("mt-2 space-y-0.5", compact && "mt-1.5 lg:text-left")}>
        <GradientWaveText
          align={compact ? "left" : "center"}
          repeat
          speed={0.62}
          bottomOffset={0}
          customColors={["#1d4ed8", "#38bdf8", "#2563eb", "#0f172a"]}
          className={cn(
            "h-auto min-h-0 text-3xl font-semibold leading-tight tracking-tight [--gradient-wave-base:rgb(15,23,42)] dark:[--gradient-wave-base:rgb(255,255,255)]",
            compact ? "text-2xl sm:text-3xl" : "sm:text-4xl",
          )}
        >
          Tell us what to fix next
        </GradientWaveText>
        <p className="text-sm font-medium leading-5 text-blue-900/75 dark:text-blue-100/85">
          Your feedback becomes fixes.
        </p>
      </div>
      <p
        className={cn(
          "mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground",
          compact && "max-w-sm",
        )}
      >
        {compact
          ? "Pick the area, rate the effort, and write the exact fix needed."
          : "Tell us what slowed down billing, GST filing, inventory, or payments. We use repeated feedback to decide the next product fix."}
      </p>
      {!compact ? (
        <>
          <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-200">
            2 min survey · dealer-first fixes · no support ticket
          </p>
          <Button
            type="button"
            className="mt-3 h-9 bg-blue-600 px-5 text-white hover:bg-blue-700"
            onClick={onStart}
          >
            Start survey
          </Button>
        </>
      ) : null}
    </motion.div>
  );
}

function StepProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="my-3 flex items-center gap-2">
      {surveySteps.map((step, index) => (
        <span
          key={step.id}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            index <= activeIndex
              ? "bg-blue-600"
              : "bg-blue-100 dark:bg-blue-950/70",
          )}
        />
      ))}
    </div>
  );
}

function SurveyStepContent({
  step,
  form,
  messageLength,
  setForm,
}: {
  step: SurveyStepId;
  form: FeedbackFormState;
  messageLength: number;
  setForm: React.Dispatch<React.SetStateAction<FeedbackFormState>>;
}) {
  return (
    <motion.div
      className="min-h-[16rem]"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {step === "category" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categoryOptions.map((option) => (
            <SurveyTile
              key={option.value}
              active={form.category === option.value}
              emoji={option.emoji}
              label={option.label}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  category: option.value,
                }))
              }
            />
          ))}
        </div>
      ) : null}

      {step === "feeling" ? (
        <div className="flex h-full items-center">
          <ScoreSelector
            groupId="experience"
            label="Feeling"
            value={form.rating}
            options={ratingOptions}
            onChange={(rating) =>
              setForm((current) => ({ ...current, rating }))
            }
          />
        </div>
      ) : null}

      {step === "effort" ? (
        <div className="flex h-full items-center">
          <ScoreSelector
            groupId="effort"
            label="Effort"
            value={form.effortScore}
            options={effortOptions}
            onChange={(effortScore) =>
              setForm((current) => ({ ...current, effortScore }))
            }
          />
        </div>
      ) : null}

      {step === "feedback" ? (
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between gap-3 text-xs font-medium">
              <span>Feedback</span>
              <span
                className={cn(
                  "text-xs font-normal tabular-nums",
                  messageLength < 10
                    ? "text-amber-600"
                    : "text-muted-foreground",
                )}
              >
                {messageLength}/2000
              </span>
            </span>
            <Textarea
              value={form.message}
              maxLength={2000}
              rows={5}
              placeholder="Tell us the screen and what felt wrong."
              className="min-h-32 resize-none rounded-2xl bg-background/80 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  message: event.target.value,
                }))
              }
            />
          </label>

          <button
            type="button"
            aria-pressed={form.contactConsent}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() =>
              setForm((current) => ({
                ...current,
                contactConsent: !current.contactConsent,
              }))
            }
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-md border",
                form.contactConsent
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-background",
              )}
            >
              {form.contactConsent ? (
                <CheckCircle2Icon className="size-3.5" />
              ) : null}
            </span>
            Contact me if needed
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}

function WorkspaceLogoMark({
  logoUrl,
  name,
  compact = false,
}: {
  logoUrl: string | null;
  name: string;
  compact?: boolean;
}) {
  const normalizedLogoUrl = logoUrl?.trim();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-blue-700 dark:text-blue-200",
        compact && "gap-1.5",
      )}
      aria-label={`${name} connected to GSTFY`}
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-blue-100 bg-white/64 text-blue-700 backdrop-blur dark:border-blue-900/60 dark:bg-slate-950/52 dark:text-blue-200",
          compact ? "size-9" : "size-12",
        )}
      >
        <GalleryVerticalEndIcon
          className={compact ? "size-4" : "size-6"}
          aria-hidden="true"
        />
        <span className="sr-only">GSTFY</span>
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-white",
          compact ? "size-5" : "size-6",
        )}
        aria-hidden="true"
      >
        <LinkIcon className="size-3" />
      </span>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-blue-100 bg-white/64 text-sm font-semibold text-blue-700 backdrop-blur dark:border-blue-900/60 dark:bg-slate-950/52 dark:text-blue-200",
          compact ? "size-9" : "size-12",
        )}
      >
        {normalizedLogoUrl ? (
          <Image
            src={normalizedLogoUrl}
            alt={`${name} logo`}
            fill
            sizes={compact ? "36px" : "48px"}
            className="rounded-[inherit] object-cover"
          />
        ) : (
          <span aria-hidden="true">{getInitials(name)}</span>
        )}
      </span>
    </span>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SurveyTile({
  active,
  emoji,
  label,
  onClick,
}: {
  active: boolean;
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      className={cn(
        "group relative flex items-center gap-1.5 overflow-hidden rounded-xl border p-2 text-left transition-colors",
        active
          ? "border-blue-300 bg-blue-50/90 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-50"
          : "border-border bg-background/80 hover:bg-muted/40",
      )}
      whileHover={{ y: -2, rotate: active ? -0.4 : 0.4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {active ? (
        <>
          <motion.span
            layoutId="active-feedback-category"
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/14 via-emerald-400/14 to-lime-300/12"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
          <motion.span
            className="absolute -right-5 -top-6 size-16 rounded-full bg-blue-500/20 blur-xl"
            initial={{ scale: 0.65, opacity: 0 }}
            animate={{ scale: [0.9, 1.15, 0.95], opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}
      <span
        className={cn(
          "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-lg text-sm transition-transform group-hover:rotate-[-8deg]",
          active ? "bg-blue-600 text-white" : "bg-muted text-foreground",
        )}
      >
        <motion.span
          key={`${label}-${active ? "active" : "idle"}`}
          animate={
            active
              ? { scale: [1, 1.2, 1], rotate: [0, -8, 5, 0] }
              : { scale: 1 }
          }
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          {emoji}
        </motion.span>
      </span>
      <span className="relative z-10 min-w-0">
        <span className="block text-xs font-medium">{label}</span>
      </span>
    </motion.button>
  );
}

function ScoreSelector({
  groupId,
  label,
  value,
  options,
  onChange,
}: {
  groupId: string;
  label: string;
  value: number;
  options: Array<{ value: number; label: string; emoji: string }>;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium">{label}</p>
        <span className="text-base leading-none">
          {options.find((option) => option.value === value)?.emoji}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {options.map((option) => (
          <motion.button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={cn(
              "relative overflow-hidden rounded-lg border px-1 py-1.5 text-center text-[11px] transition-colors",
              value === option.value
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/60",
            )}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(option.value)}
          >
            {value === option.value ? (
              <motion.span
                layoutId={`${groupId}-active-score`}
                className="absolute inset-0 rounded-xl bg-gradient-to-b from-emerald-300/22 to-blue-300/16"
                transition={{ type: "spring", stiffness: 430, damping: 32 }}
              />
            ) : null}
            <motion.span
              key={`${groupId}-${option.value}-${value === option.value ? "active" : "idle"}`}
              className="relative z-10 block text-base leading-none"
              animate={
                value === option.value
                  ? { y: [0, -3, 0], scale: [1, 1.16, 1] }
                  : { y: 0, scale: 1 }
              }
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              {option.emoji}
            </motion.span>
            <span className="relative z-10 mt-0.5 block truncate">
              {option.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

*/

function ConfettiBurst() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {confettiPieces.map((piece, index) => (
        <motion.span
          key={`${piece.left}-${index}`}
          className={cn(
            "absolute bottom-24 left-1/2 size-2 rounded-[2px]",
            piece.color,
          )}
          style={{ left: piece.left }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
          animate={{
            x: piece.x,
            y: piece.y,
            rotate: 220 + index * 35,
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 0.95,
            delay: piece.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </motion.div>
  );
}

function getCurrentPageUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function formatFeedbackDate(value: string | null) {
  if (!value) {
    return "the cooldown ends";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "the cooldown ends";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to send feedback right now.";
}
