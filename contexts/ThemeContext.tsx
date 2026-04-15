import React, { createContext, useContext } from 'react';
import { appColors, Colors } from '@/lib/theme';

interface ThemeContextType {
  colors: Colors;
}

const ThemeContext = createContext<ThemeContextType>({ colors: appColors });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors: appColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
