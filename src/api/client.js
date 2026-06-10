import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// All app data lives in a single "records" table:
//   id uuid, user_id uuid, entity text, created_date, updated_date, data jsonb
// RLS restricts every row to its owner, so list/filter are already user-scoped.

const rowToObj = (row) => ({
  ...row.data,
  id: row.id,
  created_date: row.created_date,
  updated_date: row.updated_date,
});

const TIMESTAMP_FIELDS = ['created_date', 'updated_date'];

function applySort(query, sort) {
  if (!sort) return query.order('created_date', { ascending: false });
  const ascending = !sort.startsWith('-');
  const field = ascending ? sort : sort.slice(1);
  return TIMESTAMP_FIELDS.includes(field)
    ? query.order(field, { ascending })
    : query.order(`data->>${field}`, { ascending });
}

async function currentUserEmail() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Not authenticated');
  return data.session.user.email;
}

function makeEntity(entityName) {
  const baseSelect = () => supabase.from('records').select('*').eq('entity', entityName);

  return {
    async list(sort, limit) {
      let query = applySort(baseSelect(), sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(rowToObj);
    },

    async filter(filters = {}, sort, limit) {
      let query = baseSelect();
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) continue;
        query = TIMESTAMP_FIELDS.includes(key) || key === 'id'
          ? query.eq(key, value)
          : query.eq(`data->>${key}`, String(value));
      }
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(rowToObj);
    },

    async create(payload) {
      const email = await currentUserEmail();
      const { data, error } = await supabase
        .from('records')
        .insert({ entity: entityName, data: { created_by: email, ...payload } })
        .select()
        .single();
      if (error) throw error;
      return rowToObj(data);
    },

    async bulkCreate(payloads) {
      const email = await currentUserEmail();
      const rows = payloads.map((payload) => ({
        entity: entityName,
        data: { created_by: email, ...payload },
      }));
      const { data, error } = await supabase.from('records').insert(rows).select();
      if (error) throw error;
      return data.map(rowToObj);
    },

    async update(id, payload) {
      const { data: existing, error: fetchError } = await supabase
        .from('records')
        .select('data')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;
      const { data, error } = await supabase
        .from('records')
        .update({ data: { ...existing.data, ...payload }, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return rowToObj(data);
    },

    async delete(id) {
      const { error } = await supabase.from('records').delete().eq('id', id);
      if (error) throw error;
      return { id };
    },
  };
}

const sessionUserToMe = (user) => ({
  id: user.id,
  email: user.email,
  full_name:
    user.user_metadata?.full_name || user.user_metadata?.name || user.email,
  avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
});

const auth = {
  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  },

  async me() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const error = new Error('Not authenticated');
      error.status = 401;
      throw error;
    }
    return sessionUserToMe(data.session.user);
  },

  async redirectToLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  },

  async logout() {
    await supabase.auth.signOut();
    window.location.assign('/');
  },
};

export const client = {
  entities: {
    AssetClass: makeEntity('AssetClass'),
    Instrument: makeEntity('Instrument'),
    Holding: makeEntity('Holding'),
    ManualAsset: makeEntity('ManualAsset'),
    ManualAssetValue: makeEntity('ManualAssetValue'),
  },
  auth,
  // Base44 logged page navigations server-side; we don't need that.
  appLogs: { logUserInApp: async () => {} },
};
