"use client";

import React from "react";

export type TimingStatus = "BEFORE_TIME" | "ON_TIME" | "DELAY" | "VERY_MUCH_DELAY";

export interface TimingInfo {
  status: TimingStatus;
  label: string;
  badgeClass: string;
  animationStyle?: React.CSSProperties;
  diffDays: number;
  isUploaded: boolean;
}

export function getPostTimingInfo(post: {
  scheduledAt?: string | null;
  createdAt?: string | null;
  status?: string | null;
  assets?: Array<{ isReference?: boolean; createdAt?: string | Date }>;
}): TimingInfo | null {
  if (!post?.scheduledAt) return null;

  const postingDate = new Date(post.scheduledAt);
  if (isNaN(postingDate.getTime())) return null;

  // Find non-reference (designer) assets — only uploaded design assets count
  const designAssets = post.assets?.filter((a) => !a.isReference) || [];
  const hasDesign = designAssets.length > 0;

  let comparisonDate: Date;
  let isUploaded = false;

  if (hasDesign) {
    const assetDates = designAssets
      .map((a) => (a.createdAt ? new Date(a.createdAt).getTime() : NaN))
      .filter((t) => !isNaN(t));

    if (assetDates.length > 0) {
      comparisonDate = new Date(Math.min(...assetDates));
      isUploaded = true;
    } else {
      comparisonDate = new Date();
      isUploaded = true;
    }
  } else {
    // Design NOT uploaded yet — compare posting date with TODAY dynamically
    comparisonDate = new Date();
    isUploaded = false;
  }

  // Strip time component for clean day comparison
  const postDay = new Date(postingDate.getFullYear(), postingDate.getMonth(), postingDate.getDate());
  const compareDay = new Date(comparisonDate.getFullYear(), comparisonDate.getMonth(), comparisonDate.getDate());

  // diffDays > 0: comparison date is BEFORE posting date
  // diffDays < 0: comparison date is AFTER posting date (late!)
  const diffTime = postDay.getTime() - compareDay.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let timingInfo: TimingInfo | null = null;

  if (isUploaded) {
    // If design IS uploaded, show completed timing status
    if (diffDays >= 15) {
      timingInfo = {
        status: "BEFORE_TIME",
        label: "[Before Time]",
        badgeClass:
          "text-purple-700 dark:text-purple-300 font-semibold",
        diffDays,
        isUploaded: true,
      };
    } else if (diffDays >= 7) {
      timingInfo = {
        status: "ON_TIME",
        label: "[On Time]",
        badgeClass:
          "text-emerald-700 dark:text-emerald-400 font-semibold",
        diffDays,
        isUploaded: true,
      };
    } else if (diffDays >= 2) {
      timingInfo = {
        status: "DELAY",
        label: "[Delay]",
        badgeClass:
          "text-red-600 dark:text-red-400 font-semibold",
        animationStyle: {
          animation: "timingSlowBlink 2.2s ease-in-out infinite",
        },
        diffDays,
        isUploaded: true,
      };
    } else {
      timingInfo = {
        status: "VERY_MUCH_DELAY",
        label: "[Very Much Delay]",
        badgeClass:
          "text-red-600 dark:text-red-500 font-bold",
        animationStyle: {
          animation: "timingFastBlink 1.1s ease-in-out infinite",
        },
        diffDays,
        isUploaded: true,
      };
    }
  } else {
    // If design is NOT uploaded yet:
    //  - 7+ days left: return null (no alert yet)
    //  - 2 to 6 days left: return [Delay] (warning slow blink)
    //  - <= 1 days left or past posting date: return [Very Much Delay] (critical fast blink)
    if (diffDays >= 7) {
      timingInfo = null;
    } else if (diffDays >= 2) {
      timingInfo = {
        status: "DELAY",
        label: "[Delay]",
        badgeClass:
          "text-red-600 dark:text-red-400 font-semibold",
        animationStyle: {
          animation: "timingSlowBlink 2.2s ease-in-out infinite",
        },
        diffDays,
        isUploaded: false,
      };
    } else {
      timingInfo = {
        status: "VERY_MUCH_DELAY",
        label: "[Very Much Delay]",
        badgeClass:
          "text-red-600 dark:text-red-500 font-bold",
        animationStyle: {
          animation: "timingFastBlink 1.1s ease-in-out infinite",
        },
        diffDays,
        isUploaded: false,
      };
    }
  }

  // Override style if post status is POSTED
  if (timingInfo && post.status === "POSTED") {
    timingInfo.badgeClass = "text-black dark:text-white font-bold";
    timingInfo.animationStyle = undefined;
  }

  return timingInfo;
}

export function getProjectTimingInfo(
  posts: Array<{
    scheduledAt?: string | null;
    createdAt?: string | null;
    status?: string | null;
    assets?: Array<{ isReference?: boolean; createdAt?: string | Date }>;
  }>
): TimingInfo | null {
  if (!posts || posts.length === 0) return null;

  const allPosted = posts.length > 0 && posts.every((post) => post.status === "POSTED");

  if (allPosted) {
    return {
      status: "ON_TIME",
      label: "[Completed]",
      badgeClass: "text-black dark:text-white font-bold",
      diffDays: 0,
      isUploaded: true,
    };
  }

  const validTimings = posts
    .filter((post) => post.status !== "POSTED")
    .map((post) => getPostTimingInfo(post))
    .filter((t): t is TimingInfo => t !== null);

  if (validTimings.length === 0) return null;

  const avgDiffDays = Math.round(
    validTimings.reduce((sum, t) => sum + t.diffDays, 0) / validTimings.length
  );

  if (avgDiffDays >= 15) {
    return {
      status: "BEFORE_TIME",
      label: "[Before Time]",
      badgeClass:
        "text-purple-700 dark:text-purple-300 font-semibold",
      diffDays: avgDiffDays,
      isUploaded: true,
    };
  } else if (avgDiffDays >= 7) {
    return {
      status: "ON_TIME",
      label: "[On Time]",
      badgeClass:
        "text-emerald-700 dark:text-emerald-400 font-semibold",
      diffDays: avgDiffDays,
      isUploaded: true,
    };
  } else if (avgDiffDays >= 2) {
      return {
        status: "DELAY",
        label: "[Delay]",
        badgeClass:
          "text-red-600 dark:text-red-400 font-semibold",
        animationStyle: {
          animation: "timingSlowBlink 2.2s ease-in-out infinite",
        },
        diffDays: avgDiffDays,
        isUploaded: true,
      };
  } else {
    return {
      status: "VERY_MUCH_DELAY",
      label: "[Very Much Delay]",
      badgeClass:
        "text-red-600 dark:text-red-500 font-bold",
      animationStyle: {
        animation: "timingFastBlink 1.1s ease-in-out infinite",
      },
      diffDays: avgDiffDays,
      isUploaded: true,
    };
  }
}

export function ProjectTimingBadge({
  posts,
  className = "",
}: {
  posts: Array<{
    scheduledAt?: string | null;
    createdAt?: string | null;
    status?: string | null;
    assets?: Array<{ isReference?: boolean; createdAt?: string | Date }>;
  }>;
  className?: string;
}) {
  const timing = getProjectTimingInfo(posts);
  if (!timing) return null;

  return (
    <>
      <style>{`
        @keyframes timingSlowBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes timingFastBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
      <span
        style={timing.animationStyle}
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-tight select-none whitespace-nowrap leading-tight transition-all duration-200 shadow-xs ${timing.badgeClass} ${className}`}
        title={`Project Average: ~${timing.diffDays} day(s) before posting`}
      >
        {timing.label}
      </span>
    </>
  );
}

export function PostTimingBadge({
  post,
  className = "",
}: {
  post: {
    scheduledAt?: string | null;
    createdAt?: string | null;
    status?: string | null;
    assets?: Array<{ isReference?: boolean; createdAt?: string | Date }>;
  };
  className?: string;
}) {
  const timing = getPostTimingInfo(post);
  if (!timing) return null;

  return (
    <>
      <style>{`
        @keyframes timingSlowBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes timingFastBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
      <span
        style={timing.animationStyle}
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-tight select-none whitespace-nowrap leading-tight transition-all duration-200 shadow-xs ${timing.badgeClass} ${className}`}
        title={
          timing.isUploaded
            ? `Design uploaded ${timing.diffDays >= 0 ? timing.diffDays + " day(s) before posting date" : Math.abs(timing.diffDays) + " day(s) after posting date (late)"}`
            : timing.diffDays >= 0
              ? `Design not uploaded — ${timing.diffDays} day(s) remaining until posting`
              : `Design not uploaded — posting date passed ${Math.abs(timing.diffDays)} day(s) ago!`
        }
      >
        {timing.label}
      </span>
    </>
  );
}

export default PostTimingBadge;
