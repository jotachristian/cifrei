import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { initDatabase } from '@/lib/database';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    try { initDatabase(); } catch (e) { console.error(e); }
    finally { SplashScreen.hideAsync(); }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0e0e0f' }}>
      <ThemeProvider>
        <StatusBar style="light" translucent />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0e0e0f' },
            animation: 'none',
            gestureEnabled: false,
          }}
        />
      </ThemeProvider>
    </View>
  );
}
