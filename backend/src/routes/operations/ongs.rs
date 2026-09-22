use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use chrono::{DateTime, Datelike, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    domain::Ong, error::ApiError, routes::auth::authenticate_request, services::rate_limit,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct OngQuery {
    pub q: Option<String>,
    pub city: Option<String>,
    pub verified: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowOngResponse {
    pub ong_id: String,
    pub following: bool,
    pub followers_count: i64,
}

pub async fn list_ongs(
    headers: HeaderMap,
    State(state): State<AppState>,
    Query(query): Query<OngQuery>,
) -> Result<Json<Vec<Ong>>, ApiError> {
    rate_limit::check_ip(
        &state,
        &headers,
        "ongs:list",
        60,
        std::time::Duration::from_secs(60),
    )
    .await?;
    Ok(Json(filter_ongs(query, load_db_ongs(&state).await?)))
}

pub async fn get_ong(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Ong>, ApiError> {
    rate_limit::check_ip(
        &state,
        &headers,
        "ongs:get",
        120,
        std::time::Duration::from_secs(60),
    )
    .await?;
    let uuid = Uuid::parse_str(&id).map_err(|_| ApiError::NotFound)?;
    load_db_ong(&state, uuid)
        .await?
        .map(Json)
        .ok_or(ApiError::NotFound)
}

pub async fn follow_ong(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<FollowOngResponse>, ApiError> {
    let claims = authenticate_request(&state, &headers)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| ApiError::Unauthorized)?;
    rate_limit::check_user(
        &state,
        &user_id.to_string(),
        "follow:ong",
        60,
        std::time::Duration::from_secs(60 * 60),
    )
    .await?;
    let ong_id = Uuid::parse_str(&id).map_err(|_| ApiError::NotFound)?;

    let current: bool = sqlx::query_scalar(
        "SELECT EXISTS(
           SELECT 1 FROM user_follows uf
           JOIN ong_profiles op ON op.user_id = uf.followed_id
           WHERE uf.follower_id = $1 AND uf.followed_id = op.user_id
             AND op.id = $2 AND uf.active = true
         )",
    )
    .bind(user_id)
    .bind(ong_id)
    .fetch_one(&state.db)
    .await?;
    set_follow_ong(&state, user_id, ong_id, !current, id).await
}

pub async fn follow_ong_explicit(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<FollowOngResponse>, ApiError> {
    set_follow_ong_request(headers, state, id, true).await
}

pub async fn unfollow_ong(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<FollowOngResponse>, ApiError> {
    set_follow_ong_request(headers, state, id, false).await
}

async fn set_follow_ong_request(
    headers: HeaderMap,
    state: AppState,
    id: String,
    following: bool,
) -> Result<Json<FollowOngResponse>, ApiError> {
    let claims = authenticate_request(&state, &headers)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| ApiError::Unauthorized)?;
    let ong_id = Uuid::parse_str(&id).map_err(|_| ApiError::NotFound)?;
    rate_limit::check_user(
        &state,
        &user_id.to_string(),
        "follow:ong",
        60,
        std::time::Duration::from_secs(60 * 60),
    )
    .await?;
    set_follow_ong(&state, user_id, ong_id, following, id).await
}

async fn set_follow_ong(
    state: &AppState,
    follower_id: Uuid,
    ong_id: Uuid,
    following: bool,
    ong_id_text: String,
) -> Result<Json<FollowOngResponse>, ApiError> {
    let owner_id: Uuid = sqlx::query_scalar(
        "SELECT user_id FROM ong_profiles WHERE id = $1",
    )
    .bind(ong_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(ApiError::NotFound)?;
    if owner_id == follower_id {
        return Err(ApiError::Validation("cannot follow yourself".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO user_follows (follower_id, followed_id, active)
        VALUES ($1, $2, $3)
        ON CONFLICT (follower_id, followed_id)
        DO UPDATE SET active = EXCLUDED.active, updated_at = now()
        "#,
    )
    .bind(follower_id)
    .bind(owner_id)
    .bind(following)
    .execute(&state.db)
    .await?;

    let followers_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM user_follows WHERE followed_id = $1 AND active = true",
    )
    .bind(owner_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(FollowOngResponse {
        ong_id: ong_id_text,
        following,
        followers_count,
    }))
}

fn filter_ongs(query: OngQuery, db_ongs: Vec<Ong>) -> Vec<Ong> {
    let q = query.q.map(|value| value.to_lowercase());
    let city = query.city.map(|value| value.to_lowercase());
    let verified_filter = query.verified.unwrap_or(true);

    db_ongs
        .into_iter()
        .filter(|ong| ong.verified == verified_filter)
        .filter(|ong| {
            q.as_ref().map_or(true, |q| {
                ong.name.to_lowercase().contains(q)
                    || ong.cause.to_lowercase().contains(q)
                    || ong.city.to_lowercase().contains(q)
            })
        })
        .filter(|ong| {
            city.as_ref()
                .map_or(true, |city| ong.city.to_lowercase() == *city)
        })
        .collect()
}

pub(crate) async fn load_db_ongs(state: &AppState) -> Result<Vec<Ong>, sqlx::Error> {
    let sql = db_ong_select_sql("");
    let rows = sqlx::query(&sql).fetch_all(&state.db).await?;

    Ok(rows.into_iter().map(row_to_ong).collect())
}

async fn load_db_ong(state: &AppState, id: Uuid) -> Result<Option<Ong>, sqlx::Error> {
    let sql = db_ong_select_sql("WHERE op.id = $1 AND op.verification_status = 'APPROVED'");
    let row = sqlx::query(&sql).bind(id).fetch_optional(&state.db).await?;

    Ok(row.map(row_to_ong))
}

fn db_ong_select_sql(where_clause: &str) -> String {
    format!(
        r#"
        SELECT
          op.id,
          op.legal_name,
          u.email,
          u.avatar_url,
          op.mission,
          op.city,
          op.state,
          op.cnpj,
          op.contact_phone,
          op.area_type,
          op.neighborhood,
          op.verification_status,
          op.created_at,
           COALESCE(active_cases.count, 0)::int AS active_cases,
           COALESCE(ong_followers.count, 0)::int AS followers
        FROM ong_profiles op
        JOIN users u ON u.id = op.user_id
         LEFT JOIN LATERAL (
          SELECT COUNT(*) AS count
          FROM posts p
          WHERE p.author_id = op.user_id
            AND p.moderation_status = 'approved'
        ) active_cases ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS count
           FROM user_follows uf
           WHERE uf.followed_id = op.user_id
             AND uf.active = true
         ) ong_followers ON true
        {where_clause}
        ORDER BY op.created_at DESC
        LIMIT 500
        "#
    )
}

fn row_to_ong(row: sqlx::postgres::PgRow) -> Ong {
    let name: String = row.get("legal_name");
    let city: Option<String> = row.get("city");
    let state: Option<String> = row.get("state");
    let neighborhood: Option<String> = row.get("neighborhood");
    let verification_status: String = row.get("verification_status");
    let created_at: DateTime<Utc> = row.get("created_at");
    let short_name = initials(&name);
    let city_label = city.clone().unwrap_or_else(|| "Brasil".into());
    let state_label = state.clone().unwrap_or_default();
    let location = [
        neighborhood,
        Some(city_label.clone()),
        (!state_label.is_empty()).then_some(state_label.clone()),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(", ");

    Ong {
        id: row.get::<Uuid, _>("id").to_string(),
        name: name.clone(),
        email: row.get("email"),
        short_name,
        avatar_url: row.get("avatar_url"),
        description: row
            .get::<Option<String>, _>("mission")
            .unwrap_or_else(|| "ONG verificada na rede Helpin.".into()),
        mission: row
            .get::<Option<String>, _>("mission")
            .unwrap_or_else(|| "Proteção animal e apoio a comunidade.".into()),
        location,
        city: city_label,
        state: state_label,
        verified: verification_status == "APPROVED",
        animals_rescued: row.get::<i32, _>("active_cases").max(0) as u32,
        active_cases: row.get::<i32, _>("active_cases").max(0) as u32,
        adoptions: 0,
        animal_types: vec!["Todos".into()],
        followers: row.get::<i32, _>("followers").max(0) as u32,
        since: created_at.year().to_string(),
        cnpj: row.get::<Option<String>, _>("cnpj").unwrap_or_default(),
        contact: row
            .get::<Option<String>, _>("contact_phone")
            .unwrap_or_default(),
        cause: row
            .get::<Option<String>, _>("area_type")
            .unwrap_or_else(|| "Proteção animal".into()),
    }
}

fn initials(name: &str) -> String {
    let letters: String = name
        .split_whitespace()
        .filter_map(|part| part.chars().next())
        .take(3)
        .collect();

    if letters.is_empty() {
        "ONG".into()
    } else {
        letters.to_uppercase()
    }
}
