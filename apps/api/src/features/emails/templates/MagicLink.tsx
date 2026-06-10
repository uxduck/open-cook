import { Heading, Text } from "react-email";
import { ActionButton } from "../components/ActionButton";
import { BrandHeader } from "../components/BrandHeader";
import { EmailLayout, kitchen } from "../components/EmailLayout";
import { Signoff } from "../components/Signoff";

export interface MagicLinkProps {
  signInUrl: string;
}

export function MagicLink({ signInUrl }: MagicLinkProps) {
  return (
    <EmailLayout previewText="Your OpenCook sign-in link">
      <BrandHeader />
      <Heading
        style={{ color: kitchen.foreground }}
        className="m-0 mb-4 text-[28px] font-bold leading-tight"
      >
        Sign in to OpenCook
      </Heading>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        Tap the button below to sign in. This link works once and expires soon.
      </Text>
      <ActionButton href={signInUrl} label="Sign in" />
      <Text style={{ color: kitchen.subtle }} className="m-0 text-[14px] leading-6">
        If you didn't request this link, you can safely ignore this email.
      </Text>
      <Signoff />
    </EmailLayout>
  );
}

MagicLink.PreviewProps = {
  signInUrl: "https://open-cook.com/api/auth/magic-link/verify?token=preview",
} satisfies MagicLinkProps;

export default MagicLink;
