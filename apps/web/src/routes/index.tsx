import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MarketingPage } from "../components/marketing";
import { useSession } from "../context/SessionProvider";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { session, openAuth } = useSession();

  return (
    <main className="min-h-screen">
      <MarketingPage
        onAuthIntent={openAuth}
        onOpenApp={() => navigate({ to: "/app" })}
        session={session}
      />
    </main>
  );
}
