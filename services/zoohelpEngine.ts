export type ZooHelpRuntime = "expo" | "web";

export interface ZooHelpEngineConfig {
  apiBaseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Refreshes credentials once after a 401. It must not call this request method. */
  refreshAccessToken?: () => Promise<boolean>;
  onUnauthorized?: (context: { path: string; status: number; requestId: string }) => Promise<void> | void;
  runtime?: ZooHelpRuntime;
}

export class ZooHelpApiError extends Error {
  status?: number;
  code?: string;
  requestId: string;
  payload?: unknown;
  retryAfterMs?: number;

  constructor(input: { message: string; status?: number; code?: string; requestId: string; payload?: unknown; retryAfterMs?: number }) {
    super(input.message);
    this.name = "ZooHelpApiError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.payload = input.payload;
    this.retryAfterMs = input.retryAfterMs;
  }
}

export interface CoreCapability {
  domain: string;
  owner: "rust" | "python";
  reason: string;
}

export type AccountType = "person" | "ong" | "vet";
export type AnimalType = "dog" | "cat" | "other";
export type PostType = "adoption" | "lost" | "found" | "emergency" | "campaign" | "post";

export interface AuthorContract {
  id: string;
  name: string;
  avatar: string | null;
  verified: boolean;
  type: AccountType;
}

export interface UserContract extends AuthorContract {
  email: string;
  bio: string;
  gender?: "male" | "female" | null;
  postsCount: number;
  helpedCount: number;
  adoptionsCount: number;
  profileAddress?: {
    cep?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
}

export interface PostContract {
  id: string;
  type: PostType;
  animalType: AnimalType;
  name: string;
  breed: string;
  age: string;
  description: string;
  location: string;
  neighborhood: string;
  image: string | null;
  images: PostMediaContract[];
  textOnly: boolean;
  author: AuthorContract;
  likes: number;
  likedByMe: boolean;
  comments: number;
  shares: number;
  urgent: boolean;
  rescueStatus?: "open" | "active" | "resolved" | "cancelled" | string;
  rescueOperational?: {
    fanoutPhase?: number | null;
    helpGoingCount: number;
    helpArrivedCount: number;
    operationalLabel: string;
  } | null;
  rescueFinalReport?: {
    status: string;
    publicUpdate: string;
  } | null;
  resolvedAt?: string | null;
  createdAt: string;
  contact: string;
  tags: string[];
  latitude?: number;
  longitude?: number;
  geoStatus: "unavailable" | "pending" | "confirmed" | "failed" | string;
  geoSource?: "gps_confirmed" | "address_geocoded" | string | null;
  routePublic: boolean;
  locationAddress?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    complement?: string | null;
  } | null;
}

export interface PostMediaContract {
  id: string;
  url: string;
  contentType: "image/jpeg" | "image/png" | "image/webp" | string;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  moderationStatus: "queued" | "approved" | "rejected" | "needs_review" | string;
}

export interface PostCommentContract {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: AuthorContract;
}

export interface OngContract {
  id: string;
  name: string;
  shortName: string;
  description: string;
  mission: string;
  location: string;
  city: string;
  state: string;
  verified: boolean;
  animalsRescued: number;
  activeCases: number;
  adoptions: number;
  animalTypes: string[];
  followers: number;
  since: string;
  cnpj: string;
  contact: string;
  cause: string;
}

export interface ImpactMetricsContract {
  resolvedCases: number;
  animalsHelped: number;
  confirmedHelpCases: number;
  supportedOngs?: number;
  ongSupportCents?: number;
  activeProtectors30d: number;
  activeVerifiedOngs: number;
  repeatHelpers: number;
  firstHelpResponseSeconds?: number | null;
  firstAnimalResolvedSeconds?: number | null;
  firstOngSupportSeconds?: number | null;
  medianFirstNearbySignalSeconds?: number | null;
  medianFirstResponseSeconds?: number | null;
  medianGeocodeActivationSeconds?: number | null;
  generatedAt: string;
}

export interface ChatConversationContract {
  id: string;
  postId: string;
  participant: AuthorContract;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  postTitle: string;
}

export interface ChatMessageContract {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface AuthResponseContract {
  user: UserContract;
  ongProfile?: {
    legalName: string;
    ongType?: string | null;
    cnpj?: string | null;
    phone?: string | null;
    cep?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    foundationYear?: number | null;
    verificationStatus: string;
  } | null;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
}

export interface CurrentUserResponseContract {
  user: UserContract;
  ongProfile?: AuthResponseContract["ongProfile"];
}

export interface CreatePostResponseContract {
  post: PostContract;
  media: PostMediaContract[];
  moderationStatus: "queued" | "approved" | "rejected" | "needs_review";
  fraudRisk: number;
  rescueAlert?: RescueAlertContract | null;
}

export interface RescueAlertContract {
  id: string;
  postId: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  critical: boolean;
  recipientCount?: number;
  recipients: Array<{
    userId: string;
    platform: "ios" | "android" | "expo" | "web" | string;
    distanceKm: number;
    deliveryStatus: string;
  }>;
  createdAt: string;
}

export interface MediaUploadIntentContract {
  provider: "cloudinary" | string;
  uploadId: string;
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  resourceType: "image" | "video" | string;
  expiresInSeconds: number;
  maxSizeBytes: number;
  allowedContentTypes: string[];
  cloudinary: {
    cloudName: string;
    apiKey: string;
    signature: string;
    timestamp: number;
    folder: string;
    publicId: string;
  };
}

export interface NearbyCaseContract {
  post: PostContract;
  distanceKm: number;
}

export interface SearchResponseContract {
  posts: PostContract[];
  ongs: OngContract[];
}

export interface PublicUserSummaryContract extends AuthorContract {}

export interface PublicUserProfileContract extends AuthorContract {
  bio: string;
  location: string;
  postsCount: number;
  activeCasesCount: number;
  resolvedCasesCount: number;
  followersCount: number;
  followingCount: number;
  following: boolean;
  posts: PostContract[];
  createdAt: string;
}

export interface DonationIntentContract {
  id: string;
  ongId: string;
  amountCents: number;
  currency: string;
  status: string;
}

export interface NotificationContract {
  id: string;
  title: string;
  body?: string;
  read: boolean;
  kind?: "system" | "rescue_alert" | string;
  postId?: string | null;
  imageUrl?: string | null;
  distanceKm?: number | null;
  critical?: boolean;
  deeplink?: string | null;
  dedupeKey?: string | null;
  ttlSeconds?: number | null;
  category?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface SupportTicketContract {
  id: string;
  subject: string;
  status: string;
  category: string;
  severity: string;
  createdAt: string;
  messages?: SupportMessageContract[];
}

export interface SupportMessageContract {
  id: string;
  body: string;
  authorType: "user" | "support" | "system" | string;
  createdAt: string;
}

export interface RescueSessionContract {
  id: string;
  postId: string;
  status: "active" | "ended" | string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterPushTokenResponseContract {
  status: string;
  subscribers: number;
}

export interface RescueAlertContract {
  id: string;
  postId: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  critical: boolean;
  recipientCount?: number;
  recipients: Array<{
    userId: string;
    platform: "ios" | "android" | "expo" | "web" | string;
    distanceKm: number;
    deliveryStatus: string;
  }>;
  createdAt: string;
}

export interface MarketplaceItemContract {
  id: string;
  title: string;
  itemType: string;
}

export const CORE_CAPABILITIES: CoreCapability[] = [
  { domain: "api", owner: "rust", reason: "baixa latencia e contratos publicos" },
  { domain: "auth", owner: "rust", reason: "seguranca, sessao e autorização" },
  { domain: "feed", owner: "rust", reason: "alto volume de leitura" },
  { domain: "posts", owner: "rust", reason: "validação, transação e fan-out" },
  { domain: "chat", owner: "rust", reason: "realtime e concorrencia" },
  { domain: "geo", owner: "rust", reason: "PostGIS e busca proxima" },
  { domain: "trust", owner: "rust", reason: "score usado em fluxo critico" },
  { domain: "ai-moderation", owner: "python", reason: "modelos de visao computacional" },
  { domain: "nlp", owner: "python", reason: "classificação e experimentação" },
  { domain: "advanced-fraud-models", owner: "python", reason: "ML offline/assincrono" },
];

export class ZooHelpEngine {
  private readonly config: ZooHelpEngineConfig;

  constructor(config: ZooHelpEngineConfig) {
    this.config = {
      ...config,
      apiBaseUrl: config.apiBaseUrl.replace(/\/+$/, ""),
      runtime: config.runtime ?? "expo",
    };
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const requestId = createRequestId();
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("x-client-request-id", requestId);

    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (["POST", "PUT", "PATCH"].includes(method) && !headers.has("idempotency-key")) {
      headers.set("idempotency-key", createRequestId());
    }

    const maxAttempts = method === "GET" ? 3 : 4;
    const timeoutMs = requestTimeoutMs(method);
    let lastError: unknown;
    let refreshed = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // Resolve the token per attempt: a successful refresh must be used by
      // the replay rather than the expired token captured before the request.
      if (!headers.has("authorization")) {
        const token = await this.config.getAccessToken?.();
        if (token) headers.set("authorization", `Bearer ${token}`);
      }
      const controller = typeof AbortController !== "undefined" && !init.signal ? new AbortController() : null;
      const timeout = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;
      try {
        const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
          ...init,
          method,
          headers,
          signal: init.signal ?? controller?.signal,
        });
        if (response.status === 401) {
          headers.delete("authorization");
          if (!headers.has("x-auth-refresh") && !refreshed && this.config.refreshAccessToken && await this.config.refreshAccessToken()) {
            refreshed = true;
            attempt -= 1;
            continue;
          }
          await this.config.onUnauthorized?.({ path, status: response.status, requestId });
        }
        if (!response.ok) {
          const payload = await safeJson(response);
          const message =
            typeof payload?.message === "string"
              ? payload.message
              : `ZooHelp core request failed: ${response.status} ${response.statusText}`;
          const error = new ZooHelpApiError({
            message,
            status: response.status,
            code: typeof payload?.code === "string" ? payload.code : undefined,
            requestId,
            payload,
            retryAfterMs: retryAfterMs(response.headers.get("retry-after")),
          });
          if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
            await sleep(retryDelayMs(attempt, error.retryAfterMs));
            continue;
          }
          throw error;
        }
        if (response.status === 204) return undefined as T;
        return response.json() as Promise<T>;
      } catch (error) {
        lastError = error;
        if (error instanceof ZooHelpApiError || attempt === maxAttempts) break;
        await sleep(retryDelayMs(attempt));
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new ZooHelpApiError({ message: "Erro de rede ao chamar ZooHelp", requestId, payload: lastError });
  }

  health() {
    return this.request<{ status: string; service: string }>("/healthz");
  }

  webSocketUrl(path: string, accessToken?: string | null) {
    const base = this.config.apiBaseUrl.replace(/^http/i, "ws");
    const separator = path.includes("?") ? "&" : "?";
    return accessToken
      ? `${base}${path}${separator}access_token=${encodeURIComponent(accessToken)}`
      : `${base}${path}`;
  }

  feed(input: { lat?: number; lng?: number; radiusKm?: number; type?: PostType; authorType?: AccountType; liked?: boolean; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (input.lat != null) params.set("lat", String(input.lat));
    if (input.lng != null) params.set("lng", String(input.lng));
    if (input.radiusKm != null) params.set("radius_km", String(input.radiusKm));
    if (input.type) params.set("type", input.type);
    if (input.authorType) params.set("author_type", input.authorType);
    if (input.liked != null) params.set("liked", String(input.liked));
    if (input.limit != null) params.set("limit", String(input.limit));
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<PostContract[]>(`/v1/feed${suffix}`);
  }

  feedWebSocketUrl() {
    return this.webSocketUrl("/v1/feed/ws");
  }

  login(email: string, password: string) {
    return this.request<AuthResponseContract>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  refresh(refreshToken: string) {
    return this.request<AuthResponseContract>("/v1/auth/refresh", {
      method: "POST",
      headers: { "x-auth-refresh": "1" },
      body: JSON.stringify({ refreshToken }),
    });
  }

  register(input: {
    name: string;
    email: string;
    password: string;
    accountType?: AccountType;
    gender?: "male" | "female" | null;
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
  }) {
    return this.request<AuthResponseContract>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  me() {
    return this.request<CurrentUserResponseContract>("/v1/me");
  }

  createPost(input: {
    name?: string;
    postType: PostType;
    animalType: AnimalType;
    breed?: string;
    age?: string;
    description: string;
    location: string;
    neighborhood?: string;
    image?: string | null;
    images?: Array<{
      objectKey?: string;
      publicUrl?: string;
      url?: string;
      contentType?: string;
      width?: number;
      height?: number;
      sizeBytes?: number;
      checksumSha256?: string;
    }>;
    urgent?: boolean;
    contact?: string;
    tags?: string[];
    latitude?: number;
    longitude?: number;
    geoSource?: "gps_confirmed";
    routePublic?: boolean;
    locationAddress?: {
      street: string;
      number: string;
      neighborhood: string;
      city: string;
      state: string;
      complement?: string;
    };
    idempotencyKey?: string;
  }) {
    const { idempotencyKey, ...body } = input;
    return this.request<CreatePostResponseContract>("/v1/posts", {
      method: "POST",
      headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
      body: JSON.stringify(body),
    });
  }

  createMediaUploadIntent(input: {
    fileName: string;
    contentType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/quicktime" | "video/webm" | string;
    sizeBytes: number;
    purpose?: "post" | "ong-logo" | "profile-avatar" | "kyb-document" | string;
    checksumSha256?: string;
  }) {
    return this.request<MediaUploadIntentContract>("/v1/media/upload-intents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateAvatar(input: { avatarUrl: string; uploadId?: string }) {
    return this.request<{ avatarUrl: string }>("/v1/me/avatar", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  updateProfile(input: {
    name?: string;
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }) {
    return this.request<CurrentUserResponseContract>("/v1/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  post(id: string) {
    return this.request<PostContract>(`/v1/posts/${encodeURIComponent(id)}`);
  }

  deletePost(id: string) {
    return this.request<{ status: string }>(`/v1/posts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  likePost(id: string) {
    return this.request<{ postId: string; liked: boolean; likes: number }>(`/v1/posts/${encodeURIComponent(id)}/like`, {
      method: "PUT",
    });
  }

  unlikePost(id: string) {
    return this.request<{ postId: string; liked: boolean; likes: number }>(`/v1/posts/${encodeURIComponent(id)}/like`, {
      method: "DELETE",
    });
  }

  ongs() {
    return this.request<OngContract[]>("/v1/ongs");
  }

  ong(id: string) {
    return this.request<OngContract>(`/v1/ongs/${encodeURIComponent(id)}`);
  }

  followOng(id: string) {
    return this.request<{ ongId: string; following: boolean }>(`/v1/ongs/${encodeURIComponent(id)}/follow`, {
      method: "POST",
    });
  }

  setFollowOng(id: string, following: boolean) {
    return this.request<{ ongId: string; following: boolean; followersCount: number }>(
      `/v1/ongs/${encodeURIComponent(id)}/follow`,
      { method: following ? "PUT" : "DELETE" },
    );
  }

  chatRooms(input: { postId?: string } = {}) {
    const params = new URLSearchParams();
    if (input.postId) params.set("post_id", input.postId);
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<ChatConversationContract[]>(`/v1/chat/rooms${suffix}`);
  }

  openChatRoom(postId: string) {
    return this.request<ChatConversationContract>("/v1/chat/rooms", {
      method: "POST",
      body: JSON.stringify({ postId }),
    });
  }

  openDirectChat(participantId: string) {
    return this.request<ChatConversationContract>("/v1/chat/rooms", {
      method: "POST",
      body: JSON.stringify({ participantId }),
    });
  }

  chatRoom(roomId: string) {
    return this.request<ChatConversationContract>(`/v1/chat/rooms/${encodeURIComponent(roomId)}`);
  }

  chatMessages(roomId: string, input: { before?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (input.before) params.set("before", input.before);
    if (input.limit != null) params.set("limit", String(input.limit));
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<ChatMessageContract[]>(`/v1/chat/rooms/${encodeURIComponent(roomId)}/messages${suffix}`);
  }

  issueChatWebSocketTicket(roomId: string) {
    return this.request<{ ticket: string; expiresAt: string }>(
      `/v1/chat/rooms/${encodeURIComponent(roomId)}/ws-ticket`,
      { method: "POST" },
    );
  }

  chatWebSocketUrl(roomId: string, ticket: string) {
    return this.webSocketUrl(
      `/v1/chat/rooms/${encodeURIComponent(roomId)}/ws?ticket=${encodeURIComponent(ticket)}`,
    );
  }

  markChatRoomRead(roomId: string, throughMessageId: string) {
    return this.request<{ status: string }>(`/v1/chat/rooms/${encodeURIComponent(roomId)}/read`, {
      method: "PATCH",
      body: JSON.stringify({ throughMessageId }),
    });
  }

  rescueWebSocketUrl(rescueId: string, accessToken?: string | null) {
    return this.webSocketUrl(`/v1/rescue/active/${encodeURIComponent(rescueId)}/ws`, accessToken);
  }

  sendChatMessage(roomId: string, body: string, idempotencyKey?: string) {
    return this.request<{ message: ChatMessageContract }>(
      `/v1/chat/rooms/${encodeURIComponent(roomId)}/messages`,
      {
        method: "POST",
        headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
        body: JSON.stringify({ body }),
      },
    );
  }

  blockChatParticipant(participantId: string) {
    return this.request<{ status: string }>(`/v1/chat/participants/${encodeURIComponent(participantId)}/block`, {
      method: "PUT",
    });
  }

  unblockChatParticipant(participantId: string) {
    return this.request<{ status: string }>(`/v1/chat/participants/${encodeURIComponent(participantId)}/block`, {
      method: "DELETE",
    });
  }

  nearby(input: { lat?: number; lng?: number; radiusKm?: number } = {}) {
    const params = new URLSearchParams();
    if (input.lat != null) params.set("lat", String(input.lat));
    if (input.lng != null) params.set("lng", String(input.lng));
    if (input.radiusKm != null) params.set("radius_km", String(input.radiusKm));
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<NearbyCaseContract[]>(`/v1/geo/nearby${suffix}`);
  }

  impactMetrics() {
    return this.request<ImpactMetricsContract>("/v1/impact/metrics");
  }

  search(q: string) {
    return this.request<SearchResponseContract>(`/v1/search?q=${encodeURIComponent(q)}`);
  }

  publicUsers(input: { q?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    const query = input.q?.trim();
    if (query) params.set("q", query);
    if (input.limit != null) params.set("limit", String(input.limit));
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<PublicUserSummaryContract[]>(`/v1/users${suffix}`);
  }

  publicUser(id: string) {
    return this.request<PublicUserProfileContract>(`/v1/users/${encodeURIComponent(id)}`);
  }

  publicUserFollowers(id: string, input: { limit?: number } = {}) {
    const params = new URLSearchParams();
    if (input.limit != null) params.set("limit", String(input.limit));
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<PublicUserSummaryContract[]>(`/v1/users/${encodeURIComponent(id)}/followers${suffix}`);
  }

  publicUserFollowing(id: string, input: { limit?: number } = {}) {
    const params = new URLSearchParams();
    if (input.limit != null) params.set("limit", String(input.limit));
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<PublicUserSummaryContract[]>(`/v1/users/${encodeURIComponent(id)}/following${suffix}`);
  }

  followUser(id: string) {
    return this.request<{ userId: string; following: boolean; followersCount: number }>(
      `/v1/users/${encodeURIComponent(id)}/follow`,
      { method: "POST" },
    );
  }

  unfollowUser(id: string) {
    return this.request<{ userId: string; following: boolean; followersCount: number }>(
      `/v1/users/${encodeURIComponent(id)}/follow`,
      { method: "DELETE" },
    );
  }

  createDonationIntent(input: { ongId: string; amountCents: number; currency?: string }) {
    return this.request<DonationIntentContract>("/v1/donations/intents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  notifications() {
    return this.request<NotificationContract[]>("/v1/notifications");
  }

  markNotificationAsRead(id: string) {
    return this.request<{ status: string }>(`/v1/notifications/${encodeURIComponent(id)}/mark-as-read`, {
      method: "PATCH",
    });
  }

  ackNotification(id: string) {
    return this.request<{ status: string }>(`/v1/notifications/${encodeURIComponent(id)}/ack`, {
      method: "POST",
    });
  }

  registerPushToken(input: {
    userId: string;
    pushToken: string;
    platform: "ios" | "android" | "expo" | "web";
    lat: number;
    lng: number;
    radiusKm?: number;
    criticalAlerts?: boolean;
  }) {
    return this.request<RegisterPushTokenResponseContract>("/v1/notifications/push-token", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  previewRescueAlert(postId: string) {
    return this.request<{ alert: RescueAlertContract }>(
      `/v1/notifications/rescue-alerts/${encodeURIComponent(postId)}/preview`,
      { method: "POST" },
    );
  }

  createMyKybDocument(input: { documentType: string; objectKey: string; publicUrl: string }) {
    return this.request<{
      id: string;
      ongId: string;
      documentType: string;
      publicUrl: string;
      status: string;
    }>("/v1/me/ong/kyb-documents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  triggerRescue(input: { postId: string; lat: number; lng: number; accuracy?: number; idempotencyKey?: string }) {
    const { idempotencyKey, ...body } = input;
    return this.request<{ rescue: RescueSessionContract }>("/v1/rescue/active", {
      method: "POST",
      headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
      body: JSON.stringify(body),
    });
  }

  updateRescueLocation(rescueId: string, input: { lat: number; lng: number; accuracy?: number; idempotencyKey?: string }) {
    const { idempotencyKey, ...body } = input;
    return this.request<{ rescue: RescueSessionContract }>(`/v1/rescue/active/${encodeURIComponent(rescueId)}/location`, {
      method: "PATCH",
      headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
      body: JSON.stringify(body),
    });
  }

  endRescue(rescueId: string, idempotencyKey?: string) {
    return this.request<{ rescue: RescueSessionContract }>(`/v1/rescue/active/${encodeURIComponent(rescueId)}/end`, {
      method: "PATCH",
      headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
    });
  }

  createRescueIncident(rescueId: string, input: { description: string; attachments?: string[]; idempotencyKey?: string }) {
    const { idempotencyKey, ...body } = input;
    return this.request<{ id: string; rescueId: string; status: string }>(
      `/v1/rescue/active/${encodeURIComponent(rescueId)}/incident`,
      {
        method: "POST",
        headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
        body: JSON.stringify(body),
      },
    );
  }

  supportMeta() {
    return this.request<{ categories: string[]; severities: string[] }>("/v1/support/meta");
  }

  supportTickets() {
    return this.request<SupportTicketContract[]>("/v1/support/tickets");
  }

  createSupportTicket(input: { subject: string; body: string; category?: string; severity?: string }) {
    return this.request<SupportTicketContract>("/v1/support/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  supportTicket(id: string) {
    return this.request<SupportTicketContract>(`/v1/support/tickets/${encodeURIComponent(id)}`);
  }

  addSupportMessage(id: string, body: string) {
    return this.request<SupportMessageContract>(`/v1/support/tickets/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  marketplaceItems() {
    return this.request<MarketplaceItemContract[]>("/v1/marketplace/items");
  }

  requestPasswordReset(email: string) {
    return this.request<{ status: string }>("/v1/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  confirmPasswordReset(token: string, password: string) {
    return this.request<{ status: string }>("/v1/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  }

  deleteAccount() {
    return this.request<{ status: string }>("/v1/me", { method: "DELETE" });
  }

  commentPost(postId: string, body: string, idempotencyKey?: string) {
    return this.request<{ id: string; postId: string; body: string; createdAt: string }>(
      `/v1/posts/${encodeURIComponent(postId)}/comments`,
      {
        method: "POST",
        headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
        body: JSON.stringify({ body }),
      },
    );
  }

  postComments(postId: string) {
    return this.request<PostCommentContract[]>(`/v1/posts/${encodeURIComponent(postId)}/comments`);
  }

  reportPost(postId: string, reason: string, details?: string) {
    return this.request<{ id: string; postId: string; status: string }>(
      `/v1/posts/${encodeURIComponent(postId)}/report`,
      {
        method: "POST",
        body: JSON.stringify({ reason, details }),
      },
    );
  }

  confirmRescueResponse(postId: string, input: { action?: "going" | "remote_support" | "unavailable"; status?: "confirmed" | "cancelled" | "arrived"; lat?: number; lng?: number; etaSeconds?: number } = {}) {
    return this.request<{ response: unknown }>(
      `/v1/posts/${encodeURIComponent(postId)}/rescue-response`,
      {
        method: "POST",
        body: JSON.stringify({
          action: input.action ?? "going",
          status: input.status ?? "confirmed",
          lat: input.lat,
          lng: input.lng,
          etaSeconds: input.etaSeconds,
        }),
      },
    );
  }
}

function createRequestId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(120000, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(120000, Math.max(0, date - Date.now())) : undefined;
}

function retryDelayMs(attempt: number, serverDelayMs?: number) {
  const exponential = Math.min(30000, 500 * 2 ** (attempt - 1));
  const jittered = Math.round(exponential * (0.75 + Math.random() * 0.5));
  return Math.max(serverDelayMs ?? 0, jittered);
}

function requestTimeoutMs(method: string) {
  if (method === "GET") return 12000;
  if (method === "POST" || method === "PUT" || method === "PATCH") return 30000;
  return 18000;
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
