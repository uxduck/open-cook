import { Section, Text } from "react-email";
import { kitchen } from "./EmailLayout";

export function CodeBlock({ code }: { code: string }) {
  return (
    <Section
      style={{ backgroundColor: kitchen.background, borderColor: kitchen.border }}
      className="my-8 rounded-xl border border-solid py-5 text-center"
    >
      <Text
        style={{
          color: kitchen.foreground,
          fontFamily: "ui-monospace, Menlo, monospace",
        }}
        className="m-0 text-[28px] font-bold tracking-[8px]"
      >
        {code}
      </Text>
    </Section>
  );
}
