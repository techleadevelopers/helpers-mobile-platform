import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { PostCard } from '@/components/PostCard';
import { ResolvedStoriesStrip } from '@/components/ResolvedStoriesStrip';
import { SkeletonCard } from '@/components/SkeletonCard';
import { MOCK_AUTHORS, Post, PostType } from '@/constants/data';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { geocodeAddress, geocodeStructuredAddress, getPlaceAddressDetails, searchAddressSuggestions } from '@/services/zoohelpApi';
import { ZooHelpApiError } from '@/services/zoohelpEngine';

type FeedFilter = PostType | 'all' | 'ong' | 'needs_response';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Keep the component ready for its future placement without showing it in
// the main feed for now.
const SHOW_RESOLVED_STORIES = false;

const FILTERS: Array<{ label: string; value: FeedFilter; icon: MCIcon; color: string; activeBg: string }> = [
  { label: 'Todos',       value: 'all',       icon: 'paw',               color: '#4caf4f00', activeBg: '#586158' },
  { label: 'Emergência',  value: 'emergency', icon: 'alert-circle',      color: '#FF3B30', activeBg: '#586158' },
  { label: 'Adoção',      value: 'adoption',  icon: 'home-heart',        color: '#4CAF50', activeBg: '#586158' },
  { label: 'Perdidos',    value: 'lost',       icon: 'magnify',           color: '#FF9800', activeBg: '#586158' },
  { label: 'Encontrados', value: 'found',      icon: 'check-circle',      color: '#2F80ED', activeBg: '#586158' },
  { label: 'Campanhas',   value: 'campaign',   icon: 'heart-multiple',    color: '#9B59B6', activeBg: '#586158' },
  { label: 'ONGs',        value: 'ong',        icon: 'shield-check',      color: '#2F80ED', activeBg: '#586158' },
];

FILTERS.splice(2, 0, {
  label: 'Sem resposta',
  value: 'needs_response',
  icon: 'timer-alert',
  color: '#D84A3A',
  activeBg: '#586158',
});

const ZOOHELP_HEADER_LOGO =
  'https://res.cloudinary.com/limpeja/image/upload/v1779564981/Gemini_Generated_Image_isin7wisin7wisin-removebg-preview_yx0k5g.png';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Post>);

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { posts, refreshPosts, user, addPost, syncPendingOperations, chatUnreadCount, chatMessageNotifications } = useApp();
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickImage, setQuickImage] = useState<string | null>(null);
  const [quickImages, setQuickImages] = useState<string[]>([]);
  const [quickUrgent, setQuickUrgent] = useState(true);
  const [quickLocation, setQuickLocation] = useState('');
  const [quickLocationPickerVisible, setQuickLocationPickerVisible] = useState(false);
  const [quickCoords, setQuickCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressResult, setAddressResult] = useState<{ label: string; latitude: number; longitude: number } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ id: string; label: string }>>([]);
  const [addressLookupFailed, setAddressLookupFailed] = useState(false);
  const [addressManualFallbackVisible, setAddressManualFallbackVisible] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [manualNeighborhood, setManualNeighborhood] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [quickContact, setQuickContact] = useState('');
  const [emergencyCompact, setEmergencyCompact] = useState(false);
  const quickInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);
  const contactInputRef = useRef<TextInput>(null);

  const scrollY = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      scrollY.value = 0;
      setEmergencyCompact(false);
      const timer = setTimeout(() => setEmergencyCompact(true), 3000);
      return () => clearTimeout(timer);
    }, [])
  );

  const topPad = Platform.OS === 'web' ? 16 : insets.top;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerAnimStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 60], [1, 0], 'clamp');
    const translateY = interpolate(scrollY.value, [0, 60], [0, -8], 'clamp');
    return { opacity, transform: [{ translateY }] };
  });

  const filteredPosts = useMemo(() => {
    if (activeFilter === 'all') return posts;
    if (activeFilter === 'ong') return posts.filter((p) => p.author.type === 'ong');
    if (activeFilter === 'needs_response') {
      return posts.filter((p) => {
        const urgent = p.urgent || p.type === 'emergency';
        const hasResponse = p.rescueStatus === 'active' || (p.rescueOperational?.helpGoingCount ?? 0) > 0;
        return urgent && p.rescueStatus !== 'resolved' && !hasResponse;
      });
    }
    return posts.filter((p) => p.type === (activeFilter as PostType));
  }, [posts, activeFilter]);

  function handleFilterPress(value: FeedFilter) {
    setFilterMenuVisible(false);
    if (value === 'ong') {
      router.push('/ongs');
      return;
    }
    setActiveFilter(value);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncPendingOperations().catch(() => {});
    await refreshPosts().catch(() => {});
    setRefreshing(false);
  }, [refreshPosts, syncPendingOperations]);

  const renderPost = useCallback(
    ({ item, index }: { item: Post; index: number }) => <PostCard post={item} index={index} />,
    []
  );
  const keyExtractor = useCallback((item: Post) => item.id, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const displayName = user?.name?.split(' ')[0] ?? 'Conta';
  const unreadChatNotifications = chatMessageNotifications.filter((item) => !item.isRead).length;
  const notificationBadgeCount = Math.max(chatUnreadCount, unreadChatNotifications);
  const urgentCount = filteredPosts.filter((post) => post.urgent || post.type === 'emergency').length;

  useEffect(() => {
    const query = addressQuery.trim();
    setAddressResult(null);
    if (query.length < 3) {
      setAddressSearching(false);
      setAddressSuggestions([]);
      setAddressLookupFailed(false);
      setAddressManualFallbackVisible(false);
      return;
    }

    setAddressSearching(true);
    setAddressLookupFailed(false);
    setAddressManualFallbackVisible(false);
    const fallbackTimer = setTimeout(() => setAddressManualFallbackVisible(true), 900);
    const timer = setTimeout(() => {
      searchAddressSuggestions(query)
        .then((suggestions) => {
          setAddressSuggestions(suggestions);
          if (suggestions.length > 0) {
            setAddressManualFallbackVisible(false);
            return null;
          }
          return geocodeAddress(query);
        })
        .then((result) => {
          if (!result) {
            setAddressLookupFailed(true);
            setAddressManualFallbackVisible(true);
            return;
          }
          setAddressManualFallbackVisible(false);
          setAddressResult({
            label: result.label,
            latitude: result.latitude,
            longitude: result.longitude,
          });
        })
        .catch(() => {
          setAddressSuggestions([]);
          setAddressResult(null);
          setAddressLookupFailed(true);
          setAddressManualFallbackVisible(true);
        })
        .finally(() => setAddressSearching(false));
    }, 300);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [addressQuery]);

  async function pickQuickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.85,
    });
    if (!result.canceled) {
      const selectedImages = result.assets.map((asset) => asset.uri).filter(Boolean);
      setQuickImages((prev) => {
        const next = Array.from(new Set([...prev, ...selectedImages])).slice(0, 4);
        setQuickImage(next[0] ?? null);
        return next;
      });
    }
  }

  async function detectQuickLocation() {
    const position = await getQuickCurrentPosition();
    if (!position) return;

    setQuickCoords({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    setQuickLocation('Localização atual');
    setAddressLookupFailed(false);
  }

  async function getQuickCurrentPosition() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permissao de localização', 'Ative a localização para alertar ONGs e pessoas proximas.');
        return null;
      }

      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch {
      if (Platform.OS !== 'web') {
        Alert.alert('Localização indisponivel', 'Nao foi possivel capturar sua localização agora.');
        return null;
      }

      const geolocation = globalThis.navigator?.geolocation;
      if (!geolocation) {
        Alert.alert('Localização indisponivel', 'Seu navegador nao liberou o GPS. Use um endereco validado pelo mapa.');
        return null;
      }

      return new Promise<Location.LocationObject | null>((resolve) => {
        geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            });
          },
          () => {
            Alert.alert('Permissao de localização', 'Ative a localização do navegador ou use uma sugestao validada pelo mapa.');
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        );
      });
    }
  }

  function applyAddressResult() {
    if (!addressResult) return;
    setQuickLocation(addressResult.label);
    setQuickCoords({
      latitude: addressResult.latitude,
      longitude: addressResult.longitude,
    });
    setAddressSuggestions([]);
    setAddressLookupFailed(false);
  }

  function getManualLocationParts() {
    return {
      street: addressQuery.trim(),
      number: manualNumber.trim(),
      neighborhood: manualNeighborhood.trim(),
      city: manualCity.trim(),
      state: manualState.trim().toUpperCase(),
    };
  }

  function hasCompleteManualLocation() {
    const parts = getManualLocationParts();
    return Boolean(parts.street && parts.number && parts.neighborhood && parts.city && parts.state.length === 2);
  }

  function getManualLocationLabel() {
    const parts = getManualLocationParts();
    const street = [parts.street, parts.number].filter(Boolean).join(', ');
    const cityState = [parts.city, parts.state].filter(Boolean).join(' - ');
    return [street, parts.neighborhood, cityState].filter(Boolean).join(', ');
  }

  function geocodeWithQuickTimeout(address: string) {
    return Promise.race([
      geocodeAddress(address).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
    ]);
  }

  async function resolveManualAddress(address: string) {
    const parts = getManualLocationParts();
    const geocoded = hasCompleteManualLocation()
      ? await Promise.race([
          geocodeStructuredAddress(parts).catch((error) => {
            console.warn('Structured geocode failed', error);
            return null;
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
        ]) || await geocodeWithQuickTimeout(address)
      : await geocodeWithQuickTimeout(address);
    if (!geocoded && hasCompleteManualLocation()) {
      console.warn('Manual address geocode returned null', {
        street: parts.street,
        number: parts.number,
        neighborhood: parts.neighborhood,
        city: parts.city,
        state: parts.state,
        label: address,
      });
    }
    if (!geocoded) return null;
    return { ...geocoded, label: address };
  }

  async function applyAddressSuggestion(suggestion: { id: string; label: string }) {
    setAddressSearching(true);
    const details = await getPlaceAddressDetails(suggestion.id);
    setAddressSearching(false);
    const selected = details ?? await geocodeAddress(suggestion.label);
    if (!selected) {
      Alert.alert('Endereco nao encontrado', 'Nao foi possivel validar esse endereco no Google Maps.');
      return;
    }

    const label = selected.label || suggestion.label;
    setAddressQuery(label);
    setAddressResult({ ...selected, label });
    setQuickLocation(label);
    setQuickCoords({ latitude: selected.latitude, longitude: selected.longitude });
    setAddressSuggestions([]);
    setAddressLookupFailed(false);
  }

  async function handleQuickPost() {
    if (quickSubmitting) return;
    setQuickError('');
    const description = quickText.trim();
    if (!description && quickImages.length === 0) {
      setQuickError('Escreva o que aconteceu ou adicione uma foto.');
      quickInputRef.current?.focus();
      return;
    }
    if (quickContact.replace(/\D/g, '').length < 10) {
      setQuickError('Informe um WhatsApp ou telefone valido para receber contato sobre o resgate.');
      contactInputRef.current?.focus();
      return;
    }

    setQuickSubmitting(true);

    try {
      let coords = quickCoords;
      let location = quickLocation;
      let locationAddress: Post['locationAddress'] | undefined;
      let webAddressOnlyPost = false;
      const manualLocation = getManualLocationLabel();
      const manualComplete = hasCompleteManualLocation();
      const manualAddress = manualLocation || addressQuery.trim();
      const hasManualFallbackAddress =
        addressManualFallbackVisible ||
        addressLookupFailed ||
        Boolean(manualNumber.trim() || manualNeighborhood.trim() || manualCity.trim() || manualState.trim());

      if (manualComplete) {
        const geocoded = await resolveManualAddress(manualLocation);
        if (geocoded) {
          coords = { latitude: geocoded.latitude, longitude: geocoded.longitude };
          location = manualLocation;
          locationAddress = getManualLocationParts();
          setQuickCoords(coords);
          setQuickLocation(location);
        } else {
          location = manualLocation;
          if (Platform.OS === 'web') {
            webAddressOnlyPost = true;
          } else {
            locationAddress = getManualLocationParts();
          }
          setQuickLocation(location);
        }
      } else if (hasManualFallbackAddress) {
        const message = 'Preencha rua, numero, bairro, cidade e UF para publicar com coordenada correta.';
        setAddressLookupFailed(true);
        setAddressManualFallbackVisible(true);
        setQuickError(message);
        Alert.alert('Endereco incompleto', message);
        return;
      } else if (!coords && manualAddress.length >= 3) {
        const geocoded = await resolveManualAddress(manualAddress);
        if (geocoded) {
          coords = { latitude: geocoded.latitude, longitude: geocoded.longitude };
          location = manualAddress;
          setQuickCoords(coords);
          setQuickLocation(location);
        } else {
          const message = hasManualFallbackAddress
            ? 'Confira rua, numero, bairro, cidade e UF. Preciso localizar esse endereco para publicar com seguranca.'
            : 'Digite rua, numero, bairro, cidade e UF para localizar o caso.';
          setAddressLookupFailed(true);
          setAddressManualFallbackVisible(true);
          setQuickError(message);
          Alert.alert('Endereco nao localizado', message);
          return;
        }
      }

      if (!coords && Platform.OS === 'web' && !location) {
        const message = 'Digite rua, bairro, cidade e estado para publicar.';
        setQuickError(message);
        Alert.alert('Localização obrigatoria', message);
        return;
      }

      if (!coords && !location) {
        const position = await getQuickCurrentPosition();
        if (!position) {
          const message = 'Para pedir ajuda real, permita o GPS. Assim o sistema alerta pessoas e ONGs proximas.';
          setQuickError(message);
          Alert.alert('Localização obrigatoria', message);
          return;
        }
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setQuickCoords(coords);
        location = 'Localização atual';
        setQuickLocation(location);
      }

      if (!coords && Platform.OS === 'web' && manualAddress.length >= 3) {
        const geocoded = await resolveManualAddress(manualAddress);
        if (geocoded) {
          coords = { latitude: geocoded.latitude, longitude: geocoded.longitude };
          location = geocoded.label;
          setQuickCoords(coords);
          setQuickLocation(location);
        }
      }

      if (!coords && !locationAddress && !webAddressOnlyPost) {
        const message = 'Digite rua, numero, bairro, cidade e UF para publicar.';
        setAddressLookupFailed(true);
        setAddressManualFallbackVisible(true);
        setQuickError(message);
        Alert.alert('Localização obrigatoria', message);
        return;
      }

      location = location || 'Localização atual';
      const post: Post = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      type: webAddressOnlyPost ? 'post' : 'emergency',
      animalType: 'other',
      name: description.split(' ').slice(0, 3).join(' ') || 'Pedido de ajuda',
      breed: '',
      age: '',
      description: description || 'Pedido rapido de ajuda para animal proximo.',
      location,
      neighborhood: location,
      image: quickImages[0] ?? null,
      images: quickImages,
      textOnly: quickImages.length === 0,
      author: user
        ? { id: user.id, name: user.name, avatar: user.avatar, verified: user.verified, type: user.type }
        : MOCK_AUTHORS[4],
      likes: 0,
      comments: 0,
      shares: 0,
      urgent: webAddressOnlyPost ? false : quickUrgent,
      createdAt: 'agora',
      contact: quickContact.trim(),
      tags: quickUrgent ? ['ajuda', 'urgente'] : ['ajuda'],
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      locationAddress,
      };

      await addPost(post);
      setQuickText('');
      setQuickImage(null);
      setQuickImages([]);
      setQuickLocation('');
      setQuickLocationPickerVisible(false);
      setQuickCoords(null);
      setQuickError('');
      setAddressQuery('');
      setAddressResult(null);
      setAddressSuggestions([]);
      setAddressLookupFailed(false);
      setAddressManualFallbackVisible(false);
      setManualNumber('');
      setManualNeighborhood('');
      setManualCity('');
      setManualState('');
      setQuickContact('');
      setQuickUrgent(true);
      setActiveFilter('all');
      router.replace('/(tabs)/feed' as any);
    } catch (error) {
      console.error('Quick post failed', error);
      const backendMessage =
        error instanceof ZooHelpApiError
          ? error.message.replace(/^validation error:\s*/i, '')
          : null;
      const message = backendMessage || (error instanceof Error ? error.message : 'Nao foi possivel publicar agora. Tente novamente.');
      setQuickError(message);
      Alert.alert('Erro ao publicar', message);
    } finally {
      setQuickSubmitting(false);
    }
  }

  const ListHeader = (
    <View>
      {/* ── Main Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 6 }]}>
        <Animated.View style={[styles.headerTop, headerAnimStyle]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {greeting}, {displayName}
            </Text>
            <View style={styles.logoRow}>
              <Image
                source={{ uri: ZOOHELP_HEADER_LOGO }}
                style={styles.logoIcon}
                resizeMode="contain"
              />
              <Text style={[styles.logoText, { color: colors.primary }]}>Helpers</Text>
            </View>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Ajude animais perto de você
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.muted }]}
              onPress={() => router.push('/search')}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="magnify" size={19} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.muted }]}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="bell-outline" size={19} color={colors.foreground} />
              {notificationBadgeCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (user?.id) {
                  router.push({ pathname: '/(tabs)/user/[id]', params: { id: user.id } });
                } else {
                  router.push('/(tabs)/profile');
                }
              }}
              activeOpacity={0.85}
            >
              <Avatar
                name={displayName}
                size={40}
                imageUrl={user?.avatar}
                uploadPlaceholder
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {false && (
        <>
        {/* Quick help composer */}
        <View
          style={[
            styles.quickPostCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.primary,
            },
          ]}
        >
          <View style={styles.quickPostTop}>
            <View style={[styles.quickInputShell, { backgroundColor: colors.muted }]}>
              <TouchableOpacity
                style={[
                  styles.quickTool,
                  styles.quickInputPhotoTool,
                  { backgroundColor: quickImages.length ? colors.primary + '18' : colors.card },
                ]}
                onPress={pickQuickImage}
                activeOpacity={0.75}
                accessibilityLabel="Adicionar foto"
              >
                <MaterialCommunityIcons name="image-outline" size={16} color={quickImages.length ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
              <TextInput
                ref={quickInputRef}
                style={[styles.quickInput, { color: colors.foreground }]}
                value={quickText}
                onChangeText={setQuickText}
                placeholder="Escreva algo..."
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="send"
                onSubmitEditing={handleQuickPost}
              />
              {quickImage && (
                <TouchableOpacity
                  style={[
                    styles.quickImagePreviewStrip,
                    { width: Math.min(Math.max(quickImages.length, 1) * 38, 114) },
                  ]}
                  onPress={() => {
                    setQuickImage(null);
                    setQuickImages([]);
                  }}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Remover fotos anexadas"
                >
                  {quickImages.slice(0, 3).map((uri, imageIndex) => (
                    <View key={`${uri}-${imageIndex}`} style={styles.quickImagePreviewWrap}>
                      <Image source={{ uri }} style={styles.quickImagePreview} resizeMode="cover" />
                      {imageIndex === 2 && quickImages.length > 3 && (
                        <View style={styles.quickImageMoreOverlay}>
                          <Text style={styles.quickImageCountText}>+{quickImages.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  <View style={styles.quickImageRemove}>
                    <MaterialCommunityIcons name="close" size={10} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.quickPostBottom}>
            <View style={styles.quickPostTools}>
              <TouchableOpacity
                style={[styles.quickLabelTool, { backgroundColor: quickLocation ? colors.primary + '18' : colors.muted }]}
                onPress={() => {
                  setQuickLocationPickerVisible((visible) => {
                    if (!visible) {
                      setTimeout(() => addressInputRef.current?.focus(), 0);
                    }
                    return !visible;
                  });
                }}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={quickLocation ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.quickLabelText, { color: quickLocation ? colors.primary : colors.mutedForeground }]}>
                  ENDEREÇO
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickUrgentTool, { backgroundColor: quickUrgent ? '#FF3B3014' : colors.muted }]}
                onPress={() => setQuickUrgent((prev) => !prev)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="alert-circle-outline" size={14} color={quickUrgent ? '#FF3B30' : colors.mutedForeground} />
                <Text style={[styles.quickUrgentText, { color: quickUrgent ? '#FF3B30' : colors.mutedForeground }]}>
                  URGENTE
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.quickPostCta, { backgroundColor: colors.primary, opacity: quickSubmitting ? 0.65 : 1 }]}
              onPress={handleQuickPost}
              disabled={quickSubmitting}
              activeOpacity={0.82}
            >
              <MaterialCommunityIcons name="send" size={13} color="#FFFFFF" />
              <Text style={styles.quickPostCtaText}>{quickSubmitting ? 'Enviando' : 'Postar'}</Text>
            </TouchableOpacity>
          </View>

          {quickError ? (
            <View style={styles.quickErrorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#D93025" />
              <Text style={styles.quickErrorText}>{quickError}</Text>
            </View>
          ) : null}

          {quickLocationPickerVisible && (
            <View style={[styles.locationPicker, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <View style={styles.locationTopRow}>
                <View style={styles.locationInputRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.mutedForeground} />
                  <TextInput
                    ref={addressInputRef}
                    style={[styles.locationInput, { color: colors.foreground }]}
                    value={addressQuery}
                    onChangeText={setAddressQuery}
                    placeholder="Rua e numero"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="search"
                  />
                </View>
                {(addressLookupFailed || addressManualFallbackVisible) && addressQuery.trim().length >= 3 && (
                  <TextInput
                    style={[styles.manualNumberInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={manualNumber}
                    onChangeText={setManualNumber}
                    placeholder="Nº"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                  />
                )}
                <TouchableOpacity style={styles.gpsFallbackBtn} onPress={detectQuickLocation} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={14} color={colors.primary} />
                  <Text style={[styles.gpsFallbackText, { color: colors.primary }]}>Usar GPS atual</Text>
                </TouchableOpacity>
              </View>
              {addressSearching && !(addressLookupFailed || addressManualFallbackVisible) && (
                <Text style={[styles.locationHint, { color: colors.mutedForeground }]}>Buscando endereco...</Text>
              )}
              {(addressLookupFailed || addressManualFallbackVisible) && addressQuery.trim().length >= 3 && (
                <View style={styles.manualLocationRow}>
                  <TextInput
                    style={[styles.manualLocationInput, styles.manualNeighborhoodInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={manualNeighborhood}
                    onChangeText={setManualNeighborhood}
                    placeholder="Bairro"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={[styles.manualLocationInput, styles.manualCityInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={manualCity}
                    onChangeText={setManualCity}
                    placeholder="Cidade"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={[styles.manualLocationInput, styles.manualStateInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={manualState}
                    onChangeText={(value) => setManualState(value.toUpperCase())}
                    placeholder="UF"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              )}
              {(addressLookupFailed || addressManualFallbackVisible) && addressQuery.trim().length >= 3 && (
                <View style={styles.quickContactRow}>
                  <MaterialCommunityIcons name="phone-outline" size={15} color={colors.mutedForeground} />
                  <TextInput
                    ref={contactInputRef}
                    style={[styles.quickContactInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={quickContact}
                    onChangeText={setQuickContact}
                    placeholder="WhatsApp ou telefone para contato"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                </View>
              )}
              {addressSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={styles.addressResult}
                  onPress={() => applyAddressSuggestion(suggestion)}
                  activeOpacity={0.82}
                >
                  <MaterialCommunityIcons name="map-marker" size={15} color={colors.primary} />
                  <Text style={[styles.addressResultText, { color: colors.foreground }]} numberOfLines={2}>
                    {suggestion.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {addressResult && (
                <TouchableOpacity style={styles.addressResult} onPress={applyAddressResult} activeOpacity={0.82}>
                  <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.primary} />
                  <Text style={[styles.addressResultText, { color: colors.foreground }]} numberOfLines={2}>
                    {addressResult?.label}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        </>
        )}
      </View>

      {/* ── Filter chips ── */}
      <View style={styles.filterList}>
        {FILTERS.slice(0, 4).map((f) => {
          const isActive = activeFilter === f.value;
          const textColor = isActive ? '#FFFFFF' : colors.mutedForeground;
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? '#DDEEE2' : '#EFF7F1',
                  borderColor: isActive ? '#BED9C5' : '#D7E7DA',
                },
              ]}
              onPress={() => handleFilterPress(f.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, { color: isActive ? '#245137' : '#326044' }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: FILTERS.slice(4).some((f) => f.value === activeFilter) ? '#DDEEE2' : '#EFF7F1',
              borderColor: FILTERS.slice(4).some((f) => f.value === activeFilter) ? '#BED9C5' : '#D7E7DA',
            },
          ]}
          onPress={() => setFilterMenuVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, { color: FILTERS.slice(4).some((f) => f.value === activeFilter) ? '#245137' : '#326044' }]}>
            Mais
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={filterMenuVisible} transparent animationType="fade" onRequestClose={() => setFilterMenuVisible(false)}>
        <View style={styles.filterModalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setFilterMenuVisible(false)} activeOpacity={1} />
          <BlurView intensity={64} tint="default" style={styles.filterMenu}>
            <View pointerEvents="none" style={styles.filterMenuTint} />
            <Text style={styles.filterMenuTitle}>Mais filtros</Text>
            <View style={styles.filterMenuOptions}>
              {FILTERS.slice(4).map((f) => {
                const isActive = activeFilter === f.value;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.filterMenuOption, isActive && styles.filterMenuOptionActive]}
                    onPress={() => handleFilterPress(f.value)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={f.icon} size={16} color={isActive ? '#245137' : '#326044'} />
                    <Text style={[styles.filterMenuText, isActive && styles.filterMenuTextActive]}>{f.label}</Text>
                    {isActive && <MaterialCommunityIcons name="check" size={16} color="#245137" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* ── Section heading ── */}
      {SHOW_RESOLVED_STORIES && <ResolvedStoriesStrip posts={posts} />}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {activeFilter === 'all' ? 'Feed' :
           activeFilter === 'adoption' ? 'Para adoção' :
           activeFilter === 'needs_response' ? 'Urgentes sem resposta' :
           activeFilter === 'lost' ? 'Animais perdidos' :
           activeFilter === 'found' ? 'Animais encontrados' :
           activeFilter === 'emergency' ? 'Emergências' : 'Campanhas'}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
          {urgentCount} urgentes
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {ListHeader}
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedFlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="paw-off"
            title="Nenhum caso encontrado"
            subtitle="Tente um filtro diferente ou puxe para atualizar."
            actionLabel="Ver todos"
            iconColor="#606864"
            onAction={() => setActiveFilter('all')}
          />
        }
      />
      <View
        style={[
          styles.emergencyDock,
          emergencyCompact ? styles.emergencyDockCompact : styles.emergencyDockFull,
          { paddingBottom: insets.bottom + 12 },
        ]}
      >
        <TouchableOpacity
          style={[styles.emergencyButton, emergencyCompact && styles.emergencyButtonCompact]}
          onPress={() => router.push('/composer?intent=help&type=emergency&Helpin=1')}
          activeOpacity={0.88}
          accessibilityLabel="Acionar resgate agora"
        >
          <View style={[styles.emergencyIcon, emergencyCompact && styles.emergencyIconCompact]}>
            <MaterialCommunityIcons name="alarm-light" size={20} color="#FFFFFF" />
          </View>
          {!emergencyCompact && (
            <>
              <View style={styles.emergencyTextWrap}>
                <Text style={styles.emergencyTitle}>Acionar resgate agora</Text>
                <Text style={styles.emergencySubtitle}>GPS, foto e alerta imediato</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    marginTop: 4,
    paddingHorizontal: 16.8,
    paddingBottom: 8.4,
    gap: 10.5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 61,
  },
  headerLeft: {
    gap: 1.05,
    flex: 1,
  },
  greeting: {
    fontSize: 11.55,
    fontFamily: 'Montserrat_400Regular',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    
  },
  logoIcon: {
    width: 33.86,
    height: 33.86,
    borderRadius: 8.4,
    paddingLeft: 8.4,
    paddingRight: 8.4,
  },
  logoText: {
    marginLeft: -1,
    top: 1,
    fontSize: 21.5,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: -1,
    lineHeight: 28,
    marginRight: 6,
    textShadowColor: 'rgba(46,125,50,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
 
  tagline: {
    fontSize: 11.55,
    fontFamily: 'Montserrat_400Regular',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10.5,
  },
  iconBtn: {
    width: 46.2,
    height: 46.2,
    borderRadius: 23.1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 7.35,
    right: 7.35,
    width: 7.35,
    height: 7.35,
    borderRadius: 3.675,
    borderWidth: 1.575,
    borderColor: '#F8FAF8',
  },
  notifBadge: {
    position: 'absolute',
    right: 5.25,
    bottom: 4.2,
    minWidth: 17.85,
    height: 17.85,
    borderRadius: 8.925,
    paddingHorizontal: 4.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#606864',
    borderWidth: 1.575,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    fontSize: 9.45,
    lineHeight: 11.55,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  quickPostCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 13,
    gap: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  quickPostTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickPostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickInputShell: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    paddingLeft: 4,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickInput: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    padding: 0,
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
  },
  quickImagePreviewStrip: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    flexShrink: 0,
    gap: 4,
    paddingRight: 2,
  },
  quickImagePreviewWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#DDE6DE',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  quickImagePreviewOverlap: {
    marginLeft: 0,
  },
  quickImagePreview: {
    width: '100%',
    height: '100%',
  },
  quickImageMoreOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  quickImageCountText: {
    fontSize: 9,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
  },
  quickImageRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 37, 29, 0.78)',
  },
  quickPostBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickPostTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickTool: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickInputPhotoTool: {
    flexShrink: 0,
  },
  quickUrgentTool: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickLabelTool: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickLabelText: {
    fontSize: 9,
    fontFamily: 'Montserrat_700Bold',
  },
  quickUrgentText: {
    fontSize: 9,
    fontFamily: 'Montserrat_700Bold',
  },
  quickPostCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  quickPostCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
  },
  quickErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  quickErrorText: {
    flex: 1,
    color: '#D93025',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  locationPicker: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  locationTopRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationInputRow: {
    flex: 1,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  locationInput: {
    flex: 1,
    padding: 0,
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
  },
  locationHint: {
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
  },
  manualLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    overflow: 'hidden',
  },
  manualNumberInput: {
    width: 42,
    height: 26,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 0,
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
    textAlign: 'center',
    flexShrink: 0,
  },
  manualLocationInput: {
    flex: 1,
    minWidth: 0,
    height: 28,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
  },
  manualStateInput: {
    flex: 0,
    width: 92,
    minWidth: 92,
    flexBasis: 92,
    flexShrink: 0,
    textAlign: 'center',
  },
  manualNeighborhoodInput: {
    flex: 0.36,
  },
  manualCityInput: {
    flex: 0.36,
  },
  quickContactRow: {
    width: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  quickContactInput: {
    flex: 1,
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 0,
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
    backgroundColor: '#FFFFFF',
  },
  addressResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  addressResultText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Montserrat_600SemiBold',
    lineHeight: 16,
  },
  gpsFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 24,
    flexShrink: 0,
  },
  gpsFallbackText: {
    fontSize: 11,
    fontFamily: 'Montserrat_700Bold',
  },
  filterList: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 16,
    paddingBottom: 8,
    paddingRight: 15,
    paddingTop: 4,
  },
  filterChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 9,
    fontFamily: 'Montserrat_600SemiBold',
    textTransform: 'uppercase',
  },
  filterModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18,27,21,0.28)',
    padding: 16,
  },
  filterMenu: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
    shadowColor: '#244C35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 8,
  },
  filterMenuTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(42, 87, 58, 0.27)',
  },
  filterMenuTitle: {
    fontSize: 9,
    fontFamily: 'Montserrat_600SemiBold',
    textTransform: 'uppercase',
    color: '#F3F7F4',
  },
  filterMenuOptions: {
    gap: 7,
  },
  filterMenuOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#E5F0E7',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  filterMenuOptionActive: {
    backgroundColor: '#D7E9DA',
    borderColor: '#A0C5A9',
  },
  filterMenuText: {
    flex: 1,
    color: '#326044',
    fontSize: 9,
    fontFamily: 'Montserrat_600SemiBold',
    textTransform: 'uppercase',
  },
  filterMenuTextActive: {
    color: '#245137',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
  },
  listContent: {
    paddingBottom: 0,
  },
  opsStrip: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opsStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  opsStripTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
  },
  opsStripAction: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
  },
  emergencyDock: {
    position: 'absolute',
    bottom: 0,
  },
  emergencyDockFull: {
    left: 12,
    right: 12,
  },
  emergencyDockCompact: {
    right: 16,
  },
  emergencyButton: {
    minHeight: 58,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#C94444',
    shadowColor: '#C94444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  emergencyButtonCompact: {
    width: 54,
    height: 54,
    minHeight: 54,
    borderRadius: 27,
    paddingHorizontal: 0,
    justifyContent: 'center',
    gap: 0,
  },
  emergencyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  emergencyIconCompact: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'transparent',
  },
  emergencyTextWrap: {
    flex: 1,
  },
  emergencyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
  },
  emergencySubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontFamily: 'Montserrat_500Medium',
  },
});
