
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AffiliateForm } from "@/components/marketing/AffiliateForm";

export default function AffiliateApplyPage() {
  return (
    <div className="min-h-screen bg-brand-indigo py-16 px-4">
      <Card className="max-w-3xl mx-auto bg-brand-surface border-brand-lavender/20">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl text-center text-white">
            Become an Affiliate Partner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AffiliateForm />
        </CardContent>
      </Card>
    </div>
  );
}
