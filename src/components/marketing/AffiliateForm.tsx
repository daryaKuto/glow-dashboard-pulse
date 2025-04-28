import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { API } from '@/lib/api';

const AffiliateForm = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    website: '',
    socials: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({
      ...form,
      [e.target.id]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Use API method instead of direct staticDb method
      await API.submitAffiliateApplication(form);
      toast.success('Application submitted successfully!');
      setForm({
        name: '',
        email: '',
        website: '',
        socials: '',
        message: '',
      });
    } catch (error) {
      console.error('Error submitting affiliate application:', error);
      toast.error('There was an error submitting your application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          type="text"
          id="name"
          value={form.name}
          onChange={handleChange}
          required
          disabled={isSubmitting}
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          type="email"
          id="email"
          value={form.email}
          onChange={handleChange}
          required
          disabled={isSubmitting}
        />
      </div>
      <div>
        <Label htmlFor="website">Website</Label>
        <Input
          type="text"
          id="website"
          value={form.website}
          onChange={handleChange}
          disabled={isSubmitting}
        />
      </div>
      <div>
        <Label htmlFor="socials">Social Media Links</Label>
        <Input
          type="text"
          id="socials"
          value={form.socials}
          onChange={handleChange}
          disabled={isSubmitting}
        />
      </div>
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={form.message}
          onChange={handleChange}
          rows={4}
          disabled={isSubmitting}
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit Application'}
      </Button>
    </form>
  );
};

export default AffiliateForm;
