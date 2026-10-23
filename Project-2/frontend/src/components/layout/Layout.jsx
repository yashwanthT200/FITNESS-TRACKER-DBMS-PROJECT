import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout = () => {
  const [showCookies, setShowCookies] = useState(true);

  return (
    <div className="flex h-screen bg-garmin-gray overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6 relative">
          <Outlet />
        </main>
      </div>

      {/* Cookie Consent Banner */}
      {showCookies && (
        <div className="absolute bottom-0 left-64 right-0 bg-gray-900 text-white p-4 shadow-lg flex items-center justify-between z-50">
          <div>
            <p className="font-medium">We use cookies to improve your experience.</p>
            <p className="text-sm text-gray-400">By continuing to use this site, you agree to our use of cookies.</p>
          </div>
          <div className="flex space-x-4">
            <button 
              onClick={() => setShowCookies(false)} 
              className="px-4 py-2 bg-garmin-blue hover:bg-blue-600 rounded text-white font-medium transition-colors"
            >
              Accept All
            </button>
            <button 
              onClick={() => setShowCookies(false)}
              className="px-4 py-2 border border-gray-600 hover:bg-gray-800 rounded text-gray-300 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
