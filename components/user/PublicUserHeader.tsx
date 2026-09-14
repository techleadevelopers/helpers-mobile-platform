import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import type { Author } from '@/constants/data';

type PublicUserHeaderProps = {
  author: Author;
  location: string;
  bio: string;
  userSearch: string;
  searchResults: Author[];
  following: boolean;
  followLoading?: boolean;
  followDisabled?: boolean;
  messageLoading?: boolean;
  messageDisabled?: boolean;
  followers: number;
  followingCount: number;
  postsCount: number;
  onChangeSearch: (value: string) => void;
  onBack?: () => void;
  onFocusSearch?: () => void;
  onFollow: () => void;
  onMessage: () => void;
  onShare: () => void;
  onOpenSearchResult: (author: Author) => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  getAuthorLabel: (type: Author['type']) => string;
  showsProtectorSince: (type: Author['type']) => boolean;
  formatCompactNumber: (value: number) => string;
};

export function PublicUserHeader({
  author,
  location,
  bio,
  userSearch,
  searchResults,
  following,
  followLoading = false,
  followDisabled = false,
  messageLoading = false,
  messageDisabled = false,
  followers,
  followingCount,
  postsCount,
  onChangeSearch,
  onBack,
  onFocusSearch,
  onFollow,
  onMessage,
  onShare,
  onOpenSearchResult,
  onOpenFollowers,
  onOpenFollowing,
  getAuthorLabel,
  showsProtectorSince,
  formatCompactNumber,
}: PublicUserHeaderProps) {
  return (
    <LinearGradient colors={['#FFFFFF', '#FFFFFF']} style={styles.header}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8} accessibilityLabel="Voltar">
          <MaterialCommunityIcons name="arrow-left" size={21} color="#415047" />
        </TouchableOpacity>
        <View style={styles.userSearchBox}>
          <MaterialCommunityIcons name="account-search-outline" size={15} color="#7C867C" />
          <TextInput
            style={styles.userSearchInput}
            value={userSearch}
            onChangeText={onChangeSearch}
            placeholder="Buscar usuario"
            placeholderTextColor="#8A928B"
            returnKeyType="search"
            onFocus={onFocusSearch}
          />
        </View>
      </View>

      <View style={styles.profileHead}>
        <Avatar name={author.name} size={42} verified={author.verified} type={author.type} imageUrl={author.avatar} />
        <View style={styles.profileIdentity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{author.name}</Text>
          </View>
          <Text style={styles.role}>
            {getAuthorLabel(author.type)}
            {showsProtectorSince(author.type) && <Text style={styles.roleSince}>: Desde 05/2026</Text>}
          </Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color="#7C867C" />
            <Text style={styles.location} numberOfLines={1}>{location}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.iconButton, styles.profileShareButton]} onPress={onShare} activeOpacity={0.8}>
          <MaterialCommunityIcons name="share-variant-outline" size={20} color="#1D2A20" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.followButton, following && styles.followingButton, followDisabled && styles.disabledButton]}
          onPress={onFollow}
          disabled={followDisabled || followLoading}
          activeOpacity={0.85}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={following ? '#2D6A4F' : '#FFFFFF'} />
          ) : (
            <Text style={[styles.followText, following && styles.followingText, followDisabled && styles.disabledText]}>
              {following ? 'Seguindo' : 'Seguir'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.messageButton, messageDisabled && styles.disabledButton]}
          onPress={onMessage}
          disabled={messageDisabled || messageLoading}
          activeOpacity={0.85}
        >
          {messageLoading ? (
            <ActivityIndicator size="small" color="#2D6A4F" />
          ) : (
            <>
              <MaterialCommunityIcons name="message-outline" size={17} color={messageDisabled ? '#A7B0AA' : '#2D6A4F'} />
              <Text style={[styles.messageText, messageDisabled && styles.disabledText]}>Mensagem</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <View style={styles.userSearchResults}>
          {searchResults.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.userSearchResult}
              onPress={() => onOpenSearchResult(item)}
              activeOpacity={0.82}
            >
              <Avatar name={item.name} size={24} verified={item.verified} type={item.type} imageUrl={item.avatar} />
              <View style={styles.userSearchResultInfo}>
                <Text style={styles.userSearchResultName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.userSearchResultRole}>{getAuthorLabel(item.type)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={15} color="#A4AAA4" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{postsCount}</Text>
          <Text style={styles.statLabel}>publicacoes</Text>
        </View>
        <TouchableOpacity style={styles.statItem} onPress={onOpenFollowers} activeOpacity={0.82}>
          <Text style={styles.statValue}>{formatCompactNumber(followers)}</Text>
          <Text style={styles.statLabel}>seguidores</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem} onPress={onOpenFollowing} activeOpacity={0.82}>
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>seguindo</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.bio}>{bio}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingBottom: 0, marginBottom: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, paddingHorizontal: 4 },
  backButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8F5' },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.86)' },
  profileHead: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 17, marginTop: 18 },
  profileIdentity: { flex: 1, gap: 2, paddingRight: 42 },
  profileShareButton: { position: 'absolute', right: 10, top: 8, width: 36, height: 36, borderRadius: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flex: 1, fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#162018', letterSpacing: 0 },
  role: { fontSize: 11, fontFamily: 'Montserrat_600SemiBold', color: '#2D6A4F' },
  roleSince: { fontFamily: 'Montserrat_400Regular', color: '#7C867C' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  location: { flex: 1, fontSize: 10, fontFamily: 'Montserrat_500Medium', color: '#7C867C' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  followButton: { flex: 1, height: 32, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D6A4F' },
  followingButton: { backgroundColor: '#EAF3EC', borderWidth: 1, borderColor: '#CFE0D4' },
  disabledButton: { opacity: 0.55 },
  followText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#FFFFFF' },
  followingText: { color: '#2D6A4F' },
  disabledText: { color: '#A7B0AA' },
  messageButton: { flex: 1, height: 32, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE4DD' },
  messageText: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#2D6A4F' },
  userSearchBox: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F4F6F3',
    borderWidth: 1,
    borderColor: '#E4EAE5',
  },
  userSearchInput: {
    flex: 1,
    padding: 0,
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#1D2A20',
  },
  userSearchResults: {
    marginTop: 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  userSearchResult: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EE',
  },
  userSearchResultInfo: { flex: 1 },
  userSearchResultName: { fontSize: 12, fontFamily: 'Montserrat_700Bold', color: '#18231B' },
  userSearchResultRole: { fontSize: 10, fontFamily: 'Montserrat_500Medium', color: '#7C867C', marginTop: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingVertical: 3, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E4EAE5' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#172018' },
  statLabel: { fontSize: 9, fontFamily: 'Montserrat_500Medium', color: '#7C867C' },
  bio: { marginTop: 10, fontSize: 12, fontFamily: 'Montserrat_500Medium', color: '#3D473F', lineHeight: 14 },
});
