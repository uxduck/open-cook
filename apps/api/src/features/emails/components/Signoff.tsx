import { Hr, Section, Text } from "react-email";
import { kitchen } from "./EmailLayout";

export function Signoff() {
  return (
    <Section className="mt-10">
      <Hr
        style={{ borderColor: kitchen.border }}
        className="my-6 border-t border-solid"
      />
      <Text style={{ color: kitchen.muted }} className="m-0 text-[13px] leading-6">
        Happy cooking, the OpenCook team
      </Text>
    </Section>
  );
}
