import React from 'react';
import { View, ActivityIndicator } from 'react-native';

// Shown while the stored refresh token is being validated on app launch.
export default function SplashGate() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#0052CC" />
    </View>
  );
}
