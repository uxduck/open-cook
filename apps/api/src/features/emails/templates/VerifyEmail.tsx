import { Heading, Text } from "react-email";
import { ActionButton } from "../components/ActionButton";
import { BrandHeader } from "../components/BrandHeader";
import { EmailLayout, kitchen } from "../components/EmailLayout";
import { Signoff } from "../components/Signoff";

export interface VerifyEmailProps {
  verifyUrl: string;
  userName?: string;
}

export function VerifyEmail({ verifyUrl, userName }: VerifyEmailProps) {
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  return (
    <EmailLayout previewText="Verify your email to start cooking with OpenCook">
      <BrandHeader />
      <Heading
        style={{ color: kitchen.foreground }}
        className="m-0 mb-4 text-[28px] font-bold leading-tight"
      >
        Verify your email
      </Heading>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        {greeting}
      </Text>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        Thanks for signing up for OpenCook. Tap the button below to confirm this is your
        email address, and we'll take you straight to your recipe library.
      </Text>
      <ActionButton href={verifyUrl} label="Verify email" />
      <Text style={{ color: kitchen.subtle }} className="m-0 text-[14px] leading-6">
        If you didn't create an account, you can safely ignore this email.
      </Text>
      <Signoff />
    </EmailLayout>
  );
}

VerifyEmail.PreviewProps = {
  verifyUrl: "https://open-cook.com/api/auth/verify-email?token=preview",
  userName: "Ada",
} satisfies VerifyEmailProps;

export default VerifyEmail;
