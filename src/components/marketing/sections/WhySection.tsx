
import { Target, Gamepad2, LineChart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const WhySection = () => {
  const features = [
    {
      icon: Target,
      title: "Save on Ammo",
      description: "Practice with laser targets and save thousands on ammunition costs"
    },
    {
      icon: Gamepad2,
      title: "Gamified Drills",
      description: "Engage with interactive training scenarios and competitive challenges"
    },
    {
      icon: LineChart,
      title: "Data-Driven Progress",
      description: "Track your improvement with detailed performance analytics"
    }
  ];

  return (
    <section className="py-20 bg-brand-surface">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-display font-bold text-white text-center mb-12">
          Why Fun Gun Training?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-brand-surface border-brand-lavender/30">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <feature.icon className="w-12 h-12 text-brand-lavender mb-4" />
                  <h3 className="text-xl font-display font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-brand-fg-secondary">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhySection;
