import { Heading, Text } from "react-email";
import { ActionButton } from "../components/ActionButton";
import { BrandHeader } from "../components/BrandHeader";
import { EmailLayout, kitchen } from "../components/EmailLayout";
import { Signoff } from "../components/Signoff";

export interface ResetPasswordProps {
  resetUrl: string;
  userName?: string;
}

export function ResetPassword({ resetUrl, userName }: ResetPasswordProps) {
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  return (
    <EmailLayout previewText="Reset your OpenCook password">
      <BrandHeader />
      <Heading
        style={{ color: kitchen.foreground }}
        className="m-0 mb-4 text-[28px] font-bold leading-tight"
      >
        Reset your password
      </Heading>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        {greeting}
      </Text>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        Someone asked to reset the password for this OpenCook account. Tap the button
        below to choose a new one.
      </Text>
      <ActionButton href={resetUrl} label="Reset password" />
      <Text style={{ color: kitchen.subtle }} className="m-0 text-[14px] leading-6">
        If you didn't request this, you can safely ignore this email. Your password
        won't change.
      </Text>
      <Signoff />
    </EmailLayout>
  );
}

ResetPassword.PreviewProps = {
  resetUrl: "https://open-cook.com/api/auth/reset-password/preview",
  userName: "Ada",
} satisfies ResetPasswordProps;

export default ResetPassword;
