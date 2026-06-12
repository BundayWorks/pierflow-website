import { getMembers, getPlanOptions } from "../actions";
import MembersClient from "./MembersClient";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [result, plans] = await Promise.all([getMembers(), getPlanOptions()]);

  async function fetchMembers(opts: {
    search?: string;
    status?: string;
    planId?: string;
    cursor?: string;
  }) {
    "use server";
    return getMembers(opts);
  }

  return (
    <MembersClient
      initialItems={result.items}
      initialNextCursor={result.nextCursor}
      initialTotalCount={result.totalCount}
      plans={plans}
      fetchMembers={fetchMembers}
    />
  );
}
