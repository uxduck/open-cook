import { Heading, Text } from "react-email";
import { BrandHeader } from "../components/BrandHeader";
import { CodeBlock } from "../components/CodeBlock";
import { EmailLayout, kitchen } from "../components/EmailLayout";
import { Signoff } from "../components/Signoff";

export interface OtpCodeProps {
  otp: string;
  title: string;
  intro: string;
}

export function OtpCode({ otp, title, intro }: OtpCodeProps) {
  return (
    <EmailLayout previewText={`${otp} is your OpenCook code`}>
      <BrandHeader />
      <Heading
        style={{ color: kitchen.foreground }}
        className="m-0 mb-4 text-[28px] font-bold leading-tight"
      >
        {title}
      </Heading>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        {intro}
      </Text>
      <CodeBlock code={otp} />
      <Text style={{ color: kitchen.subtle }} className="m-0 text-[14px] leading-6">
        This code expires soon. If you didn't request it, you can safely ignore this
        email.
      </Text>
      <Signoff />
    </EmailLayout>
  );
}

OtpCode.PreviewProps = {
  otp: "123456",
  title: "Sign in to OpenCook",
  intro: "Use this code to finish signing in.",
} satisfies OtpCodeProps;

export default OtpCode;
