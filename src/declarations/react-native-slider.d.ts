// Minimal TypeScript declaration for @react-native-community/slider
// This prevents TS errors when the package is not yet installed.
declare module '@react-native-community/slider' {
  import { ComponentType } from 'react';
  const Slider: ComponentType<any>;
  export default Slider;
}
