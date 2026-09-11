import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const { colors } = useTheme();
  
  return (
    <Tabs screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: 'transparent' },
      tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, borderTopRightRadius: 30, borderBottomRightRadius: 30, margin: 20 },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textSub,
    }}>
      <Tabs.Screen 
        name="index" 
        options={{
          title: 'Playlists',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="chords" 
        options={{
          title: 'Cifras',
          tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes" size={size} color={color} />
        }} 
      />
    </Tabs>
  );
}
