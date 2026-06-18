/**
 * @fileoverview Allergies form component - Step 3 of booking wizard
 * Displays cards for each member (adults + children) with 14 allergen icons
 */

import { useSelector, useDispatch } from 'react-redux';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, User, Baby, Check, AlertTriangle } from 'lucide-react';
import { setStep, updateMemberAllergy, selectBookingTotals } from '../../store/bookingSlice';

// 14 EU allergens with their icons (using emoji for simplicity, can be replaced with custom icons)
const ALLERGENS = [
  { id: 'gluten', name: 'Gluten', icon: '🌾' },
  { id: 'crustaceans', name: 'Crustáceos', icon: '🦐' },
  { id: 'eggs', name: 'Huevos', icon: '🥚' },
  { id: 'fish', name: 'Pescado', icon: '🐟' },
  { id: 'peanuts', name: 'Cacahuetes', icon: '🥜' },
  { id: 'soy', name: 'Soja', icon: '🫘' },
  { id: 'dairy', name: 'Lácteos', icon: '🥛' },
  { id: 'nuts', name: 'Frutos secos', icon: '🌰' },
  { id: 'celery', name: 'Apio', icon: '🥬' },
  { id: 'mustard', name: 'Mostaza', icon: '🟡' },
  { id: 'sesame', name: 'Sésamo', icon: '⚪' },
  { id: 'sulfites', name: 'Sulfitos', icon: '🍷' },
  { id: 'lupin', name: 'Altramuces', icon: '🌸' },
  { id: 'mollusks', name: 'Moluscos', icon: '🦪' },
];

function MemberCard({ memberType, memberIndex, label, icon: Icon }) {
  const dispatch = useDispatch();
  const { memberAllergies } = useSelector((state) => state.booking);
  
  const memberData = memberAllergies.find(
    m => m.memberType === memberType && m.memberIndex === memberIndex
  ) || { name: '', lastname: '', allergies: [] };

  const hasAllergies = memberData.allergies.length > 0;
  const hasNameError = hasAllergies && (!memberData.name.trim() || !memberData.lastname.trim());

  const updateField = (field, value) => {
    dispatch(updateMemberAllergy({
      memberType,
      memberIndex,
      data: { [field]: value }
    }));
  };

  const toggleAllergy = (allergyId) => {
    const currentAllergies = memberData.allergies || [];
    const newAllergies = currentAllergies.includes(allergyId)
      ? currentAllergies.filter(a => a !== allergyId)
      : [...currentAllergies, allergyId];
    updateField('allergies', newAllergies);
  };

  return (
    <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          memberType === 'adult' ? 'bg-princess-purple/30' : 'bg-princess-gold/30'
        }`}>
          <Icon className={`w-5 h-5 ${memberType === 'adult' ? 'text-princess-purple' : 'text-princess-gold'}`} />
        </div>
        <span className="text-white font-semibold">{label}</span>
        {hasAllergies && (
          <span className="ml-auto px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            {memberData.allergies.length} alergia{memberData.allergies.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Name fields - only required if allergies selected */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <input
            type="text"
            value={memberData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Nombre"
            className={`w-full px-3 py-2 bg-white/10 border rounded-lg text-white text-base placeholder-white/40 focus:outline-none focus:border-princess-pink transition-colors ${
              hasNameError && !memberData.name.trim() ? 'border-red-500' : 'border-white/20'
            }`}
          />
        </div>
        <div>
          <input
            type="text"
            value={memberData.lastname}
            onChange={(e) => updateField('lastname', e.target.value)}
            placeholder="Apellidos"
            className={`w-full px-3 py-2 bg-white/10 border rounded-lg text-white text-base placeholder-white/40 focus:outline-none focus:border-princess-pink transition-colors ${
              hasNameError && !memberData.lastname.trim() ? 'border-red-500' : 'border-white/20'
            }`}
          />
        </div>
      </div>
      {hasNameError && (
        <p className="text-red-400 text-xs mb-3 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Nombre y apellidos requeridos si hay alergias
        </p>
      )}

      {/* Allergen grid */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {ALLERGENS.map((allergen) => {
          const isSelected = memberData.allergies?.includes(allergen.id);
          return (
            <button
              key={allergen.id}
              type="button"
              onClick={() => toggleAllergy(allergen.id)}
              className={`relative flex flex-col items-center p-2 rounded-lg transition-all ${
                isSelected 
                  ? 'bg-princess-pink/30 border-2 border-princess-pink' 
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
              title={allergen.name}
            >
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <span className={`text-xl ${isSelected ? '' : 'grayscale opacity-50'}`}>
                {allergen.icon}
              </span>
              <span className={`text-[10px] mt-1 text-center leading-tight ${
                isSelected ? 'text-white' : 'text-white/50'
              }`}>
                {allergen.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AllergiesForm() {
  const dispatch = useDispatch();
  const { memberAllergies } = useSelector((state) => state.booking);
  const { adults: adultsCount, children: childrenCount } = useSelector(selectBookingTotals);

  // Validation: check if any member with allergies is missing name/lastname
  const hasValidationErrors = memberAllergies.some(
    m => m.allergies.length > 0 && (!m.name.trim() || !m.lastname.trim())
  );

  const handleNext = () => {
    if (!hasValidationErrors) {
      dispatch(setStep(4));
    }
  };

  // Generate member cards
  const members = [];
  for (let i = 0; i < adultsCount; i++) {
    members.push({
      memberType: 'adult',
      memberIndex: i,
      label: `Adulto ${i + 1}`,
      icon: User,
    });
  }
  for (let i = 0; i < childrenCount; i++) {
    members.push({
      memberType: 'child',
      memberIndex: i,
      label: `Niño/a ${i + 1}`,
      icon: Baby,
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-display font-bold text-white mb-2">
          Información de Alergias
        </h3>
        <p className="text-white/60 text-sm">
          Selecciona las alergias de cada asistente. Si no hay alergias, puedes continuar.
        </p>
      </div>

      {/* Member cards */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {members.map((member) => (
          <MemberCard
            key={`${member.memberType}-${member.memberIndex}`}
            {...member}
          />
        ))}
      </div>

      {/* Validation error message */}
      {hasValidationErrors && (
        <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Completa nombre y apellidos de los miembros con alergias seleccionadas
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={() => dispatch(setStep(2))}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Atrás
        </button>
        <button
          onClick={handleNext}
          disabled={hasValidationErrors}
          className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
