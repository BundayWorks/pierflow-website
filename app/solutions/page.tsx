import PageHeader from "@/components/shared/PageHeader";
import SolutionsGrid from "@/components/home/SolutionsGrid";
import ContactBar from "@/components/shared/ContactBar";

export default function SolutionsPage() {
  return (
    <>
      <PageHeader
        label="Solutions"
        title="One connectivity layer, every audience."
        intro="HMOs, hospitals, pharmacies, fintechs, HR platforms, governments, cooperatives — every organisation in healthcare has data that needs to connect to something else. We build the pipes, starting with extending HMO products into distribution channels that didn't have them before."
      />
      <SolutionsGrid />
      <ContactBar />
    </>
  );
}
