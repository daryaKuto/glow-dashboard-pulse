
import { DollarSign, Clock, BarChart3 } from 'lucide-react';

const AffiliateSection = () => {
  const benefits = [
    {
      icon: DollarSign,
      title: "High Payouts",
      description: "Earn up to ",
      highlight: "15%",
      suffix: " per sale."
    },
    {
      icon: Clock,
      title: "30-Day Cookie",
      description: "Get credit even when buyers return later."
    },
    {
      icon: BarChart3,
      title: "Live Dashboard",
      description: "Track clicks, sales, and payouts in real time."
    }
  ];

  return (
    <section className="bg-brand-surface py-16 md:py-24">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-3xl md:text-4xl text-center text-white">
          Join Our Affiliate Program
        </h2>
        <p className="text-brand-fg-secondary text-center max-w-xl mx-auto mt-3">
          Earn competitive commissions by helping shooters train safer and smarter.
          Perfect for ranges, instructors, retailers, and creators.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-brand-indigo grid place-content-center">
                <benefit.icon className="text-brand-lavender w-6 h-6" />
              </div>
              <h3 className="text-white font-medium mt-4">{benefit.title}</h3>
              <p className="text-brand-fg-secondary text-sm">
                {benefit.description}
                {benefit.highlight && (
                  <span className="text-brand-orange font-semibold">
                    {benefit.highlight}
                  </span>
                )}
                {benefit.suffix}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <a
            href="https://example.com/affiliate"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 rounded-full font-medium bg-brand-lavender text-brand-indigo
                     hover:bg-transparent hover:outline hover:outline-2 hover:outline-brand-lavender
                     hover:text-brand-lavender focus-visible:ring-4 focus-visible:ring-brand-lavender/50 transition"
          >
            Apply as Affiliate
          </a>
        </div>
      </div>
    </section>
  );
};

export default AffiliateSection;
