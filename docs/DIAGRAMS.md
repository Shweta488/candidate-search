# Diagrams

Generated from `docs/diagrams/*.mmd`. Edit the `.mmd` file, then regenerate this page. Section numbers refer to [ARCHITECTURE.md](ARCHITECTURE.md).

## 01. High-level design

Source: [`01-high-level-design.mmd`](diagrams/01-high-level-design.mmd)

```mermaid
%% High-level design: one Next.js app serves both the pages and the API.
flowchart LR
    Browser["Browser<br/>(recruiter)"]
    Stripe["Stripe<br/>(webhook events)"]

    App["Next.js app<br/>pages + API routes"]

    Auth["Supabase Auth"]
    DB[("Postgres<br/>(local Supabase)")]
    LLM["Claude Haiku<br/>(brief to filters)"]

    Browser -- "sign in" --> Auth
    Browser -- "pages and /api/* calls<br/>with the recruiter's token" --> App
    Stripe -- "POST /api/billing/events" --> App
    App -- "verify token" --> Auth
    App -- "SQL, row level security" --> DB
    App -- "brief only" --> LLM
```

## 02. Data model (core entities)

Source: [`02-data-model.mmd`](diagrams/02-data-model.mmd)

```mermaid
%% LLD: data model, based on the real shape of candidates.json.
%% public schema (recruiter's own token, RLS): recruiters, shortlists, shortlist_members, saved_briefs.
%% private schema (server only, secret key): companies, candidates, experiences, educations,
%% searches, search_results, subscriptions, stripe_events. See LLD section 2.
erDiagram
    companies ||--o{ recruiters : employs
    companies ||--o{ shortlists : owns
    companies ||--o{ saved_briefs : owns
    companies ||--o{ searches : runs
    companies ||--o{ subscriptions : "billed by"
    shortlists ||--o{ shortlist_members : contains
    candidates ||--o{ shortlist_members : "listed in"
    searches ||--o{ search_results : "ranked rows"
    candidates ||--o{ search_results : "appears in"
    candidates ||--o{ experiences : has
    candidates ||--o{ educations : has

    companies {
        uuid id PK
        text code UK "acme or globex"
        text name
        int searches_used "free plan counter"
    }
    recruiters {
        uuid user_id PK "auth.users.id"
        uuid company_id FK
    }
    candidates {
        text id PK "cand_0001"
        text full_name
        text headline
        text avatar_url
        text current_title
        text current_company
        text current_company_logo_url
        text role "13 values"
        text seniority "junior, mid, senior, staff"
        int years_experience "0 to 15"
        text city "10 values"
        text state
        text country
        bool open_to_work
        text_arr skills "79 values, GIN index"
        text_arr past_company_types "derived: startup, enterprise"
        text_arr past_companies "derived: 28 values"
        text_arr schools "derived"
        text_arr degrees "derived: BS, BA, MS, MBA, PhD"
        text_arr fields_of_study "derived"
    }
    experiences {
        bigint id PK
        text candidate_id FK
        int position "0 = current"
        text title
        text company
        text company_logo_url
        text company_type
        int start_year
        int end_year "null = current"
        text description
    }
    educations {
        bigint id PK
        text candidate_id FK
        text school
        text degree
        text field
        int graduation_year
    }
    shortlists {
        uuid id PK
        uuid company_id FK "set by the server, checked by RLS"
        text name
        timestamptz created_at
    }
    shortlist_members {
        uuid shortlist_id PK
        text candidate_id PK
        timestamptz added_at
    }
    saved_briefs {
        uuid id PK
        uuid company_id FK
        text brief
        jsonb filters
        timestamptz created_at
    }
    searches {
        uuid id PK
        uuid company_id FK
        text brief
        jsonb filters "validated filters actually used"
        text_arr unsupported "parts we could not filter on"
        int total
        timestamptz created_at
    }
    search_results {
        uuid search_id PK
        int rank PK "1 to total, fixed at search time"
        text candidate_id FK
    }
    subscriptions {
        text id PK "Stripe subscription id"
        uuid company_id FK
        text status
        bigint last_event_created
        text last_event_id
    }
    stripe_events {
        text id PK "Stripe event id, dedupe key"
        text type
        bigint created
        text outcome "applied, stale, ignored"
        timestamptz received_at
    }
```

## 03. Search flow (deep dive 6.1)

Source: [`03-search-flow.mmd`](diagrams/03-search-flow.mmd)

```mermaid
%% LLD: data flow for a new search (POST /api/search).
sequenceDiagram
    autonumber
    actor R as Recruiter
    participant UI as Search page
    participant API as POST /api/search
    participant Q as private.spend_search_credit()
    participant L as Anthropic (Haiku 5.5)
    participant V as Filter validator (zod + vocabulary)
    participant S as private.run_search()

    R->>UI: types brief, presses Enter
    UI->>API: { brief } + Bearer token
    API->>API: verify token, find company, brief length 1 to 500
    API->>Q: spend one search credit for this company (secret-key client)
    Note over Q: one UPDATE ... WHERE paid OR searches_used < 1 RETURNING<br/>row lock: concurrent requests queue, only one wins
    alt no searches left
        Q-->>API: no row
        API-->>UI: 402 { searches_remaining: 0 }
        UI-->>R: "You've used your free search" + Upgrade
    else credit spent
        Q-->>API: searches_remaining
        API->>L: system rules + brief inside tags, forced tool call,<br/>tool schema whose values are enums from our data
        L-->>API: { filters, unsupported[] }
        API->>V: parse, values not in the vocabulary move to unsupported
        alt LLM error or timeout (2.5s)
            API->>Q: give the search credit back
            API-->>UI: 503 "Search is unavailable, try again"
        else valid
            V-->>API: clean filters
            Note over API: if no filters, or a hard requirement is in unsupported[],<br/>the search returns 0 people (never "everyone")
            API->>S: company_id, brief, filters as parameters (static SQL)
            Note over S: WHERE role = ANY(...) AND skills @> ... AND ...<br/>ORDER BY score DESC, id<br/>INSERT ranked ids into search_results
            S-->>API: search_id, total, first 20
            API-->>UI: { search_id, filters, unsupported, total, results, searches_remaining }
            UI-->>R: filter tags + ranked results
        end
    end
```

## 04. Request map: every API route

Source: [`04-request-map.mmd`](diagrams/04-request-map.mmd)

```mermaid
%% LLD: every API request, how it is authorised, and what it touches.
%% recruiter client = publishable key + caller's token, every query runs under RLS
%% server client = secret key, used for the paths marked (server). See LLD section 4.
flowchart LR
    C(["Client<br/>(browser or grader script)"])

    subgraph Gate["Gate for every recruiter route"]
        G1["Authorization: Bearer token"]
        G2["supabase.auth.getUser(token)<br/>401 if missing or invalid"]
        G3["load recruiter row (server client)<br/>company_id from the database, never from the request"]
        G1 --> G2 --> G3
    end

    subgraph Search["Search"]
        S1["POST /api/search<br/>{ brief, filters? }"]
        S2["GET /api/search/:id?page=N"]
        S3["GET /api/vocabulary<br/>(options for the filter editor)"]
    end
    subgraph People["Candidates"]
        P1["GET /api/people/:id"]
    end
    subgraph Lists["Shortlists"]
        L1["GET / POST /api/shortlists"]
        L2["GET / PATCH / DELETE /api/shortlists/:id"]
        L3["POST / DELETE /api/shortlists/:id/people/:personId"]
    end
    subgraph Saved["Saved searches"]
        B1["GET / POST /api/saved-briefs"]
        B2["DELETE /api/saved-briefs/:id"]
    end
    subgraph Plan["Plan"]
        PL["GET /api/plan"]
    end
    subgraph Billing["Billing (no recruiter token)"]
        W1["POST /api/billing/events"]
        W2["HMAC check on the raw body<br/>400 if bad"]
        W1 --> W2
    end

    C --> G1
    C --> W1
    G3 --> S1 & S2 & S3 & P1 & L1 & L2 & L3 & B1 & B2 & PL

    S1 -- "(server) spend_search_credit, LLM, run_search" --> T1[("private: companies, searches,<br/>search_results, candidates")]
    S2 -- "(server) get_search_page: 20 rows by (search_id, rank)<br/>scoped to my company, never touches the quota" --> T1
    S3 -- "(server) distinct values, cached in memory" --> T2
    P1 -- "(server) read one candidate" --> T2[("private: candidates, experiences, educations")]
    P1 -- "recruiter client: my shortlist_ids" --> T3
    L1 & L2 & L3 -- "recruiter client, RLS: my company only" --> T3[("public: shortlists, shortlist_members")]
    B1 & B2 -- "recruiter client, RLS: my company only" --> T4[("public: saved_briefs")]
    PL -- "(server) get_plan for my company" --> T5[("private: companies, subscriptions")]
    W2 -- "(server) apply_stripe_event" --> T6[("private: stripe_events,<br/>subscriptions")]
```

## 05. Stripe webhook (deep dive 6.5)

Source: [`05-billing-webhook.mmd`](diagrams/05-billing-webhook.mmd)

```mermaid
%% LLD: Stripe webhook handling (LLD section 5). One Postgres transaction per event.
sequenceDiagram
    autonumber
    participant ST as Stripe (simulated)
    participant API as POST /api/billing/events
    participant DB as private.apply_stripe_event()
    participant PL as GET /api/plan

    ST->>API: raw body (bytes untouched) + Stripe-Signature
    API->>API: parse t= and v1= from the header<br/>HMAC-SHA256(secret, t + "." + raw body)<br/>timingSafeEqual against each v1
    alt signature missing or wrong
        API-->>ST: 400 invalid_signature
    else valid
        API->>API: JSON.parse + zod (id, type, created, plus subscription fields for subscription events)
        API->>DB: event id, type, created, sub id, status, metadata.company
        DB->>DB: INSERT INTO stripe_events ON CONFLICT (id) DO NOTHING
        alt event id already seen (repeat)
            DB-->>API: duplicate, nothing changes
        else not a subscription event, or unknown company
            DB-->>API: ignored
        else subscription event
            DB->>DB: upsert subscription only if (created, event id)<br/>is newer than the stored pair
            alt older event arrived late
                DB-->>API: stale, not applied
            else newer (same second: higher event id wins)
                DB-->>API: applied
            end
        end
        API-->>ST: 200 { received, outcome }
    end

    Note over PL,DB: plan = 'paid' when any subscription of the company<br/>has status active or trialing, else 'free'.<br/>Computed on read, so it can never drift from the events.
    PL->>DB: get_plan(company)
```

## 06. Tenant isolation (deep dive 6.4)

Source: [`06-tenancy.mmd`](diagrams/06-tenancy.mmd)

```mermaid
%% LLD: how tenant isolation holds on both paths (our API and direct Supabase). See LLD 2.4.
flowchart TB
    A["Acme recruiter token<br/>(JWT, sub = acme user id)"]

    A --> API["Our API route"]
    A --> PR["Direct PostgREST call<br/>/rest/v1/shortlists?..."]

    API --> RC["Recruiter client<br/>same JWT forwarded"]
    RC --> PG
    PR --> PG

    subgraph PG["Postgres, role = authenticated"]
        F["my company = company_id from public.recruiters<br/>where user_id = auth.uid()"]
        POL["Row level security on shortlists, shortlist_members, saved_briefs<br/>read rule (USING): only rows of my company<br/>write rule (WITH CHECK): new or changed rows must be my company"]
        COL["company_id set by the server from the recruiter lookup,<br/>only UPDATE (name) granted on shortlists"]
        REV["private schema: no USAGE for anon or authenticated<br/>(candidates, companies, searches, billing, all functions)"]
        F --> POL
    end

    PG --> OK["Acme rows only"]
    PG --> NO["Globex rows: 0 rows on read,<br/>writes rejected"]
```

## 07. Setup flow

Source: [`07-setup.mmd`](diagrams/07-setup.mmd)

```mermaid
%% How `make setup` and `make dev` bring the app up on a clean Mac.
flowchart LR
    S0["make setup"] --> S1["check Node 24 + Docker running"]
    S1 --> S2["npm ci<br/>(lockfile, pinned supabase CLI 2.119.0)"]
    S2 --> S3["npx supabase start"]
    S3 --> S4["npx supabase db reset<br/>applies migrations"]
    S4 --> S5["node scripts/seed.ts<br/>companies, 2 recruiters,<br/>5,000 candidates + derived columns"]
    S5 --> S6["write .env.local from supabase status<br/>(local URL + keys only)"]
    D0["make dev"] --> D1["next dev on :3000<br/>reads ANTHROPIC_API_KEY,<br/>STRIPE_WEBHOOK_SECRET from env"]
    S6 -.-> D0
```
