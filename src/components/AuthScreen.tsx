import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import brandWordmark from '../logo/uhub_logo.svg';

export const AuthScreen: React.FC = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);

  const toggleMode = () => {
    setIsLoginMode(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="auth-hero">
          <img src={brandWordmark} alt="UHub" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Sistema Uniodonto
          </h1>
          <p className="text-gray-600">
            Gestão de Credenciamento e Suprimento de Rede
          </p>
        </div>
        
        {isLoginMode ? (
          <LoginForm onToggleMode={toggleMode} />
        ) : (
          <RegisterForm onToggleMode={toggleMode} />
        )}
      </div>
    </div>
  );
};
