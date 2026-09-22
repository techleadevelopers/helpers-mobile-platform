import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOCK_ONGS, ONG } from '@/constants/data';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { shareZooHelpItem } from '@/services/share';

const STATE_FILTERS = ['Todos', 'SP', 'RJ', 'MG', 'RS'];

const ANIMAL_IMAGES = [
  require('@/assets/images/hero_dog.png'),
  require('@/assets/images/hero_cat.png'),
];

const getCoverOverlay = (_cause: string): [string, string] => {
  return ['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.52)'];
};

const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'k'
  : n > 0 ? String(n) : '—';

const trustScore = (o: ONG) => {
  let s = 0;
  if (o.verified)              s += 40;
  if (o.animalsRescued > 1000) s += 20;
  if (o.followers > 10000)     s += 20;
  if (o.adoptions > 500)       s += 20;
  return Math.min(s, 100);
};

function ONGCard({ item, following, onFollow, onPress, index }: {
  item: ONG; following: boolean; onFollow: () => void; onPress: () => void; index: number;
}) {
  const colors = useColors();
  const [o1, o2] = getCoverOverlay(item.cause);
  const score = trustScore(item);
  const coverImg = ANIMAL_IMAGES[index % ANIMAL_IMAGES.length];
  const avatarImg = ANIMAL_IMAGES[(index + 1) % ANIMAL_IMAGES.length];

  return (
    <TouchableOpacity
      style={[S.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.95}
    >

      {/* ── COVER ── */}
      <ImageBackground source={coverImg} style={S.cover} resizeMode="cover">
        <LinearGradient colors={[o1, o2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.coverOverlay}>
          <View style={S.coverRow}>
            {item.verified && (
              <View style={S.chip}>
                <MaterialCommunityIcons name="check-decagram" size={10} color="#fff" />
                <Text style={S.chipTxt}>Verificada</Text>
              </View>
            )}
            <View style={[S.chip, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
              <MaterialCommunityIcons name="shield-star" size={9} color="#FFD700" />
              <Text style={S.chipTxt}>{score}/100</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={S.coverSince}>desde {item.since}</Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* ── IDENTITY ── */}
      <View style={S.idRow}>
        <View style={[S.avatarWrap, { borderColor: colors.card }]}>
          <Image source={avatarImg} style={S.avatarImg} resizeMode="cover" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.ongName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[S.ongMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.city}, {item.state} · {item.cause}
          </Text>
        </View>
        {/* inline follow */}
        <TouchableOpacity
          style={[
            S.inlineFollow,
            following
              ? { backgroundColor: '#4CAF50' }
              : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#4CAF50' },
          ]}
          onPress={onFollow}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons
            name={following ? 'account-check' : 'account-plus'}
            size={13}
            color={following ? '#fff' : '#4CAF50'}
          />
          <Text style={[S.inlineFollowTxt, { color: following ? '#fff' : '#4CAF50' }]}>
            {following ? 'Seguindo' : 'Seguir'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── DESCRIPTION ── */}
      <Text style={[S.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
        {item.description}
      </Text>

      {/* ── COMPACT STATS ROW ── */}
      <View style={[S.statsRow, { borderColor: colors.border }]}>
        {([
          { v: item.animalsRescued, l: 'Resgatados', c: '#4CAF50' },
          { v: item.adoptions,      l: 'Adoções',    c: '#1565C0' },
          { v: item.activeCases,    l: 'Ativos',     c: '#E65100' },
          { v: item.followers,      l: 'Seguidores', c: '#6A1B9A' },
        ] as const).map((s, i) => (
          <React.Fragment key={s.l}>
            {i > 0 && <View style={[S.statDiv, { backgroundColor: colors.border }]} />}
            <View style={S.statItem}>
              <Text style={[S.statNum, { color: s.c }]}>{fmt(s.v)}</Text>
              <Text style={[S.statLabel, { color: colors.mutedForeground }]}>{s.l}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* ── FOOTER: trust + action ── */}
      <View style={S.footer}>
        <View style={S.trustRow}>
          <MaterialCommunityIcons name="shield-check" size={11} color="#4CAF50" />
          <Text style={[S.trustTxt, { color: colors.mutedForeground }]}>CNPJ verificado</Text>
          <View style={[S.dot, { backgroundColor: colors.border }]} />
          <MaterialCommunityIcons name="file-document-check-outline" size={11} color="#1565C0" />
          <Text style={[S.trustTxt, { color: colors.mutedForeground }]}>Prestação ativa</Text>
        </View>

        <View style={S.actionBtns}>
          <TouchableOpacity
            style={[S.helpBtn, { backgroundColor: '#4CAF50' }]}
            onPress={onPress}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="hand-heart" size={13} color="#fff" />
            <Text style={S.helpTxt}>Ajudar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.sqBtn, { backgroundColor: '#1565C014', borderColor: '#1565C030' }]}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="message-outline" size={15} color="#1565C0" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.sqBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => shareZooHelpItem(item.name, `Ajude ${item.name} no Helpin.`)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={15} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ONGsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { followedOngs, toggleFollowOng } = useApp();
  const [search, setSearch] = useState('');
  const [stateF, setStateF] = useState('Todos');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  async function handleFollowOng(ongId: string) {
    try {
      await toggleFollowOng(ongId);
    } catch {
      Alert.alert('Não foi possível seguir', 'Entre na sua conta e tente novamente.');
    }
  }

  const list = MOCK_ONGS.filter((o) => {
    const q = search.trim().toLowerCase();
    const mQ = !q || o.name.toLowerCase().includes(q) || o.cause.toLowerCase().includes(q) || o.city.toLowerCase().includes(q);
    const mS = stateF === 'Todos' || o.state === stateF;
    return mQ && mS;
  });

  return (
    <View style={[S.root, { backgroundColor: '#F5F7F5' }]}>

      {/* HEADER */}
      <View style={[S.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          style={[S.circ, { backgroundColor: colors.muted }]}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[S.title, { color: colors.foreground }]}>ONGs Verificadas</Text>
          <Text style={S.subtitle}>{MOCK_ONGS.length} organizações · confiança verificada</Text>
        </View>
        <TouchableOpacity
          style={[S.circ, { backgroundColor: colors.muted }]}
          onPress={() => Alert.alert('Filtros', 'Use busca e estados para filtrar ONGs verificadas.')}
        >
          <MaterialCommunityIcons name="tune-variant" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={[S.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[S.searchInput, { color: colors.foreground }]}
          placeholder="ONG, causa ou cidade..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[S.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ONGCard
            item={item}
            index={index}
            following={followedOngs.includes(item.id)}
            onFollow={() => handleFollowOng(item.id)}
            onPress={() => router.push(`/ong/${item.id}`)}
          />
        )}
        ListHeaderComponent={
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.pillRow}>
              {STATE_FILTERS.map((f) => {
                const a = stateF === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[S.pill, a ? S.pillOn : { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setStateF(f)}
                  >
                    <Text style={[S.pillTxt, { color: a ? '#fff' : colors.mutedForeground }]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* impact bar */}
            <View style={[S.impact, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {([
                { v: '58k+', l: 'Animais salvos', c: '#4CAF50' },
                { v: '45k+', l: 'Adotados',       c: '#1565C0' },
                { v: '396',  l: 'Casos ativos',   c: '#E65100' },
              ] as const).map((s, i) => (
                <React.Fragment key={s.l}>
                  {i > 0 && <View style={[S.impDiv, { backgroundColor: colors.border }]} />}
                  <View style={S.impItem}>
                    <Text style={[S.impVal, { color: s.c }]}>{s.v}</Text>
                    <Text style={[S.impLbl, { color: colors.mutedForeground }]}>{s.l}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={S.empty}>
            <MaterialCommunityIcons name="magnify-close" size={32} color={colors.mutedForeground} />
            <Text style={[S.emptyTxt, { color: colors.mutedForeground }]}>Nenhuma ONG encontrada</Text>
          </View>
        }
      />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  circ: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4CAF50', marginTop: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },

  pillRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 10 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 18, borderWidth: 1.5,
  },
  pillOn: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  pillTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  impact: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 6,
  },
  impItem: { flex: 1, alignItems: 'center', gap: 1 },
  impDiv: { width: 1, marginVertical: 4 },
  impVal: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  impLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  content: { paddingTop: 2 },

  /* ── CARD ── */
  card: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },

  cover: { height: 80, overflow: 'hidden' },
  coverOverlay: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'flex-end' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff', opacity: 0.08 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  chipTxt: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  coverSince: { fontSize: 9, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)' },

  /* identity */
  idRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6,
  },
  avatarWrap: { borderWidth: 2.5, borderRadius: 28, overflow: 'hidden', marginTop: -24, backgroundColor: '#fff', width: 48, height: 48 },
  avatarImg: { width: '100%', height: '100%' },
  ongName: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  ongMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 },
  inlineFollow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, flexShrink: 0,
  },
  inlineFollowTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  desc: {
    fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17,
    paddingHorizontal: 12, marginBottom: 10,
  },

  /* stats — compact divider style */
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 12, marginBottom: 8,
    borderTopWidth: 1, borderBottomWidth: 1,
    paddingVertical: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 1 },
  statDiv: { width: 1, marginVertical: 2 },
  statNum: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  statLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },

  /* footer */
  footer: {
    paddingHorizontal: 12, paddingBottom: 12, gap: 8,
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustTxt: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  dot: { width: 3, height: 3, borderRadius: 1.5 },

  actionBtns: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  helpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
  },
  helpTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  sqBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyTxt: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
