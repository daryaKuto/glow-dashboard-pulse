
import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      
      <Sidebar 
        isMobile={true} 
        isOpen={isOpen} 
        onClose={onClose} 
      />
    </>
  );
};

export default MobileDrawer;
