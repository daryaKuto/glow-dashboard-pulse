import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import HeroSection from '@/components/marketing/sections/HeroSection';
import WhySection from '@/components/marketing/sections/WhySection';

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <WhySection />
        {/* Additional sections will be implemented in subsequent iterations */}
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
