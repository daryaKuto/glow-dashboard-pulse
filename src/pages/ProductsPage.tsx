
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ProductsPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-brand-indigo">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white text-center mb-12">
            Our Products
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-brand-surface border-brand-lavender/30">
              <CardHeader>
                <CardTitle className="text-white">Starter Kit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-brand-fg-secondary">
                    Perfect for beginners. Includes 2 targets and basic scenarios.
                  </p>
                  <Button className="w-full bg-brand-lavender hover:bg-brand-lavender/80">
                    Pre-order Now
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-brand-surface border-brand-lavender/30">
              <CardHeader>
                <CardTitle className="text-white">Pro Kit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-brand-fg-secondary">
                    For serious trainers. 5 targets, all scenarios, advanced analytics.
                  </p>
                  <Button className="w-full bg-brand-lavender hover:bg-brand-lavender/80">
                    Pre-order Now
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-brand-surface border-brand-lavender/30">
              <CardHeader>
                <CardTitle className="text-white">Team Kit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-brand-fg-secondary">
                    Ideal for ranges and teams. 10 targets, custom scenarios, priority support.
                  </p>
                  <Button className="w-full bg-brand-lavender hover:bg-brand-lavender/80">
                    Contact Sales
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductsPage;
