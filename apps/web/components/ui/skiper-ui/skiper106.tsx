"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { cn } from "@/lib/utils";

type SmoothInputProps = React.ComponentProps<"input"> & {
  wrapperClassName?: string;
};

type SmoothTextareaProps = React.ComponentProps<"textarea"> & {
  wrapperClassName?: string;
};

const defaultInputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-inset aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const defaultTextareaClassName =
  "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-inset aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const inputGroupControlClassName =
  "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent";

const smoothTextInputTypes = new Set([
  "",
  "email",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

const SmoothInput = React.forwardRef<HTMLInputElement, SmoothInputProps>(
  (
    {
      className,
      wrapperClassName,
      type = "text",
      value,
      defaultValue,
      onBlur,
      onChange,
      onClick,
      onFocus,
      onKeyUp,
      onSelect,
      style,
      ...props
    },
    forwardedRef,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const measureRef = React.useRef<HTMLSpanElement | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);
    const caretX = useMotionValue(0);
    const caretOpacity = useMotionValue(0);
    const prefersReducedMotion = useReducedMotion();
    const springCaretX = useSpring(
      caretX,
      prefersReducedMotion ?
        { stiffness: 10000, damping: 100, mass: 0.1 }
      : { stiffness: 520, damping: 36, mass: 0.45 },
    );
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
    const inputValue = isControlled ? value : internalValue;
    const inputType = String(type ?? "text");
    const canUseSmoothCaret = smoothTextInputTypes.has(inputType);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
          return;
        }

        if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const hideCaret = React.useCallback(() => {
      caretOpacity.set(0);
    }, [caretOpacity]);

    const updateCaret = React.useCallback(
      (target: HTMLInputElement) => {
        const measure = measureRef.current;

        if (!measure || document.activeElement !== target) {
          hideCaret();
          return;
        }

        const selection = getInputSelection(target);

        if (!selection || selection.start !== selection.end) {
          hideCaret();
          return;
        }

        const styles = window.getComputedStyle(target);
        const passwordChar = getPasswordChar();
        const textBeforeCaret =
          target.type === "password" ?
            passwordChar.repeat(selection.start)
          : target.value.slice(0, selection.start);

        measure.style.font = [
          styles.fontStyle,
          styles.fontVariant,
          styles.fontWeight,
          styles.fontSize,
          styles.fontFamily,
        ].join(" ");
        measure.style.letterSpacing = styles.letterSpacing;
        measure.style.textTransform = styles.textTransform;
        measure.textContent = textBeforeCaret;

        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const absoluteWidth =
          textBeforeCaret.length > 0 ?
            measure.offsetWidth + paddingLeft
          : paddingLeft - 1;
        const maxScroll = Math.max(0, target.scrollWidth - target.clientWidth);
        const visibleRight = target.scrollLeft + target.clientWidth - paddingRight;
        const visibleLeft = target.scrollLeft + paddingLeft;

        if (absoluteWidth > visibleRight) {
          target.scrollLeft = Math.min(
            absoluteWidth - target.clientWidth + paddingRight,
            maxScroll,
          );
        } else if (absoluteWidth < visibleLeft) {
          target.scrollLeft = Math.max(0, absoluteWidth - paddingLeft);
        }

        const caretPosition = absoluteWidth - target.scrollLeft;
        const minX = paddingLeft - 1;
        const maxX = target.clientWidth - paddingRight;

        caretX.set(Math.min(Math.max(caretPosition, minX), maxX));
        caretOpacity.set(caretPosition >= minX && caretPosition <= maxX + 1 ? 1 : 0);
      },
      [caretOpacity, caretX, hideCaret],
    );

    const scheduleCaretUpdate = React.useCallback(
      (target: HTMLInputElement) => {
        window.requestAnimationFrame(() => updateCaret(target));
      },
      [updateCaret],
    );

    React.useEffect(() => {
      const input = inputRef.current;

      if (input && document.activeElement === input) {
        updateCaret(input);
      }
    }, [inputValue, updateCaret]);

    React.useEffect(() => {
      const input = inputRef.current;
      const wrapper = wrapperRef.current;

      if (!input || !wrapper) {
        return;
      }

      const updateFocusedCaret = () => {
        if (document.activeElement === input) {
          updateCaret(input);
        }
      };

      const handleSelectionChange = () => {
        if (document.activeElement === input) {
          window.requestAnimationFrame(updateFocusedCaret);
        }
      };

      const resizeObserver = new ResizeObserver(updateFocusedCaret);

      resizeObserver.observe(wrapper);
      document.addEventListener("selectionchange", handleSelectionChange);
      input.addEventListener("scroll", updateFocusedCaret);

      return () => {
        resizeObserver.disconnect();
        document.removeEventListener("selectionchange", handleSelectionChange);
        input.removeEventListener("scroll", updateFocusedCaret);
      };
    }, [updateCaret]);

    if (!canUseSmoothCaret) {
      return (
        <input
          {...props}
          ref={setRefs}
          type={type}
          value={value}
          defaultValue={defaultValue}
          className={cn(defaultInputClassName, className)}
          style={style}
          onBlur={onBlur}
          onChange={onChange}
          onClick={onClick}
          onFocus={onFocus}
          onKeyUp={onKeyUp}
          onSelect={onSelect}
        />
      );
    }

    return (
      <div
        ref={wrapperRef}
        className={cn("relative grid w-full min-w-0", wrapperClassName)}
      >
        <input
          {...props}
          ref={setRefs}
          type={type}
          value={inputValue}
          className={cn(
            defaultInputClassName,
            "col-start-1 col-end-2 row-start-1 row-end-2 caret-transparent",
            className,
          )}
          style={style}
          onBlur={(event) => {
            hideCaret();
            onBlur?.(event);
          }}
          onChange={(event) => {
            if (!isControlled) {
              setInternalValue(event.target.value);
            }

            onChange?.(event);
            scheduleCaretUpdate(event.target);
          }}
          onClick={(event) => {
            onClick?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
          onFocus={(event) => {
            onFocus?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
          onKeyUp={(event) => {
            onKeyUp?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
          onSelect={(event) => {
            onSelect?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
        />
        <span
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre"
        />
        <motion.span
          aria-hidden
          className="pointer-events-none col-start-1 col-end-2 row-start-1 row-end-2 ml-0 h-[1em] w-0.5 self-center rounded-full bg-blue-600"
          style={{ x: springCaretX, opacity: caretOpacity }}
        />
      </div>
    );
  },
);

SmoothInput.displayName = "SmoothInput";

const SmoothTextarea = React.forwardRef<HTMLTextAreaElement, SmoothTextareaProps>(
  (
    {
      className,
      wrapperClassName,
      value,
      defaultValue,
      onBlur,
      onChange,
      onClick,
      onFocus,
      onKeyUp,
      onScroll,
      onSelect,
      style,
      ...props
    },
    forwardedRef,
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const measureRef = React.useRef<HTMLDivElement | null>(null);
    const caretX = useMotionValue(0);
    const caretY = useMotionValue(0);
    const caretOpacity = useMotionValue(0);
    const prefersReducedMotion = useReducedMotion();
    const springConfig =
      prefersReducedMotion ?
        { stiffness: 10000, damping: 100, mass: 0.1 }
      : { stiffness: 520, damping: 36, mass: 0.45 };
    const springCaretX = useSpring(caretX, springConfig);
    const springCaretY = useSpring(caretY, springConfig);
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
    const textareaValue = isControlled ? value : internalValue;

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
          return;
        }

        if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const hideCaret = React.useCallback(() => {
      caretOpacity.set(0);
    }, [caretOpacity]);

    const updateCaret = React.useCallback(
      (target: HTMLTextAreaElement) => {
        const measure = measureRef.current;

        if (!measure || document.activeElement !== target) {
          hideCaret();
          return;
        }

        const selection = getTextareaSelection(target);

        if (!selection || selection.start !== selection.end) {
          hideCaret();
          return;
        }

        const styles = window.getComputedStyle(target);
        syncTextareaMirrorStyles(measure, target, styles);
        measure.textContent = target.value.slice(0, selection.start);

        const marker = document.createElement("span");
        marker.textContent = "\u200b";
        measure.appendChild(marker);

        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const nextX = marker.offsetLeft - target.scrollLeft;
        const nextY = marker.offsetTop - target.scrollTop;
        const minX = paddingLeft - 1;
        const maxX = target.clientWidth - paddingRight;
        const minY = paddingTop - 1;
        const maxY = target.clientHeight - paddingBottom;

        caretX.set(Math.min(Math.max(nextX, minX), maxX));
        caretY.set(Math.min(Math.max(nextY, minY), maxY));
        caretOpacity.set(
          nextX >= minX &&
            nextX <= maxX + 1 &&
            nextY >= minY &&
            nextY <= maxY + 1 ?
            1
          : 0,
        );
      },
      [caretOpacity, caretX, caretY, hideCaret],
    );

    const scheduleCaretUpdate = React.useCallback(
      (target: HTMLTextAreaElement) => {
        window.requestAnimationFrame(() => updateCaret(target));
      },
      [updateCaret],
    );

    React.useEffect(() => {
      const textarea = textareaRef.current;

      if (textarea && document.activeElement === textarea) {
        updateCaret(textarea);
      }
    }, [textareaValue, updateCaret]);

    React.useEffect(() => {
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      const updateFocusedCaret = () => {
        if (document.activeElement === textarea) {
          updateCaret(textarea);
        }
      };

      const handleSelectionChange = () => {
        if (document.activeElement === textarea) {
          window.requestAnimationFrame(updateFocusedCaret);
        }
      };

      const resizeObserver = new ResizeObserver(updateFocusedCaret);

      resizeObserver.observe(textarea);
      document.addEventListener("selectionchange", handleSelectionChange);

      return () => {
        resizeObserver.disconnect();
        document.removeEventListener("selectionchange", handleSelectionChange);
      };
    }, [updateCaret]);

    return (
      <div
        className={cn("relative grid w-full min-w-0 overflow-hidden", wrapperClassName)}
      >
        <textarea
          {...props}
          ref={setRefs}
          data-slot="textarea"
          value={textareaValue}
          className={cn(
            defaultTextareaClassName,
            "col-start-1 col-end-2 row-start-1 row-end-2 caret-transparent",
            className,
          )}
          style={style}
          onBlur={(event) => {
            hideCaret();
            onBlur?.(event);
          }}
          onChange={(event) => {
            if (!isControlled) {
              setInternalValue(event.target.value);
            }

            onChange?.(event);
            scheduleCaretUpdate(event.target);
          }}
          onClick={(event) => {
            onClick?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
          onFocus={(event) => {
            onFocus?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
          onKeyUp={(event) => {
            onKeyUp?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
          onScroll={(event) => {
            onScroll?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
          onSelect={(event) => {
            onSelect?.(event);
            scheduleCaretUpdate(event.currentTarget);
          }}
        />
        <div
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre-wrap break-words"
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[1em] w-0.5 rounded-full bg-blue-600"
          style={{ x: springCaretX, y: springCaretY, opacity: caretOpacity }}
        />
      </div>
    );
  },
);

SmoothTextarea.displayName = "SmoothTextarea";

const SmoothInputGroupInput = React.forwardRef<HTMLInputElement, SmoothInputProps>(
  ({ className, wrapperClassName, ...props }, forwardedRef) => (
    <SmoothInput
      {...props}
      ref={forwardedRef}
      data-slot="input-group-control"
      wrapperClassName={cn("min-w-0 flex-1", wrapperClassName)}
      className={cn(inputGroupControlClassName, className)}
    />
  ),
);

SmoothInputGroupInput.displayName = "SmoothInputGroupInput";

function getInputSelection(input: HTMLInputElement) {
  try {
    return {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };
  } catch {
    return null;
  }
}

function getTextareaSelection(textarea: HTMLTextAreaElement) {
  try {
    return {
      start: textarea.selectionStart ?? textarea.value.length,
      end: textarea.selectionEnd ?? textarea.value.length,
    };
  } catch {
    return null;
  }
}

function getPasswordChar() {
  if (typeof navigator !== "undefined" && /firefox|fxios/i.test(navigator.userAgent)) {
    return "\u25CF";
  }

  return "\u2022";
}

function syncTextareaMirrorStyles(
  measure: HTMLDivElement,
  textarea: HTMLTextAreaElement,
  styles: CSSStyleDeclaration,
) {
  measure.style.width = `${textarea.clientWidth}px`;
  measure.style.minHeight = `${textarea.clientHeight}px`;
  measure.style.boxSizing = styles.boxSizing;
  measure.style.padding = styles.padding;
  measure.style.border = styles.border;
  measure.style.font = [
    styles.fontStyle,
    styles.fontVariant,
    styles.fontWeight,
    styles.fontSize,
    styles.fontFamily,
  ].join(" ");
  measure.style.lineHeight = styles.lineHeight;
  measure.style.letterSpacing = styles.letterSpacing;
  measure.style.textTransform = styles.textTransform;
  measure.style.overflowWrap = styles.overflowWrap;
  measure.style.wordBreak = styles.wordBreak;
}

function Skiper106() {
  return (
    <div className="grid w-full max-w-sm gap-3">
      <SmoothInput aria-label="Smooth input demo" placeholder="Smooth input" />
      <SmoothInput
        aria-label="Smooth password demo"
        placeholder="Smooth password"
        type="password"
      />
      <SmoothTextarea aria-label="Smooth textarea demo" placeholder="Smooth textarea" />
    </div>
  );
}

export { Skiper106, SmoothInput, SmoothInputGroupInput, SmoothTextarea };
