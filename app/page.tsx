import Hero from "@/components/home/Hero";
import ProductGrid from "@/components/home/ProductGrid";
import ApiKeysCta from "@/components/home/ApiKeysCta";
import Stories from "@/components/home/Stories";
import Faq from "@/components/home/Faq";
import GetStarted from "@/components/home/GetStarted";

export default function Home() {
  return (
    <>
      <Hero />
      <ProductGrid />
      <ApiKeysCta />
      <Stories />
      <Faq />
      <GetStarted />
    </>
  );
}
