
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Users, Copy } from "lucide-react";

interface InviteModalProps {
  sessionId: number;
  onCreateInvite: (sessionId: number) => Promise<string | null>;
}

const InviteModal: React.FC<InviteModalProps> = ({ sessionId, onCreateInvite }) => {
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const handleCreateInvite = async () => {
    setIsLoading(true);
    try {
      const token = await onCreateInvite(sessionId);
      if (token) {
        setInviteToken(token);
      }
    } catch (error) {
      toast.error("Failed to create invite");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteToken) return;
    
    const inviteUrl = `${window.location.origin}/sessions/join/${inviteToken}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard");
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-transparent border-brand-lavender/30 text-brand-lavender hover:bg-brand-lavender hover:text-white"
          onClick={() => setIsOpen(true)}
        >
          <Users className="h-4 w-4 mr-2" />
          Invite Friend
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-brand-surface border-brand-lavender/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Invite a Friend</DialogTitle>
          <DialogDescription className="text-brand-fg-secondary">
            Generate an invite link to share with your friends
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!inviteToken ? (
            <Button 
              className="w-full bg-brand-lavender hover:bg-brand-lavender/80"
              disabled={isLoading}
              onClick={handleCreateInvite}
            >
              {isLoading ? "Generating..." : "Generate Invite Link"}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input 
                  value={`${window.location.origin}/sessions/join/${inviteToken}`}
                  readOnly
                  className="bg-brand-indigo border-brand-lavender/30"
                />
                <Button variant="outline" onClick={handleCopyLink} className="border-brand-lavender/30 text-brand-lavender hover:bg-brand-lavender hover:text-white">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-center text-brand-fg-secondary">
                This invite link will expire after the session ends
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteModal;
