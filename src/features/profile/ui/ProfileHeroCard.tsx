import React, { useState } from 'react';
import { Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import type { UserProfileData } from '@/features/profile/schema';

interface ProfileHeroCardProps {
  profileData: UserProfileData | null | undefined;
  isLoading: boolean;
  error?: string | null;
  profileUpdateData: { name: string; email: string };
  onProfileUpdateDataChange: (data: { name: string; email: string }) => void;
  onProfileUpdate: () => Promise<void>;
  isUpdating: boolean;
}

const ProfileHeroCard: React.FC<ProfileHeroCardProps> = ({
  profileData,
  isLoading,
  error,
  profileUpdateData,
  onProfileUpdateDataChange,
  onProfileUpdate,
  isUpdating,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = async () => {
    await onProfileUpdate();
    setDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Card className="shadow-card bg-gradient-to-br from-white via-white to-brand-primary/[0.03]">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center gap-4 md:gap-6 animate-pulse">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded w-40 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-56" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profileData) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-5 md:p-6">
          <div className="text-center py-4">
            <p className="text-sm text-brand-dark/40 font-body">
              {error || 'Profile data unavailable'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const initials = profileData.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <Card className="shadow-card bg-gradient-to-br from-white via-white to-brand-primary/[0.03]">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center gap-4 md:gap-6">
          <Avatar className="h-16 w-16 md:h-20 md:w-20 border-2 border-brand-primary/20">
            <AvatarImage src={profileData.avatarUrl} />
            <AvatarFallback className="bg-brand-primary text-white text-lg md:text-xl font-body font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-stat-md font-bold text-brand-dark font-body truncate">
                {profileData.name}
              </h3>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <button className="text-brand-dark/30 hover:text-brand-primary transition-colors p-1 rounded-full hover:bg-brand-primary/[0.08]">
                    <Edit className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white shadow-lg border-0 rounded-[var(--radius-lg)]">
                  <DialogHeader>
                    <DialogTitle className="text-base font-heading text-brand-dark">
                      Edit Profile
                    </DialogTitle>
                    <DialogDescription className="text-sm text-brand-dark/50 font-body">
                      Update your display name
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-1.5">
                        Display Name
                      </label>
                      <Input
                        value={profileUpdateData.name}
                        onChange={(e) =>
                          onProfileUpdateDataChange({
                            ...profileUpdateData,
                            name: e.target.value,
                          })
                        }
                        className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark placeholder:text-brand-dark/40 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-10"
                      />
                    </div>
                    <div>
                      <label className="text-label text-brand-secondary font-body uppercase tracking-wide block mb-1.5">
                        Email
                      </label>
                      <Input
                        value={profileUpdateData.email}
                        disabled
                        className="bg-brand-light/50 border-[rgba(28,25,43,0.06)] text-brand-dark/50 font-body h-10"
                      />
                      <p className="text-xs text-brand-dark/30 font-body mt-1">
                        Email cannot be changed
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <DialogClose asChild>
                        <Button variant="secondary" className="font-body">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="bg-brand-primary hover:bg-brand-primary/90 text-white font-body"
                      >
                        {isUpdating ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-sm text-brand-dark/50 font-body truncate">
              {profileData.email}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileHeroCard;
