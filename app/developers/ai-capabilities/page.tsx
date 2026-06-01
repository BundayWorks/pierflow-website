import PageHeader from "@/components/shared/PageHeader";
import AiSection from "@/components/home/AiSection";
import ContactBar from "@/components/shared/ContactBar";

export default function AiCapabilitiesPage() {
  return (
    <>
      <PageHeader
        label="Developers · AI"
        title="AI in every response, on every endpoint."
        intro="The platform does not just move data. It understands it. Every score is logged, explainable, and reviewable."
      />
      <AiSection />
      <ContactBar />
    </>
  );
}
