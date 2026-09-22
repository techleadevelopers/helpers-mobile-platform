import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ProfileTabs,
  PublicUserHeader,
  SocialOverlaySheet,
  UserAboutBlock,
  UserPostGrid,
  type ProfileTab,
  type SocialOverlayType,
} from '@/components/user';
import { AUTHOR_TO_ONG, MOCK_AUTHORS, MOCK_ONGS, MOCK_POSTS, type Author, type Post } from '@/constants/data';
import { useApp } from '@/context/AppContext';
import { shareZooHelpItem } from '@/services/share';
import { createZooHelpApi, inferAccountType, mapPost } from '@/services/zoohelpApi';
import type { PublicUserProfileContract, PublicUserSummaryContract } from '@/services/zoohelpEngine';

function formatCompactNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return String(value);
}

function getAuthorLabel(type: Author['type']) {
  if (type === 'ong') return 'ONG';
  if (type === 'vet') return 'Veterinario';
  return 'Protetor';
}

function showsProtectorSince(type: Author['type']) {
  return type !== 'ong' && type !== 'vet';
}

function mapPublicUser(user: PublicUserSummaryContract): Author {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    verified: user.verified,
    type: inferAccountType(user.type),
  };
}

function isResolved(post: Post) {
  return post.rescueStatus === 'resolved';
}

function isActive(post: Post) {
  return !isResolved(post) && (post.urgent || post.type === 'emergency' || post.type === 'lost' || post.type === 'found');
}

function formatCityState(city: string, state: string) {
  const cleanCity = city.trim().replace(/\s*-\s*$/g, '');
  const cleanState = state.trim().toUpperCase();
  if (!cleanCity || !/^[A-Z]{2}$/.test(cleanState)) return null;
  return `${cleanCity}-${cleanState}`;
}

function getStructuredCityState(post: Post) {
  if (!post.locationAddress) return null;
  return formatCityState(post.locationAddress.city, post.locationAddress.state);
}

function getAuthorLocation(posts: Post[]) {
  const firstWithLocation = posts.find((post) => post.locationAddress || post.location || post.neighborhood);
  const structuredLocation = firstWithLocation ? getStructuredCityState(firstWithLocation) : null;
  if (structuredLocation) return structuredLocation;
  // Usa apenas neighborhood se existir, senao usa location
  const locationText = firstWithLocation?.location || firstWithLocation?.neighborhood;
  if (!locationText) return 'Brasil';

  const parts = locationText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const stateIndex = parts.findIndex((part) => /^[A-Z]{2}$/i.test(part));
  const city = stateIndex > 0 ? parts[stateIndex - 1] : null;
  const state = stateIndex >= 0 ? parts[stateIndex].toUpperCase() : null;
  if (city && state) return `${city}-${state}`;

  const cityStatePart = parts.find((part) => /-\s*[A-Z]{2}$/i.test(part));
  if (cityStatePart) {
    const cityStateParts = cityStatePart.split('-').map((part) => part.trim()).filter(Boolean);
    const state = cityStateParts[cityStateParts.length - 1]?.toUpperCase();
    const city = cityStateParts[cityStateParts.length - 2];
    const formatted = city && state ? formatCityState(city, state) : null;
    if (formatted) return formatted;
  }

  return 'Brasil';
}

function getAuthorBio(author: Author, posts: Post[]) {
  const ong = MOCK_ONGS.find((item) => item.id === AUTHOR_TO_ONG[author.id]);
  if (ong) return ong.description;
  if (author.type === 'vet') return 'Atendimento, orientação e apoio veterinario para casos que precisam de resposta rapida.';
  if (posts.some((post) => post.urgent)) return 'Protetor ativo na rede Helpin, compartilhando casos urgentes e pedidos de apoio.';
  return 'Perfil da comunidade Helpin, com publicacoes sobre resgate, adoção e cuidado animal.';
}

export default function PublicUserProfileScreen() {
  const { id, profileName, profileAvatar, profileVerified, profileType } = useLocalSearchParams<{
    id: string;
    profileName?: string;
    profileAvatar?: string;
    profileVerified?: string;
    profileType?: Author['type'];
  }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const { posts, user, followedUsers, setFollowUser } = useApp();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [userSearch, setUserSearch] = useState('');
  const [userSearchFocused, setUserSearchFocused] = useState(false);
  const [remoteSearchUsers, setRemoteSearchUsers] = useState<Author[]>([]);
  const [remoteUsersLoaded, setRemoteUsersLoaded] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<PublicUserProfileContract | null>(null);
  const [relationUsers, setRelationUsers] = useState<Author[]>([]);
  const [socialOverlay, setSocialOverlay] = useState<SocialOverlayType>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  const allPosts = useMemo(() => {
    const merged = [...posts, ...MOCK_POSTS];
    const seen = new Set<string>();
    return merged.filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  }, [posts]);

  const remoteProfilePosts = useMemo(
    () => remoteProfile?.posts.map(mapPost) ?? [],
    [remoteProfile],
  );
  const profilePosts = remoteProfile
    ? remoteProfilePosts
    : allPosts.filter((post) => post.author.id === id);
  const searchableAuthors = useMemo(() => {
    const authors = [
      ...allPosts.map((post) => post.author),
      ...MOCK_AUTHORS,
      ...(user
        ? [{
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            verified: user.verified,
            type: user.type,
          }]
        : []),
    ];
    const byId = new Map<string, Author>();
    authors.forEach((item) => byId.set(item.id, item));
    return Array.from(byId.values());
  }, [allPosts, user]);
  const routedAuthor: Author | null =
    profileName && (profileType === 'person' || profileType === 'ong' || profileType === 'vet')
      ? {
          id,
          name: profileName,
          avatar: profileAvatar || null,
          verified: profileVerified === 'true',
          type: profileType,
        }
      : null;
  const remoteAuthor: Author | null = remoteProfile
    ? {
        id: remoteProfile.id,
        name: remoteProfile.name,
        avatar: remoteProfile.avatar,
        verified: remoteProfile.verified,
        type: inferAccountType(remoteProfile.type),
      }
    : null;
  const author =
    remoteAuthor ??
    profilePosts[0]?.author ??
    MOCK_AUTHORS.find((item) => item.id === id) ??
    (user?.id === id
      ? {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          verified: user.verified,
          type: user.type,
        }
      : routedAuthor);
  const resolvedAuthor = author ?? { id: '', name: '', avatar: null, verified: false, type: 'person' as const };

  const activePosts = profilePosts.filter(isActive);
  const resolvedPosts = profilePosts.filter(isResolved);
  const location = remoteProfile?.location || getAuthorLocation(profilePosts);
  const bio = remoteProfile?.bio || getAuthorBio(resolvedAuthor, profilePosts);
  const following = remoteProfile?.following ?? followedUsers.includes(resolvedAuthor.id);
  const isOwnProfile = !!user?.id && user.id === resolvedAuthor.id;
  const followers = remoteProfile?.followersCount ?? 0;
  const followingCount = remoteProfile?.followingCount ?? 0;
  const socialUsers = relationUsers.filter((item) => item.id !== resolvedAuthor.id);
  const socialCount = socialOverlay === 'following' ? followingCount : followers;
  const visiblePosts =
    activeTab === 'active' ? activePosts :
    activeTab === 'resolved' ? resolvedPosts :
    profilePosts;
  const searchTerm = userSearch.trim().toLowerCase();
  const fallbackSearchResults = useMemo(
    () => (searchTerm
      ? searchableAuthors.filter((item) => item.name.toLowerCase().includes(searchTerm))
      : searchableAuthors
    )
      .filter((item) => item.id !== resolvedAuthor.id)
      .slice(0, 6),
    [resolvedAuthor.id, searchableAuthors, searchTerm],
  );
  const searchResults = userSearchFocused || searchTerm
    ? (remoteUsersLoaded ? remoteSearchUsers : fallbackSearchResults)
        .filter((item) => item.id !== resolvedAuthor.id)
        .slice(0, 6)
    : [];

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const api = createZooHelpApi();
    api?.publicUser(id)
      .then((profile) => {
        if (!cancelled) setRemoteProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setRemoteProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !socialOverlay) {
      setRelationUsers([]);
      return;
    }
    let cancelled = false;
    const api = createZooHelpApi();
    const request = socialOverlay === 'following'
      ? api?.publicUserFollowing(id, { limit: 100 })
      : api?.publicUserFollowers(id, { limit: 100 });

    request
      ?.then((users) => {
        if (!cancelled) setRelationUsers(users.map(mapPublicUser));
      })
      .catch(() => {
        if (!cancelled) setRelationUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [id, socialOverlay]);

  useEffect(() => {
    if (!userSearchFocused && !userSearch.trim()) return;
    const rawTerm = userSearch.trim();
    const timeout = setTimeout(() => {
      const api = createZooHelpApi();
      if (!api) {
        setRemoteSearchUsers(fallbackSearchResults);
        setRemoteUsersLoaded(true);
        return;
      }
      api.publicUsers({ q: rawTerm, limit: rawTerm ? 20 : 16 })
        .then((users) => setRemoteSearchUsers(users.map(mapPublicUser)))
        .catch(() => setRemoteSearchUsers(fallbackSearchResults))
        .finally(() => setRemoteUsersLoaded(true));
    }, rawTerm ? 250 : 0);
    return () => clearTimeout(timeout);
  }, [fallbackSearchResults, userSearch, userSearchFocused]);

  if (!author) {
    return (
      <View style={styles.emptyScreen}>
        <MaterialCommunityIcons name="account-off-outline" size={42} color="#8A928B" />
        <Text style={styles.emptyTitle}>Perfil nao encontrado</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.emptyButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleFollow() {
    if (!user) {
      Alert.alert('Entrar para seguir', 'Faca login para acompanhar este perfil.');
      router.push('/login');
      return;
    }
    if (isOwnProfile || followLoading) return;

    setFollowLoading(true);
    const wasFollowing = following;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const response = await setFollowUser(author.id, !following);
      setRemoteProfile((current) => current
        ? {
            ...current,
            following: response.following,
            followersCount: response.followersCount,
          }
        : current);
    } catch {
      setRemoteProfile((current) => current
        ? {
            ...current,
            following: wasFollowing,
          }
        : current);
      Alert.alert('Nao foi possivel seguir', 'Verifique sua conexao e tente novamente.');
    }
    setFollowLoading(false);
  }

  async function handleMessage() {
    if (!user) {
      Alert.alert('Entrar para conversar', 'Faca login para enviar mensagem a este perfil.');
      router.push('/login');
      return;
    }
    if (isOwnProfile || messageLoading) return;

    setMessageLoading(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const api = createZooHelpApi();
    const room = await api?.openDirectChat(author.id).catch(() => null);

    if (room) {
      setMessageLoading(false);
      router.push(
        `/chat/${room.id}?postName=${encodeURIComponent(room.postTitle)}&authorName=${encodeURIComponent(room.participant.name)}`
      );
      return;
    }

    setMessageLoading(false);
    Alert.alert('Chat indisponivel', 'Nao foi possivel abrir uma conversa com este perfil agora.');
  }

  function handleShare() {
    shareZooHelpItem(author.name, `Veja o perfil de ${author.name} no Helpin.`);
  }

  function getSocialLocation(item: Author) {
    return getAuthorLocation(allPosts.filter((candidate) => candidate.author.id === item.id));
  }

  function openSocialProfile(item: Author) {
    setSocialOverlay(null);
    router.push({ pathname: '/(tabs)/user/[id]', params: { id: item.id } });
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>
        <PublicUserHeader
          author={author}
          location={location}
          bio={bio}
          userSearch={userSearch}
          searchResults={searchResults}
          following={following}
          followLoading={followLoading}
          followDisabled={isOwnProfile}
          messageLoading={messageLoading}
          messageDisabled={isOwnProfile}
          followers={followers}
          followingCount={followingCount}
          postsCount={profilePosts.length}
          onChangeSearch={(value) => {
            setUserSearch(value);
            setUserSearchFocused(true);
            setRemoteUsersLoaded(false);
          }}
          onBack={() => router.back()}
          onFocusSearch={() => {
            setUserSearchFocused(true);
            if (!remoteUsersLoaded) setRemoteUsersLoaded(false);
          }}
          onFollow={handleFollow}
          onMessage={handleMessage}
          onShare={handleShare}
          onOpenSearchResult={(item) => {
            setUserSearch('');
            setUserSearchFocused(false);
            router.push({ pathname: '/(tabs)/user/[id]', params: { id: item.id } });
          }}
          onOpenFollowers={() => setSocialOverlay('followers')}
          onOpenFollowing={() => setSocialOverlay('following')}
          getAuthorLabel={getAuthorLabel}
          showsProtectorSince={showsProtectorSince}
          formatCompactNumber={formatCompactNumber}
        />

        <ProfileTabs activeTab={activeTab} onChangeTab={setActiveTab} />

        {activeTab === 'about' ? (
          <UserAboutBlock
            bio={bio}
            location={location}
            verified={author.verified}
            activePostsCount={activePosts.length}
            resolvedPostsCount={resolvedPosts.length}
            followers={followers}
            formatCompactNumber={formatCompactNumber}
          />
        ) : (
          <UserPostGrid
            posts={visiblePosts}
            onOpenPost={(post) => router.push(`/post/${post.id}`)}
            isResolved={isResolved}
          />
        )}

        <View style={{ height: insets.bottom + 28 }} />
      </ScrollView>

      <SocialOverlaySheet
        visible={socialOverlay !== null}
        overlay={socialOverlay}
        height={height}
        bottomInset={insets.bottom}
        users={socialUsers}
        count={socialCount}
        onClose={() => setSocialOverlay(null)}
        onOpenProfile={openSocialProfile}
        getAuthorLabel={getAuthorLabel}
        getSocialLocation={getSocialLocation}
        formatCompactNumber={formatCompactNumber}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  emptyScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F7F2', padding: 24 },
  emptyTitle: { marginTop: 10, fontSize: 16, fontFamily: 'Montserrat_700Bold', color: '#1D2A20' },
  emptyButton: { marginTop: 18, paddingHorizontal: 18, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D6A4F' },
  emptyButtonText: { fontSize: 13, fontFamily: 'Montserrat_700Bold', color: '#FFFFFF' },
});
