import Calculator from "@/components/Calculator";
import Comparison from "@/components/Comparison";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ReportMockup from "@/components/ReportMockup";

// NOTE: ModalProvider / WaitlistModal ("fake door" waitlist queue-position
// mechanic) were unwired here in favor of real, direct links into the live
// production app (see lib/utils.ts PRODUCTION_APP_ROOT_URL / buildInstallUrl).
// The two files are intentionally left on disk, not deleted, in case the
// waitlist mechanic is wanted again later -- ping Claude before re-wiring
// them so the shop-domain sanitization/validation isn't duplicated.
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Calculator />
        <ReportMockup />
        <Comparison />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
