import 'react-native-get-random-values';
// Aplica Poppins globalmente em todo <Text> (patch do JSX runtime). Precisa vir
// antes de qualquer outra coisa renderizar — por isso é o primeiro import.
import '@/lib/globalFont';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { initDatabase } from '@/lib/database';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AppBackground } from '@/components/AppBackground';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { Comfortaa_700Bold } from '@expo-google-fonts/comfortaa';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Comfortaa_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      SplashScreen.hideAsync().catch(() => {});
    };
    const fallback = setTimeout(hide, 3000);
    (async () => {
      try {
        await initDatabase();
      }
      catch (e) { console.error(e); }
      finally {
        if (fontsLoaded) {
          clearTimeout(fallback);
          hide();
        }
      }
    })();
    return () => clearTimeout(fallback);
  }, [fontsLoaded]);

  // Espera as fontes carregarem antes de montar a árvore, senão o primeiro
  // render usaria a fonte do sistema até a Poppins ficar pronta.
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}

function RootContent() {
  const { isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'none',
          gestureEnabled: false,
        }}
      />
    </View>
  );
}
