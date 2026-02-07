export const dynamic = "force-dynamic";

import ChallengeDetailClient from "@/components/ChallengeDetailClient";

// Next.js 15 may treat `params` as an async dynamic API depending on configuration.
// To keep this route stable across environments, we render a client component that
// reads the id via `useParams()`.

export default function ChallengeDetailPage() {
  return <ChallengeDetailClient />;
}
