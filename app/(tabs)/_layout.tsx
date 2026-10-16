import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.bg },
      tabBarStyle: { backgroundColor: colors.bg, borderColor: colors.bg, borderTopWidth:1, margin:6},
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
