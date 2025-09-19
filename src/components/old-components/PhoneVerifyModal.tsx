
import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Phone, Check } from 'lucide-react';
import { useAuth } from '@/store/useAuth';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const PhoneVerifyModal: React.FC = () => {
  const { 
    phoneVerifyModalOpen, 
    setPhoneVerifyModalOpen,
    phoneVerificationStep,
    phoneVerificationError,
    linkPhone,
    verifyPhoneOtp,
    resetPhoneVerification
  } = useAuth();
  
  const [phoneInput, setPhoneInput] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Validate and format phone number
  useEffect(() => {
    try {
      if (phoneInput) {
        const phoneNumber = parsePhoneNumber(phoneInput, 'US');
        const isValid = phoneNumber ? isValidPhoneNumber(phoneNumber.number) : false;
        setIsPhoneValid(isValid);
        
        if (isValid) {
          setFormattedPhone(phoneNumber.number);
        }
      } else {
        setIsPhoneValid(false);
      }
    } catch (error) {
      setIsPhoneValid(false);
    }
  }, [phoneInput]);
  
  const handleSubmitPhone = async () => {
    if (!isPhoneValid || isSubmitting) return;
    
    setIsSubmitting(true);
    const success = await linkPhone(formattedPhone);
    setIsSubmitting(false);
    
    if (success) {
      // Clear OTP input when moving to verification step
      setOtpInput('');
    }
  };
  
  const handleVerifyOtp = async () => {
    if (otpInput.length !== 6 || isSubmitting) return;
    
    setIsSubmitting(true);
    await verifyPhoneOtp(formattedPhone, otpInput);
    setIsSubmitting(false);
  };
  
  const handleCancel = () => {
    setPhoneVerifyModalOpen(false);
    // Reset forms after modal closes
    setTimeout(() => {
      setPhoneInput('');
      setOtpInput('');
      resetPhoneVerification();
    }, 300);
  };
  
  return (
    <Dialog open={phoneVerifyModalOpen} onOpenChange={setPhoneVerifyModalOpen}>
      <DialogContent className="bg-brand-surface border-brand-lavender/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            {phoneVerificationStep === 'input' && 'Add Your Phone Number'}
            {phoneVerificationStep === 'verify' && 'Verify Phone Number'}
            {phoneVerificationStep === 'complete' && 'Phone Verified!'}
          </DialogTitle>
          <DialogDescription className="text-brand-fg-secondary">
            {phoneVerificationStep === 'input' && 
              'Adding your phone lets friends find you and improves security.'}
            {phoneVerificationStep === 'verify' && 
              `We sent a verification code to ${formattedPhone}. Enter it below.`}
            {phoneVerificationStep === 'complete' && 
              'Your phone number has been verified successfully!'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {phoneVerificationStep === 'input' && (
            <>
              <div className="relative">
                <Input
                  className="pl-10 bg-brand-surface-light border-brand-lavender/30 text-white"
                  placeholder="+1 (555) 123-4567"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-lavender" size={18} />
              </div>
              
              {phoneVerificationError && (
                <p className="text-red-400 text-sm">{phoneVerificationError}</p>
              )}
              
              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  className="bg-transparent border-gray-700 text-white hover:bg-gray-700 hover:text-white"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-brand-lavender hover:bg-brand-lavender/90 text-white"
                  onClick={handleSubmitPhone}
                  disabled={!isPhoneValid || isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Code'}
                </Button>
              </div>
            </>
          )}
          
          {phoneVerificationStep === 'verify' && (
            <>
              <InputOTP maxLength={6} value={otpInput} onChange={setOtpInput}>
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="bg-brand-surface-light border-brand-lavender/30 text-white" />
                  <InputOTPSlot index={1} className="bg-brand-surface-light border-brand-lavender/30 text-white" />
                  <InputOTPSlot index={2} className="bg-brand-surface-light border-brand-lavender/30 text-white" />
                  <InputOTPSlot index={3} className="bg-brand-surface-light border-brand-lavender/30 text-white" />
                  <InputOTPSlot index={4} className="bg-brand-surface-light border-brand-lavender/30 text-white" />
                  <InputOTPSlot index={5} className="bg-brand-surface-light border-brand-lavender/30 text-white" />
                </InputOTPGroup>
              </InputOTP>
              
              {phoneVerificationError && (
                <p className="text-red-400 text-sm">{phoneVerificationError}</p>
              )}
              
              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  className="text-brand-fg-secondary hover:text-white hover:bg-transparent p-0"
                  onClick={() => resetPhoneVerification()}
                >
                  Change number
                </Button>
                
                <Button
                  className="bg-brand-lavender hover:bg-brand-lavender/90 text-white"
                  onClick={handleVerifyOtp}
                  disabled={otpInput.length !== 6 || isSubmitting}
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Code'}
                </Button>
              </div>
            </>
          )}
          
          {phoneVerificationStep === 'complete' && (
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <p className="text-white text-center">
                Your phone number has been successfully verified!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneVerifyModal;
