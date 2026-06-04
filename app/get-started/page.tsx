import { AUDIENCE_OPTIONS } from "@/lib/onboarding";
import Step1Audience from "./Step1Audience";

export const metadata = {
  title: "Get started · Pierflow",
};

export default function GetStartedPage() {
  return <Step1Audience options={AUDIENCE_OPTIONS} />;
}
