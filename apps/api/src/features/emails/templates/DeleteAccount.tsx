import { Heading, Text } from "react-email";
import { ActionButton } from "../components/ActionButton";
import { BrandHeader } from "../components/BrandHeader";
import { EmailLayout, kitchen } from "../components/EmailLayout";
import { Signoff } from "../components/Signoff";

export interface DeleteAccountProps {
  confirmUrl: string;
  userName?: string;
}

export function DeleteAccount({ confirmUrl, userName }: DeleteAccountProps) {
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  return (
    <EmailLayout previewText="Confirm OpenCook account deletion">
      <BrandHeader />
      <Heading
        style={{ color: kitchen.foreground }}
        className="m-0 mb-4 text-[28px] font-bold leading-tight"
      >
        Confirm account deletion
      </Heading>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        {greeting}
      </Text>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        You asked to delete your OpenCook account. This permanently removes your recipes
        and can't be undone. Tap the button below to confirm.
      </Text>
      <ActionButton href={confirmUrl} label="Delete my account" />
      <Text style={{ color: kitchen.subtle }} className="m-0 text-[14px] leading-6">
        If you didn't request this, you can safely ignore this email and your account
        will stay as it is.
      </Text>
      <Signoff />
    </EmailLayout>
  );
}

DeleteAccount.PreviewProps = {
  confirmUrl: "https://open-cook.com/api/auth/delete-user/callback?token=preview",
  userName: "Ada",
} satisfies DeleteAccountProps;

export default DeleteAccount;
