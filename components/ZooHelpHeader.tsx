import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';

const ZOOHELP_HEADER_LOGO =
  'https://res.cloudinary.com/limpeja/image/upload/v1779564981/Gemini_Generated_Image_isin7wisin7wisin-removebg-preview_yx0k5g.png';

type ZooHelpHeaderProps = {
  onBack?: () => void;
};

export function ZooHelpHeader({ onBack }: ZooHelpHeaderProps = {}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 8 : Math.max(insets.top, 8);

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: '#F5F7F2', borderBottomColor: '#E4EAE5', paddingTop: topPad },
      ]}
    >
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.78}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSideSpacer} />
      )}
      <View pointerEvents="none" style={styles.logoCenter}>
        <View style={styles.logoRow}>
          <Image source={{ uri: ZOOHELP_HEADER_LOGO }} style={styles.logoIcon} contentFit="contain" />
          <Text style={[styles.logoText, { color: colors.primary }]}>Helpers</Text>
           
        </View>
      </View>
      <View style={styles.headerSideSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 1,
    gap: 10,
    borderBottomWidth: 1,
    minHeight: 50,
  },
  backBtn: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', bottom: 2, },
  headerSideSpacer: { width: 40, height: 40 },
  logoCenter: {
    position: 'absolute',
    left: -20,
    right: 0,
    bottom: 4,
    height: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  logoIcon: {
    width: 32.5,
    height: 25.5,
    borderRadius: 8,
  },
  logoText: {
    marginLeft: -1,
    top: 1,
    fontSize: 17.5,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: -1,
    lineHeight: 28,
    marginRight: 6,
    textShadowColor: 'rgba(46,125,50,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  communityLabel: {
  fontSize: 11,
  fontWeight: '300',
  letterSpacing: 1.04,
  marginTop: 2,
  color: '#a3a3a3',
  textShadowColor: 'rgba(0, 0, 0, 0.06)',
  textShadowOffset: {
    width: 0,
    height: 1,
  },
  textShadowRadius: 2,
},
});
