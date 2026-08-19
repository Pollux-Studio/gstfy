export interface TypographyScale {
  xs: number;
  sm: number;
  base: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
}

export interface SpacingScale {
  0: number;
  0.5: number;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  8: number;
  10: number;
  12: number;
  16: number;
}

export interface FontWeights {
  regular: number;
  medium: number;
  semibold: number;
  bold: number;
}

export interface LineHeights {
  tight: number;
  normal: number;
  relaxed: number;
}

export interface BorderRadiusScale {
  none: number;
  sm: number;
  md: number;
  lg: number;
  full: number;
}

export interface LetterSpacingScale {
  tight: number;
  normal: number;
  wide: number;
  wider: number;
}

export interface PrimitiveTokens {
  typography: TypographyScale;
  spacing: SpacingScale;
  fontWeights: FontWeights;
  lineHeights: LineHeights;
  borderRadius: BorderRadiusScale;
  letterSpacing: LetterSpacingScale;
}

export interface ColorTokens {
  foreground: string;
  background: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  border: string;
  accent: string;
  destructive: string;
  success: string;
  warning: string;
  info: string;
}

export interface TypographyTokens {
  body: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
  heading: {
    fontFamily: string;
    fontWeight: number;
    lineHeight: number;
    fontSize: {
      h1: number;
      h2: number;
      h3: number;
      h4: number;
      h5: number;
      h6: number;
    };
  };
}

export interface SpacingTokens {
  page: {
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
  };
  sectionGap: number;
  paragraphGap: number;
  componentGap: number;
}

export interface PageTokens {
  size: "A4" | "LETTER" | "LEGAL";
  orientation: "portrait" | "landscape";
}

export interface PdfcnTheme {
  name: string;
  primitives: PrimitiveTokens;
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  page: PageTokens;
}
