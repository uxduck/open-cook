import { Heading, Text } from "react-email";
import { ActionButton } from "../components/ActionButton";
import { BrandHeader } from "../components/BrandHeader";
import { EmailLayout, kitchen } from "../components/EmailLayout";
import { Signoff } from "../components/Signoff";

export interface GatheringInviteProps {
  creatorName: string;
  gatheringTitle: string;
  gatheringUrl: string;
  welcome: string;
}

export function GatheringInvite({
  creatorName,
  gatheringTitle,
  gatheringUrl,
  welcome,
}: GatheringInviteProps) {
  return (
    <EmailLayout previewText={`${creatorName} invited you to ${gatheringTitle}`}>
      <BrandHeader />
      <Heading
        style={{ color: kitchen.foreground }}
        className="m-0 mb-4 text-[28px] font-bold leading-tight"
      >
        {gatheringTitle}
      </Heading>
      <Text style={{ color: kitchen.muted }} className="m-0 mb-3 text-[15px] leading-6">
        {welcome}
      </Text>
      <Text style={{ color: kitchen.muted }} className="m-0 text-[15px] leading-6">
        Open the shared page to see the recipes, choose what you would like, or add what
        you are bringing.
      </Text>
      <ActionButton href={gatheringUrl} label="Open gathering" />
      <Text style={{ color: kitchen.subtle }} className="m-0 text-[14px] leading-6">
        Everyone has the same gathering page, so menu updates and guest notes stay in
        one place.
      </Text>
      <Signoff />
    </EmailLayout>
  );
}

GatheringInvite.PreviewProps = {
  creatorName: "Avery",
  gatheringTitle: "Saturday Supper",
  gatheringUrl: "https://open-cook.com/g/saturday-supper-preview",
  welcome:
    "Come hungry for a relaxed Saturday supper. Pick the dish you are most excited for, and tell us if you are bringing something extra.",
} satisfies GatheringInviteProps;

export default GatheringInvite;
