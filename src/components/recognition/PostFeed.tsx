import type { Schemas } from "@crewstars/api-client";
import { useFormatter, useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";

import { CoinPill, TagChip } from "./Chips";
import { HidePostButton } from "./HidePostButton";

type PostOut = Schemas["PostOut"];

/**
 * Shout-outs as the prototype's feed (OP-05, OP-07): who got it, from whom, where and when,
 * its tag, its message and its coins. With `hide`, each post the API lets the owner hide
 * (`can_hide`) has a Hide button (NF-06).
 *
 * `now` is the request's time, so "2 hours ago" is the same on the server and in the browser.
 */
export function PostFeed({
  posts,
  now,
  hide = false,
  showSender = true,
  label,
  className,
}: {
  posts: readonly PostOut[];
  now: Date;
  hide?: boolean;
  /** Off for the owner's own recognitions, which are all from them. */
  showSender?: boolean;
  /** Names the list. */
  label: string;
  className?: string;
}) {
  const t = useTranslations("recognition.feed");
  const format = useFormatter();
  return (
    <ul aria-label={label} className={cx("flex flex-col", className)}>
      {posts.map((post) => {
        const at = new Date(post.created_at);
        const from = post.sender ? t("from", { name: post.sender.name }) : t("fromProgram");
        return (
          <li key={post.id} className="flex gap-3 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
            <Avatar name={post.recipient.name} colored seed={post.recipient.id} className="size-8.5 text-caption" />
            <div className="min-w-0 flex-1">
              <p className="break-words">
                <span className="font-extrabold">{post.recipient.name}</span>{" "}
                <span className="text-caption text-muted">
                  {showSender ? `${from} · ` : ""}
                  {post.store ? `${t("store", { number: post.store.number })} · ` : ""}
                  <time dateTime={post.created_at} title={format.dateTime(at, { dateStyle: "medium", timeStyle: "short" })}>
                    {format.relativeTime(at, now)}
                  </time>
                </span>
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <TagChip tag={post.tag} />
                {post.is_award && post.award_name ? (
                  <Badge tone="reward">{t("award", { name: post.award_name })}</Badge>
                ) : null}
              </div>
              {post.message ? <p className="mt-1.5 break-words text-sm">{post.message}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <CoinPill coins={post.coins} plus />
              {hide && post.can_hide ? (
                <HidePostButton postId={post.id} recipient={post.recipient.name} coins={post.coins} />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
