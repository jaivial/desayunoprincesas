/**
 * @fileoverview Booking form component - Step 2 of booking wizard
 */

import { useSelector, useDispatch } from 'react-redux';
import { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, User, Mail, Phone } from 'lucide-react';
import { setFormField, setStep } from '../../store/bookingSlice';
import Select from '../ui/Select';

const countryCodes = [
  { value: '+34', label: '🇪🇸 +34 España' },
  { value: '+33', label: '🇫🇷 +33 Francia' },
  { value: '+44', label: '🇬🇧 +44 Reino Unido' },
  { value: '+49', label: '🇩🇪 +49 Alemania' },
  { value: '+39', label: '🇮🇹 +39 Italia' },
  { value: '+351', label: '🇵🇹 +351 Portugal' },
  { value: '+1', label: '🇺🇸 +1 EEUU/Canadá' },
  { value: '+52', label: '🇲🇽 +52 México' },
  { value: '+54', label: '🇦🇷 +54 Argentina' },
  { value: '+57', label: '🇨🇴 +57 Colombia' },
];

export default function BookingForm() {
  const dispatch = useDispatch();
  const { name, surname, email, phoneCountryCode, phoneNumber } = useSelector((state) => state.booking);
  const [errors, setErrors] = useState({});
  const phoneInputRefs = useRef([]);

  const phoneDigits = phoneNumber.split('').slice(0, 9);
  while (phoneDigits.length < 9) phoneDigits.push('');

  const handlePhoneDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...phoneDigits];
    newDigits[index] = value.slice(-1);
    const newPhone = newDigits.join('');
    dispatch(setFormField({ field: 'phoneNumber', value: newPhone }));

    if (value && index < 8) {
      phoneInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePhoneKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !phoneDigits[index] && index > 0) {
      phoneInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePhonePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 9);
    dispatch(setFormField({ field: 'phoneNumber', value: pasted }));
  };

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Nombre requerido';
    if (!surname.trim()) newErrors.surname = 'Apellidos requeridos';
    if (!email.trim()) newErrors.email = 'Email requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Email inválido';
    if (phoneNumber.length !== 9) newErrors.phone = 'Teléfono debe tener 9 dígitos';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      dispatch(setStep(3));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Name */}
        <div>
          <label className="flex items-center gap-2 text-white/80 mb-2">
            <User className="w-4 h-4" />
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => dispatch(setFormField({ field: 'name', value: e.target.value }))}
            className={`w-full px-4 py-3 bg-white/10 border ${errors.name ? 'border-red-500' : 'border-white/20'} rounded-xl text-white text-base placeholder-white/40 focus:outline-none focus:border-princess-pink transition-colors`}
            placeholder="Tu nombre"
          />
          {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Surname */}
        <div>
          <label className="flex items-center gap-2 text-white/80 mb-2">
            <User className="w-4 h-4" />
            Apellidos
          </label>
          <input
            type="text"
            value={surname}
            onChange={(e) => dispatch(setFormField({ field: 'surname', value: e.target.value }))}
            className={`w-full px-4 py-3 bg-white/10 border ${errors.surname ? 'border-red-500' : 'border-white/20'} rounded-xl text-white text-base placeholder-white/40 focus:outline-none focus:border-princess-pink transition-colors`}
            placeholder="Tus apellidos"
          />
          {errors.surname && <p className="text-red-400 text-sm mt-1">{errors.surname}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="flex items-center gap-2 text-white/80 mb-2">
          <Mail className="w-4 h-4" />
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => dispatch(setFormField({ field: 'email', value: e.target.value }))}
          className={`w-full px-4 py-3 bg-white/10 border ${errors.email ? 'border-red-500' : 'border-white/20'} rounded-xl text-white text-base placeholder-white/40 focus:outline-none focus:border-princess-pink transition-colors`}
          placeholder="tu@email.com"
        />
        {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="flex items-center gap-2 text-white/80 mb-2">
          <Phone className="w-4 h-4" />
          Teléfono
        </label>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Country code selector - Custom */}
          <Select
            value={phoneCountryCode}
            onChange={(value) => dispatch(setFormField({ field: 'phoneCountryCode', value }))}
            options={countryCodes}
            className="sm:w-48"
          />

          {/* OTP-style phone input */}
          <div className="flex gap-1 sm:gap-2 flex-1" onPaste={handlePhonePaste}>
            {phoneDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (phoneInputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePhoneDigitChange(index, e.target.value)}
                onKeyDown={(e) => handlePhoneKeyDown(index, e)}
                className={`w-9 h-12 sm:w-10 sm:h-14 text-center text-base sm:text-xl font-bold bg-white/10 border ${errors.phone ? 'border-red-500' : 'border-white/20'} rounded-lg text-white focus:outline-none focus:border-princess-pink transition-colors`}
              />
            ))}
          </div>
        </div>
        {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
      </div>

      {/* Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={() => dispatch(setStep(1))}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Atrás
        </button>
        <button
          onClick={handleNext}
          className="flex-1 btn-primary flex items-center justify-center gap-2"
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
