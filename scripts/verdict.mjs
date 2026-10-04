/** Pure verdict: unknown measurements are never zero demand. No IO. */
const DAY_MS = 86400000;
function age(date, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return null;
  const value = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0,10) !== date) return null;
  const days = Math.floor((now-value)/DAY_MS);
  return days >= 0 ? days : null;
}
export function judge(meta, rules, waitlistCount, events, returningUsers, postHogAvailable, now=Date.now()) {
  const ageDays = age(meta.created, now);
  const dates = (meta.distribution ?? []).map(x=>x.date).sort();
  const distributed = dates.length>0 && age(dates[0],now)!==null;
  const observedDays = distributed ? age(dates[0],now) : null;
  const validCount = x => Number.isFinite(x) && x>=0;
  const toolKnown = postHogAvailable && validCount(events?.tool_use);
  const signupKnown = validCount(waitlistCount);
  const measured = meta.probe_type==='A' ? toolKnown : signupKnown;
  const weeklyToolUse = toolKnown ? events.tool_use : null;
  const signals = measured ? (meta.probe_type==='A' ? weeklyToolUse : waitlistCount) : null;
  const exposureKnown = postHogAvailable && validCount(events?.pageview);
  const minimumExposures = meta.minimum_exposures ?? 20;
  const exposureSufficient = exposureKnown && events.pageview>=minimumExposures;
  const graduated = meta.probe_type==='B'
    ? signupKnown && waitlistCount>=rules.graduate.probe_b_signups
    : toolKnown && (weeklyToolUse>=rules.graduate.probe_a_weekly_tool_use ||
      (validCount(returningUsers) && returningUsers>=rules.graduate.probe_a_returning_users));
  let verdict='WATCH';
  let reason = !distributed ? 'not_distributed' : !measured ? 'measurement_unknown' : !exposureSufficient ? 'insufficient_exposure' : 'observing';
  if (graduated) { verdict='GRADUATE'; reason='threshold_met'; }
  else if (distributed && measured && exposureSufficient && observedDays>=rules.kill.min_age_days && signals<rules.kill.max_signals) {
    verdict='KILL'; reason='measured_low_signal';
  }
  return {verdict,reason,ageDays,observedDays,distributed,weeklyToolUse,signals,measured,exposureSufficient};
}
