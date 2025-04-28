import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { staticDb } from '@/lib/staticDb';
import { toast } from 'sonner';

const schema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  email: z.string().email("Invalid email address"),
  website: z.string().url("Please enter a valid URL"),
  audienceSize: z.string().optional(),
  promoPlan: z.string().min(10, "Please provide more detail").max(500, "Response too long"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consent is required" })
  }),
  _gotcha: z.string().max(0).optional()
});

type FormData = z.infer<typeof schema>;

const AffiliateForm = () => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isSubmitSuccessful } } = 
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await new Promise(r => setTimeout(r, 500)); // Simulate latency
      // Remove the consent and honeypot fields before saving to the database
      const { consent, _gotcha, ...applicationData } = data;
      staticDb.createAffiliateApp({
        ...applicationData,
        fullName: applicationData.fullName,  // Ensure it's not optional
        email: applicationData.email,        // Ensure it's not optional
        website: applicationData.website,    // Ensure it's not optional
        promoPlan: applicationData.promoPlan // Ensure it's not optional
      });
      toast.success("Application submitted successfully!");
      reset();
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-6">
      <input {...register('_gotcha')} type="text" className="hidden" tabIndex={-1} />
      
      <div className="col-span-2">
        <label htmlFor="fullName" className="block text-brand-fg-secondary mb-1">Full Name *</label>
        <input
          id="fullName"
          {...register('fullName')}
          className="w-full rounded-md border border-input bg-brand-surface px-4 py-2 text-white focus:ring-2 focus:ring-brand-lavender focus:ring-offset-2 focus:ring-offset-brand-indigo focus:outline-none"
        />
        {errors.fullName && (
          <p role="alert" className="text-brand-orange text-sm mt-1">{errors.fullName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-brand-fg-secondary mb-1">Email Address *</label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="w-full rounded-md border border-input bg-brand-surface px-4 py-2 text-white focus:ring-2 focus:ring-brand-lavender focus:ring-offset-2 focus:ring-offset-brand-indigo focus:outline-none"
        />
        {errors.email && (
          <p role="alert" className="text-brand-orange text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="website" className="block text-brand-fg-secondary mb-1">Website / Social URL *</label>
        <input
          id="website"
          type="url"
          {...register('website')}
          className="w-full rounded-md border border-input bg-brand-surface px-4 py-2 text-white focus:ring-2 focus:ring-brand-lavender focus:ring-offset-2 focus:ring-offset-brand-indigo focus:outline-none"
        />
        {errors.website && (
          <p role="alert" className="text-brand-orange text-sm mt-1">{errors.website.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="audienceSize" className="block text-brand-fg-secondary mb-1">Audience Size</label>
        <input
          id="audienceSize"
          type="number"
          {...register('audienceSize')}
          className="w-full rounded-md border border-input bg-brand-surface px-4 py-2 text-white focus:ring-2 focus:ring-brand-lavender focus:ring-offset-2 focus:ring-offset-brand-indigo focus:outline-none"
        />
      </div>

      <div className="md:col-span-2">
        <label htmlFor="promoPlan" className="block text-brand-fg-secondary mb-1">How Will You Promote? *</label>
        <textarea
          id="promoPlan"
          rows={4}
          {...register('promoPlan')}
          className="w-full rounded-md border border-input bg-brand-surface px-4 py-2 text-white focus:ring-2 focus:ring-brand-lavender focus:ring-offset-2 focus:ring-offset-brand-indigo focus:outline-none"
        />
        {errors.promoPlan && (
          <p role="alert" className="text-brand-orange text-sm mt-1">{errors.promoPlan.message}</p>
        )}
      </div>

      <div className="col-span-2 flex items-start gap-2">
        <input
          id="consent"
          type="checkbox"
          {...register('consent')}
          className="mt-1 accent-brand-lavender"
        />
        <label htmlFor="consent" className="text-brand-fg-secondary text-sm">
          I agree to be contacted about the affiliate program *
          {errors.consent && (
            <span role="alert" className="text-brand-orange ml-2">{errors.consent.message}</span>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isSubmitSuccessful}
        className="col-span-2 mt-4 py-3 rounded-full font-medium bg-brand-lavender text-brand-indigo
                 hover:bg-transparent hover:outline hover:outline-2 hover:outline-brand-lavender hover:text-brand-lavender
                 focus-visible:ring-4 focus-visible:ring-brand-lavender/50 transition
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Sending...' : isSubmitSuccessful ? 'Application Sent!' : 'Submit Application'}
      </button>
    </form>
  );
};

export default AffiliateForm;
