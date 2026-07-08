import React from 'react'

// Small inline "(?)" affordance. Uses the native title attribute for the
// tooltip text, so no extra UI library or hover-state code is needed.
export default function InfoTip({ text }) {
  return (
    <span
      title={text}
      tabIndex={0}
      aria-label={text}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] leading-none cursor-help select-none bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-gray-300"
    >
      ?
    </span>
  )
}
