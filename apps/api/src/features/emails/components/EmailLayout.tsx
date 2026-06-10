import type { ReactNode } from "react";
import { Body, Container, Head, Html, Preview, Tailwind } from "react-email";

// OpenCook palette (sRGB hex; keep in sync with apps/web/src/styles.css :root).
export const kitchen = {
  background: "#f7f3eb",
  card: "#fffdf8",
  foreground: "#202622",
  muted: "#68736b",
  subtle: "#8d978f",
  primary: "#c84f3f",
  primaryForeground: "#fff8f3",
  border: "#e3dccd",
} as const;

export interface EmailLayoutProps {
  previewText: string;
  children: ReactNode;
}

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body
          style={{ backgroundColor: kitchen.background, color: kitchen.foreground }}
          className="font-sans"
        >
          <Container
            style={{ backgroundColor: kitchen.card, borderColor: kitchen.border }}
            className="mx-auto my-10 max-w-[560px] rounded-2xl border border-solid px-8 py-10"
          >
            {children}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
