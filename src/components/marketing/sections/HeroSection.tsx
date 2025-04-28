
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden border-t border-brand-lavender/10">
      {/* Gradient background with ring SVG */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-lavender/5" />
      
      <div className="container mx-auto px-4 py-20 relative">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">
            Train Smarter, Have Fun.
          </h1>
          <p className="text-xl md:text-2xl text-brand-fg-secondary mb-8">
            Wi-Fi & Bluetooth laser targets that make gun safety engaging.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-brand-lavender hover:bg-brand-lavender/80">
              <Link to="/signup">Get Started</Link>
            </Button>
            <Button 
              size="lg"
              variant="outline" 
              className="border-brand-lavender text-brand-lavender hover:bg-brand-lavender/10"
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
