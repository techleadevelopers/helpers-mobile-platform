import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { AUTHOR_TO_ONG, MOCK_ONGS, MOCK_POSTS } from '@/constants/data';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { shareZooHelpItem } from '@/services/share';
import { supportPaymentsEnabled } from '@/services/zoohelpApi';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k';
  return String(n);
}

const CAUSE_ICONS: Record<string, MCIcon> = {
  'Adoção responsável e resgate urbano': 'home-heart',
  'Combate a maus-tratos e adoção': 'shield-check',
  'Bem-estar animal público': 'city-variant',
  'Saúde e bem-estar veterinário': 'medical-bag',
  'Resgate em emergências e desastres': 'ambulance',
  'Captação e distribuição de recursos': 'hand-coin',
};

export default function OngProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const ongId = AUTHOR_TO_ONG[id] ?? id;
  const ong = MOCK_ONGS.find((o) => o.id === ongId);
  const ongPosts = MOCK_POSTS.filter((p) => AUTHOR_TO_ONG[p.author.id] === ongId);

  const { followedOngs, toggleFollowOng, donateToOng } = useApp();
  const following = followedOngs.includes(ongId);
  const [donated, setDonated] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.96)).current;
  const statsY = useRef(new Animated.Value(20)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const donateScale = useRef(new Animated.Value(0.92)).current;
  const donateOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(heroScale, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.spring(statsY, { toValue: 0, tension: 85, friction: 11, useNativeDriver: true }),
          Animated.timing(statsOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.parallel([
          Animated.spring(donateScale, { toValue: 1, tension: 75, friction: 9, useNativeDriver: true }),
          Animated.timing(donateOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  async function handleFollow() {
    try {
      await toggleFollowOng(ongId);
    } catch {
      Alert.alert('Não foi possível seguir', 'Entre na sua conta e tente novamente.');
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleDonate() {
    if (!supportPaymentsEnabled) {
      Alert.alert(
        'Apoio comunitario futuro',
        'O Helpin vai comecar sem cobranca. Apoio opcional, como R$1 para manter a infraestrutura, so sera habilitado depois de uso real, confianca e impacto comprovado.',
      );
      return;
    }
    setDonated(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    donateToOng(ongId).catch(() => {});
    setTimeout(() => setDonated(false), 2800);
  }

  function handleShare() {
    shareZooHelpItem(ong?.name ?? 'Helpin', `Ajude ${ong?.name ?? 'uma ONG'} no Helpin.`);
  }

  function handleContact() {
    if (!ong?.contact) return;
    const phone = ong.contact.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/55${phone}`).catch(() =>
      Linking.openURL(`tel:${ong.contact}`)
    );
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (!ong) {
    return (
      <View style={[styles.container, { backgroundColor: '#F1F2F1', justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="domain-off" size={48} color="#9CA3AF" />
        <Text style={[styles.errorText, { color: '#6B7280' }]}>ONG nío encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backFallback, { backgroundColor: '#4CAF50' }]}>
          <Text style={styles.backFallbackText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const causeIcon: MCIcon = CAUSE_ICONS[ong.cause] ?? 'paw';

  const COVER_IMAGES = [
    require('@/assets/images/hero_dog.png'),
    require('@/assets/images/hero_cat.png'),
  ];
  const AVATAR_IMAGES = [
    require('@/assets/images/hero_cat.png'),
    require('@/assets/images/hero_dog.png'),
  ];
  const ongIndex = MOCK_ONGS.findIndex((o) => o.id === ongId);
  const coverImg = COVER_IMAGES[ongIndex % COVER_IMAGES.length];
  const avatarImg = AVATAR_IMAGES[ongIndex % AVATAR_IMAGES.length];

  const STATS: Array<{ label: string; value: number; icon: MCIcon; color: string }> = [
    { label: 'Resgatados', value: ong.animalsRescued, icon: 'heart-pulse', color: '#FF6B6B' },
    { label: 'Adotados', value: ong.adoptions, icon: 'home-heart', color: '#4CAF50' },
    { label: 'Seguidores', value: ong.followers, icon: 'account-group', color: '#2F80ED' },
    { label: 'Casos ativos', value: ong.activeCases, icon: 'clipboard-list', color: '#FF9800' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: '#F1F2F1' }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── HERO HEADER (apenas imagem, sem gradiente azul pesado) ── */}
        <Animated.View style={{ opacity: headerOpacity, transform: [{ scale: heroScale }] }}>
          <View style={[styles.coverWrapper, { paddingTop: topPad }]}>
            <ImageBackground source={coverImg} style={styles.cover} resizeMode="cover">
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.65)']}
                style={styles.coverOverlay}
              >
                {/* Back button */}
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Share button */}
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="share-variant-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Avatar flutuante sobre a imagem */}
                <View style={styles.avatarOverlay}>
                  <View style={styles.avatarRing}>
                    <Image source={avatarImg} style={styles.avatarImage} resizeMode="cover" />
                  </View>
                  {ong.verified && (
                    <View style={styles.avatarVerifiedBadge}>
                      <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </LinearGradient>
            </ImageBackground>
          </View>

          {/* Nome e informações abaixo da imagem (fora do overlay) */}
          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={[styles.heroName, { color: '#1F2937' }]}>{ong.name}</Text>
              {ong.verified && (
                <View style={styles.verifiedBadge}>
                  <MaterialCommunityIcons name="check-decagram" size={14} color="#2F80ED" />
                  <Text style={styles.verifiedText}>Verificado</Text>
                </View>
              )}
            </View>

            <View style={styles.heroCause}>
              <View style={styles.causePill}>
                <MaterialCommunityIcons name={causeIcon} size={14} color="#4CAF50" />
                <Text style={styles.causePillText}>{ong.cause}</Text>
              </View>
            </View>

            <Text style={styles.heroLocation}>
              <MaterialCommunityIcons name="map-marker-outline" size={13} color="#6B7280" />
              {'  '}{ong.location}
            </Text>
            <Text style={styles.heroSince}>Desde {ong.since} · CNPJ {ong.cnpj}</Text>
          </View>
        </Animated.View>

        {/* ── STATS GRID ── */}
        <Animated.View
          style={[
            styles.statsGrid,
            { opacity: statsOpacity, transform: [{ translateY: statsY }] },
          ]}
        >
          {STATS.map((s) => (
            <View
              key={s.label}
              style={[
                styles.statBox,
                {
                  backgroundColor: '#FFFFFF',
                  borderColor: s.color + '20',
                  shadowColor: s.color,
                },
              ]}
            >
              <View style={[styles.statIconWrap, { backgroundColor: s.color + '10' }]}>
                <MaterialCommunityIcons name={s.icon} size={16} color={s.color} />
              </View>
              <View style={styles.statTexts}>
                <Text style={[styles.statValue, { color: '#1F2937' }]}>
                  {formatNumber(s.value)}
                </Text>
                <Text style={[styles.statLabel, { color: '#6B7280' }]}>{s.label}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ── ACTION BUTTONS ── */}
        <Animated.View
          style={[
            styles.actionRow,
            { opacity: donateOpacity, transform: [{ scale: donateScale }] },
          ]}
        >
          <TouchableOpacity
            onPress={handleDonate}
            activeOpacity={0.88}
            style={styles.donateBtnWrapper}
          >
            <LinearGradient
              colors={donated ? ['#4CAF50', '#2E7D32'] : supportPaymentsEnabled ? ['#FF6B6B', '#E53E3E'] : ['#6B7280', '#4B5563']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.donateBtn}
            >
              <MaterialCommunityIcons
                name={donated ? 'check-circle' : supportPaymentsEnabled ? 'hand-coin' : 'heart-outline'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.donateBtnText}>
                {donated ? 'Obrigado! ' : supportPaymentsEnabled ? 'Doar / Ajudar ONG' : 'Apoio opcional futuro'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleFollow}
            activeOpacity={0.85}
            style={[
              styles.followBtn,
              {
                backgroundColor: following ? '#4CAF5015' : '#FFFFFF',
                borderColor: following ? '#4CAF5040' : '#E5E7EB',
              },
            ]}
          >
            <MaterialCommunityIcons
              name={following ? 'account-check' : 'account-plus-outline'}
              size={18}
              color={following ? '#4CAF50' : '#374151'}
            />
            <Text style={[styles.followBtnText, { color: following ? '#4CAF50' : '#374151' }]}>
              {following ? 'Seguindo' : 'Seguir'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleContact}
            activeOpacity={0.85}
            style={styles.iconBtn}
          >
            <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── MISSION ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconCircle}>
              <MaterialCommunityIcons name="bullhorn-outline" size={16} color="#2F80ED" />
            </View>
            <Text style={styles.sectionTitle}>Missío</Text>
          </View>
          <Text style={styles.missionText}>{ong.mission}</Text>
          <Text style={styles.descriptionText}>{ong.description}</Text>
        </View>

        {/* ── INFO ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: '#4CAF5010' }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#4CAF50" />
            </View>
            <Text style={styles.sectionTitle}>Informações</Text>
          </View>

          {[
            { icon: 'paw' as MCIcon, color: '#4CAF50', label: 'Animais', value: ong.animalTypes.join(', ') },
            { icon: 'phone-outline' as MCIcon, color: '#2F80ED', label: 'Contato', value: ong.contact },
            { icon: 'map-marker-outline' as MCIcon, color: '#FF9800', label: 'Local', value: ong.location },
            { icon: 'calendar-outline' as MCIcon, color: '#9B59B6', label: 'Fundação', value: ong.since },
          ].map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <View style={[styles.infoIconCircle, { backgroundColor: row.color + '10' }]}>
                <MaterialCommunityIcons name={row.icon} size={15} color={row.color} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── POSTS BY THIS ONG ── */}
        {ongPosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: '#FF6B6B10' }]}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={16} color="#FF6B6B" />
              </View>
              <Text style={styles.sectionTitle}>Casos ativos</Text>
              <View style={styles.postCountBadge}>
                <Text style={styles.postCountText}>{ongPosts.length}</Text>
              </View>
            </View>

            {ongPosts.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.postRow}
                onPress={() => router.push(`/post/${p.id}`)}
                activeOpacity={0.88}
              >
                <View style={styles.postRowLeft}>
                  <StatusBadge type={p.type} size="sm" />
                  <View style={styles.postRowInfo}>
                    <Text style={styles.postRowName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.postRowMeta}>
                      {p.breed} · {p.neighborhood}
                    </Text>
                  </View>
                </View>
                <View style={styles.postRowRight}>
                  {p.urgent && (
                    <View style={styles.urgentDot}>
                      <MaterialCommunityIcons name="lightning-bolt" size={9} color="#FFFFFF" />
                    </View>
                  )}
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── TRANSPARENCY SEAL ── */}
        <View style={styles.trustSeal}>
          <MaterialCommunityIcons name="shield-check" size={22} color="#2F80ED" />
          <View style={styles.trustText}>
            <Text style={styles.trustTitle}>Organização verificada pelo Helpin</Text>
            <Text style={styles.trustSub}>Documentação e CNPJ validados · Doações rastreáveis</Text>
          </View>
        </View>

        <View style={{ height: Platform.OS === 'web' ? 80 : insets.bottom + 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorText: { fontSize: 16, fontFamily: 'Inter_500Medium', marginTop: 12, marginBottom: 24 },
  backFallback: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  backFallbackText: { color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  /* HERO */
  coverWrapper: {
    width: '100%',
  },
  cover: {
    width: '100%',
    height: 200,
  },
  coverOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    position: 'absolute',
    right: 20,
    top: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: -40,
    left: 20,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarVerifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2F80ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroInfo: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#F1F2F1',
  },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2F80ED10',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#2F80ED' },
  heroCause: { marginTop: 6 },
  causePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4CAF5010',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  causePillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#4CAF50' },
  heroLocation: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginTop: 6,
  },
  heroSince: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },

  /* STATS */
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTexts: { gap: 2, alignItems: 'center' },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  statLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  /* ACTIONS */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  donateBtnWrapper: { flex: 1 },
  donateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  donateBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  followBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  /* SECTION */
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F80ED10',
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1, color: '#1F2937' },
  missionText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontStyle: 'italic',
    lineHeight: 21,
    color: '#4B5563',
  },
  descriptionText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, color: '#374151' },

  /* INFO ROWS */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  infoIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1F2937' },

  /* POST ROWS */
  postCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#FF6B6B',
  },
  postCountText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    gap: 10,
  },
  postRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  postRowInfo: { flex: 1 },
  postRowName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1F2937' },
  postRowMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#6B7280', marginTop: 2 },
  postRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  urgentDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* TRUST SEAL */
  trustSeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trustText: { flex: 1 },
  trustTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1F2937' },
  trustSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#6B7280', marginTop: 2 },
});
