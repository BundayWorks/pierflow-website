import PageHeader from "@/components/shared/PageHeader";
import RequestAccessForm from "./RequestAccessForm";

export default function RequestAccessPage() {
  return (
    <>
      <PageHeader
        label="Developers"
        title="Get API access."
        intro="Tell us a bit about what you are building. We provision sandbox credentials within one business day."
      />
      <section className="bg-white">
        <div className="max-w-[640px] mx-auto px-6 py-20">
          <RequestAccessForm />
        </div>
      </section>
    </>
  );
}
