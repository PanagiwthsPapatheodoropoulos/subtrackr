import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { CircleX, ArrowLeft } from 'lucide-react-native'; // Added icons

export default function PaymentCancel() {
  return (
    <View className="flex-1 bg-[#020617] items-center justify-center px-8">
      {/* Icon with soft red glow */}
      <View className="w-20 h-20 rounded-full bg-red-500/10 items-center justify-center mb-6 border border-red-500/20">
        <CircleX size={48} color="#ef4444" strokeWidth={1.5} />
      </View>

      <Text className="text-white text-xl font-bold text-center mb-2">
        Payment cancelled
      </Text>
      <Text className="text-slate-400 text-sm text-center mb-8 leading-5">
        No worries! You can upgrade any time{"\n"}from your profile.
      </Text>

      <TouchableOpacity
        onPress={() => router.replace('/(tabs)/')}
        className="bg-slate-800/50 border border-white/10 px-8 py-4 rounded-2xl flex-row items-center"
      >
        <ArrowLeft size={16} color="#94a3b8" style={{ marginRight: 8 }} />
        <Text className="text-slate-300 font-bold">Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}