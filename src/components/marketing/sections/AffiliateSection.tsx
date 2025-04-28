
import React from "react";
import { BarChart3, Clock, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

const AffiliateSection = () => {
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
          {/* Benefit 1 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-brand-indigo grid place-content-center">
              <DollarSign className="text-brand-lavender w-6 h-6" />
            </div>
            <h3 className="text-white font-medium mt-4">High Payouts</h3>
            <p className="text-brand-fg-secondary text-sm">
              Earn up to <span className="text-brand-orange font-semibold">15%</span> per sale.
            </p>
          </div>
          {/* Benefit 2 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-brand-indigo grid place-content-center">
              <Clock className="text-brand-lavender w-6 h-6" />
            </div>
            <h3 className="text-white font-medium mt-4">30-Day Cookie</h3>
            <p className="text-brand-fg-secondary text-sm">
              Get credit even when buyers return later.
            </p>
          </div>
          {/* Benefit 3 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-brand-indigo grid place-content-center">
              <BarChart3 className="text-brand-lavender w-6 h-6" />
            </div>
            <h3 className="text-white font-medium mt-4">Live Dashboard</h3>
            <p className="text-brand-fg-secondary text-sm">
              Track clicks, sales, and payouts in real time.
            </p>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            to="/affiliate/apply"
            className="px-8 py-3 rounded-full font-medium bg-brand-lavender text-brand-indigo
                     hover:bg-transparent hover:outline hover:outline-2 hover:outline-brand-lavender hover:text-brand-lavender
                     focus-visible:ring-4 focus-visible:ring-brand-lavender/50 transition"
          >
            Apply as Affiliate
          </Link>
        </div>
      </div>
    </section>
  );
};

export default AffiliateSection;
