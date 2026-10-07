import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useInvitationPreview } from '../hooks/useInvitationPreview';

interface LoginProps {
  inviteToken?: string | null;
}

function getAuthErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return '';
}

export const Login: React.FC<LoginProps> = ({ inviteToken }) => {
  const { login, loginWithEmail, registerWithEmail } = useAppContext();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inviteState = useInvitationPreview(inviteToken);
  const googleAttempt = useRef(0);

  useEffect(() => {
    // Firebase delays rejecting a closed popup. Restore the button when the
    // user returns, while Firebase continues to resolve the actual session.
    const releaseGoogleLoading = () => setIsGoogleLoading(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') releaseGoogleLoading();
    };

    window.addEventListener('focus', releaseGoogleLoading);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', releaseGoogleLoading);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      googleAttempt.current += 1;
    };
  }, []);

  const clearError = () => setError(null);
  const roleLabel =
    inviteState.preview?.role === 'MANAGER'
      ? 'Socio'
      : inviteState.preview?.role === 'STAFF'
        ? 'Empleado'
        : inviteState.preview?.role === 'OWNER'
          ? 'Propietario'
          : null;

  const getFirebaseErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No existe una cuenta con este correo electrónico.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Correo o contraseña incorrectos.';
      case 'auth/operation-not-allowed':
        return 'Este método de acceso no está habilitado en Firebase.';
      case 'auth/network-request-failed':
        return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana de Google. Permití popups e intentá de nuevo.';
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con este correo electrónico.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intentá de nuevo más tarde.';
      case 'auth/internal-error':
        return 'Firebase devolvió un error interno. Intentá de nuevo.';
      default:
        return 'No pudimos completar el acceso. Intenta de nuevo.';
    }
  };

  const handleGoogleLogin = async () => {
    const attempt = ++googleAttempt.current;
    try {
      setIsGoogleLoading(true);
      clearError();
      await login();
    } catch (err: unknown) {
      if (attempt !== googleAttempt.current) return;
      const errorCode = getAuthErrorCode(err);
      if (errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request') return;
      console.error('Login error:', err);
      setError(getFirebaseErrorMessage(errorCode));
    } finally {
      if (attempt === googleAttempt.current) setIsGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (isRegisterMode && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setIsLoading(true);
      if (isRegisterMode) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: unknown) {
      console.error('Email auth error:', err);
      setError(getFirebaseErrorMessage(getAuthErrorCode(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    clearError();
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-zinc-950">
          <motion.div
            animate={{ y: [0, 32] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="absolute inset-0 opacity-[0.06] w-full"
            style={{
              height: '200%',
              top: '-50%',
              backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          <motion.div
            animate={{
              x: [0, 100, 0, -100, 0],
              y: [0, 50, 100, 50, 0],
              scale: [1, 1.2, 1, 0.8, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/10 blur-[100px]"
          />
          <motion.div
            animate={{
              x: [0, -100, 0, 100, 0],
              y: [0, -50, -100, -50, 0],
              scale: [1, 1.5, 1, 1.2, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-zinc-400/10 blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[30%] left-[20%] w-[50%] h-[50%] rounded-full bg-zinc-300/10 blur-[80px]"
          />

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
            transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
          >
            <h1 className="text-5xl lg:text-6xl font-medium leading-[1.1] tracking-tight mb-6">
              El control total de tu negocio,
              <br />
              <span className="text-zinc-500">en un solo lugar.</span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-md leading-relaxed">
              Gestiona inventario, ventas, clientes y canjes con la plataforma más intuitiva y profesional del mercado.
            </p>
          </motion.div>
        </div>

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
                animate={{ width: '100%' }}
                transition={{ duration: 2, delay: 1, ease: 'easeInOut' }}
                className="h-full bg-zinc-500 rounded-full"
              />
            </div>
            <div className="h-2 bg-zinc-800 rounded-full w-3/4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, delay: 1.2, ease: 'easeInOut' }}
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

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative">
        <motion.div layout className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="bg-black text-white p-2.5 rounded-xl">
              <Package size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight">iManager</span>
          </div>

          <motion.div layout className="mb-8 text-center">
            <AnimatePresence mode="wait">
              {inviteToken && (inviteState.isLoading || inviteState.preview || inviteState.invalid || inviteState.error) && (
                <motion.div
                  key={
                    inviteState.invalid
                      ? 'invite-invalid'
                      : inviteState.error
                        ? 'invite-error'
                        : inviteState.preview
                          ? 'invite-preview'
                          : inviteState.isRetrying
                            ? 'invite-retrying'
                            : 'invite-loading'
                  }
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`mb-6 rounded-2xl border px-4 py-4 text-left ${
                    inviteState.invalid
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : inviteState.error
                        ? 'border-orange-200 bg-orange-50 text-orange-900'
                        : 'border-blue-200 bg-blue-50 text-blue-900'
                  }`}
                >
                  {inviteState.isLoading ? (
                    <>
                      <p className="text-sm font-semibold">
                        {inviteState.isRetrying ? 'Reintentando verificación de invitación…' : 'Verificando invitación…'}
                      </p>
                      <p className="mt-1 text-sm text-blue-800">
                        {inviteState.isRetrying
                          ? 'Railway está tardando en responder. Seguimos intentando cargar los datos de la tienda.'
                          : 'Estamos cargando los datos de la tienda antes de que inicies sesión.'}
                      </p>
                    </>
                  ) : inviteState.preview ? (
                    <>
                      <p className="text-sm font-semibold">Te invitaron a una tienda</p>
                      <p className="mt-1 text-sm">
                        Vas a unirte a <strong>{inviteState.preview.storeName}</strong>
                        {roleLabel ? <> como <strong>{roleLabel}</strong></> : null}.
                      </p>
                      <p className="mt-2 text-xs text-blue-800">
                        Iniciá sesión o creá tu cuenta para aceptar esta invitación después.
                      </p>
                    </>
                  ) : inviteState.error ? (
                    <>
                      <p className="text-sm font-semibold">No pudimos verificar la invitación todavía</p>
                      <p className="mt-1 text-sm text-orange-800">
                        {inviteState.error}
                      </p>
                      <p className="mt-2 text-xs text-orange-800">
                        El enlace puede seguir siendo válido. Probá iniciar sesión igual y te mostramos el estado después.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Esta invitación ya no está disponible</p>
                      <p className="mt-1 text-sm text-amber-800">
                        El enlace expiró, ya fue usado o no es válido. Igual podés iniciar sesión normalmente.
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={isRegisterMode ? 'register-title' : 'login-title'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
                  {isRegisterMode ? 'Crear cuenta' : 'Bienvenido a iManager'}
                </h2>
                <p className="text-gray-500">
                  {isRegisterMode
                    ? 'Registrate para comenzar a gestionar tu negocio.'
                    : 'Inicia sesión para gestionar tu negocio.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form layout onSubmit={handleEmailSubmit} className="space-y-4 mb-6">
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="login-email"
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                required
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
              />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                data-testid="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                required
                minLength={6}
                className="w-full pl-11 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <AnimatePresence>
              {isRegisterMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden"
                >
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirmar contraseña"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearError();
                    }}
                    required
                    minLength={6}
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              data-testid="login-submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={isLoading}
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-black text-white rounded-xl font-medium hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegisterMode ? 'Crear cuenta' : 'Iniciar sesión'}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </motion.form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-400">o</span>
            </div>
          </div>

          <motion.button
            data-testid="login-google"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
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
            Continuar con Google
          </motion.button>

          <motion.p layout className="text-center text-sm text-gray-500 mt-8">
            {isRegisterMode ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}{' '}
            <button
              onClick={toggleMode}
              type="button"
              className="text-black font-semibold hover:underline transition-all"
            >
              {isRegisterMode ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};
