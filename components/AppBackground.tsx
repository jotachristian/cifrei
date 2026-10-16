import React from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

export function AppBackground() {
  const { isDark } = useTheme();
  const { width, height } = useWindowDimensions();

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.rootContainer]} pointerEvents="none">
      {/* 1. Fundo Base Sólido Opaque (Evita vazamento de camadas entre telas) */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: isDark ? '#0f0f12' : '#f5f6fa' },
        ]}
      />

      {/* 2. Orbs / Esferas de luz vermelha difusa */}
      {/* Orb Topo Direito - Tom Vermelho / Vinho */}
      <View
        style={[
          styles.orb,
          {
            top: -height * 0.08,
            right: -width * 0.25,
            width: Math.max(width * 1.05, 320),
            height: Math.max(width * 1.05, 320),
            borderRadius: Math.max(width * 1.05, 320) / 2,
            opacity: isDark ? 0.50 : 0.40,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['#b91c1c', '#7f1d1d', 'transparent']
              : ['#ff2d55', '#ff6b81', 'transparent']
          }
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.9, y: 0.9 }}
        />
      </View>

      {/* Orb Inferior Esquerdo - Tom Secundário Suave */}
      <View
        style={[
          styles.orb,
          {
            bottom: -height * 0.05,
            left: -width * 0.3,
            width: Math.max(width * 0.95, 300),
            height: Math.max(width * 0.95, 300),
            borderRadius: Math.max(width * 0.95, 300) / 2,
            opacity: isDark ? 0.42 : 0.34,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['#831843', '#4c0519', 'transparent']
              : ['#ff477e', '#ffa8ba', 'transparent']
          }
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 0.9, y: 0.9 }}
        />
      </View>

      {/* Orb Centro/Destaque sutil com a cor de destaque do app */}
      <View
        style={[
          styles.orb,
          {
            top: height * 0.3,
            left: -width * 0.2,
            width: Math.max(width * 0.75, 260),
            height: Math.max(width * 0.75, 260),
            borderRadius: Math.max(width * 0.75, 260) / 2,
            opacity: isDark ? 0.32 : 0.26,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['#991b1b', '#3b0764', 'transparent']
              : ['#ff5277', '#fed7aa', 'transparent']
          }
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.8, y: 0.8 }}
        />
      </View>

      {/* 3. Camada de Desfoque e Textura de Vidro iOS (BlurView) */}
      <BlurView
        style={StyleSheet.absoluteFillObject}
        tint={isDark ? 'dark' : 'light'}
        intensity={PlatformBlurIntensity}
        experimentalBlurMethod="dimezisBlurView"
      />

      {/* 4. Overlay de acabamento leitoso / fosco suave */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: isDark
              ? 'rgba(15, 15, 18, 0.30)'
              : 'rgba(255, 255, 255, 0.25)',
          },
        ]}
      />
    </View>
  );
}

const PlatformBlurIntensity = 80;

const styles = StyleSheet.create({
  rootContainer: {
    overflow: 'hidden',
    zIndex: 0,
  },
  orb: {
    position: 'absolute',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          filter: 'blur(60px)',
          WebkitFilter: 'blur(60px)',
          transform: 'translate3d(0, 0, 0)',
        } as any)
      : {}),
  },
});

