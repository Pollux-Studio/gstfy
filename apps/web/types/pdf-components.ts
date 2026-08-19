import type { ReactNode } from "react";

export type Style = Record<string, unknown>;

export interface PDFComponentProps {
  children: ReactNode;
  style?: Style;
}
