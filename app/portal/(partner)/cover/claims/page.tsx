import { getClaims } from "../actions";
import ClaimsClient from "./ClaimsClient";

export const dynamic = "force-dynamic";

export default async function ClaimsPage() {
  const result = await getClaims();

  async function fetchClaims(opts: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
  }) {
    "use server";
    return getClaims(opts);
  }

  return (
    <ClaimsClient
      initialItems={result.items}
      initialNextCursor={result.nextCursor}
      initialTotalCount={result.totalCount}
      fetchClaims={fetchClaims}
    />
  );
}
