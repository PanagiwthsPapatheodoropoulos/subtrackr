/**
 * components/ui/FormField.tsx
 * 
 * Reusable form field used across auth screens.
 * 100% NativeWind except: borderColor (dynamic), boxShadow (web-only)
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, TextInputProps } from 'react-native';

const IS_WEB = Platform.OS === 'web';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
}

export function FormField({ label, error, isPassword, ...props }: FormFieldProps) {
  const [focused, setFocused]   = useState(false);
  const [showVal, setShowVal]   = useState(false);

  return (
    <View className="mb-4">
      <Text className="text-slate-500 text-[10px] font-bold tracking-[1px] uppercase mb-2">
        {label}
      </Text>

      <View
        className="rounded-xl overflow-hidden flex-row items-center"
        style={{
          borderWidth: 1.5,
          borderColor: error ? '#ef4444' : focused ? '#7c3aed' : 'rgba(255,255,255,0.07)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          ...(IS_WEB ? {
            transition: 'border-color .2s, box-shadow .2s',
            boxShadow: error
              ? '0 0 0 3px rgba(239,68,68,.12)'
              : focused
                ? '0 0 0 3px rgba(124,58,237,.14)'
                : 'none',
          } : {}),
        } as any}
      >
        <TextInput
          className="flex-1 text-white text-[15px] px-4 py-3.5 bg-transparent"
          placeholderTextColor="#2d3f5a"
          secureTextEntry={isPassword && !showVal}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowVal(v => !v)} className="px-4 justify-center">
            <Text className="text-slate-500 text-[10px] font-bold tracking-wider">
              {showVal ? 'HIDE' : 'SHOW'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text className="text-red-400 text-xs mt-1.5 ml-1">{error}</Text>
      ) : null}
    </View>
  );
}