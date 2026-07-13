# TUCASA STUM Management System

> Mfumo wa kidijitali wa kusimamia wanachama, uongozi, na taarifa za **TUCASA** (Tanzania Universities and Colleges Adventist Students Association) kwa muundo wa ngazi (hierarchy) kuanzia **Union → Conference → Zone → Branch**.

---

## 1. Mfumo huu ni wa nini? (Kwa ufupi)

TUCASA STUM ni mfumo wa usimamizi (Management System) unaowasaidia viongozi na wanachama wa TUCASA:

- **Kusajili na kutunza kumbukumbu za wanachama** (members) wa kila tawi.
- **Kusimamia uongozi** (leadership) katika kila ngazi ya shirika.
- **Kuona muundo mzima wa shirika** (hierarchy) — Union, Conferences, Zones na Branches.
- **Kutengeneza ripoti na takwimu** (reports & statistics) za wanachama.
- **Kufuatilia mabadiliko** kupitia kumbukumbu za matukio (audit logs).

Kila mtumiaji anaona **kile tu anachoruhusiwa** kulingana na ngazi na nafasi yake ya uongozi (role-based access).

---

## 2. Nani anatumia mfumo? (Watumiaji / Roles)

| Aina ya mtumiaji | Anachoweza kufanya |
| --- | --- |
| **Super Admin** | Anaona na kudhibiti kila kitu katika ngazi zote za shirika. |
| **Union Leader** | Anasimamia Union nzima: conferences, zones, branches, hierarchy na audit logs. |
| **Conference / Zone / Branch Leader** | Anaona na kusimamia wanachama na taarifa za ngazi yake tu na zilizo chini yake. |
| **Mwanachama (Plain Member)** | Anaona taarifa zake binafsi na viongozi wake tu. |

Ruhusa hazihifadhiwi kwenye profile ya mtumiaji — zipo kwenye majedwali tofauti (`user_roles`, `roles`, `role_permissions`, `permissions`) ili kuzuia udukuzi wa vibali (privilege escalation).

---

## 3. Jinsi mfumo unavyofanya kazi (Mtiririko)

### a) Kuingia (Authentication)
1. Mtumiaji anaingia kwa **namba ya simu + password** (`/auth`).
2. Namba ya simu inabadilishwa kuwa email ya ndani (`namba@tucasa.local`) inayotumika na mfumo wa auth.
3. Baada ya kuthibitishwa, **session** inatengenezwa na kuhifadhiwa kwenye kifaa (`localStorage`).
4. `AuthContext` inapakia **profile, roles, na hadhi ya super-admin** ya mtumiaji **mara moja tu** kwa kila session (`loadUserData`), kisha inaruhusu kuingia kwenye dashboard.

### b) Ulinzi wa kurasa (Protected Routes)
`src/App.tsx` ina `ProtectedRoute` inayolinda kila ukurasa kwa hatua:
1. Kama auth bado inapakia → onyesha `StartupScreen`.
2. Kama hakuna session → rudi `/auth`.
3. Kama profile bado inapakia → onyesha `StartupScreen` (haitupi mtu nje).
4. Kama onboarding (course / year of study) haijakamilika → nenda `/welcome`.
5. Vinginevyo → onyesha ukurasa ulioombwa.

### c) Kuonyesha data kulingana na ngazi
Mfumo unatumia **hierarchy scope** (angalia `src/lib/scope.ts`) kubaini ni data ipi mtumiaji anaruhusiwa kuona kulingana na ngazi yake ya juu zaidi (`highestLevel`).

---

## 4. Kurasa kuu (Pages)

| Njia (Route) | Ukurasa | Kazi |
| --- | --- | --- |
| `/auth` | Auth | Kuingia / kujisajili |
| `/welcome` | Welcome | Onboarding — kukamilisha taarifa za msingi |
| `/dashboard` | Dashboard | Muhtasari, moduli, na taarifa binafsi za mwanachama |
| `/members` | Members | Orodha na maelezo ya wanachama kwa ngazi husika |
| `/leadership` | Leadership | Viongozi wa ngazi husika |
| `/reports` | Reports | Ripoti, takwimu na chati (export PDF/Excel) |
| `/hierarchy` | Hierarchy | Muundo wa shirika (Union → Branch) — viongozi wa juu tu |
| `/audit-logs` | AuditLogs | Kumbukumbu za matukio — union leaders tu |

---

## 5. Muundo wa Data (Database)

Mfumo unatumia **Lovable Cloud** (backend: PostgreSQL + Auth + Edge Functions) na **Row Level Security (RLS)** kila jedwali.

Majedwali makuu:

- **Ngazi za shirika:** `unions`, `conferences`, `zones`, `branches`
- **Watu:** `profiles`, `members`
- **Vibali & uongozi:** `roles`, `permissions`, `role_permissions`, `user_roles`, `super_admin_phones`
- **Usalama & ufuatiliaji:** `audit_logs`, `otp_codes`
- **Function:** `is_super_admin(_uid)` — huthibitisha hadhi ya super admin kwa usalama (security definer).

Edge Functions:
- `send-otp` — kutuma msimbo wa uthibitisho.
- `verify-otp` — kuthibitisha msimbo.

---

## 6. Teknolojia (Tech Stack)

- **Frontend:** React 18, TypeScript, Vite
- **UI:** Tailwind CSS, shadcn/ui, glass components za kipekee (`src/components/glass`)
- **State / Data:** React Query (`@tanstack/react-query`), React Context (`AuthContext`)
- **Routing:** React Router
- **Backend:** Lovable Cloud (PostgreSQL, Auth, Edge Functions, Storage)
- **Chati & Ripoti:** Recharts, jsPDF, xlsx
- **Fomu & Uthibitisho:** react-hook-form + zod

---

## 7. Muundo wa Folda

```text
src/
├─ pages/            # Kurasa (Dashboard, Members, Leadership, Reports, ...)
├─ components/
│  ├─ glass/         # Glass UI components (premium look)
│  ├─ AppSidebar.tsx # Menyu ya pembeni
│  └─ ...
├─ contexts/
│  └─ AuthContext.tsx  # Auth, session, roles, permissions
├─ integrations/
│  └─ supabase/      # Client & types (auto-generated — usibadilishe)
├─ lib/              # utils, scope, exports, reports
└─ hooks/            # React hooks
supabase/functions/  # send-otp, verify-otp
```

---

## 8. Kuendesha Mfumo (Development)

```bash
npm install     # sakinisha dependencies
npm run dev     # endesha dev server
npm run build   # jenga toleo la production
npm run test    # endesha tests
```

---

## 9. Usalama (Security)

- Ruhusa hazihifadhiwi kwenye profile — zipo kwenye `user_roles` (kuzuia privilege escalation).
- Kila jedwali lina **RLS policies** na **GRANT** sahihi.
- Hadhi ya super admin inathibitishwa **upande wa server** kupitia function `is_super_admin` — kamwe si kwa localStorage au thamani zilizohifadhiwa kwenye code.
- Session zilizoharibika husafishwa mara moja ili kuzuia mzunguko wa token-refresh unaosababisha kutolewa nje.

---

_TUCASA STUM Management System — imejengwa kwa Lovable._