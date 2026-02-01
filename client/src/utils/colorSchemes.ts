export interface ColorScheme {
  id: string;
  name: string;
  gradient: string;
  primary: string;
  secondary: string;
}

export const colorSchemes: ColorScheme[] = [
  {
    id: 'purple',
    name: 'Lila Traum',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    primary: '#667eea',
    secondary: '#764ba2',
  },
  {
    id: 'blue',
    name: 'Ozean Blau',
    gradient: 'linear-gradient(135deg, #2e3192 0%, #1bffff 100%)',
    primary: '#2e3192',
    secondary: '#1bffff',
  },
  {
    id: 'sunset',
    name: 'Sonnenuntergang',
    gradient: 'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)',
    primary: '#ff512f',
    secondary: '#dd2476',
  },
  {
    id: 'forest',
    name: 'Waldgrün',
    gradient: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
    primary: '#134e5e',
    secondary: '#71b280',
  },
  {
    id: 'orange',
    name: 'Orange Feuer',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    primary: '#f093fb',
    secondary: '#f5576c',
  },
  {
    id: 'night',
    name: 'Mitternacht',
    gradient: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
    primary: '#0f2027',
    secondary: '#2c5364',
  },
  {
    id: 'mint',
    name: 'Minzfrisch',
    gradient: 'linear-gradient(135deg, #00d2ff 0%, #3a47d5 50%, #00d2ff 100%)',
    primary: '#00d2ff',
    secondary: '#3a47d5',
  },
  {
    id: 'rose',
    name: 'Roségold',
    gradient: 'linear-gradient(135deg, #ED4264 0%, #FFEDBC 100%)',
    primary: '#ED4264',
    secondary: '#FFEDBC',
  },
];

export const getColorScheme = (id: string): ColorScheme => {
  return colorSchemes.find(scheme => scheme.id === id) || colorSchemes[0];
};
