import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { X, ArrowBigUp, CornerDownRight } from 'lucide-react'
import { timeAgo } from '../lib/sites'
import type { ForumPost } from '../lib/forum'

type Sort = 'top' | 'new'

interface ReportForumProps {
  title: string
  thumbnail?: string
  posts: ForumPost[]
  onPost: (body: string, parentId: string | null) => void
  onVote: (postId: string) => void
  votedIds: Set<string>
  onClose: () => void
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

/**
 * Discussion attached to one report. A forum rather than a chat: posts are
 * durable, ranked by score, and answered in place, because the useful thing
 * here is the best information rising, not the latest.
 *
 * Posts live in Home's state only; the backend has no endpoint for them.
 */
export function ReportForum({
  title,
  thumbnail,
  posts,
  onPost,
  onVote,
  votedIds,
  onClose,
}: ReportForumProps) {
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ForumPost | null>(null)
  const [sort, setSort] = useState<Sort>('top')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const threads = useMemo(() => {
    const roots = posts.filter((p) => p.parentId === null)
    const sorted =
      sort === 'top'
        ? [...roots].sort((a, b) => b.score - a.score)
        : [...roots].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return sorted.map((root) => ({
      root,
      replies: posts
        .filter((p) => p.parentId === root.id)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    }))
  }, [posts, sort])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    onPost(body, replyTo?.id ?? null)
    setDraft('')
    setReplyTo(null)
  }

  const startReply = (post: ForumPost) => {
    setReplyTo(post)
    inputRef.current?.focus()
  }

  return (
    <div className="absolute inset-0 z-[900] flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="animate-fade absolute inset-0 bg-black/40" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Discussion about ${title}`}
        className="animate-sheet relative flex max-h-[88%] min-h-0 flex-col rounded-t-2xl bg-surface"
      >
        <header className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-start gap-3">
            {thumbnail && (
              <img src={thumbnail} alt="" className="size-11 shrink-0 rounded-lg bg-surface-2 object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold leading-tight tracking-[-0.01em]">
                {title}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="press -mr-1 -mt-1 p-1">
              <X size={22} strokeWidth={2.2} />
            </button>
          </div>

          <div className="mt-3 flex gap-1.5">
            {(['top', 'new'] as Sort[]).map((option) => (
              <button
                key={option}
                onClick={() => setSort(option)}
                aria-pressed={sort === option}
                className={`press rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize ${
                  sort === option ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </header>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {threads.length === 0 && (
            <p className="py-10 text-center text-[14px] text-ink-2">
              No posts yet
            </p>
          )}

          <ul className="divide-y divide-line">
            {threads.map(({ root, replies }) => (
              <li key={root.id} className="py-3.5">
                <Post post={root} voted={votedIds.has(root.id)} onVote={onVote} onReply={startReply} />
                {replies.length > 0 && (
                  <ul className="mt-3 space-y-3 border-l-2 border-line pl-3">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <Post post={reply} voted={votedIds.has(reply.id)} onVote={onVote} onReply={startReply} compact />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={submit}
          className="shrink-0 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
              <CornerDownRight size={14} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-ink-2">
                Replying to {replyTo.author}
              </span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                <X size={15} className="text-ink-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyTo ? 'Write a reply' : 'Post an update'}
              className="min-w-0 flex-1 rounded-full bg-surface-2 px-4 py-3 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ink"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="press h-11 shrink-0 rounded-full bg-ink px-4 text-[15px] font-semibold text-white disabled:bg-surface-2 disabled:text-ink-3"
            >
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Post({
  post,
  voted,
  onVote,
  onReply,
  compact = false,
}: {
  post: ForumPost
  voted: boolean
  onVote: (id: string) => void
  onReply: (post: ForumPost) => void
  compact?: boolean
}) {
  return (
    <article className="flex gap-3">
      <span
        className={`flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          compact ? 'size-7' : 'size-9'
        } ${post.mine ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'}`}
      >
        {initials(post.author)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px]">
          <span className="font-bold">{post.author}</span>
          <span className="text-ink-3"> · {timeAgo(post.createdAt)}</span>
        </p>
        <p className="mt-1 text-[15px] leading-snug">{post.body}</p>

        <div className="mt-1.5 flex items-center gap-4">
          <button
            onClick={() => onVote(post.id)}
            aria-pressed={voted}
            className={`press flex items-center gap-1 text-[13px] font-semibold ${
              voted ? 'text-ink' : 'text-ink-3'
            }`}
          >
            <ArrowBigUp size={17} strokeWidth={2.1} fill={voted ? 'currentColor' : 'none'} />
            {post.score + (voted ? 1 : 0)}
          </button>
          <button
            onClick={() => onReply(post)}
            className="press text-[13px] font-semibold text-ink-3"
          >
            Reply
          </button>
        </div>
      </div>
    </article>
  )
}
