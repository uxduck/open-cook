import { Button, Section } from "react-email";
import { kitchen } from "./EmailLayout";

export interface ActionButtonProps {
  href: string;
  label: string;
}

export function ActionButton({ href, label }: ActionButtonProps) {
  return (
    <Section className="my-8 text-left">
      <Button
        href={href}
        style={{ backgroundColor: kitchen.primary, color: kitchen.primaryForeground }}
        className="box-border inline-block rounded-full px-8 py-4 text-[15px] font-semibold no-underline"
      >
        {label} →
      </Button>
    </Section>
  );
}
