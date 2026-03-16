import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const Login: React.FC = () => {
  const { login } = useAppContext();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await login();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Error al iniciar sesión con Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Left Pane - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-zinc-950">
          {/* Animated Grid */}
          <motion.div 
            animate={{ y: [0, 32] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="absolute inset-0 opacity-[0.06] w-full" 
            style={{ 
              height: '200%',
              top: '-50%',
              backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', 
              backgroundSize: '32px 32px',
            }}
          />
          
          {/* Floating Glowing Orbs */}
          <motion.div 
            animate={{ 
              x: [0, 100, 0, -100, 0],
              y: [0, 50, 100, 50, 0],
              scale: [1, 1.2, 1, 0.8, 1]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/10 blur-[100px]"
          />
          <motion.div 
            animate={{ 
              x: [0, -100, 0, 100, 0],
              y: [0, -50, -100, -50, 0],
              scale: [1, 1.5, 1, 1.2, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-zinc-400/10 blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.8, 0.3]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[30%] left-[20%] w-[50%] h-[50%] rounded-full bg-zinc-300/10 blur-[80px]"
          />

          {/* Dark Overlays for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="bg-white text-black p-2.5 rounded-xl shadow-lg shadow-white/10">
              <Package size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight">iManager</span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-5xl lg:text-6xl font-medium leading-[1.1] tracking-tight mb-6">
              El control total de tu negocio,<br />
              <span className="text-zinc-500">en un solo lugar.</span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
              Gestiona inventario, ventas, clientes y canjes con la plataforma más intuitiva y profesional del mercado.
            </p>
          </motion.div>
        </div>

        {/* Floating Card Animation */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative z-10 bg-zinc-900/50 backdrop-blur-md border border-zinc-800/50 p-6 rounded-2xl max-w-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <Sparkles size={18} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Sistema Inteligente</p>
              <p className="text-xs text-zinc-400">Actualización en tiempo real</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2 bg-zinc-800 rounded-full w-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, delay: 1, ease: "easeInOut" }}
                className="h-full bg-zinc-500 rounded-full"
              />
            </div>
            <div className="h-2 bg-zinc-800 rounded-full w-3/4 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, delay: 1.2, ease: "easeInOut" }}
                className="h-full bg-zinc-600 rounded-full"
              />
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 flex items-center justify-between text-sm text-zinc-500">
          <span>&copy; {new Date().getFullYear()} iManager.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Ayuda</a>
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
          </div>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative">
        <motion.div 
          layout
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="bg-black text-white p-2.5 rounded-xl">
              <Package size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight">iManager</span>
          </div>

          <motion.div layout className="mb-10 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key="login-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
                  Bienvenido a iManager
                </h2>
                <p className="text-gray-500">
                  Inicia sesión para gestionar tu negocio.
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <motion.div layout className="mt-6">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              disabled={isLoading}
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {isLoading ? 'Iniciando sesión...' : 'Continuar con Google'}
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
