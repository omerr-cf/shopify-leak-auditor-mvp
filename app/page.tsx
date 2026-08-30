import { ModalProvider } from "@/components/ModalProvider";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Calculator from "@/components/Calculator";
import ReportMockup from "@/components/ReportMockup";
import Comparison from "@/components/Comparison";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import WaitlistModal from "@/components/WaitlistModal";

export default function Home() {
  return (
    <ModalProvider>
      <Header />
      <main>
        <Hero />
        <Calculator />
        <ReportMockup />
        <Comparison />
        <FAQ />
      </main>
      <Footer />
      <WaitlistModal />
    </ModalProvider>
  );
}
