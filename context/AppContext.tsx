import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { Post } from '@/constants/data';
import { loadCachedFeed, saveCachedFeed } from '@/services/feedCache';
import { enqueuePost, listDuePendingPosts, listPendingPosts, markPendingPostAttempt, removePendingPost, retryPendingPost, savePendingPostUploads, type PendingPost } from '@/services/postOutbox';
import { enqueueRescueOperation, flushRescueOutbox, listPendingRescueOperations } from '@/services/rescueOutbox';
import { registerRescueAlerts } from '@/services/rescueNotifications';
import { clearSessionTokens, getSecureItem, setSecureItem, REFRESH_TOKEN_KEY } from '@/services/secureSession';
import { AUTH_TOKEN_KEY, createZooHelpApi, inferAccountType, mapPost, supportPaymentsEnabled, uploadLocalImageToCloudinary } from '@/services/zoohelpApi';
import { ZooHelpApiError, type ChatConversationContract } from '@/services/zoohelpEngine';

const DELETED_POST_IDS_KEY = 'zoohelp:deletedPostIds:v1';
const POST_IMAGES_CACHE_KEY = 'zoohelp:postImages:v1';
const LIKED_POST_USERS_KEY = 'zoohelp:likedPostUsers:v1';
const SESSION_SCHEMA_KEY = 'zoohelp:sessionSchemaVersion';
const SESSION_SCHEMA_VERSION = 'identity-v2-2026-06-22';
const MAX_LOCAL_DELETED_POST_IDS = 200;
const MAX_POST_IMAGES_CACHE_ITEMS = 500;
const JUST_PUBLISHED_PROMOTION_MS = 5 * 60 * 1000;

function postSortTime(post: Post) {
  if (post.createdAt === 'agora' || post.createdAt === 'pendente') return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(post.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortPostsNewestFirst(posts: Post[]) {
  return [...posts].sort((a, b) => {
    const byTime = postSortTime(b) - postSortTime(a);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}

function isPersistablePostImage(uri: string) {
  return Platform.OS !== 'web' || !uri.startsWith('blob:');
}

function uniquePostImages(images: Array<string | null | undefined>) {
  return Array.from(new Set(images.filter((uri): uri is string => Boolean(uri)))).filter(isPersistablePostImage);
}

function postImageList(post: Post) {
  return uniquePostImages([...(post.images ?? []), post.image]);
}

function mergePostImages(post: Post, fallback?: Post | string[]) {
  const currentImages = postImageList(post);
  const fallbackImages = Array.isArray(fallback) ? uniquePostImages(fallback) : fallback ? postImageList(fallback) : [];
  const bestImages = currentImages.length >= fallbackImages.length ? currentImages : fallbackImages;
  const fallbackPost = !Array.isArray(fallback) ? fallback : undefined;
  const fallbackAddress = fallbackPost?.locationAddress;

  if (bestImages.length === 0 && !fallbackAddress) return post;

  return {
    ...post,
    location: fallbackAddress ? fallbackPost.location : post.location,
    neighborhood: fallbackAddress ? fallbackAddress.neighborhood : post.neighborhood,
    locationAddress: fallbackAddress ?? post.locationAddress,
    image: bestImages[0] ?? post.image,
    images: bestImages.length > 0 ? bestImages : post.images,
  };
}

async function loadPostImagesCache() {
  const raw = await AsyncStorage.getItem(POST_IMAGES_CACHE_KEY).catch(() => null);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([postId, images]) => [
          postId,
          Array.isArray(images) ? uniquePostImages(images as Array<string | null | undefined>) : [],
        ] as const)
        .filter(([, images]) => images.length > 0),
    ) as Record<string, string[]>;
  } catch {
    return {};
  }
}

async function rememberPostImages(post: Post) {
  const images = postImageList(post);
  if (images.length < 2) return;

  const cache = await loadPostImagesCache();
  if ((cache[post.id]?.length ?? 0) >= images.length) return;

  cache[post.id] = images;
  const trimmed = Object.fromEntries(Object.entries(cache).slice(-MAX_POST_IMAGES_CACHE_ITEMS));
  await AsyncStorage.setItem(POST_IMAGES_CACHE_KEY, JSON.stringify(trimmed)).catch(() => {});
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  bio: string;
  type: 'person' | 'ong' | 'vet';
  gender?: 'male' | 'female' | null;
  verified: boolean;
  verificationStatus?: string | null;
  postsCount: number;
  helpedCount: number;
  adoptionsCount: number;
  profileAddress?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  posts: Post[];
  likedPosts: string[];
  likedPostCounts: Record<string, number>;
  followedOngs: string[];
  followedUsers: string[];
  chatUnreadCount: number;
  chatMessageNotifications: Array<{
    id: string;
    roomId: string;
    title: string;
    body: string;
    createdAt: string;
    isRead: boolean;
  }>;
  login: (email: string, password: string) => Promise<User>;
  register: (
    name: string,
    email: string,
    password: string,
    type?: 'person' | 'ong',
    profile?: {
      avatar?: string | null;
      gender?: 'male' | 'female' | null;
      ongType?: string;
      cnpj?: string;
      phone?: string;
      cep?: string;
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      foundationYear?: number;
    },
  ) => Promise<User>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  toggleLike: (postId: string) => void;
  fetchLikedPosts: () => Promise<Post[]>;
  toggleFollowOng: (ongId: string) => Promise<void>;
  setFollowUser: (userId: string, following: boolean) => Promise<{ following: boolean; followersCount: number }>;
  toggleFollowUser: (userId: string) => Promise<{ following: boolean; followersCount: number }>;
  deletePost: (postId: string) => Promise<void>;
  addPost: (post: Post) => Promise<Post>;
  refreshPosts: () => Promise<void>;
  donateToOng: (ongId: string, amountCents?: number) => Promise<void>;
  updateUserAvatar: (avatarUri: string, fileSize?: number, contentType?: string | null) => Promise<void>;
  updateUserProfile: (input: {
    name: string;
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshChatState: () => Promise<void>;
  pendingOutboxCount: number;
  syncPendingOperations: () => Promise<void>;
  retryFailedPost: (postId: string) => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

function likedPostsStorageKey(userId: string) {
  return `likedPosts:${userId}`;
}

function normalizeLikedPostUsers(raw: unknown) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string[]>>((acc, [postId, userIds]) => {
    if (!Array.isArray(userIds)) return acc;
    const ids = Array.from(new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    if (ids.length) acc[postId] = ids;
    return acc;
  }, {});
}

function likedPostCountsFromUsers(likedPostUsers: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(likedPostUsers).map(([postId, userIds]) => [postId, userIds.length])
  );
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // State updates are asynchronous. Keep the restored identity available to
  // the feed refresh that runs in the same async session-restoration flow.
  const userRef = useRef<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [likedPostUsers, setLikedPostUsers] = useState<Record<string, string[]>>({});
  const [followedOngs, setFollowedOngs] = useState<string[]>([]);
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatMessageNotifications, setChatMessageNotifications] = useState<AppContextType['chatMessageNotifications']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const authClearingRef = useRef(false);
  const feedRetryAfterRef = useRef(0);
  const feedFailureCountRef = useRef(0);
  const deletedPostIdsRef = useRef<Set<string>>(new Set());
  const pendingLikePostIdsRef = useRef<Set<string>>(new Set());
  const pendingFollowUserIdsRef = useRef<Set<string>>(new Set());
  const pendingFollowOngIdsRef = useRef<Set<string>>(new Set());
  const justPublishedRef = useRef<{ postId: string; expiresAt: number } | null>(null);

  const api = useMemo(
    () => createZooHelpApi(() => getSecureItem(AUTH_TOKEN_KEY)),
    [],
  );
  const likedPostCounts = useMemo(() => likedPostCountsFromUsers(likedPostUsers), [likedPostUsers]);

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLikedPosts([]);
      return;
    }
    const storageKey = likedPostsStorageKey(user.id);
    Promise.all([
      AsyncStorage.getItem(storageKey),
      AsyncStorage.getItem('likedPosts'),
    ])
      .then(async ([storedLikes, legacyLikes]) => {
        const sourceLikes = storedLikes ?? legacyLikes;
        if (!sourceLikes) {
          setLikedPosts([]);
          return;
        }
        const parsed = JSON.parse(sourceLikes);
        const nextLikes = Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
        setLikedPosts(nextLikes);
        setLikedPostUsers((current) => {
          let changed = false;
          const next = { ...current };
          nextLikes.forEach((postId) => {
            const userIds = next[postId] ?? [];
            if (!userIds.includes(user.id)) {
              next[postId] = [...userIds, user.id];
              changed = true;
            }
          });
          if (changed) AsyncStorage.setItem(LIKED_POST_USERS_KEY, JSON.stringify(next)).catch(() => {});
          return changed ? next : current;
        });
        if (!storedLikes && legacyLikes) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(nextLikes)).catch(() => {});
          await AsyncStorage.removeItem('likedPosts').catch(() => {});
        }
      })
      .catch(() => setLikedPosts([]));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    registerRescueAlerts(user.id).catch(() => {
      // Push/geolocation permission is optional; the app keeps working without it.
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setChatUnreadCount(0);
      setChatMessageNotifications([]);
      return;
    }
    refreshChatState();
    const timer = setInterval(() => {
      refreshChatState();
    }, 30000);
    return () => clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      registerRescueAlerts(user.id).catch(() => {
        // Foreground refresh keeps push targeting close to the user's real position.
      });
      refreshCurrentUser().catch(() => {});
      refreshPostsFromBackend().catch(() => {});
    });
    return () => subscription.remove();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      refreshPostsFromBackend().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      registerRescueAlerts(user.id).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !api) return;
    if (Platform.OS === 'web') return;
    let closed = false;
    let refreshing = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const refreshFromEvent = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        await refreshPostsFromBackend();
      } finally {
        refreshing = false;
      }
    };

    const connect = () => {
      if (closed) return;
      if (reconnectAttempts >= maxReconnectAttempts) return;
      socket = new WebSocket(api.feedWebSocketUrl());
      socket.onopen = () => {
        reconnectAttempts = 0;
      };
      socket.onmessage = () => {
        refreshFromEvent().catch(() => {});
      };
      socket.onclose = () => {
        if (closed) return;
        reconnectAttempts += 1;
        if (reconnectAttempts >= maxReconnectAttempts) return;
        const delayMs = Math.min(30000, 2000 * 2 ** (reconnectAttempts - 1));
        reconnectTimer = setTimeout(connect, delayMs);
      };
      socket.onerror = () => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [user?.id, api]);

  async function loadStoredData() {
    try {
      const storedSessionSchema = await AsyncStorage.getItem(SESSION_SCHEMA_KEY);
      if (storedSessionSchema !== SESSION_SCHEMA_VERSION) {
        await clearSessionTokens();
        await clearLocalIdentityState();
        await AsyncStorage.setItem(SESSION_SCHEMA_KEY, SESSION_SCHEMA_VERSION);
      }

      const [storedUser, storedOnboarding, storedFollows, storedUserFollows, storedDeletedPostIds, storedLikedPostUsers, storedToken] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('hasSeenOnboarding'),
        AsyncStorage.getItem('followedOngs'),
        AsyncStorage.getItem('followedUsers'),
        AsyncStorage.getItem(DELETED_POST_IDS_KEY),
        AsyncStorage.getItem(LIKED_POST_USERS_KEY),
        getSecureItem(AUTH_TOKEN_KEY),
      ]);

      if (storedToken && api) {
        const currentUser = await api.me().catch(async (error) => {
          if (error instanceof ZooHelpApiError && error.status === 401) {
            await clearInvalidSession();
          }
          return null;
        });
        if (currentUser) {
          await persistUser(mapAuthUser(currentUser));
        } else {
          await AsyncStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        await AsyncStorage.removeItem('user');
        setUser(null);
        setIsAuthenticated(false);
      }
      setHasSeenOnboarding(true);
      if (storedFollows) setFollowedOngs(JSON.parse(storedFollows));
      if (storedUserFollows) setFollowedUsers(JSON.parse(storedUserFollows));
      if (storedDeletedPostIds) {
        const parsed = JSON.parse(storedDeletedPostIds);
        if (Array.isArray(parsed)) deletedPostIdsRef.current = new Set(parsed.filter((id) => typeof id === 'string'));
      }
      if (storedLikedPostUsers) {
        setLikedPostUsers(normalizeLikedPostUsers(JSON.parse(storedLikedPostUsers)));
      }

      const cachedFeed = await loadCachedFeed();
      const imageCache = await loadPostImagesCache();
      const visibleCachedFeed = cachedFeed
        .map((post) => mergePostImages(post, imageCache[post.id]))
        .filter((post) => !deletedPostIdsRef.current.has(post.id));
      if (visibleCachedFeed.length) setPosts(visibleCachedFeed);
      await refreshOutboxCount();
      await refreshPostsFromBackend();
      await syncPendingOperations();
    } catch {
      // Keep local mock fallback available in development/offline mode.
    } finally {
      setIsLoading(false);
    }
  }

  async function persistUser(nextUser: User) {
    userRef.current = nextUser;
    setIsAuthenticated(true);
    setUser(nextUser);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    return nextUser;
  }

  async function clearLocalIdentityState() {
    await Promise.all([
      AsyncStorage.removeItem('user'),
      AsyncStorage.removeItem('followedOngs'),
      AsyncStorage.removeItem('followedUsers'),
      AsyncStorage.removeItem('likedPosts'),
    ]);
    setUser(null);
    setIsAuthenticated(false);
    setLikedPosts([]);
    setFollowedOngs([]);
    setFollowedUsers([]);
    setChatUnreadCount(0);
    setChatMessageNotifications([]);
  }

  async function refreshCurrentUser() {
    if (!api) return;
    const currentUser = await api.me().catch(async (error) => {
      if (error instanceof ZooHelpApiError && error.status === 401) {
        await clearInvalidSession();
      }
      return null;
    });
    if (currentUser) {
      await persistUser(mapAuthUser(currentUser));
    }
  }

  function buildChatNotification(room: ChatConversationContract) {
    return {
      id: `chat-${room.id}-${room.lastMessageTime}`,
      roomId: room.id,
      title: `Nova mensagem de ${room.participant.name}`,
      body: room.lastMessage || `Mensagem sobre ${room.postTitle}`,
      createdAt: room.lastMessageTime || new Date().toISOString(),
      isRead: false,
    };
  }

  async function refreshChatState() {
    if (!api || !user?.id) {
      setChatUnreadCount(0);
      setChatMessageNotifications([]);
      return;
    }
    const rooms = await api.chatRooms().catch(() => null);
    if (!rooms) return;
    const unreadRooms = rooms.filter((room) => room.unread > 0);
    setChatUnreadCount(unreadRooms.reduce((sum, room) => sum + room.unread, 0));
    setChatMessageNotifications(unreadRooms.map(buildChatNotification));
  }

  async function clearInvalidSession() {
    if (authClearingRef.current) return;
    authClearingRef.current = true;
    try {
      await clearSessionTokens();
      await clearLocalIdentityState();
    } finally {
      authClearingRef.current = false;
    }
  }

  function mapAuthUser(response: Pick<Awaited<ReturnType<NonNullable<typeof api>['login']>>, 'user' | 'ongProfile'>): User {
    const ongVerificationStatus = response.ongProfile?.verificationStatus ?? null;
    const accountType = inferAccountType(response.user.type as any);
    const isApprovedOng =
      accountType === 'ong'
        ? ongVerificationStatus === 'APPROVED' || response.user.verified
        : response.user.verified;

    return {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      avatar: response.user.avatar,
      bio: response.user.bio,
      type: accountType,
      gender: response.user.gender ?? null,
      verified: isApprovedOng,
      verificationStatus: ongVerificationStatus,
      postsCount: response.user.postsCount,
      helpedCount: response.user.helpedCount,
      adoptionsCount: response.user.adoptionsCount,
      profileAddress: response.user.profileAddress
        ? {
            cep: response.user.profileAddress.cep ?? undefined,
            street: response.user.profileAddress.street ?? undefined,
            number: response.user.profileAddress.number ?? undefined,
            complement: response.user.profileAddress.complement ?? undefined,
            neighborhood: response.user.profileAddress.neighborhood ?? undefined,
            city: response.user.profileAddress.city ?? undefined,
            state: response.user.profileAddress.state ?? undefined,
          }
        : response.ongProfile
        ? {
            cep: response.ongProfile.cep ?? undefined,
            street: response.ongProfile.street ?? undefined,
            number: response.ongProfile.number ?? undefined,
            complement: response.ongProfile.complement ?? undefined,
            neighborhood: response.ongProfile.neighborhood ?? undefined,
            city: response.ongProfile.city ?? undefined,
            state: response.ongProfile.state ?? undefined,
          }
        : user?.profileAddress,
    };
  }

  async function login(email: string, password: string) {
    if (api) {
      await clearLocalIdentityState();
      await clearSessionTokens();
      const response = await api.login(email, password);
      await setSecureItem(AUTH_TOKEN_KEY, response.accessToken);
      await setSecureItem(REFRESH_TOKEN_KEY, response.refreshToken);
      const confirmed = await api.me().catch(() => null);
      const authUser = confirmed ? mapAuthUser(confirmed) : mapAuthUser(response);
      if (authUser.id !== response.user.id) {
        await clearSessionTokens();
        await clearLocalIdentityState();
        throw new Error('Sessao inconsistente. Entre novamente.');
      }
      return persistUser(authUser);
    }

    throw new Error('Backend auth is required');
  }

  async function register(
    name: string,
    email: string,
    password: string,
    type: 'person' | 'ong' = 'person',
    profile: {
      avatar?: string | null;
      ongType?: string;
      cnpj?: string;
      phone?: string;
      cep?: string;
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      foundationYear?: number;
    } = {},
  ) {
    if (api) {
      await clearLocalIdentityState();
      await clearSessionTokens();
      const response = await api.register({
        name,
        email,
        password,
        accountType: type,
        ...profile,
      });
      await setSecureItem(AUTH_TOKEN_KEY, response.accessToken);
      await setSecureItem(REFRESH_TOKEN_KEY, response.refreshToken);
      const confirmed = await api.me().catch(() => null);
      const nextUser = confirmed ? mapAuthUser(confirmed) : mapAuthUser(response);
      if (type === 'ong' && response.ongProfile?.verificationStatus !== 'APPROVED') {
        nextUser.verified = false;
        nextUser.verificationStatus = response.ongProfile?.verificationStatus ?? 'PENDING_MANUAL_REVIEW';
      }
      return persistUser(nextUser);
    }

    throw new Error('Backend auth is required');
  }

  async function logout() {
    await clearSessionTokens();
    await clearLocalIdentityState();
  }

  async function deleteAccount() {
    await api?.deleteAccount().catch(() => {});
    await logout();
  }

  async function completeOnboarding() {
    setHasSeenOnboarding(true);
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
  }

  function persistLikedPosts(userId: string, next: string[]) {
    AsyncStorage.setItem(likedPostsStorageKey(userId), JSON.stringify(next)).catch(() => {});
  }

  function updateLikeState(postId: string, liked: boolean, likes?: number) {
    if (!user?.id) return;
    setLikedPosts((current) => {
      const next = liked
        ? Array.from(new Set([...current, postId]))
        : current.filter((id) => id !== postId);
      persistLikedPosts(user.id, next);
      return next;
    });
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              likedByMe: liked,
              likes: likes ?? Math.max(0, post.likes + (liked ? 1 : -1)),
            }
          : post
      )
    );
  }

  function toggleLike(postId: string) {
    if (!user?.id || !api || pendingLikePostIdsRef.current.has(postId)) return;
    const previousPost = posts.find((post) => post.id === postId);
    const wasLiked = likedPosts.includes(postId) || previousPost?.likedByMe === true;
    const nextLiked = !wasLiked;
    pendingLikePostIdsRef.current.add(postId);
    updateLikeState(postId, nextLiked);
    const request = nextLiked ? api.likePost(postId) : api.unlikePost(postId);
    request
      .then((response) => updateLikeState(postId, response.liked, response.likes))
      .catch(() => updateLikeState(postId, wasLiked, previousPost?.likes))
      .finally(() => pendingLikePostIdsRef.current.delete(postId));
  }

  async function fetchLikedPosts() {
    if (!api || !user?.id) return [];
    const fetched = (await api.feed({ liked: true, limit: 100 })).map(mapPost);
    const ids = fetched.map((post) => post.id);
    setLikedPosts(ids);
    persistLikedPosts(user.id, ids);
    return fetched;
  }

  function synchronizeVisibleLikes(remotePosts: Post[]) {
    if (!user?.id) return;
    const storageKey = likedPostsStorageKey(user.id);
    setLikedPosts((prev) => {
      const visibleIds = new Set(remotePosts.map((post) => post.id));
      const next = [
        ...prev.filter((postId) => !visibleIds.has(postId)),
        ...remotePosts.filter((post) => post.likedByMe).map((post) => post.id),
      ];
      const unique = Array.from(new Set(next));
      AsyncStorage.setItem(storageKey, JSON.stringify(unique)).catch(() => {});
      return unique;
    });
  }

  async function toggleFollowOng(ongId: string) {
    if (!api || !user?.id) throw new Error('Entre para seguir uma ONG');
    if (pendingFollowOngIdsRef.current.has(ongId)) return;
    pendingFollowOngIdsRef.current.add(ongId);
    const wasFollowing = followedOngs.includes(ongId);
    const nextFollowing = !wasFollowing;
    setFollowedOngs((prev) => {
      const next = nextFollowing ? Array.from(new Set([...prev, ongId])) : prev.filter((id) => id !== ongId);
      AsyncStorage.setItem('followedOngs', JSON.stringify(next)).catch(() => {});
      return next;
    });
    try {
      const response = await api.setFollowOng(ongId, nextFollowing);
      if (response.following !== nextFollowing) {
        setFollowedOngs((prev) => {
          const next = response.following ? Array.from(new Set([...prev, ongId])) : prev.filter((id) => id !== ongId);
          AsyncStorage.setItem('followedOngs', JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
    } catch (error) {
      setFollowedOngs((prev) => {
        const next = wasFollowing ? Array.from(new Set([...prev, ongId])) : prev.filter((id) => id !== ongId);
        AsyncStorage.setItem('followedOngs', JSON.stringify(next)).catch(() => {});
        return next;
      });
      throw error;
    } finally {
      pendingFollowOngIdsRef.current.delete(ongId);
    }
  }

  async function setFollowUser(userId: string, nextFollowing: boolean) {
    if (!api || !user?.id) throw new Error('Entre para seguir este usuário');
    if (userId === user.id) throw new Error('Você não pode seguir seu próprio perfil');
    if (pendingFollowUserIdsRef.current.has(userId)) {
      return { following: followedUsers.includes(userId), followersCount: 0 };
    }
    pendingFollowUserIdsRef.current.add(userId);
    const wasFollowing = followedUsers.includes(userId);
    setFollowedUsers((prev) => {
      const next = nextFollowing ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId);
      AsyncStorage.setItem('followedUsers', JSON.stringify(next)).catch(() => {});
      return next;
    });
    try {
      const response = nextFollowing
        ? await api.followUser(userId)
        : await api.unfollowUser(userId);
      setFollowedUsers((prev) => {
        const next = response.following ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId);
        AsyncStorage.setItem('followedUsers', JSON.stringify(next)).catch(() => {});
        return next;
      });
      return { following: response.following, followersCount: response.followersCount };
    } catch (error) {
      setFollowedUsers((prev) => {
        const next = wasFollowing ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId);
        AsyncStorage.setItem('followedUsers', JSON.stringify(next)).catch(() => {});
        return next;
      });
      throw error;
    } finally {
      pendingFollowUserIdsRef.current.delete(userId);
    }
  }

  async function toggleFollowUser(userId: string) {
    return setFollowUser(userId, !followedUsers.includes(userId));
  }

  async function markPostDeletedLocally(postId: string) {
    const next = new Set(deletedPostIdsRef.current);
    next.add(postId);
    const ids = Array.from(next).slice(-MAX_LOCAL_DELETED_POST_IDS);
    deletedPostIdsRef.current = new Set(ids);
    await AsyncStorage.setItem(DELETED_POST_IDS_KEY, JSON.stringify(ids)).catch(() => {});
  }

  async function deletePost(postId: string) {
    const previousPosts = posts;
    const nextPosts = previousPosts.filter((post) => post.id !== postId);
    const isBackendPost = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
    setPosts(nextPosts);
    await saveCachedFeed(nextPosts).catch(() => {});
    await removePendingPost(postId).catch(() => {});
    if (!isBackendPost) {
      await markPostDeletedLocally(postId);
      return;
    }
    try {
      await api?.deletePost(postId);
      await markPostDeletedLocally(postId);
    } catch (error) {
      if (error instanceof ZooHelpApiError && error.status === 405) {
        await markPostDeletedLocally(postId);
        return;
      }
      setPosts(previousPosts);
      await saveCachedFeed(previousPosts).catch(() => {});
      throw error;
    }
  }

  async function publishPostToBackend(pending: PendingPost) {
    if (!api) throw new Error('Backend unavailable');
    const { post, idempotencyKey } = pending;
    const localImages = Array.from(new Set(
      (post.images?.length ? post.images : post.image ? [post.image] : [])
        .filter((uri): uri is string => Boolean(uri) && !uri.startsWith('http')),
    )).slice(0, 4);
    const uploadedImages = pending.uploadedMedia.length
      ? pending.uploadedMedia
      : await Promise.all(localImages.map((uri) => uploadLocalImageToCloudinary(api, uri)));
    if (!pending.uploadedMedia.length && uploadedImages.length) {
      // The create request can time out after the uploads succeeded. Persisting
      // their server-owned references prevents a retry from uploading again.
      await savePendingPostUploads(pending.id, uploadedImages);
    }
    const publicImage = uploadedImages[0]?.publicUrl ?? post.image;
    const response = await api.createPost({
      name: post.name,
      postType: post.type,
      animalType: post.animalType,
      breed: post.breed,
      age: post.age,
      description: post.description,
      location: post.location,
      neighborhood: post.neighborhood,
      image: publicImage,
      images: uploadedImages,
      urgent: post.urgent,
      contact: post.contact,
      tags: post.tags,
      latitude: post.latitude,
      longitude: post.longitude,
      geoSource: post.geoSource === 'gps_confirmed' ? 'gps_confirmed' : undefined,
      routePublic: post.routePublic,
      locationAddress: post.locationAddress,
      idempotencyKey,
    });
    return mapPost(response.post);
  }

  function hasVolatileWebMedia(post: Post) {
    if (Platform.OS !== 'web') return false;
    const media = post.images?.length ? post.images : post.image ? [post.image] : [];
    return media.some((uri) => typeof uri === 'string' && uri.startsWith('blob:'));
  }

  async function refreshOutboxCount() {
    const [pendingPosts, pendingRescues] = await Promise.all([
      listPendingPosts(),
      listPendingRescueOperations(),
    ]);
    setPendingOutboxCount(pendingPosts.length + pendingRescues.length);
  }

  async function syncPendingOperations() {
    if (api) {
      const pendingPosts = await listDuePendingPosts();
      for (const pending of pendingPosts) {
        if (hasVolatileWebMedia(pending.post)) {
          await markPendingPostAttempt(pending.id, 'A mídia temporária do navegador expirou; selecione os arquivos novamente para tentar publicar.');
          continue;
        }
        try {
          const synced = await publishPostToBackend(pending);
          const syncedWithImages = mergePostImages(synced, pending.post);
          await rememberPostImages(syncedWithImages);
          await removePendingPost(pending.id);
          if (justPublishedRef.current?.postId === pending.post.id) {
            justPublishedRef.current = {
              postId: syncedWithImages.id,
              expiresAt: Date.now() + JUST_PUBLISHED_PROMOTION_MS,
            };
          }
          setPosts((prev) => sortPostsNewestFirst([syncedWithImages, ...prev.filter((item) => item.id !== pending.post.id)]));
          await maybeTriggerRescueForSyncedPost(syncedWithImages);
        } catch (error) {
          await markPendingPostAttempt(
            pending.id,
            error instanceof Error ? error.message : 'Falha de rede',
            error instanceof ZooHelpApiError ? error.retryAfterMs : undefined,
          );
        }
      }
      await flushRescueOutbox(api);
    }
    await refreshOutboxCount();
  }

  async function retryFailedPost(postId: string) {
    await retryPendingPost(postId);
    await syncPendingOperations();
  }

  async function addPost(post: Post) {
    const optimisticPost = {
      ...post,
      createdAt: 'agora',
    };
    justPublishedRef.current = {
      postId: optimisticPost.id,
      expiresAt: Date.now() + JUST_PUBLISHED_PROMOTION_MS,
    };
    setPosts((prev) => {
      if (prev.some((item) => item.id === optimisticPost.id)) return prev;
      return sortPostsNewestFirst([optimisticPost, ...prev]);
    });

    // Persist before the very first network side effect. Every timeout/retry
    // now reuses this same key, including after an app restart.
    const pending = await enqueuePost(post);
    try {
      const synced = await publishPostToBackend(pending);
      const syncedWithImages = mergePostImages(synced, post);
      await rememberPostImages(syncedWithImages);
      justPublishedRef.current = {
        postId: syncedWithImages.id,
        expiresAt: Date.now() + JUST_PUBLISHED_PROMOTION_MS,
      };
      setPosts((prev) => sortPostsNewestFirst([
        syncedWithImages,
        ...prev.filter((item) => item.id !== post.id && item.id !== syncedWithImages.id),
      ]));
      await maybeTriggerRescueForSyncedPost(syncedWithImages);
      await removePendingPost(pending.id);
      await refreshOutboxCount();
      return syncedWithImages;
    } catch (error) {
      await markPendingPostAttempt(
        pending.id,
        error instanceof Error ? error.message : 'Falha de rede',
        error instanceof ZooHelpApiError ? error.retryAfterMs : undefined,
      );
      await refreshOutboxCount();
      if (error instanceof ZooHelpApiError && error.status === 401) {
        setPosts((prev) => prev.filter((item) => item.id !== post.id));
        await clearInvalidSession();
        throw error;
      }
      if (hasVolatileWebMedia(post)) {
        throw error;
      }
      const pendingPost = {
        ...post,
        tags: Array.from(new Set(['pendente', ...post.tags])),
        createdAt: 'pendente',
      };
      justPublishedRef.current = {
        postId: pendingPost.id,
        expiresAt: Date.now() + JUST_PUBLISHED_PROMOTION_MS,
      };
      setPosts((prev) => sortPostsNewestFirst([
        pendingPost,
        ...prev.filter((item) => item.id !== post.id),
      ]));
      return pendingPost;
    }
  }

  async function refreshPostsFromBackend() {
    if (!api) return;
    if (Date.now() < feedRetryAfterRef.current) return;
    const activeUser = userRef.current ?? user;
    try {
      const [feed, ownProfile] = await Promise.all([
        api.feed(),
        activeUser?.id ? api.publicUser(activeUser.id).catch(() => null) : Promise.resolve(null),
      ]);
      feedFailureCountRef.current = 0;
      feedRetryAfterRef.current = 0;
      const imageCache = await loadPostImagesCache();
      // The public feed is ranked and bounded. Merge the authenticated user's
      // profile posts so a valid publication can never disappear locally just
      // because it falls outside that global result window.
      const remotePosts = [
        ...feed,
        ...(ownProfile?.posts ?? []),
      ].filter((post, index, allPosts) => allPosts.findIndex((item) => item.id === post.id) === index);
      const mapped = remotePosts
        .map(mapPost)
        .map((post) => mergePostImages(post, imageCache[post.id]))
        .filter((post) => !deletedPostIdsRef.current.has(post.id));
      synchronizeVisibleLikes(mapped);
      const backendIds = new Set(mapped.map((post) => post.id));
      let nextFeed = mapped;
      setPosts((prev) => {
        const now = Date.now();
        const previousById = new Map(prev.map((post) => [post.id, post]));
        const mergedMapped = mapped.map((post) => mergePostImages(post, previousById.get(post.id)));
        const stickyLocalPosts = prev.filter((post) => {
          if (deletedPostIdsRef.current.has(post.id)) return false;
          if (backendIds.has(post.id)) return false;
          if (post.createdAt === 'pendente' || post.createdAt === 'agora') return true;
          if (post.author.id !== activeUser?.id) return false;
          const createdAtMs = Date.parse(post.createdAt);
          return Number.isFinite(createdAtMs) && now - createdAtMs < 5 * 60 * 1000;
        });
        nextFeed = [...sortPostsNewestFirst(stickyLocalPosts), ...mergedMapped];
        const promoted = justPublishedRef.current;
        if (promoted && promoted.expiresAt > now) {
          const promotedIndex = nextFeed.findIndex((post) => post.id === promoted.postId);
          if (promotedIndex > 0) {
            nextFeed = [nextFeed[promotedIndex], ...nextFeed.filter((_, index) => index !== promotedIndex)];
          }
        } else if (promoted) {
          justPublishedRef.current = null;
        }
        return nextFeed;
      });
      await saveCachedFeed(nextFeed);
    } catch (error) {
      feedFailureCountRef.current = Math.min(feedFailureCountRef.current + 1, 5);
      feedRetryAfterRef.current =
        Date.now() + Math.min(120000, 10000 * 2 ** (feedFailureCountRef.current - 1));
      throw error;
    }
  }

  async function refreshPosts() {
    try {
      await syncPendingOperations();
      await refreshPostsFromBackend();
    } catch {
      const cachedFeed = await loadCachedFeed();
      const visibleCachedFeed = cachedFeed.filter((post) => !deletedPostIdsRef.current.has(post.id));
      if (visibleCachedFeed.length) setPosts(visibleCachedFeed);
    }
  }

  async function refreshUser() {
    await refreshCurrentUser();
  }

  async function maybeTriggerRescueForSyncedPost(post: Post) {
    if (!api || (!post.urgent && post.type !== 'emergency') || post.latitude == null || post.longitude == null) {
      return;
    }
    try {
      await api.triggerRescue({
        postId: post.id,
        lat: post.latitude,
        lng: post.longitude,
      });
    } catch {
      await enqueueRescueOperation({
        type: 'trigger',
        postId: post.id,
        lat: post.latitude,
        lng: post.longitude,
      });
    }
  }

  async function donateToOng(ongId: string, amountCents = 1000) {
    if (!supportPaymentsEnabled) {
      throw new Error('Apoio financeiro ainda nao esta habilitado');
    }
    if (api) {
      await api.createDonationIntent({ ongId, amountCents, currency: 'BRL' });
    }
  }

  async function updateUserAvatar(avatarUri: string, fileSize?: number, contentType?: string | null) {
    if (!user) return;

    const uploadedImage =
      api && !avatarUri.startsWith('http')
        ? await uploadLocalImageToCloudinary(
            api,
            avatarUri,
            user.type === 'ong' ? 'ong-logo' : 'profile-avatar',
            fileSize,
            contentType,
          )
        : null;
    // Match the composer flow: persist Cloudinary's confirmed delivery URL.
    // This is the URL of the asset that was actually stored and rendered.
    let avatar = uploadedImage?.publicUrl ?? avatarUri;
    if (api && avatar.startsWith('http')) {
      const savedAvatar = await api.updateAvatar({
        avatarUrl: avatar,
        uploadId: uploadedImage?.uploadId,
      });
      avatar = savedAvatar.avatarUrl;
    }
    const nextUser = {
      ...user,
      avatar,
    };

    await persistUser(nextUser);
  }

  async function updateUserProfile(input: {
    name: string;
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }) {
    if (!user) return;

    const cleanName = input.name.trim();
    if (!cleanName) throw new Error('Nome obrigatorio');

    const response = api ? await api.updateProfile({ ...input, name: cleanName }) : null;
    const backendUser = response ? mapAuthUser(response) : null;
    const nextUser = {
      ...(backendUser ?? user),
      name: backendUser?.name ?? cleanName,
      profileAddress: backendUser?.profileAddress ?? {
        cep: input.cep,
        street: input.street,
        number: input.number,
        complement: input.complement,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
      },
    };

    await persistUser(nextUser);
  }

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        hasSeenOnboarding,
        posts,
        likedPosts,
        likedPostCounts,
        followedOngs,
        followedUsers,
        chatUnreadCount,
        chatMessageNotifications,
        login,
        register,
        logout,
        deleteAccount,
        completeOnboarding,
        toggleLike,
        fetchLikedPosts,
        toggleFollowOng,
        setFollowUser,
        toggleFollowUser,
        deletePost,
        addPost,
        refreshPosts,
        donateToOng,
        updateUserAvatar,
        updateUserProfile,
        refreshUser,
        refreshChatState,
        pendingOutboxCount,
        syncPendingOperations,
        retryFailedPost,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
