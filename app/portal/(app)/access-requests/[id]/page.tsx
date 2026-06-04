import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAccessRequest } from "../actions";
import AccessRequestDetail from "./AccessRequestDetail";

export const dynamic = "force-dynamic";

export default async function AccessRequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const request = await getAccessRequest(params.id);
  if (!request) notFound();

  return (
    <div>
      <Link
        href="/portal/access-requests"
        className="inline-flex items-center gap-1.5 text-[12px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={13} />
        All access requests
      </Link>
      <div className="mt-6">
        <AccessRequestDetail request={request} />
      </div>
    </div>
  );
}
