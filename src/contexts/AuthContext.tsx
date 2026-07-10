import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface UserRole {
  id: string;
  role_id: string;
  hierarchy_level: 'union' | 'conference' | 'zone' | 'branch';
  level_id: string;
  role_name: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRoles: UserRole[];
  loading: boolean;
  profileLoaded: boolean;
  isUnionLeader: boolean;
  isSuperAdmin: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string, fullName: string, branchId: string, institution?: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  highestLevel: 'union' | 'conference' | 'zone' | 'branch' | null;
  refreshRoles: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Tracks which user id we have already loaded profile/roles for, so token
  // refreshes (which fire onAuthStateChange repeatedly) never re-trigger a fetch.
  const loadedForRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const started = performance.now();
    console.log('[Auth] profile query start for', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Auth] profile query FAILED:', error.message, error);
      return null;
    }

    console.log(
      `[Auth] profile query done in ${Math.round(performance.now() - started)}ms — ${data ? 'row returned' : 'NO ROW (null)'}`,
    );
    return data;
  };

  const fetchUserRoles = async (userId: string): Promise<UserRole[]> => {
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('id, role_id, hierarchy_level, level_id')
      .eq('user_id', userId);

    if (rolesError) {
      console.error('[Auth] roles fetch failed:', rolesError);
      return [];
    }

    if (!roles || roles.length === 0) return [];

    const roleIds = [...new Set(roles.map(r => r.role_id))];
    const { data: roleData } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', roleIds);

    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('role_id, permission_id')
      .in('role_id', roleIds);

    const permIds = [...new Set((rolePerms || []).map(rp => rp.permission_id))];
    const { data: permsData } = permIds.length > 0
      ? await supabase.from('permissions').select('id, name').in('id', permIds)
      : { data: [] };

    const permMap = new Map((permsData || []).map(p => [p.id, p.name]));
    const rolePermMap = new Map<string, string[]>();
    (rolePerms || []).forEach(rp => {
      const perms = rolePermMap.get(rp.role_id) || [];
      const permName = permMap.get(rp.permission_id);
      if (permName) perms.push(permName);
      rolePermMap.set(rp.role_id, perms);
    });

    const roleNameMap = new Map((roleData || []).map(r => [r.id, r.name]));

    return roles.map(r => ({
      id: r.id,
      role_id: r.role_id,
      hierarchy_level: r.hierarchy_level,
      level_id: r.level_id,
      role_name: roleNameMap.get(r.role_id) || 'Unknown',
      permissions: rolePermMap.get(r.role_id) || [],
    }));
  };

  const refreshRoles = async () => {
    if (user) setUserRoles(await fetchUserRoles(user.id));
  };

  const refreshProfile = async () => {
    if (user) setProfile(await fetchProfile(user.id));
  };

  // Load profile, roles and super-admin flag for a signed-in user. This is the
  // ONLY place that reads user-scoped data, and it runs at most once per user id.
  const loadUserData = useCallback(async (u: User) => {
    const started = performance.now();
    console.log('[Auth] loading user data for', u.id);
    setProfileLoaded(false);

    const results = await Promise.allSettled([
      fetchProfile(u.id),
      fetchUserRoles(u.id),
      supabase.rpc('is_super_admin', { _uid: u.id }),
    ]);

    const [profileRes, rolesRes, superRes] = results;
    setProfile(profileRes.status === 'fulfilled' ? profileRes.value : null);
    setUserRoles(rolesRes.status === 'fulfilled' ? rolesRes.value : []);
    setIsSuperAdmin(
      superRes.status === 'fulfilled' ? Boolean((superRes.value as any)?.data) : false,
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error('[Auth] user-data step', i, 'rejected:', r.reason);
    });

    // Never leave the app stuck loading, even if a query failed — profileLoaded
    // only means "we finished trying", not "a profile exists".
    setProfileLoaded(true);
    console.log(
      `[Auth] user data ready in ${Math.round(performance.now() - started)}ms`,
      { hasProfile: profileRes.status === 'fulfilled' && !!profileRes.value },
    );
  }, []);

  useEffect(() => {
    let active = true;

    // Register the listener FIRST. In supabase-js v2 this also fires an
    // INITIAL_SESSION event with the persisted session on cold load, so it is
    // the single canonical entry point for every auth transition.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      console.log('[Auth] event:', event, '| user:', nextSession?.user?.id ?? 'none');

      // Synchronous state only inside the callback — never await here (it can
      // deadlock the auth client). Session/user always reflect the latest event.
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      const nextUserId = nextSession?.user?.id ?? null;

      if (!nextUserId) {
        // Signed out (or no session): clear scoped data. Do NOT treat a transient
        // event as a profile failure — mark loaded so guards can redirect cleanly.
        loadedForRef.current = null;
        setProfile(null);
        setUserRoles([]);
        setIsSuperAdmin(false);
        setProfileLoaded(true);
        return;
      }

      // Only (re)fetch scoped data when the actual user changes. TOKEN_REFRESHED,
      // USER_UPDATED for the same user, etc. must not spawn duplicate requests.
      if (loadedForRef.current !== nextUserId) {
        loadedForRef.current = nextUserId;
        setProfileLoaded(false);
        // Defer out of the auth callback to avoid re-entrancy with the client.
        setTimeout(() => {
          if (active) loadUserData(nextSession!.user);
        }, 0);
      }
    });

    // Fallback: guarantees `loading` resolves even if no INITIAL_SESSION arrives.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      if (error) {
        console.error('[Auth] getSession error:', error.message);
        setLoading(false);
        setProfileLoaded(true);
        return;
      }
      if (!session) {
        console.log('[Auth] no persisted session on load');
        setLoading(false);
        setProfileLoaded(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const isUnionLeader = userRoles.some(r => r.hierarchy_level === 'union') || isSuperAdmin;

  const hasPermission = (permission: string) => {
    if (isSuperAdmin) return true;
    return userRoles.some(r => r.permissions.includes(permission));
  };

  const levelOrder = { union: 0, conference: 1, zone: 2, branch: 3 };
  const highestLevel = userRoles.length > 0
    ? userRoles.reduce((best, r) =>
        levelOrder[r.hierarchy_level] < levelOrder[best] ? r.hierarchy_level : best,
      userRoles[0].hierarchy_level)
    : null;

  const phoneToEmail = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    return `${clean}@tucasa.local`;
  };

  const signIn = async (phone: string, password: string) => {
    console.log('[Auth] sign-in started for', phone);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    if (error) {
      console.error('[Auth] sign-in failed:', error.message);
      throw error;
    }
    // The onAuthStateChange SIGNED_IN event drives session + profile loading.
    // Route guards keep showing the splash until profileLoaded flips true.
    console.log('[Auth] sign-in successful, session created for', data.user?.id);
  };

  const signUp = async (phone: string, password: string, fullName: string, branchId: string, institution?: string) => {
    setLoading(true);
    try {
      const clean = phone.replace(/\D/g, '');
      const { error } = await supabase.auth.signUp({
        email: phoneToEmail(phone),
        password,
        options: {
          data: { full_name: fullName, phone: clean, branch_id: branchId, institution: institution || null },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, userRoles, loading, profileLoaded,
      isUnionLeader, isSuperAdmin, signIn, signUp, signOut, hasPermission, highestLevel, refreshRoles, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
