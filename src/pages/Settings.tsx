import React, { useState, useEffect } from 'react';
import { Store, User, Shield, CreditCard, Save, Check, Key, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAppContext } from '../context/AppContext';
import type { StoreUpdateInput } from '../services/settings-api';

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

interface SettingsProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
    />
  );
}

function SaveButton({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <motion.button
      type="submit"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      disabled={loading}
      className="px-6 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors disabled:opacity-60"
    >
      {saved ? <Check size={16} /> : <Save size={16} />}
      {saved ? 'Guardado' : loading ? 'Guardando…' : 'Guardar Cambios'}
    </motion.button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
      {message}
    </p>
  );
}

// ─── Store Tab ────────────────────────────────────────────────────────────────

function StoreTab() {
  const { appSession, updateStore } = useAppContext();
  const store = appSession?.store;

  const [form, setForm] = useState<StoreUpdateInput>({
    name: store?.name ?? '',
    legalName: store?.legalName ?? '',
    taxId: store?.taxId ?? '',
    phone: store?.phone ?? '',
    address: store?.address ?? '',
    currency: store?.currency ?? 'ARS',
    timezone: store?.timezone ?? 'America/Argentina/Buenos_Aires',
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if appSession loads after component mount
  useEffect(() => {
    if (!store) return;
    setForm({
      name: store.name,
      legalName: store.legalName ?? '',
      taxId: store.taxId ?? '',
      phone: store.phone ?? '',
      address: store.address ?? '',
      currency: store.currency,
      timezone: store.timezone,
    });
  }, [store?.id]);

  const handleChange = (key: keyof StoreUpdateInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await updateStore({
        name: form.name,
        legalName: form.legalName || null,
        taxId: form.taxId || null,
        phone: form.phone || null,
        address: form.address || null,
        currency: form.currency,
        timezone: form.timezone,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      key="store"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-8 w-full"
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-bold text-gray-900 mb-6">Información de la Tienda</h2>

      <div className="space-y-6">
        <div className="flex items-center gap-6 pb-6 border-b border-gray-100">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">
            <Store size={32} />
          </div>
          <div>
            <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 mb-2 transition-colors">
              Cambiar Logo
            </motion.button>
            <p className="text-xs text-gray-500">JPG, GIF o PNG. Tamaño máximo de 2MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FieldGroup label="Nombre de la Tienda">
            <TextInput required value={form.name ?? ''} onChange={handleChange('name')} />
          </FieldGroup>
          <FieldGroup label="Razón Social">
            <TextInput value={form.legalName ?? ''} onChange={handleChange('legalName')} />
          </FieldGroup>
          <FieldGroup label="CUIT / RUT">
            <TextInput value={form.taxId ?? ''} onChange={handleChange('taxId')} />
          </FieldGroup>
          <FieldGroup label="Teléfono de Contacto">
            <TextInput value={form.phone ?? ''} onChange={handleChange('phone')} />
          </FieldGroup>
          <div className="col-span-1 sm:col-span-2">
            <FieldGroup label="Dirección Comercial">
              <TextInput value={form.address ?? ''} onChange={handleChange('address')} />
            </FieldGroup>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Configuración Regional</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FieldGroup label="Moneda Principal">
              <select
                value={form.currency}
                onChange={handleChange('currency')}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none appearance-none transition-shadow"
              >
                <option value="ARS">ARS - Peso Argentino</option>
                <option value="USD">USD - Dólar Estadounidense</option>
                <option value="EUR">EUR - Euro</option>
                <option value="CLP">CLP - Peso Chileno</option>
                <option value="COP">COP - Peso Colombiano</option>
                <option value="MXN">MXN - Peso Mexicano</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Zona Horaria">
              <select
                value={form.timezone}
                onChange={handleChange('timezone')}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none appearance-none transition-shadow"
              >
                <option value="America/Argentina/Buenos_Aires">(GMT-03:00) Buenos Aires</option>
                <option value="America/Bogota">(GMT-05:00) Bogotá, Lima, Quito</option>
                <option value="America/Mexico_City">(GMT-06:00) Ciudad de México</option>
                <option value="America/Santiago">(GMT-04:00) Santiago de Chile</option>
                <option value="America/Sao_Paulo">(GMT-03:00) São Paulo</option>
              </select>
            </FieldGroup>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="pt-6 flex justify-end">
          <SaveButton loading={loading} saved={saved} />
        </div>
      </div>
    </motion.form>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { appSession, updateUserProfile } = useAppContext();
  const sessionUser = appSession?.user;

  const [displayName, setDisplayName] = useState(sessionUser?.displayName ?? '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(sessionUser?.displayName ?? '');
  }, [sessionUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await updateUserProfile({ displayName: displayName.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const avatarSrc = sessionUser?.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=000&color=fff`;

  return (
    <motion.form
      key="profile"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-8 w-full"
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-bold text-gray-900 mb-6">Mi Perfil</h2>
      <div className="space-y-6">
        <div className="flex items-center gap-6 pb-6 border-b border-gray-100">
          <div className="w-20 h-20 bg-gray-100 rounded-full border border-gray-200 overflow-hidden shrink-0">
            <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{displayName || '—'}</p>
            <p className="text-xs text-gray-500 mt-1">{sessionUser?.email ?? ''}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="col-span-1 sm:col-span-2">
            <FieldGroup label="Nombre para mostrar">
              <TextInput
                required
                value={displayName}
                onChange={e => { setSaved(false); setDisplayName(e.target.value); }}
              />
            </FieldGroup>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <FieldGroup label="Correo Electrónico">
              <TextInput type="email" value={sessionUser?.email ?? ''} disabled />
            </FieldGroup>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <FieldGroup label="Rol">
              <TextInput value={appSession?.membership?.role ?? '—'} disabled />
            </FieldGroup>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="pt-6 flex justify-end">
          <SaveButton loading={loading} saved={saved} />
        </div>
      </div>
    </motion.form>
  );
}

// ─── Static tabs (UI only) ────────────────────────────────────────────────────

function PreviewBanner() {
  return (
    <div className="mx-8 mt-8 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4">
      <p className="text-sm font-semibold">Módulo en preview</p>
      <p className="text-sm mt-1">Esta sección todavía no persiste cambios reales.</p>
    </div>
  );
}

function SecurityTab() {
  const { user } = useAppContext();

  const isEmailUser = user?.providerData.some(p => p.providerId === 'password') ?? false;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setError(null);

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('La contraseña actual es incorrecta.');
      } else if (code === 'auth/weak-password') {
        setError('La nueva contraseña es demasiado débil.');
      } else {
        setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key="security"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <div className="p-8 space-y-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Seguridad de la Cuenta</h2>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
            <Key size={16} /> Cambiar Contraseña
          </h3>

          {!isEmailUser ? (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              Tu cuenta usa inicio de sesión con Google. No es posible cambiar la contraseña desde aquí.
            </p>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <FieldGroup label="Contraseña Actual">
                <TextInput
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={e => { setError(null); setSaved(false); setCurrentPassword(e.target.value); }}
                  required
                />
              </FieldGroup>
              <FieldGroup label="Nueva Contraseña">
                <TextInput
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => { setError(null); setSaved(false); setNewPassword(e.target.value); }}
                  required
                />
              </FieldGroup>
              <FieldGroup label="Confirmar Nueva Contraseña">
                <TextInput
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => { setError(null); setSaved(false); setConfirmPassword(e.target.value); }}
                  required
                />
              </FieldGroup>

              {error && <ErrorBanner message={error} />}

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors disabled:opacity-60"
              >
                {saved ? <Check size={16} /> : <Key size={16} />}
                {saved ? 'Contraseña actualizada' : loading ? 'Actualizando…' : 'Actualizar Contraseña'}
              </motion.button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── BillingTabFull — UI completa, reservada para cuando se active la facturación real ───
// function BillingTabFull() {
//   return (
//     <motion.div key="billing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="w-full">
//       <PreviewBanner />
//       <div className="p-8 space-y-8">
//         <h2 className="text-lg font-bold text-gray-900 mb-6">Facturación y Suscripción</h2>
//         <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl text-white">
//           <div className="flex justify-between items-start mb-6">
//             <div>
//               <p className="text-gray-400 text-sm font-medium mb-1">Plan Actual</p>
//               <h3 className="text-2xl font-black">Pro Business</h3>
//             </div>
//             <span className="px-3 py-1 bg-white/10 text-white text-xs font-bold rounded-full">Activo</span>
//           </div>
//           <div className="flex items-end gap-2 mb-6">
//             <span className="text-4xl font-black">$49</span>
//             <span className="text-gray-400 text-sm mb-1">/ mes</span>
//           </div>
//           <div className="flex gap-4">
//             <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors">Cambiar Plan</motion.button>
//             <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors">Cancelar</motion.button>
//           </div>
//         </div>
//         <div className="space-y-4">
//           <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Historial de Facturas</h3>
//           <div className="border border-gray-200 rounded-xl overflow-hidden">
//             <table className="w-full text-left text-sm">
//               <thead className="bg-gray-50">
//                 <tr className="text-gray-500">
//                   <th className="px-4 py-3 font-medium">Fecha</th>
//                   <th className="px-4 py-3 font-medium">Monto</th>
//                   <th className="px-4 py-3 font-medium">Estado</th>
//                   <th className="px-4 py-3 font-medium text-right">Factura</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-100">
//                 {['01 Mar 2026', '01 Feb 2026'].map(date => (
//                   <tr key={date}>
//                     <td className="px-4 py-3 text-gray-900">{date}</td>
//                     <td className="px-4 py-3 text-gray-900">$49.00</td>
//                     <td className="px-4 py-3"><span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">Pagado</span></td>
//                     <td className="px-4 py-3 text-right"><button type="button" className="text-gray-400 hover:text-gray-900"><Download size={16} /></button></td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </div>
//     </motion.div>
//   );
// }

function BillingTab() {
  return (
    <motion.div
      key="billing"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <div className="p-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Facturación y Suscripción</h2>
        <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl text-white flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-white/10 text-white text-xs font-bold rounded-full mb-3">
              Usuario Beta
            </span>
            <h3 className="text-xl font-black mb-2">Acceso gratuito durante el beta</h3>
            <p className="text-gray-400 text-sm max-w-xs">
              Sos parte del programa de acceso anticipado. Por ahora iManager es completamente gratuito para vos.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Settings component ──────────────────────────────────────────────────

export const Settings: React.FC<SettingsProps> = ({ activeTab: externalActiveTab, setActiveTab: externalSetActiveTab }) => {
  const [internalActiveTab, setInternalActiveTab] = useState('store');

  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = externalSetActiveTab ?? setInternalActiveTab;

  const tabs = [
    { id: 'store', label: 'Datos de la Tienda', icon: Store },
    { id: 'profile', label: 'Mi Perfil', icon: User },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'billing', label: 'Facturación', icon: CreditCard },
  ];

  const tabContent: Record<string, React.ReactNode> = {
    store: <StoreTab />,
    profile: <ProfileTab />,
    security: <SecurityTab />,
    billing: <BillingTab />,
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col flex-1">
      <motion.div variants={item} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
        <p className="text-gray-500 text-sm">Administra las preferencias y ajustes de tu cuenta.</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-8 flex-1 overflow-hidden">
        <motion.div variants={item} className="w-full md:w-64 shrink-0 space-y-1 overflow-x-auto md:overflow-visible flex md:block pb-2 md:pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.id)}
                className={`w-auto md:w-full flex-shrink-0 md:flex-shrink flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors relative ${
                  isActive ? 'text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="settingsTab"
                    className="absolute inset-0 bg-white shadow-sm border border-gray-200 rounded-xl"
                    style={{ zIndex: -1 }}
                  />
                )}
                <Icon size={18} className={isActive ? 'text-gray-900 relative z-10' : 'text-gray-400 relative z-10'} />
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        <motion.div variants={item} className="flex-1 max-w-3xl bg-white border border-gray-200 rounded-2xl overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {tabContent[activeTab] ?? null}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};
