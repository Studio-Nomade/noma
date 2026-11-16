import { BriefingCard } from "./briefing-card";
import { getTodayBriefing, type BriefingUser } from "./briefing";

/** Server component: se hace streaming dentro de <Suspense> en el inicio. */
export async function BriefingSection({ user }: { user: BriefingUser }) {
  try {
    const data = await getTodayBriefing(user);
    return <BriefingCard data={data} />;
  } catch (error) {
    console.error("[assistant:briefing-section]", error);
    return null;
  }
}
