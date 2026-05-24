'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Institution {
  id: string;
  name: string;
  type: string;   // PE | FO | BANK | DEBT | OTHER
  hq: string;
  region: string;
  aum: string;
  strategy: string;
  updated_at: string;
}

interface Contact {
  id: string;
  institution_id: string;
  name: string;
  role: string;
  email: string;
  notes: string;
}

interface Signal {
  type: 'likes' | 'avoids' | 'structure' | 'size' | 'sector' | 'timing' | 'relationship';
  text: string;
}

interface Interaction {
  id: string;
  institution_id: string;
  contact_ids: string[];
  date: string;
  type: string;   // Meeting | Call | Email | Conference | Other
  location: string;
  summary: string;
  raw_notes: string;
  signals: Signal[];
  deals: string[];
  extracting?: boolean;
}

interface SynthProfile {
  institution_id: string;
  investment_thesis: string;
  strong_likes: string;
  avoids: string;
  preferred_structures: string;
  typical_deal: string;
  coverage_note: string;
  updated_at: string;
}

interface FullProfile {
  institution: Institution | null;
  contacts: Contact[];
  interactions: Interaction[];
  profile: SynthProfile | null;
}

type ProfileTab = 'timeline' | 'preferences' | 'contacts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix = 'r') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SIGNAL_COLORS: Record<string, string> = {
  likes:        'bg-accent/15 text-accent',
  avoids:       'bg-danger/15 text-danger',
  structure:    'bg-secondary/15 text-secondary',
  size:         'bg-warning/15 text-warning',
  sector:       'bg-blue-400/15 text-blue-400',
  timing:       'bg-purple-400/15 text-purple-400',
  relationship: 'bg-emerald-400/15 text-emerald-400',
};

const TYPE_OPTIONS = ['PE', 'FO', 'BANK', 'DEBT', 'OTHER'];
const INTERACTION_TYPES = ['Meeting', 'Call', 'Email', 'Conference', 'Other'];

// ─── Main component ───────────────────────────────────────────────────────────

export default function CRMPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected institution + full profile
  const [selected, setSelected] = useState<FullProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('timeline');

  // Modals
  const [showAddInst, setShowAddInst] = useState(false);
  const [editInst, setEditInst] = useState<Institution | null>(null);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);

  // Synthesizing
  const [synthesizing, setSynthesizing] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch all institutions ──────────────────────────────────────────────────
  const fetchInstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm?resource=institutions');
      const data = await res.json();
      setInstitutions(Array.isArray(data) ? data : []);
    } catch { setInstitutions([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInstitutions(); }, [fetchInstitutions]);

  // ── Load full profile for an institution ───────────────────────────────────
  const openProfile = async (inst: Institution) => {
    setLoadingProfile(true);
    setSelected({ institution: inst, contacts: [], interactions: [], profile: null });
    setProfileTab('timeline');
    try {
      const res = await fetch(`/api/crm?resource=profile_full&institutionId=${inst.id}`);
      const data = await res.json();
      setSelected(data);
    } catch { /* keep partial */ }
    setLoadingProfile(false);
  };

  // ── Save institution ────────────────────────────────────────────────────────
  const saveInstitution = async (data: Omit<Institution, 'updated_at'>) => {
    await fetch('/api/crm?resource=institutions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    showToast(editInst ? 'Institution updated' : 'Institution added');
    setShowAddInst(false);
    setEditInst(null);
    fetchInstitutions();
    // Refresh open profile if it's the same institution
    if (selected?.institution?.id === data.id) {
      openProfile({ ...data, updated_at: new Date().toISOString() });
    }
  };

  // ── Save interaction ────────────────────────────────────────────────────────
  const saveInteraction = async (data: Omit<Interaction, 'extracting'>) => {
    await fetch('/api/crm?resource=interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    showToast('Interaction logged');
    setShowAddInteraction(false);
    if (selected?.institution) openProfile(selected.institution);
  };

  // ── Save contact ────────────────────────────────────────────────────────────
  const saveContact = async (data: Contact) => {
    await fetch('/api/crm?resource=contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    showToast('Contact saved');
    setShowAddContact(false);
    if (selected?.institution) openProfile(selected.institution);
  };

  // ── Extract signals for one interaction ────────────────────────────────────
  const extractSignals = async (interaction: Interaction) => {
    if (!interaction.raw_notes?.trim()) {
      showToast('Add raw notes first', false); return;
    }
    // Optimistic: show spinner on card
    setSelected(prev => prev ? {
      ...prev,
      interactions: prev.interactions.map(i =>
        i.id === interaction.id ? { ...i, extracting: true } : i
      ),
    } : prev);

    try {
      const res = await fetch('/api/crm/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract',
          institutionName: selected?.institution?.name,
          notes: interaction.raw_notes,
        }),
      });
      const { signals } = await res.json();
      // Save back to DB
      await fetch('/api/crm?resource=interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...interaction, signals: signals || [], extracting: undefined }),
      });
      showToast(`${(signals || []).length} signals extracted`);
      if (selected?.institution) openProfile(selected.institution);
    } catch { showToast('AI extraction failed', false); }
  };

  // ── Synthesize full profile ─────────────────────────────────────────────────
  const synthesizeProfile = async () => {
    if (!selected?.interactions?.length) {
      showToast('Log some interactions first', false); return;
    }
    setSynthesizing(true);
    try {
      const res = await fetch('/api/crm/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'synthesize',
          institutionName: selected.institution?.name,
          interactions: selected.interactions,
        }),
      });
      const { profile, error } = await res.json();
      if (error) throw new Error(error);
      // Save profile
      await fetch('/api/crm?resource=profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, institution_id: selected.institution?.id }),
      });
      showToast('Profile synthesized');
      if (selected.institution) openProfile(selected.institution);
    } catch (e) {
      showToast((e as Error).message || 'Synthesis failed', false);
    }
    setSynthesizing(false);
  };

  // ── Filtered institutions ───────────────────────────────────────────────────
  const filtered = institutions.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.type.toLowerCase().includes(search.toLowerCase()) ||
    i.region.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 lg:px-8 pt-5 pb-8">

      {/* ── Institution profile view ── */}
      {selected && (
        <ProfileView
          data={selected}
          loading={loadingProfile}
          tab={profileTab}
          onTabChange={setProfileTab}
          onBack={() => setSelected(null)}
          onLogInteraction={() => setShowAddInteraction(true)}
          onAddContact={() => setShowAddContact(true)}
          onEdit={() => { setEditInst(selected.institution); setShowAddInst(true); }}
          onExtractSignals={extractSignals}
          onSynthesize={synthesizeProfile}
          synthesizing={synthesizing}
          expandedInteraction={expandedInteraction}
          onToggleInteraction={id => setExpandedInteraction(prev => prev === id ? null : id)}
        />
      )}

      {/* ── Dashboard ── */}
      {!selected && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Sponsor CRM</h1>
              <p className="text-xs text-text-muted font-mono mt-0.5">
                {institutions.length} institution{institutions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => { setEditInst(null); setShowAddInst(true); }}
              className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center active:opacity-70"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, type, region…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-text-muted text-sm">
              {search ? 'No institutions match your search.' : (
                <div>
                  <p className="mb-1">No institutions yet.</p>
                  <p className="text-xs">Hit <span className="text-accent">+</span> to add your first sponsor.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              {filtered.map(inst => (
                <InstitutionCard key={inst.id} institution={inst} onClick={() => openProfile(inst)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {showAddInst && (
        <InstitutionModal
          institution={editInst}
          onClose={() => { setShowAddInst(false); setEditInst(null); }}
          onSave={saveInstitution}
        />
      )}
      {showAddInteraction && selected?.institution && (
        <InteractionModal
          institutionId={selected.institution.id}
          contacts={selected.contacts}
          onClose={() => setShowAddInteraction(false)}
          onSave={saveInteraction}
        />
      )}
      {showAddContact && selected?.institution && (
        <ContactModal
          institutionId={selected.institution.id}
          onClose={() => setShowAddContact(false)}
          onSave={saveContact}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg toast-enter ${toast.ok ? 'bg-accent text-white' : 'bg-danger text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── InstitutionCard ──────────────────────────────────────────────────────────

function InstitutionCard({ institution: i, onClick }: { institution: Institution; onClick: () => void }) {
  const typeColors: Record<string, string> = {
    PE:   'bg-accent/15 text-accent',
    FO:   'bg-secondary/15 text-secondary',
    BANK: 'bg-warning/15 text-warning',
    DEBT: 'bg-blue-400/15 text-blue-400',
    OTHER:'bg-border text-text-muted',
  };
  const badge = typeColors[i.type] || typeColors.OTHER;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-surface border border-border rounded-xl p-4 active:bg-bg-elevated transition-colors hover:border-accent/40"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center shrink-0 text-base font-bold text-text-secondary">
          {i.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-text-primary truncate">{i.name}</h3>
            {i.type && <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${badge}`}>{i.type}</span>}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text-muted font-mono flex-wrap">
            {i.region && <span>{i.region}</span>}
            {i.hq && <span>{i.hq}</span>}
            {i.aum && <span>AUM {i.aum}</span>}
          </div>
          {i.strategy && (
            <p className="text-[11px] text-text-secondary mt-1 truncate">{i.strategy}</p>
          )}
        </div>

        <svg className="w-4 h-4 text-text-muted shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}

// ─── ProfileView ──────────────────────────────────────────────────────────────

function ProfileView({
  data, loading, tab, onTabChange, onBack,
  onLogInteraction, onAddContact, onEdit,
  onExtractSignals, onSynthesize, synthesizing,
  expandedInteraction, onToggleInteraction,
}: {
  data: FullProfile;
  loading: boolean;
  tab: ProfileTab;
  onTabChange: (t: ProfileTab) => void;
  onBack: () => void;
  onLogInteraction: () => void;
  onAddContact: () => void;
  onEdit: () => void;
  onExtractSignals: (i: Interaction) => void;
  onSynthesize: () => void;
  synthesizing: boolean;
  expandedInteraction: string | null;
  onToggleInteraction: (id: string) => void;
}) {
  const { institution: inst, contacts, interactions, profile } = data;
  if (!inst) return null;

  const typeColors: Record<string, string> = {
    PE: 'text-accent', FO: 'text-secondary', BANK: 'text-warning', DEBT: 'text-blue-400', OTHER: 'text-text-muted',
  };

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-bg-surface border border-border flex items-center justify-center active:opacity-70 shrink-0">
          <svg className="w-4 h-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold truncate">{inst.name}</h2>
            {inst.type && <span className={`text-xs font-mono font-bold ${typeColors[inst.type] || typeColors.OTHER}`}>{inst.type}</span>}
          </div>
          <p className="text-[11px] text-text-muted font-mono">
            {[inst.region, inst.hq, inst.aum && `AUM ${inst.aum}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onEdit} className="w-9 h-9 rounded-xl bg-bg-surface border border-border flex items-center justify-center active:opacity-70 shrink-0">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </button>
      </div>

      {/* Strategy pill */}
      {inst.strategy && (
        <div className="mb-4 bg-bg-surface border border-border rounded-xl px-3.5 py-2.5">
          <p className="text-[10px] font-mono text-text-muted uppercase mb-0.5">Strategy focus</p>
          <p className="text-sm text-text-primary">{inst.strategy}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4">
        {(['timeline', 'preferences', 'contacts'] as ProfileTab[]).map(t => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted border border-border'}`}
          >
            {t === 'timeline' ? `Timeline (${interactions.length})` :
             t === 'contacts' ? `Contacts (${contacts.length})` : 'Preferences'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Timeline ── */}
          {tab === 'timeline' && (
            <div>
              <div className="flex justify-end mb-3">
                <button
                  onClick={onLogInteraction}
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent rounded-xl text-xs font-semibold text-white active:opacity-70"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Log interaction
                </button>
              </div>

              {interactions.length === 0 ? (
                <p className="text-center text-text-muted text-sm py-12">No interactions yet.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3.5 top-4 bottom-4 w-px bg-border" />
                  <div className="space-y-3">
                    {interactions.map(ix => (
                      <InteractionCard
                        key={ix.id}
                        interaction={ix}
                        contacts={contacts}
                        expanded={expandedInteraction === ix.id}
                        onToggle={() => onToggleInteraction(ix.id)}
                        onExtract={() => onExtractSignals(ix)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Preferences ── */}
          {tab === 'preferences' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-text-muted font-mono">
                  {profile?.updated_at ? `Last synthesized ${fmtDate(profile.updated_at)}` : 'Not yet synthesized'}
                </p>
                <button
                  onClick={onSynthesize}
                  disabled={synthesizing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-secondary/20 rounded-xl text-xs font-semibold text-secondary active:opacity-70 disabled:opacity-50"
                >
                  {synthesizing ? (
                    <div className="w-3.5 h-3.5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  )}
                  {synthesizing ? 'Synthesizing…' : profile ? 'Re-synthesize' : 'Synthesize with AI'}
                </button>
              </div>

              {!profile ? (
                <div className="bg-bg-surface border border-dashed border-border rounded-xl p-6 text-center">
                  <p className="text-sm text-text-muted mb-1">No profile yet</p>
                  <p className="text-xs text-text-muted">Log interactions and hit &ldquo;Synthesize with AI&rdquo; to generate an investment profile.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <ProfileSection label="Investment Thesis" value={profile.investment_thesis} accent="accent" />
                  <ProfileSection label="Strong Likes" value={profile.strong_likes} accent="accent" />
                  <ProfileSection label="Avoids" value={profile.avoids} accent="danger" />
                  <ProfileSection label="Preferred Structures" value={profile.preferred_structures} accent="secondary" />
                  <ProfileSection label="Typical Deal" value={profile.typical_deal} accent="warning" />
                  <ProfileSection label="Coverage Note" value={profile.coverage_note} accent="text-muted" />
                </div>
              )}
            </div>
          )}

          {/* ── Contacts ── */}
          {tab === 'contacts' && (
            <div>
              <div className="flex justify-end mb-3">
                <button
                  onClick={onAddContact}
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent rounded-xl text-xs font-semibold text-white active:opacity-70"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add contact
                </button>
              </div>

              {contacts.length === 0 ? (
                <p className="text-center text-text-muted text-sm py-12">No contacts yet.</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map(c => (
                    <div key={c.id} className="bg-bg-surface border border-border rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 text-secondary font-semibold text-sm">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                          {c.role && <p className="text-xs text-text-secondary">{c.role}</p>}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-xs text-accent hover:underline block mt-0.5">{c.email}</a>
                          )}
                          {c.notes && <p className="text-xs text-text-muted mt-1">{c.notes}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── InteractionCard ──────────────────────────────────────────────────────────

function InteractionCard({
  interaction: ix, contacts, expanded, onToggle, onExtract,
}: {
  interaction: Interaction;
  contacts: Contact[];
  expanded: boolean;
  onToggle: () => void;
  onExtract: () => void;
}) {
  const typeColors: Record<string, string> = {
    Meeting:    'bg-accent/15 text-accent',
    Call:       'bg-secondary/15 text-secondary',
    Email:      'bg-blue-400/15 text-blue-400',
    Conference: 'bg-warning/15 text-warning',
    Other:      'bg-border text-text-muted',
  };
  const badge = typeColors[ix.type] || typeColors.Other;
  const involvedContacts = contacts.filter(c => (ix.contact_ids || []).includes(c.id));

  return (
    <div className="pl-8 relative">
      {/* Timeline dot */}
      <div className="absolute left-2 top-4 w-3 h-3 rounded-full bg-bg-primary border-2 border-accent" />

      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <button
          onClick={onToggle}
          className="w-full text-left p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${badge}`}>{ix.type}</span>
                <span className="text-xs text-text-muted font-mono">{fmtDate(ix.date)}</span>
                {ix.location && <span className="text-[10px] text-text-muted">· {ix.location}</span>}
              </div>
              {ix.summary && <p className="text-sm text-text-primary">{ix.summary}</p>}
              {involvedContacts.length > 0 && (
                <p className="text-[11px] text-text-muted mt-1">
                  with {involvedContacts.map(c => c.name).join(', ')}
                </p>
              )}
              {/* Signal chips */}
              {(ix.signals || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ix.signals.map((s, si) => (
                    <span key={si} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SIGNAL_COLORS[s.type] || 'bg-border text-text-muted'}`}>
                      {s.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <svg className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </button>

        {/* Expanded: raw notes + extract button */}
        {expanded && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            {ix.raw_notes ? (
              <p className="text-xs text-text-secondary whitespace-pre-wrap mb-3 leading-relaxed">{ix.raw_notes}</p>
            ) : (
              <p className="text-xs text-text-muted italic mb-3">No raw notes.</p>
            )}
            <button
              onClick={onExtract}
              disabled={!!ix.extracting}
              className="flex items-center gap-1.5 px-3 py-2 bg-secondary/20 rounded-xl text-xs font-semibold text-secondary active:opacity-70 disabled:opacity-50"
            >
              {ix.extracting ? (
                <div className="w-3.5 h-3.5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              )}
              {ix.extracting ? 'Extracting…' : 'Extract signals with AI'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProfileSection ───────────────────────────────────────────────────────────

function ProfileSection({ label, value, accent }: { label: string; value: string; accent: string }) {
  const accentMap: Record<string, string> = {
    accent: 'text-accent', danger: 'text-danger', secondary: 'text-secondary',
    warning: 'text-warning', 'text-muted': 'text-text-muted',
  };
  const color = accentMap[accent] || 'text-text-muted';
  if (!value?.trim()) return null;
  return (
    <div className="bg-bg-surface border border-border rounded-xl p-4">
      <p className={`text-[10px] font-mono uppercase font-bold mb-2 ${color}`}>{label}</p>
      <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

// ─── InstitutionModal ─────────────────────────────────────────────────────────

function InstitutionModal({
  institution, onClose, onSave,
}: {
  institution: Institution | null;
  onClose: () => void;
  onSave: (data: Omit<Institution, 'updated_at'>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    id:       institution?.id       || uid('si'),
    name:     institution?.name     || '',
    type:     institution?.type     || 'PE',
    hq:       institution?.hq       || '',
    region:   institution?.region   || '',
    aum:      institution?.aum      || '',
    strategy: institution?.strategy || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal title={institution ? 'Edit institution' : 'Add institution'} onClose={onClose}>
      <Field label="Name *">
        <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Triton Investment Management" className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select value={form.type} onChange={e => set('type', e.target.value)} className={INPUT}>
            {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="HQ">
          <input value={form.hq} onChange={e => set('hq', e.target.value)} placeholder="e.g. Stockholm" className={INPUT} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Region">
          <input value={form.region} onChange={e => set('region', e.target.value)} placeholder="e.g. DACH, Nordics" className={INPUT} />
        </Field>
        <Field label="AUM">
          <input value={form.aum} onChange={e => set('aum', e.target.value)} placeholder="e.g. €5bn" className={INPUT} />
        </Field>
      </div>
      <Field label="Strategy focus">
        <input value={form.strategy} onChange={e => set('strategy', e.target.value)} placeholder="e.g. Mid-market buyout, €50–200m EV" className={INPUT} />
      </Field>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} disabled={!form.name.trim()} />
    </Modal>
  );
}

// ─── InteractionModal ─────────────────────────────────────────────────────────

function InteractionModal({
  institutionId, contacts, onClose, onSave,
}: {
  institutionId: string;
  contacts: Contact[];
  onClose: () => void;
  onSave: (data: Omit<Interaction, 'extracting'>) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    id:           uid('ix'),
    institution_id: institutionId,
    contact_ids:  [] as string[],
    date:         today,
    type:         'Meeting',
    location:     '',
    summary:      '',
    raw_notes:    '',
    signals:      [] as Signal[],
    deals:        [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const toggleContact = (id: string) => {
    setForm(p => ({
      ...p,
      contact_ids: p.contact_ids.includes(id)
        ? p.contact_ids.filter(c => c !== id)
        : [...p.contact_ids, id],
    }));
  };

  const handleSave = async () => {
    if (!form.date) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal title="Log interaction" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date *">
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={INPUT} />
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={e => set('type', e.target.value)} className={INPUT}>
            {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Location / format">
        <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Frankfurt, Zoom" className={INPUT} />
      </Field>
      {contacts.length > 0 && (
        <Field label="Contacts present">
          <div className="flex flex-wrap gap-2">
            {contacts.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleContact(c.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.contact_ids.includes(c.id) ? 'bg-accent border-accent text-white' : 'border-border text-text-muted'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Summary">
        <input value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="One-line summary" className={INPUT} />
      </Field>
      <Field label="Raw notes">
        <textarea
          value={form.raw_notes}
          onChange={e => set('raw_notes', e.target.value)}
          placeholder="Paste full meeting notes here — AI will extract investment signals later"
          className={`${INPUT} resize-none`}
          rows={5}
        />
      </Field>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} disabled={!form.date} saveLabel="Log" />
    </Modal>
  );
}

// ─── ContactModal ─────────────────────────────────────────────────────────────

function ContactModal({
  institutionId, onClose, onSave,
}: {
  institutionId: string;
  onClose: () => void;
  onSave: (data: Contact) => Promise<void>;
}) {
  const [form, setForm] = useState<Contact>({
    id: uid('c'),
    institution_id: institutionId,
    name: '',
    role: '',
    email: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Contact, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal title="Add contact" onClose={onClose}>
      <Field label="Name *">
        <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Klaus Musterfrau" className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <input value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Partner" className={INPUT} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@firm.com" className={INPUT} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Coverage notes…" className={`${INPUT} resize-none`} rows={2} />
      </Field>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} disabled={!form.name.trim()} saveLabel="Add" />
    </Modal>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const INPUT = 'w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-mono uppercase text-text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-12 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-surface rounded-2xl border border-border sheet-enter max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-bg-surface border-b border-border px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-semibold text-base">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-muted active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onClose, onSave, saving, disabled, saveLabel = 'Save',
}: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  disabled?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex gap-3 pt-1">
      <button onClick={onClose} className="flex-1 py-3.5 text-sm rounded-xl bg-bg-elevated text-text-primary font-medium active:opacity-70">Cancel</button>
      <button onClick={onSave} disabled={saving || disabled} className="flex-1 py-3.5 text-sm rounded-xl bg-accent text-white font-semibold active:opacity-70 disabled:opacity-50">
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
