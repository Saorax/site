import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, Img, PageHeader, PageShell, Pill, SkeletonGrid, Tabs, apiUrl, cx, fetchWithRetry, useApi, useQueryState } from '../ui';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'patch-notes', label: 'Patch notes' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'esports', label: 'Esports' },
  { value: 'legends', label: 'Legends' },
  { value: 'community', label: 'Community' },
  { value: 'weekly-rotation', label: 'Weekly rotation' },
];

const TONES = { 'patch-notes': 'blue', announcements: 'emerald', esports: 'amber', legends: 'rose', community: 'sky', 'weekly-rotation': 'violet' };
const GRID = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[137.5rem]:grid-cols-5 min-[175rem]:grid-cols-6';

const newsUrl = (category, after) => {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (after) params.set('after', after);
  const query = params.toString();
  return apiUrl(`/game/news${query ? `?${query}` : ''}`);
};

const postDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const postTime = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : '');

function ago(iso, now) {
  const time = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

function PostCard({ post }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60">
      <a href={post.url} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-slate-900" tabIndex={-1} aria-hidden="true">
        {post.image && <Img src={post.image.src} alt="" className="h-full w-full object-cover" />}
      </a>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <div className="flex flex-wrap gap-1">
          {post.categories.map((category) => <Pill key={category.slug} tone={TONES[category.slug] || 'slate'}>{category.name}</Pill>)}
        </div>
        <time dateTime={post.date || undefined} title={postTime(post.date)} className="text-xs text-slate-400">{postDate(post.date)}</time>
        <h2 className="font-bold leading-snug text-white">
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{post.title}</a>
        </h2>
        {post.excerpt && <p className="line-clamp-3 text-sm text-slate-400">{post.excerpt}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm font-bold">
          {post.patchId && <a href={`/game/patch?patch=${encodeURIComponent(post.patchId)}`} className="text-blue-300 hover:underline">Patch {post.patch} changes</a>}
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white hover:underline">brawlhalla.com ↗</a>
        </div>
      </div>
    </article>
  );
}

export default function News() {
  const [category, setCategory] = useQueryState('category', '');
  const wanted = CATEGORIES.some((item) => item.value === category) ? category : '';
  const first = useApi(newsUrl(wanted));
  const [more, setMore] = useState({ category: wanted, pages: [], loading: false, error: null });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setMore({ category: wanted, pages: [], loading: false, error: null });
  }, [wanted]);

  const current = first.data?.category === (wanted || null) ? first.data : null;
  const extra = more.category === wanted ? more.pages : [];
  const posts = [...(current?.posts || []), ...extra.flatMap((page) => page.posts || [])];
  const next = extra.length ? extra[extra.length - 1].next : current?.next;

  const loadMore = async () => {
    if (!next || more.loading) return;
    const forCategory = wanted;
    setMore((state) => ({ ...state, loading: true, error: null }));
    try {
      const response = await fetchWithRetry(newsUrl(forCategory, next), { attempts: 1 });
      const page = await response.json();
      setMore((state) => (state.category === forCategory ? { ...state, pages: [...state.pages, page], loading: false } : state));
    } catch (error) {
      setMore((state) => (state.category === forCategory ? { ...state, loading: false, error } : state));
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="News"
        meta={current?.fetchedAt ? <>From <a href="https://www.brawlhalla.com/news" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:underline">brawlhalla.com</a>, checked {ago(current.fetchedAt, now)}</> : null}
        actions={<a href="/game/patch" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700">Patch History</a>}
      >
        <Tabs items={CATEGORIES} value={wanted} onChange={setCategory} variant="chips" label="News category" />
      </PageHeader>

      {first.error && !current && <ErrorState message="Couldn't load the news." detail={first.error?.message} onRetry={first.retry} />}
      {!current && !first.error && <SkeletonGrid count={8} className={GRID} tileClassName="h-80" />}
      {current && !posts.length && <EmptyState title="No posts here" />}

      {posts.length > 0 && (
        <div className={cx(GRID, first.loading && 'opacity-60')}>
          {posts.map((post) => <PostCard key={post.slug} post={post} />)}
        </div>
      )}

      {current && (next || more.error) && (
        <div className="flex flex-wrap items-center gap-3">
          {next && (
            <button type="button" onClick={loadMore} disabled={more.loading} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-60">
              {more.loading ? 'Loading…' : 'Older posts'}
            </button>
          )}
          {more.error && <span className="text-sm text-rose-300">Couldn't load older posts.</span>}
          <span className="text-sm text-slate-500">{posts.length} shown</span>
        </div>
      )}
    </PageShell>
  );
}
