// Hello Shade visitor analytics. Two optional tools, each off until its key is filled in:
//   POSTHOG_KEY  PostHog project API key (phc_…). Settings → Project → Project API key. Public by design.
//   GC_CODE      GoatCounter site code (the "hello-shade" part of hello-shade.goatcounter.com).
// Both empty = nothing loads.
//
// AI referrals: visits from ChatGPT, Perplexity, Claude, Gemini, Copilot etc. usually land as "direct"
// because those apps often strip the referrer. ChatGPT adds ?utm_source=chatgpt.com to its links, so we
// check utm_source first, then the referrer, and tag the visit with `ai_source` (e.g. "chatgpt").
// In PostHog: every event in the session carries ai_source / ai_landing_page; the person keeps
// first_ai_source; and the landing fires one `ai_referral` event. Filter or break down by ai_source.
(function () {
  var POSTHOG_KEY = '';
  var POSTHOG_HOST = 'https://us.i.posthog.com';
  var GC_CODE = '';
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  // ---------- Which AI assistant sent this visit? ----------
  var AI = [
    ['chatgpt', /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|^openai$|^chatgpt$/],
    ['perplexity', /(^|\.)perplexity\.ai$|^perplexity$/],
    ['claude', /(^|\.)claude\.ai$|^claude$/],
    ['gemini', /(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$|^gemini$/],
    ['copilot', /(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$|^copilot$/],
    ['meta-ai', /(^|\.)meta\.ai$/],
    ['grok', /(^|\.)grok\.com$|^grok$/],
    ['deepseek', /(^|\.)chat\.deepseek\.com$/],
    ['you', /(^|\.)you\.com$/],
    ['phind', /(^|\.)phind\.com$/],
  ];
  function aiFrom(value) {
    if (!value) return null;
    var v = String(value).toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0];
    for (var i = 0; i < AI.length; i++) if (AI[i][1].test(v)) return AI[i][0];
    return null;
  }
  var params = new URLSearchParams(location.search);
  var utm = params.get('utm_source');
  var ref = '';
  try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
  var hit = aiFrom(utm) || (ref && ref !== location.hostname ? aiFrom(ref) : null);

  var KEY = 'hs_ai';
  var session = null;
  try { session = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (hit) {
    session = { source: hit, landing: location.pathname, via: utm && aiFrom(utm) ? 'utm' : 'referrer' };
    try { sessionStorage.setItem(KEY, JSON.stringify(session)); } catch (e) {}
  }
  window.HS_AI = session; // { source, landing, via } or null; handy for other scripts

  // ---------- PostHog ----------
  if (POSTHOG_KEY) {
    /* eslint-disable */
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    /* eslint-enable */
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: true,
      // Keep phone numbers, names and emails out of URLs we send.
      sanitize_properties: function (props) {
        ['$current_url', '$pathname'].forEach(function (k) {
          if (props[k]) props[k] = String(props[k]).replace(/([?&])(phone|name|email|t)=[^&#]*/g, '$1$2=redacted');
        });
        return props;
      },
    });
    if (session) {
      posthog.register_for_session({ ai_source: session.source, ai_landing_page: session.landing, ai_via: session.via });
      posthog.register_once({ first_ai_source: session.source });
    }
    if (hit) posthog.capture('ai_referral', { ai_source: hit, ai_via: session.via, landing_page: location.pathname, referrer_host: ref || null, utm_source: utm || null });
  }

  // ---------- GoatCounter ----------
  if (GC_CODE) {
    window.goatcounter = { path: function () { return location.pathname + location.search.replace(/[?&](phone|name|email|t)=[^&]*/g, ''); } };
    var s = document.createElement('script');
    s.async = true;
    s.dataset.goatcounter = 'https://' + GC_CODE + '.goatcounter.com/count';
    s.src = 'https://gc.zgo.at/count.js';
    if (hit) s.addEventListener('load', function () {
      if (window.goatcounter.count) window.goatcounter.count({ path: 'ai-referral/' + hit, title: location.pathname, event: true });
    });
    document.head.appendChild(s);
  }

  // ---------- Funnel steps, counted as events ----------
  function eventFor(a) {
    var h = a.getAttribute('href') || '';
    if (h.indexOf('sms:') === 0 || a.hasAttribute('data-dana') || a.hasAttribute('data-text-sheet')) return 'text-a-designer';
    if (a.hasAttribute('data-swatch-kit')) return 'samples-request';
    if (/swatch-kit\//.test(h)) return 'samples-page';
    if (/try-your-window\//.test(h)) return 'try-your-window';
    if (/studio\//.test(h)) return 'try-on';
    if (/how-to-measure\//.test(h)) return 'how-to-measure';
    return null;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var name = eventFor(a);
    if (!name) return;
    if (POSTHOG_KEY && window.posthog) posthog.capture(name, { page: location.pathname });
    if (GC_CODE && window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: location.pathname, event: true });
  }, true);
})();
