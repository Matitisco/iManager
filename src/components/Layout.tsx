import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string, subTab?: string) => void;
  actionLabel?: string;
  onNewAction?: () => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  actionLabel,
  onNewAction,
  searchTerm,
  onSearchTermChange,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header 
          actionLabel={actionLabel} 
          onNewAction={onNewAction} 
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onNavigate={setActiveTab}
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 flex flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};


