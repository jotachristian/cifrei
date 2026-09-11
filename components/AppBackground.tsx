import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

export function AppBackground() {
  const { colors, isDark } = useTheme();

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* 1. Fundo Base Autêntico iOS (Branco no Light / Preto profundo no Dark) */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: isDark ? '#0a0a0d' : '#f6f7fb' },
        ]}
      />

      {/* 2. Orbs / Esferas de luz vermelha difusa para compor o fundo */}
      {/* Orb Topo Direito - Tom Vermelho / Vinho */}
      <View
        style={[
          styles.orb,
          {
            top: -height * 0.08,
            right: -width * 0.25,
            width: width * 1.1,
            height: width * 1.1,
            borderRadius: (width * 1.1) / 2,
            opacity: isDark ? 0.45 : 0.38,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['#b91c1c', '#7f1d1d', 'transparent'] // Vinho / Carmesim profundo no Dark
              : ['#ff2d55', '#ff6b81', 'transparent'] // Vermelho vivo e rosa no Light -> pastel leitoso
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
            width: width * 1.0,
            height: width * 1.0,
            borderRadius: (width * 1.0) / 2,
            opacity: isDark ? 0.40 : 0.32,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['#831843', '#4c0519', 'transparent'] // Profundidade vinho/púrpura no Dark
              : ['#ff477e', '#ffa8ba', 'transparent'] // Rosa pastel leitoso no Light
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
            width: width * 0.8,
            height: width * 0.8,
            borderRadius: (width * 0.8) / 2,
            opacity: isDark ? 0.30 : 0.25,
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
              ? 'rgba(10, 10, 13, 0.35)'
              : 'rgba(255, 255, 255, 0.28)',
          },
        ]}
      />
    </View>
  );
}

const PlatformBlurIntensity = 75;

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
