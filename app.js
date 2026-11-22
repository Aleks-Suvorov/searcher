/*
 * Unlisted: a self-audit of your own online exposure.
 *
 * Everything runs in the browser. Details and progress live in localStorage.
 * The only network calls Unlisted makes itself are the optional checks the
 * user starts by clicking a button: a breach lookup for an email
 * (XposedOrNot), a Gravatar lookup by email hash, and a k-anonymous
 * Pwned Passwords range query that never sends the password.
 */
(function () {
  'use strict';

  const D = window.UNLISTED_DATA;
  const EMBED = window.UNLISTED_EMBED === true; // set by the hosted preview, where downloads and outside calls are blocked
  const KEY = 'unlisted.v1';
  const THEME_KEY = 'unlisted.theme';
  const DAY = 864e5;
  const STATE_NAME = Object.fromEntries(D.states);

  // ---------------------------------------------------------------- helpers
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const num = (n) => Number(n).toLocaleString('en-US');
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many || one + 's'}`;
  const ago = (t) => { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
  };
  const G = (q) => 'https://www.google.com/search?q=' + enc(q);
  const B = (q) => 'https://www.bing.com/search?q=' + enc(q);
  const DDG = (q) => 'https://duckduckgo.com/?q=' + enc(q);
  const engines = (q) => [{ t: 'Google', href: G(q), primary: true }, { t: 'Bing', href: B(q) }, { t: 'DuckDuckGo', href: DDG(q) }];

  // ---------------------------------------------------------------- model
  const SECTIONS = [
    { id: 'overview', label: 'Overview', blurb: '' },
    { id: 'brokers', label: 'People-search sites', blurb: 'Sites that show your address, phone number and relatives to anyone who types your name. Most take you down within a few days of an opt-out.' },
    { id: 'search', label: 'Search engines', blurb: 'Ready-made searches that show what a stranger finds when they look you up, on Google, Bing and DuckDuckGo.' },
    { id: 'accounts', label: 'Accounts and usernames', blurb: 'Every platform where your usernames might be registered. Forgotten accounts still show old photos, posts and links.' },
    { id: 'tags', label: 'Tags and mentions', blurb: 'Posts other people tagged you in, the settings that make you approve tags first, and apps that broadcast where you are.' },
    { id: 'breaches', label: 'Breaches and passwords', blurb: 'Which leaks include your email, what they exposed, and whether a password you use is already public.' },
    { id: 'phone', label: 'Phone number', blurb: 'Where your number shows up, caller-ID apps that attach your name to it, and the carrier lock that stops SIM-swap takeovers.' },
    { id: 'home', label: 'Home and maps', blurb: 'Public records and map imagery that show where you live, and the programs that let you hide your address.' },
    { id: 'photos', label: 'Photos and faces', blurb: 'Location data hidden inside your photos, where your face appears, and face-search engines you can opt out of.' },
    { id: 'identity', label: 'Identity lockdown', blurb: 'Freezes and account claims that stop someone from opening credit, bank accounts or tax returns as you.' },
    { id: 'letters', label: 'Removal letters', blurb: 'Legal deletion requests filled in with your details, for companies that ignore forms or have none.' },
  ];
  const SECTION_IDS = new Set(SECTIONS.map((s) => s.id));
  const SETS = {
    broker: [['todo', 'Not checked'], ['clear', 'Not listed'], ['found', 'Listed'], ['requested', 'Opt-out sent'], ['removed', 'Removed']],
    search: [['todo', 'Not checked'], ['clear', 'Nothing found'], ['found', 'Found something'], ['requested', 'Removal asked'], ['removed', 'Gone']],
    account: [['todo', 'Not checked'], ['clear', 'Not mine or none'], ['found', 'Mine, still up'], ['locked', 'Locked down'], ['removed', 'Deleted']],
    action: [['todo', 'To do'], ['done', 'Done'], ['skip', 'Not for me']],
  };
  const RESOLVED = new Set(['removed', 'locked', 'done']);
  const CLEARED = new Set(['clear', 'skip']);

  const EMPTY = { name: '', others: '', city: '', state: '', emails: '', users: '', phones: '' };
  const EXAMPLE = { name: 'Jordan Avery Ellis', others: 'Reyes', city: 'Columbus', state: 'OH', emails: 'jordan.ellis@example.com', users: 'jordanellis', phones: '(614) 555-0142' };

  const state = {
    profile: EMPTY, marks: {}, scans: {}, built: 0, example: true,
    view: 'overview', filter: 'all', handle: 'all',
    x: null, checks: [],
    busy: {}, scanErr: {}, showAll: {}, photos: [], pwResult: null,
    letter: { to: '', other: '', kind: '', addr: '' },
    pendingFocus: null, animate: false,
  };

  // ---------------------------------------------------------------- parsing
  const list = (s) => String(s || '').split(/[,;\n]+/).map((v) => v.trim()).filter(Boolean);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{1,38}$/i;
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  function splitName(full) {
    const parts = String(full || '').trim().replace(/\s+/g, ' ').split(' ')
      .filter((p) => p && !/^(jr|sr|ii|iii|iv|phd|md|esq)\.?$/i.test(p));
    return { first: parts[0] || '', middle: parts.slice(1, -1).join(' '), last: parts.length > 1 ? parts[parts.length - 1] : '' };
  }

  function nicknamesFor(first) {
    const f = first.toLowerCase();
    const out = new Set(D.nicknames[f] || []);
    for (const [formal, nicks] of Object.entries(D.nicknames)) {
      if (nicks.some((n) => n.toLowerCase() === f)) out.add(cap(formal));
    }
    out.delete(cap(f));
    return [...out];
  }

  function normPhone(s) { let d = String(s).replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d; }
  function phoneFormats(d) {
    if (d.length !== 10) return [d];
    const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6);
    return [`${a}-${b}-${c}`, `(${a}) ${b}-${c}`, `${a}.${b}.${c}`, d, `+1 ${a} ${b} ${c}`];
  }
  const prettyPhone = (d) => (d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d);

  function derive(p) {
    const n = splitName(p.name);
    const st = /^[A-Z]{2}$/.test(p.state || '') ? p.state : '';
    const full = [n.first, n.last].filter(Boolean).join(' ');
    const names = [];
    const addName = (v) => { v = v.replace(/\s+/g, ' ').trim(); if (v && !names.some((x) => x.toLowerCase() === v.toLowerCase())) names.push(v); };
    if (full) addName(full);
    if (n.middle && n.last) { addName(`${n.first} ${n.middle[0]}. ${n.last}`); addName(`${n.first} ${n.middle} ${n.last}`); }
    if (n.last) nicknamesFor(n.first).slice(0, 3).forEach((k) => addName(`${k} ${n.last}`));
    list(p.others).forEach((o) => addName(o.includes(' ') || !n.first ? o : `${n.first} ${o}`));

    const emails = [...new Set(list(p.emails).map((e) => e.toLowerCase()).filter((e) => EMAIL_RE.test(e)))].slice(0, 5);
    const handles = [];
    const seen = new Set();
    const addH = (h, from) => {
      h = String(h).replace(/^@+/, '').trim().toLowerCase();
      if (HANDLE_RE.test(h) && !seen.has(h)) { seen.add(h); handles.push({ h, from }); }
    };
    list(p.users).forEach((u) => addH(u, 'typed'));
    emails.forEach((e) => {
      const local = e.split('@')[0].split('+')[0];
      addH(local, e);
      if (local.includes('.')) addH(local.replace(/\./g, ''), e);
    });
    const phones = [...new Set(list(p.phones).map(normPhone).filter((d) => d.length >= 7))].slice(0, 4);
    return {
      ...n, full, names: names.slice(0, 8), city: String(p.city || '').trim(), st,
      stName: st ? STATE_NAME[st] : '', us: p.state !== 'XX', ca: st === 'CA',
      emails, handles: handles.slice(0, 6), phones,
    };
  }

  function countDetails(p) {
    const x = derive(p);
    if (!x.first) return 0;
    return 1 + list(p.others).length + (x.city || x.st ? 1 : 0) + x.emails.length + list(p.users).length + x.phones.length;
  }

  // ---------------------------------------------------------------- checks
  function buildChecks(x) {
    const out = [];
    const add = (o) => out.push(Object.assign({ w: 1, links: [], chips: [], set: 'action', group: '' }, o));
    if (!x.first) return out;
    const L = D.links;
    const f = `"${x.full}"`;
    const loc = x.city ? ` "${x.city}"` : x.stName ? ` "${x.stName}"` : '';

    // People-search sites
    if (x.ca) {
      add({ id: 'drop', sec: 'brokers', group: 'One request for every registered broker', w: 3, title: 'California DROP: delete me everywhere',
        sub: 'As a California resident you can send one deletion request to every data broker registered with the state. Registered brokers have to process it on a regular schedule.',
        links: [{ t: 'Open DROP', href: L.drop, primary: true }, { t: 'How DROP works', href: L.dropInfo }] });
    }
    const tierGroup = { 1: 'Biggest people-search sites', 2: 'More people-search sites', source: 'Data sources that feed the others', pro: 'Work and sales directories' };
    const tierW = { 1: 3, 2: 2, source: 2, pro: 1 };
    for (const b of D.brokers) {
      const links = [];
      if (b.tier !== 'source') {
        const direct = b.search && x.last ? b.search(x) : null;
        links.push({ t: 'Find me', href: direct || G(`site:${b.domain} "${x.full}"${loc}`) });
        if (direct) links.push({ t: 'Search Google', href: G(`site:${b.domain} "${x.full}"`) });
      }
      links.push({ t: 'Opt out', href: b.optout, primary: true });
      add({ id: 'broker:' + b.id, sec: 'brokers', group: tierGroup[b.tier], name: b.name, title: b.name, sub: b.note,
        covers: b.covers, chips: b.exposes, diff: b.diff, mins: b.mins, needs: b.needs, w: tierW[b.tier], tier: b.tier,
        set: b.tier === 'source' ? 'action' : 'broker', links });
    }

    // Search engines
    const S = (o) => add(Object.assign({ sec: 'search', set: 'search', w: 2 }, o, { links: o.links || engines(o.query) }));
    S({ id: 'q:name', group: 'Your name', title: 'Your name, anywhere', query: f, sub: 'The first page of results is what a new employer, landlord or date sees.' });
    if (loc) S({ id: 'q:name-loc', group: 'Your name', title: 'Your name where you live', query: f + loc, sub: 'Adding your city cuts out people who share your name.' });
    x.names.slice(1, 7).forEach((v) => S({ id: 'q:var:' + v.toLowerCase(), group: 'Your name', title: v, query: `"${v}"${loc}`, sub: 'Records often use a nickname, a middle initial or a previous last name.' }));
    S({ id: 'q:contact', group: 'Where your name shows up', title: 'Your name next to contact details', query: `${f} ("address" OR "phone" OR "relatives")`, sub: 'Brings up directory and people-search pages that list you.' });
    S({ id: 'q:docs', group: 'Where your name shows up', title: 'Documents that mention you', query: `${f} (filetype:pdf OR filetype:docx OR filetype:xlsx)`, sub: 'Resumes, meeting minutes, newsletters, team rosters and court filings.' });
    S({ id: 'q:social', group: 'Where your name shows up', title: 'Social profiles under your real name', query: `${f} (site:facebook.com OR site:instagram.com OR site:linkedin.com OR site:x.com OR site:tiktok.com)` });
    S({ id: 'q:forums', group: 'Where your name shows up', title: 'Forums and comment threads', query: `${f} (site:reddit.com OR site:quora.com OR site:medium.com)` });
    S({ id: 'q:obits', group: 'Where your name shows up', title: 'Obituaries and family pages', query: `${f} (obituary OR "survived by" OR "family tree")`, sub: "A relative's obituary can list your name, city and family together." });
    S({ id: 'q:court', group: 'Where your name shows up', title: 'Court cases and public notices', query: `${f} (court OR lawsuit OR "case number" OR "public notice")${x.stName ? ` "${x.stName}"` : ''}` });
    S({ id: 'q:images', group: 'Where your name shows up', title: 'Images captioned with your name', query: f, sub: 'Team photos, event pages and news photos often name everyone in them.',
      links: [{ t: 'Google Images', href: 'https://www.google.com/search?tbm=isch&q=' + enc(f), primary: true }, { t: 'Bing Images', href: 'https://www.bing.com/images/search?q=' + enc(f) }] });
    S({ id: 'q:news', group: 'Where your name shows up', title: 'News that mentions you', query: f,
      links: [{ t: 'Google News', href: 'https://www.google.com/search?tbm=nws&q=' + enc(f), primary: true }, { t: 'Bing News', href: 'https://www.bing.com/news/search?q=' + enc(f) }] });
    x.emails.forEach((e) => {
      S({ id: 'q:email:' + e, group: 'Your email addresses', title: e, query: `"${e}"`, sub: 'Anywhere the address is printed: profiles, rosters, old posts, leaked lists.' });
      S({ id: 'q:leak:' + e, group: 'Your email addresses', title: `${e} in pastes and public code`, query: `"${e}" (site:pastebin.com OR site:github.com OR site:gist.github.com OR site:trello.com)`, sub: 'Leaked lists and public code sometimes contain addresses next to passwords.' });
    });
    x.handles.forEach(({ h, from }) => S({ id: 'q:handle:' + h, group: 'Your usernames', title: '@' + h, query: `"${h}"`,
      sub: from === 'typed' ? 'Mentions of your username on sites Unlisted does not list.' : `Taken from ${from}. People often reuse the part before the @ as a username.` }));
    add({ id: 'watch:rays', sec: 'search', group: 'Keep watching', w: 2, title: 'Turn on Google "Results about you"',
      sub: 'Google tells you when new results show your phone, home address or email, and lets you ask for removal in a couple of taps.',
      links: [{ t: 'Open Results about you', href: L.resultsAboutYou, primary: true }] });
    add({ id: 'watch:alert', sec: 'search', group: 'Keep watching', title: 'Set a Google Alert for your name', copy: f,
      sub: `Create an alert for ${f} so new mentions land in your inbox.`, links: [{ t: 'Open Google Alerts', href: L.googleAlerts, primary: true }] });

    // Accounts
    x.handles.forEach(({ h }) => {
      for (const p of D.platforms) {
        const links = [{ t: 'Open profile', href: p.url(h), primary: true }];
        if (p.del) links.push({ t: 'Delete account', href: p.del });
        add({ id: `acct:${p.id}:${h}`, sec: 'accounts', group: D.platformCats[p.cat], handle: h, name: p.name, title: p.name,
          url: p.url(h), sub: p.delNote, set: 'account', links });
      }
    });

    // Tags and mentions
    const T = (o) => add(Object.assign({ sec: 'tags', set: 'search' }, o));
    const typed = x.handles.filter((h) => h.from === 'typed');
    (typed.length ? typed : x.handles).slice(0, 3).forEach(({ h }) => {
      T({ id: 'tag:ig:' + h, group: 'Posts that tag or mention you', title: `Instagram posts tagging @${h}`,
        sub: 'The Tagged tab lists every post someone tagged you in, including posts from strangers.',
        links: [{ t: 'Open tagged posts', href: `https://www.instagram.com/${h}/tagged/`, primary: true }] });
      T({ id: 'tag:x:' + h, group: 'Posts that tag or mention you', title: `X posts mentioning @${h}`, sub: 'Every recent post that mentions your username, newest first.',
        links: [{ t: 'Search mentions', href: `https://x.com/search?q=${enc('@' + h)}&f=live`, primary: true }] });
      T({ id: 'tag:reddit:' + h, group: 'Posts that tag or mention you', title: `Reddit threads naming u/${h}`,
        links: [{ t: 'Search Google', href: G(`"u/${h}" site:reddit.com`), primary: true }] });
    });
    T({ id: 'tag:fb', group: 'Posts that tag or mention you', title: 'Facebook photos and videos you are tagged in',
      sub: "Open your Activity log and filter to Photos and videos you're tagged in. Untag yourself or ask the poster to take it down.",
      links: [{ t: 'Open Activity log', href: L.fbActivity, primary: true }] });
    T({ id: 'tag:tiktok', group: 'Posts that tag or mention you', title: 'TikTok videos that mention or tag you', sub: 'In the app: Inbox, then Activity, then filter to Mentions and tags.' });
    T({ id: 'tag:threads', group: 'Posts that tag or mention you', title: 'Threads posts that mention you', sub: 'In the app: the Activity tab, then Mentions.' });
    const A = (o) => T(Object.assign({ group: 'Approve tags before they go public', set: 'action' }, o));
    A({ id: 'tagset:ig', title: 'Instagram: approve tags by hand', sub: 'Settings and activity, then Tags and mentions. Turn on Manually approve tags and limit who can tag or mention you.' });
    A({ id: 'tagset:fb', title: 'Facebook: review tags before they appear', sub: "Turn on Review tags people add to your posts, and Review posts you're tagged in before the post appears on your profile.",
      links: [{ t: 'Open tagging settings', href: L.fbTagging, primary: true }] });
    A({ id: 'tagset:x', title: 'X: limit photo tagging', sub: 'Turn photo tagging off, or allow it only from people you follow.', links: [{ t: 'Open tagging settings', href: L.xTagging, primary: true }] });
    A({ id: 'tagset:tiktok', title: 'TikTok: choose who can mention and tag you', sub: 'Settings and privacy, then Privacy, then Mentions and tags.' });
    A({ id: 'tagset:li', title: 'LinkedIn: control mentions by others', sub: "Turn off mentions or tags by others if you don't want posts linking to your profile.",
      links: [{ t: 'Open setting', href: L.liMentions, primary: true }] });
    const P = (o) => T(Object.assign({ group: 'Apps that give away where you are', set: 'action', w: 2 }, o));
    P({ id: 'loc:snap', title: 'Snapchat: turn on Ghost Mode', sub: 'Open the Snap Map, tap the settings gear and turn on Ghost Mode so people cannot see where you are.' });
    P({ id: 'loc:strava', title: 'Strava: hide the start and end of your routes', sub: "Most runs and rides start at the front door. Map visibility hides the part of each route near home.",
      links: [{ t: 'Open privacy settings', href: L.strava, primary: true }] });
    P({ id: 'loc:venmo', title: 'Venmo: make payments private', sub: 'Settings, then Privacy: choose Private, then change all past transactions to private. Hide your friends list too.' });
    P({ id: 'loc:maps', w: 1, title: 'Google Maps: review your public reviews and photos', sub: 'Reviews show the places you go under your name. Open your Maps profile, then Contributions.' });
    P({ id: 'loc:spotify', w: 1, title: 'Spotify: stop sharing what you play', sub: 'Settings, then Privacy and social: turn off listening activity and make playlists private.' });
    P({ id: 'loc:youtube', w: 1, title: 'YouTube: keep subscriptions and playlists private', links: [{ t: 'Open YouTube privacy', href: L.youtubePrivacy, primary: true }] });
    P({ id: 'loc:amazon', w: 1, title: 'Amazon: check your public profile and lists', sub: 'Your profile shows your name, reviews and any public wish lists.',
      links: [{ t: 'Open public profile', href: L.amazonProfile, primary: true }] });

    // Breaches
    x.emails.forEach((e) => {
      const scan = state.scans[e];
      if (!scan || !scan.breaches) return;
      scan.breaches.forEach((b) => {
        const pw = b.data.some((d) => /password/i.test(d));
        add({ id: `breach:${e}:${b.n}`, sec: 'breaches', group: 'Breaches to act on', exposed: true, w: pw ? 2 : 1, name: b.n,
          title: pw ? `Change your ${b.n} password` : `Review the ${b.n} breach`,
          sub: `${e} · ${b.y || 'date unknown'}. ${pw ? 'If you used that password anywhere else, change it there too.' : 'Watch for phishing that uses these details.'}`,
          dataTypes: b.data });
      });
    });
    D.hygiene.forEach((hg) => add({ id: hg.id, sec: 'breaches', group: hg.group, title: hg.title, sub: hg.sub, w: hg.w, mins: hg.mins,
      links: (hg.links || []).map(([t, href], i) => ({ t, href, primary: i === 0 })) }));

    // Phone
    x.phones.forEach((d) => {
      const q = phoneFormats(d).slice(0, 4).map((v) => `"${v}"`).join(' OR ');
      add({ id: 'q:phone:' + d, sec: 'phone', group: 'Your number online', set: 'search', w: 2, title: prettyPhone(d), query: q, links: engines(q), sub: 'Searches every common way your number gets written.' });
      const q2 = `${f} (${q})`;
      add({ id: 'q:phonename:' + d, sec: 'phone', group: 'Your number online', set: 'search', w: 2, title: `${prettyPhone(d)} next to your name`, query: q2, links: engines(q2) });
    });
    const PH = (o) => add(Object.assign({ sec: 'phone' }, o));
    PH({ id: 'ph:truecaller', group: 'Caller-ID apps', w: 2, title: 'Unlist your number from Truecaller',
      sub: 'Truecaller shows your name to anyone you call or who looks your number up, built from contact lists its users upload.',
      links: [{ t: 'Open unlisting', href: D.links.truecaller, primary: true }] });
    PH({ id: 'ph:syncme', group: 'Caller-ID apps', title: 'Remove your number from Sync.ME', sub: 'Another caller-ID directory built from uploaded contacts.',
      links: [{ t: 'Open removal', href: D.links.syncme, primary: true }] });
    PH({ id: 'ph:carrier', group: 'Stop SIM-swap takeovers', w: 3, title: "Turn on your carrier's number lock",
      sub: 'Verizon calls it Number Lock, AT&T calls it Wireless Account Lock, and T-Mobile offers SIM Protection and Port Out Protection. Other carriers offer a port-out PIN. It stops someone moving your number to their phone and receiving your login codes.' });
    if (x.us) PH({ id: 'ph:dnc', group: 'Fewer calls', title: 'Register on the National Do Not Call Registry', sub: 'Cuts legitimate telemarketing. Scammers ignore it, so keep screening unknown calls.',
      links: [{ t: 'Open donotcall.gov', href: D.links.donotcall, primary: true }] });
    PH({ id: 'ph:second', group: 'Fewer calls', title: 'Give out a second number for sign-ups', sub: 'A free forwarding number for stores, forms and dating apps keeps your real number out of new databases.' });

    // Home and maps
    const H = (o) => add(Object.assign({ sec: 'home' }, o));
    if (x.us && x.stName) {
      const q1 = `${x.city ? x.city + ' ' : ''}${x.stName} county property records owner search`;
      H({ id: 'home:property', group: 'Public records', set: 'search', w: 2, title: 'Property records', query: q1, links: engines(q1),
        sub: 'If you own your home, the county assessor publishes your name next to the address. Some states let you shield it.' });
      const q2 = `${x.stName} voter registration confidential address`;
      H({ id: 'home:voter', group: 'Public records', set: 'search', w: 2, title: 'Voter record privacy', query: q2, links: engines(q2),
        sub: 'Voter files with your name, address and birth year are public or for sale in many states. Some offer confidentiality.' });
      H({ id: 'home:acp', group: 'Public records', title: `${x.stName} Address Confidentiality Program`,
        sub: 'For survivors of stalking, domestic violence or abuse: a free legal substitute address to use on public records.',
        links: [{ t: "Find your state's program", href: G(`${x.stName} address confidentiality program`), primary: true }] });
    }
    H({ id: 'home:streetview', group: 'Maps', title: 'Blur your home on Google Street View', sub: 'Find your house in Street View, choose Report a problem, and ask for it to be blurred. The blur is permanent.',
      links: [{ t: 'Open Google Maps', href: 'https://www.google.com/maps', primary: true }] });
    H({ id: 'home:apple', group: 'Maps', title: 'Blur your home on Apple Maps Look Around', copy: 'MapsImageCollection@apple.com',
      sub: 'Email MapsImageCollection@apple.com with your address and ask for your home to be blurred.' });

    // Photos
    add({ id: 'img:reverse', sec: 'photos', group: 'Where your photos appear', set: 'search', w: 2, title: 'Reverse-search your profile photo',
      sub: 'Upload the photo you use most. Copies on sites you never joined usually mean a scraper or an impersonator.',
      links: [{ t: 'Google Lens', href: D.links.lens, primary: true }, { t: 'TinEye', href: D.links.tineye }, { t: 'Bing Visual Search', href: D.links.bingVisual }] });
    add({ id: 'img:pimeyes', sec: 'photos', group: 'Opt out of face-search engines', w: 2, title: 'PimEyes',
      sub: 'Finds photos of a face across the web. Its opt-out hides your face from results.', links: [{ t: 'Open opt-out', href: D.links.pimeyes, primary: true }] });
    add({ id: 'img:facecheck', sec: 'photos', group: 'Opt out of face-search engines', w: 2, title: 'FaceCheck.ID',
      sub: 'Another face-search engine with a removal form.', links: [{ t: 'Open removal', href: D.links.facecheck, primary: true }] });

    // Identity
    if (x.us) {
      D.identity.forEach((i) => add({ id: i.id, sec: 'identity', group: i.group, title: i.title, sub: i.sub, w: i.w, mins: i.mins,
        links: [{ t: 'Open site', href: i.href, primary: true }] }));
    }
    return out;
  }

  // ---------------------------------------------------------------- status
  const statusOf = (c) => (state.marks[c.id] ? state.marks[c.id].s : 'todo');
  function tally(checks) {
    const t = { total: checks.length, checked: 0, found: 0, requested: 0, resolved: 0, cleared: 0, wOpen: 0 };
    for (const c of checks) {
      const s = statusOf(c);
      if (s !== 'todo' || c.exposed) t.checked++;
      if (s === 'found' || (c.exposed && s === 'todo')) { t.found++; t.wOpen += c.w; }
      else if (s === 'requested') t.requested++;
      else if (RESOLVED.has(s)) t.resolved++;
      else if (CLEARED.has(s)) t.cleared++;
    }
    return t;
  }
  function setMark(id, s) {
    if (s === 'todo') delete state.marks[id];
    else state.marks[id] = { s, t: Date.now() };
    save();
  }
  function save() {
    if (state.example) return;
    store.set(KEY, { app: 'unlisted', v: 1, profile: state.profile, marks: state.marks, scans: state.scans, built: state.built });
  }

  // ---------------------------------------------------------------- rendering helpers
  const EXT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  function linkBtn(l, size = 'sm') {
    const cls = `btn ${size}${l.primary ? ' primary' : ''}`;
    if (state.example) return `<span class="${cls} is-disabled" aria-disabled="true" title="Example audit: links are switched off">${esc(l.t)}${EXT}</span>`;
    return `<a class="${cls}" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.t)}${EXT}<span class="vh"> (opens in a new tab)</span></a>`;
  }
  const effort = (d) => `<span class="effort" data-d="${d}" title="Effort: ${['', 'easy', 'medium', 'hard'][d]}"><i></i><i></i><i></i><span class="vh">Effort: ${['', 'easy', 'medium', 'hard'][d]}</span></span>`;
  function statusLabel(c, s) { const p = SETS[c.set].find(([v]) => v === s); return p ? p[1] : s; }

  function row(c) {
    const m = state.marks[c.id];
    const s = statusOf(c);
    const sid = 's-' + hash(c.id);
    const meta = [];
    if (c.diff) meta.push(effort(c.diff));
    if (c.mins) meta.push(`<span>About ${c.mins} min</span>`);
    if (c.needs) meta.push(`<span>Needs: ${esc(c.needs.join(', '))}</span>`);
    if (c.covers) meta.push(`<span>Also covers ${esc(c.covers.join(', '))}</span>`);
    if (c.url) meta.push(`<span class="mono-s">${esc(c.url.replace(/^https?:\/\//, ''))}</span>`);
    const chips = c.chips.length ? `<ul class="chips" aria-label="Usually shows">${c.chips.map((k) => `<li>${esc(D.exposes[k] || k)}</li>`).join('')}</ul>` : '';
    const dchips = c.dataTypes && c.dataTypes.length ? `<ul class="chips" aria-label="Exposed in this breach">${c.dataTypes.map((d) => `<li class="${HOT.test(d) ? 'is-hot' : ''}">${esc(d)}</li>`).join('')}</ul>` : '';
    const copy = c.query ? `<button class="btn sm ghost" type="button" data-copy="${esc(c.query)}">Copy search</button>`
      : c.copy ? `<button class="btn sm ghost" type="button" data-copy="${esc(c.copy)}">Copy</button>` : '';
    const actions = c.links.map((l) => linkBtn(l)).join('') + copy;
    return `<article class="row" id="c-${hash(c.id)}" data-id="${esc(c.id)}" data-state="${s}">
      <div class="row-body">
        <h4 class="row-title"><span class="ink">${esc(c.title)}</span>${c.handle && state.x.handles.length > 1 ? `<span class="handle">@${esc(c.handle)}</span>` : ''}</h4>
        ${c.sub ? `<p class="row-sub">${esc(c.sub)}</p>` : ''}
        ${c.query ? `<code class="query">${esc(c.query)}</code>` : ''}
        ${chips}${dchips}
        ${meta.length ? `<p class="row-meta">${meta.join('<span class="sep" aria-hidden="true">·</span>')}</p>` : ''}
        ${actions ? `<div class="row-actions">${actions}</div>` : ''}
      </div>
      <div class="row-side">
        <span class="status-wrap"><select class="status" id="${sid}" data-id="${esc(c.id)}" aria-label="Status: ${esc(c.title)}">${SETS[c.set].map(([v, l]) => `<option value="${v}"${v === s ? ' selected' : ''}>${l}</option>`).join('')}</select></span>
        <span class="since">${m ? `${esc(statusLabel(c, s))} ${ago(m.t)}` : c.exposed ? 'From your breach scan' : ''}</span>
      </div>
    </article>`;
  }

  function groups(checks) {
    const order = [];
    const by = {};
    checks.forEach((c) => { if (!by[c.group]) { by[c.group] = []; order.push(c.group); } by[c.group].push(c); });
    return order.map((g) => `<section class="group"><header class="group-head"><h3>${esc(g)}</h3><span class="group-count">${by[g].length}</span></header><div class="rows">${by[g].map(row).join('')}</div></section>`).join('');
  }

  function statPills(t) {
    const p = [`<span class="pill"><b>${num(t.checked)}</b> of ${num(t.total)} checked</span>`];
    if (t.found) p.push(`<span class="pill is-found"><b>${num(t.found)}</b> exposed</span>`);
    if (t.requested) p.push(`<span class="pill is-req"><b>${num(t.requested)}</b> in progress</span>`);
    if (t.resolved) p.push(`<span class="pill is-done"><b>${num(t.resolved)}</b> removed or done</span>`);
    return p.join('');
  }

  function passFilter(c) {
    const s = statusOf(c);
    switch (state.filter) {
      case 'todo': return s === 'todo' && !c.exposed;
      case 'open': return s === 'found' || s === 'requested' || (c.exposed && s === 'todo');
      case 'done': return RESOLVED.has(s) || CLEARED.has(s);
      default: return true;
    }
  }

  function viewHead(sec, list, eyebrow) {
    const t = tally(list);
    const filters = [['all', 'All'], ['todo', 'Not checked'], ['open', 'Needs action'], ['done', 'Done']];
    return `<header class="view-head">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2>${esc(sec.label)}</h2>
      <p class="blurb">${esc(sec.blurb)}</p>
      ${list.length ? `<div class="head-bar"><div class="view-stats" id="viewStats">${statPills(t)}</div>
        <div class="filters" role="group" aria-label="Show">${filters.map(([v, l]) => `<button type="button" data-filter="${v}" aria-pressed="${state.filter === v}">${l}</button>`).join('')}</div></div>` : ''}
    </header>`;
  }

  // ---------------------------------------------------------------- views
  const extras = {};
  const callout = (html, tone = '') => `<div class="callout ${tone}">${html}</div>`;
  const toolLinks = (label, items) => `<p class="tool-links"><span>${esc(label)}</span>${items.map(([t, h]) => linkBtn({ t, href: h })).join('')}</p>`;

  extras.brokers = (list) => {
    const mins = list.reduce((a, c) => a + (c.mins || 0), 0);
    const pc = list.find((c) => c.id === 'broker:peopleconnect');
    return `${callout(`<strong>Start with the biggest five.</strong> Whitepages, Spokeo, BeenVerified, FastPeopleSearch and TruePeopleSearch are where most lookups land. ${pc ? 'The PeopleConnect request alone clears five more sites.' : ''} Every opt-out on this page takes about ${Math.round(mins / 6) / 10} hours in total.`)}
      ${toolLinks('After a page is gone:', [['Remove it from Google', 'https://search.google.com/search-console/remove-outdated-content']])}`;
  };
  extras.search = () => toolLinks('Ask a search engine to drop a result:', [['Google removal request', D.links.googleRemoval], ['Bing removal request', D.links.bingConcern]]);
  extras.accounts = (list) => {
    if (!state.x.handles.length) return callout('Add a username or an email address to your details to check which platforms have accounts under your names.');
    const hs = state.x.handles;
    const chips = hs.length > 1 ? `<div class="filters" role="group" aria-label="Username">${[['all', 'All usernames']].concat(hs.map(({ h }) => [h, '@' + h])).map(([v, l]) => `<button type="button" data-handle="${esc(v)}" aria-pressed="${state.handle === v}">${esc(l)}</button>`).join('')}</div>` : '';
    return `${callout(`Open each profile link. If the page loads, the username is taken there. If the account is yours, mark it <em>Mine</em>, then lock it down or delete it. Checking ${plural(hs.length, 'username')} across ${D.platforms.length} platforms.`)}${chips}`;
  };
  extras.tags = () => (state.x.handles.length ? '' : callout('Add your usernames to your details to check Instagram tags and X mentions.'));
  extras.phone = () => (state.x.phones.length ? '' : callout('Add a phone number to your details to search for it.'));
  extras.home = () => (state.x.stName ? '' : callout('Add your state to your details to get property, voter-record and address-confidentiality searches for where you live.'));
  extras.identity = () => (state.x.us ? '' : callout('Credit freezes and these programs are for the United States. In the UK, check your files with Experian, Equifax and TransUnion and consider Cifas Protective Registration. Elsewhere, ask your national credit bureaus about a freeze or fraud alert.'));

  // Breaches widgets
  const HOT = /(password|physical address|phone|birth|security question|social security|credit card|bank|passport|government|geographic|ip address)/i;
  const RISK = { plaintext: ['Plain text', 'bad'], easytocrack: ['Weak hash', 'warn'], hardtocrack: ['Strong hash', 'good'], unknown: ['Unknown', ''] };
  extras.breaches = () => {
    const x = state.x;
    let h = '<div class="tools">';
    if (!x.emails.length) h += callout('Add an email address to your details to scan it for breaches.');
    h += x.emails.map(emailCard).join('');
    h += pwCard();
    h += '</div>';
    h += toolLinks('Second opinions:', [['Have I Been Pwned', D.links.hibp], ['Mozilla Monitor', D.links.mozillaMonitor]]);
    return h;
  };
  function emailCard(e) {
    const s = state.scans[e];
    let body;
    if (EMBED) body = `<p class="fine">Live breach scans run when Unlisted is opened from its own site. This preview can't reach outside services, so use the second-opinion links below.</p>`;
    else if (state.busy[e]) body = '<p class="scan-status" role="status">Scanning breach records…</p>';
    else if (state.scanErr[e]) body = `<p class="scan-status is-bad" role="alert">${esc(state.scanErr[e])}</p>`;
    else if (s) body = scanResult(e, s);
    else body = '<p class="fine">Sends this one address to the free XposedOrNot breach database and checks Gravatar for a public photo. Results are saved only on this device.</p>';
    const btn = EMBED ? '' : state.example ? '<span class="btn sm is-disabled" aria-disabled="true">Scan</span>'
      : `<button class="btn sm primary" type="button" data-act="scan" data-email="${esc(e)}"${state.busy[e] ? ' disabled' : ''}>${s ? 'Scan again' : 'Scan for breaches'}</button>`;
    return `<article class="tool-card" id="scan-${hash(e)}"><header class="tool-head"><span class="mono">${esc(e)}</span>${btn}</header>${body}</article>`;
  }
  function scanResult(e, s) {
    const n = s.breaches.length;
    const grav = s.gravatar ? `<div class="gravatar is-bad"><img src="https://gravatar.com/avatar/${esc(s.gravatar)}?s=96" alt="" width="40" height="40"><p><strong>Public Gravatar photo.</strong> Anyone who has this address can see this picture, and many sites show it next to your comments. ${linkBtn({ t: 'Manage on Gravatar', href: D.links.gravatar })}</p></div>`
      : s.gravatar === false ? '<p class="fine">No Gravatar photo is linked to this address.</p>' : '';
    if (!n) return `<p class="scan-verdict is-good"><strong>No known breaches.</strong> XposedOrNot has no record of this address. Scanned ${ago(s.at)}.</p>${grav}`;
    const counts = {};
    s.breaches.forEach((b) => b.data.forEach((d) => { counts[d] = (counts[d] || 0) + 1; }));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 16);
    const pwN = s.breaches.filter((b) => b.data.some((d) => /password/i.test(d))).length;
    const all = state.showAll[e];
    const shown = all ? s.breaches : s.breaches.slice(0, 10);
    const rows = shown.map((b) => {
      const r = RISK[b.pw] || RISK.unknown;
      return `<tr><td><strong>${esc(b.n)}</strong>${b.d ? `<span class="mono-s">${esc(b.d)}</span>` : ''}</td><td class="num">${esc(b.y || '—')}</td><td>${esc(b.data.join(', '))}</td><td><span class="risk ${r[1]}">${r[0]}</span></td></tr>`;
    }).join('');
    return `<div class="scan-verdict is-bad"><span class="big">${num(n)}</span><p><strong>${n === 1 ? 'breach includes' : 'breaches include'} this address</strong><span>${plural(pwN, 'breach', 'breaches')} exposed a password · scanned ${ago(s.at)}</span></p></div>
      <p class="fine">Exposed alongside your email, by number of breaches:</p>
      <ul class="chips data">${top.map(([d, c]) => `<li class="${HOT.test(d) ? 'is-hot' : ''}">${esc(d)} <b>${c}</b></li>`).join('')}</ul>
      <div class="table-wrap"><table class="btable"><thead><tr><th scope="col">Breach</th><th scope="col">Year</th><th scope="col">Exposed</th><th scope="col">Password</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${n > 10 ? `<button class="btn sm ghost" type="button" data-act="toggle-all" data-email="${esc(e)}">${all ? 'Show fewer' : `Show all ${num(n)}`}</button>` : ''}
      ${grav}`;
  }
  function pwCard() {
    if (EMBED) return `<article class="tool-card"><header class="tool-head"><strong>Check a password</strong></header><p class="fine">Have I Been Pwned's password check hashes the password in your browser, so the password itself is never sent.</p><div class="row-actions">${linkBtn({ t: 'Check on Have I Been Pwned', href: D.links.hibpPasswords, primary: true })}</div></article>`;
    const r = state.pwResult;
    const out = !r ? '' : r.error ? `<p class="scan-status is-bad" role="alert">${esc(r.error)}</p>`
      : r.count > 0 ? `<p class="scan-verdict is-bad"><span class="big">${num(r.count)}</span><span><strong>times in known breaches.</strong> Stop using this password everywhere you use it.</span></p>`
        : '<p class="scan-verdict is-good"><strong>Not in any known breach.</strong> That alone does not make it strong. Keep it unique to one site.</p>';
    return `<form class="tool-card" id="pwForm" autocomplete="off">
      <header class="tool-head"><label for="pw"><strong>Check a password</strong></label></header>
      <div class="pw-row"><input id="pw" type="password" autocomplete="off" spellcheck="false" placeholder="Type a password you use">
        <button class="btn sm ghost" type="button" data-act="pw-show" aria-pressed="false">Show</button>
        <button class="btn sm primary" type="submit">Check</button></div>
      <p class="fine">The password never leaves this page. Unlisted hashes it here and sends only the first 5 characters of the hash to Pwned Passwords, then compares the matches locally.</p>
      <div id="pwOut" aria-live="polite">${out}</div>
    </form>`;
  }

  // Photos widget
  extras.photos = () => {
    const items = state.photos.map((p, i) => {
      const info = p.info;
      let verdict;
      if (info.type === 'error') verdict = `<p class="verdict">${esc(info.message)}</p>`;
      else if (info.gps) verdict = `<p class="verdict is-bad"><strong>Location embedded:</strong> <span class="mono-s">${info.gps.lat.toFixed(5)}, ${info.gps.lon.toFixed(5)}</span></p>`;
      else if (info.type === 'exif') verdict = '<p class="verdict is-good"><strong>No location data.</strong></p>';
      else if (info.type === 'not-jpeg') verdict = '<p class="verdict">Not a JPEG. Unlisted reads location from JPEG photos, which is what most phones share.</p>';
      else verdict = '<p class="verdict is-good"><strong>No metadata block.</strong> Nothing hidden here.</p>';
      const dl = [['Camera', [info.make, info.model].filter(Boolean).join(' ')], ['Taken', info.taken], ['Software', info.software]].filter(([, v]) => v);
      const actions = [];
      if (info.gps) actions.push(linkBtn({ t: 'See the spot on a map', href: `https://www.google.com/maps?q=${info.gps.lat},${info.gps.lon}` }));
      if (!EMBED && info.type === 'exif') actions.push(`<button class="btn sm primary" type="button" data-act="clean" data-i="${i}">Save a copy without metadata</button>`);
      return `<article class="photo"><img src="${esc(p.url)}" alt="" width="88" height="88"><div class="photo-body"><h4>${esc(p.name)}</h4>${verdict}${dl.length ? `<dl class="photo-dl">${dl.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}${actions.length ? `<div class="row-actions">${actions.join('')}</div>` : ''}</div></article>`;
    }).join('');
    return `<div class="tools">
      <article class="tool-card">
        <header class="tool-head"><strong>Does your photo say where you live?</strong></header>
        <div class="drop" id="drop"><input type="file" id="photoIn" accept="image/jpeg,image/*" multiple aria-label="Choose photos to scan">
          <p><strong>Drop photos here</strong> or click to choose</p><p class="fine">Read on this device. Photos are never uploaded.</p></div>
        ${items ? `<div class="photos">${items}</div>` : ''}
        <p class="fine">Phones save GPS coordinates inside every photo. Many sites strip them, but email, messaging apps, forums and file shares often don't. To stop it at the source: on iPhone, tap Options in the share sheet and turn off Location; on Android, turn off location tags in the camera settings.</p>
      </article>
      ${callout(`<strong>If someone shared intimate images of you.</strong> StopNCII.org blocks them from spreading on major platforms without you uploading the image. Take It Down handles images from before you turned 18. Google removes them from search results on request.<span class="callout-links">${linkBtn({ t: 'StopNCII.org', href: D.links.stopncii })}${linkBtn({ t: 'Take It Down', href: D.links.takeitdown })}${linkBtn({ t: 'Google removal request', href: D.links.googleRemoval })}</span>`, 'soft')}
    </div>`;
  };

  function viewSection(sec) {
    const all = state.checks.filter((c) => c.sec === sec.id);
    let list = all;
    if (sec.id === 'accounts' && state.handle !== 'all') list = list.filter((c) => c.handle === state.handle);
    const shown = list.filter(passFilter);
    const mins = all.reduce((a, c) => a + (c.mins || 0), 0);
    const eyebrow = `${plural(all.length, 'check')}${mins ? ` · about ${mins >= 90 ? Math.round(mins / 6) / 10 + ' hours' : mins + ' minutes'} of work` : ''}`;
    let h = viewHead(sec, all, eyebrow);
    h += extras[sec.id] ? extras[sec.id](all) : '';
    if (all.length && !shown.length) h += '<p class="empty">Nothing here matches this filter.</p>';
    else h += groups(shown);
    return h;
  }

  // Overview
  function nextMoves() {
    const moves = [];
    const now = Date.now();
    const add = (prio, c, title, href) => moves.push({ prio, c, title, href });
    for (const c of state.checks) {
      const s = statusOf(c);
      const m = state.marks[c.id];
      const opt = c.links.find((l) => l.primary);
      if (c.id === 'drop' && s === 'todo') add(100, c, 'Send one deletion request to every registered data broker', opt && opt.href);
      else if (c.set === 'broker' && s === 'found') add(90 + c.w, c, `Send your opt-out to ${c.name}`, opt && opt.href);
      else if (s === 'requested' && m && now - m.t > 14 * DAY) add(88, c, `Follow up on ${c.title}: you asked ${ago(m.t)}`, opt && opt.href);
      else if (c.id.startsWith('freeze-') && c.w === 3 && s === 'todo') add(85, c, c.title, opt && opt.href);
      else if (c.id === 'ph:carrier' && s === 'todo') add(83, c, c.title);
      else if (c.id === 'mfa-email' && s === 'todo') add(82, c, c.title);
      else if (c.exposed && s === 'todo' && c.w === 2) add(80, c, c.title);
      else if (c.set === 'broker' && s === 'todo' && c.tier === 1) add(76, c, `Check ${c.name} for a listing`, c.links[0] && c.links[0].href);
      else if (c.set === 'search' && s === 'found') add(72, c, `Ask for removal: ${c.title}`);
      else if (c.set === 'account' && s === 'found') add(66, c, `Lock down or delete your ${c.name} account`, c.links[1] ? c.links[1].href : null);
      else if (c.id === 'watch:rays' && s === 'todo') add(70, c, c.title, opt && opt.href);
      else if (c.id === 'tagset:ig' && s === 'todo') add(60, c, c.title);
    }
    if (!EMBED) state.x.emails.forEach((e) => { if (!state.scans[e]) moves.push({ prio: 87, scan: e, title: `Scan ${e} for breaches` }); });
    return moves.sort((a, b) => b.prio - a.prio).slice(0, 6);
  }
  function dueRechecks() {
    const now = Date.now();
    return state.checks.filter((c) => {
      const m = state.marks[c.id];
      return m && (c.set === 'broker' || c.set === 'search') && (m.s === 'removed' || m.s === 'clear') && now - m.t > 90 * DAY;
    });
  }
  function ring(pct, label) {
    const r = 34, full = +(2 * Math.PI * r).toFixed(1);
    const off = +(full * (1 - pct / 100)).toFixed(1);
    return `<svg class="ring" viewBox="0 0 80 80" role="img" aria-label="${esc(label)}: ${pct}%"><circle class="track" cx="40" cy="40" r="${r}"/><circle class="val" cx="40" cy="40" r="${r}" style="--full:${full};stroke-dasharray:${full};stroke-dashoffset:${off}"/><text x="40" y="46" text-anchor="middle">${pct}%</text></svg>`;
  }
  function viewOverview() {
    const x = state.x;
    const checks = state.checks;
    const t = tally(checks);
    const details = countDetails(state.profile);
    const coverage = t.total ? Math.round((t.checked / t.total) * 100) : 0;
    const touched = t.found + t.requested + t.resolved;
    const cleanup = touched ? Math.round((t.resolved / touched) * 100) : 0;
    const level = t.wOpen === 0 ? ['none', 'None confirmed yet'] : t.wOpen <= 5 ? ['low', 'Low'] : t.wOpen <= 15 ? ['moderate', 'Moderate'] : ['high', 'High'];
    const due = dueRechecks();
    const moves = nextMoves();
    const loc = [x.city, x.st || (x.us ? '' : 'Outside the US')].filter(Boolean).join(', ');
    const areaCount = SECTIONS.filter((s) => s.id !== 'overview' && s.id !== 'letters' && checks.some((c) => c.sec === s.id)).length;

    const moveItems = moves.map((mv) => {
      if (mv.scan) return `<li><div><p class="move-title">${esc(mv.title)}</p><p class="move-sub">Breaches and passwords</p></div><div class="move-actions"><button class="btn sm" type="button" data-goto="breaches">Go</button></div></li>`;
      const sec = SECTIONS.find((s) => s.id === mv.c.sec);
      return `<li><div><p class="move-title">${esc(mv.title)}</p><p class="move-sub">${esc(sec.label)}</p></div><div class="move-actions">${mv.href ? linkBtn({ t: 'Open', href: mv.href, primary: true }) : ''}<button class="btn sm" type="button" data-goto="${esc(mv.c.sec)}" data-focus="${esc(mv.c.id)}">Show</button></div></li>`;
    }).join('');

    // Exposure map: how many catalog sources publish each detail, and how many are confirmed for you.
    const brokerChecks = checks.filter((c) => c.sec === 'brokers' && c.chips.length);
    const breachTypes = {};
    x.emails.forEach((e) => { const s = state.scans[e]; if (s) s.breaches.forEach((b) => b.data.forEach((d) => { breachTypes[d] = (breachTypes[d] || 0) + 1; })); });
    const breachMap = { address: /physical address/i, phone: /phone/i, email: /email/i, age: /birth|age/i, job: /employer|job/i, social: /social media/i, photos: /photo|avatar/i };
    const rows = Object.entries(D.exposes).map(([k, label]) => {
      const pub = brokerChecks.filter((c) => c.chips.includes(k)).length;
      let you = brokerChecks.filter((c) => c.chips.includes(k) && ['found', 'requested'].includes(statusOf(c))).length;
      if (breachMap[k]) you += Object.entries(breachTypes).filter(([d]) => breachMap[k].test(d)).reduce((a, [, n]) => a + n, 0);
      return { label, pub, you };
    }).filter((r) => r.pub || r.you);
    const maxPub = Math.max(1, ...rows.map((r) => r.pub));
    const maxYou = Math.max(1, ...rows.map((r) => r.you));
    const xmap = rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>
      <td><span class="bar"><i style="width:${(r.pub / maxPub) * 100}%"></i></span><span class="num">${r.pub}</span></td>
      <td><span class="bar is-you"><i style="width:${(r.you / maxYou) * 100}%"></i></span><span class="num">${r.you || '–'}</span></td></tr>`).join('');

    const areas = SECTIONS.filter((s) => s.id !== 'overview' && s.id !== 'letters').map((s) => {
      const l = checks.filter((c) => c.sec === s.id);
      const at = tally(l);
      const pct = l.length ? Math.round((at.checked / l.length) * 100) : 0;
      return `<a class="area" href="#${s.id}"><span class="area-top"><h4>${esc(s.label)}</h4>${at.found ? `<span class="nav-flag">${at.found}</span>` : ''}</span>
        <p>${l.length ? `${num(at.checked)} of ${num(l.length)} checked` : 'Add details to unlock'}</p><span class="progress"><i style="width:${pct}%"></i></span></a>`;
    }).join('');

    return `<header class="view-head">
        <p class="eyebrow">Exposure audit${state.built ? ` · started ${new Date(state.built).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
        <h2>${esc(state.profile.name.trim())}</h2>
        <p class="blurb">${loc ? esc(loc) + ' · ' : ''}From ${plural(details, 'detail')}, Unlisted built <strong>${num(t.total)} checks</strong> across ${areaCount} areas.</p>
      </header>
      <div class="meters">
        <div class="meter">${ring(coverage, 'Audit coverage')}<p class="meter-label">Audit coverage</p><p class="meter-sub">${num(t.checked)} of ${num(t.total)} checked</p></div>
        <div class="meter is-exposure" data-level="${level[0]}"><p class="meter-num"><span data-count="${t.found}">${num(t.found)}</span></p><p class="meter-label">Open exposures</p><p class="meter-sub">Severity: ${level[1]}</p></div>
        <div class="meter">${ring(cleanup, 'Cleaned up')}<p class="meter-label">Cleaned up</p><p class="meter-sub">${num(t.resolved)} removed, locked or done</p></div>
        <div class="meter"><p class="meter-num"><span data-count="${due.length}">${num(due.length)}</span></p><p class="meter-label">Re-checks due</p><p class="meter-sub">Removed listings often come back after 90 days</p></div>
      </div>
      <section class="panel"><h3>Do these next</h3>${moveItems ? `<ol class="moves">${moveItems}</ol>` : '<p class="fine">Nothing urgent. Keep working through the sections, then come back in 90 days to re-check.</p>'}</section>
      ${due.length ? `<section class="panel"><h3>Due for a re-check</h3><ul class="due">${due.map((c) => `<li><span>${esc(c.title)}</span><button class="btn sm" type="button" data-goto="${c.sec}" data-focus="${esc(c.id)}">Show</button></li>`).join('')}</ul></section>` : ''}
      <section class="panel"><h3>What's out there</h3><p class="fine">The left column counts the people-search sites in this audit that usually publish each detail. The right column counts what you've confirmed: listings you marked, plus breaches from your scans.</p>
        <div class="table-wrap plain"><table class="xmap"><thead><tr><th scope="col">Detail</th><th scope="col">Sites that publish it</th><th scope="col">Confirmed for you</th></tr></thead><tbody>${xmap}</tbody></table></div></section>
      <div class="areas">${areas}</div>
      <section class="panel soft"><h3>If someone is stalking, threatening or harassing you</h3>
        <p class="fine">Removing listings helps, but you don't have to do it alone. If you are in immediate danger, call 911 in the US or your local emergency number.</p>
        <div class="row-actions">${linkBtn({ t: 'Safety Net tech safety guides', href: D.links.techsafety })}${x.stName ? linkBtn({ t: `${x.stName} Address Confidentiality Program`, href: G(`${x.stName} address confidentiality program`) }) : ''}${linkBtn({ t: 'StopNCII.org', href: D.links.stopncii })}</div></section>`;
  }

  // Letters
  function letterText() {
    const L = state.letter;
    const x = state.x;
    const b = D.brokers.find((v) => v.id === L.to);
    const to = L.to === '__other' ? L.other.trim() || '[Company name]' : b ? b.name : '[Company name]';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const name = state.profile.name.trim();
    const idLines = [
      `Full name: ${name}`,
      x.names.length > 1 && `Other names: ${x.names.slice(1).join('; ')}`,
      L.addr.trim() && `Mailing address: ${L.addr.trim()}`,
      (x.city || x.st) && `City and state: ${[x.city, x.st].filter(Boolean).join(', ')}`,
      x.emails.length && `Email: ${x.emails.join(', ')}`,
      x.phones.length && `Phone: ${x.phones.map(prettyPhone).join(', ')}`,
    ].filter(Boolean).map((l) => '  ' + l).join('\n');
    const sign = `\n\nSincerely,\n${name}\n${date}`;
    const kind = L.kind;
    if (kind === 'ccpa') return `Subject: Request to delete my personal information under the CCPA

To the privacy team at ${to},

I am a California resident. Under the California Consumer Privacy Act, as amended by the California Privacy Rights Act, I am exercising my rights to:

  1. Delete all personal information you hold about me, and direct your service providers and contractors to do the same (Cal. Civ. Code § 1798.105).
  2. Opt out of the sale and sharing of my personal information (§ 1798.120).
  3. Limit the use of any sensitive personal information you hold about me (§ 1798.121).

Please use the details below only to find and remove my records:

${idLines}

Please confirm in writing once my information has been deleted. The law requires a response within 45 days of receiving this request (§ 1798.130).${sign}`;
    if (kind === 'gdpr') return `Subject: Erasure request under Article 17 GDPR

To the data protection officer at ${to},

I request the erasure of all personal data you hold about me, under Article 17 of the General Data Protection Regulation (and the UK GDPR, where it applies). I also object to any processing of my personal data for direct marketing or profiling under Article 21.

Please also:
  1. Tell anyone you have disclosed my data to about this erasure (Article 19).
  2. Confirm what data you held, where you got it, and who you shared it with (Article 15).

Details to locate my records, to be used only for this request:

${idLines}

You must respond without undue delay and within one month of receiving this request (Article 12(3)).${sign.replace('Sincerely', 'Kind regards')}`;
    if (kind === 'follow') {
      const reg = x.ca ? 'the California Privacy Protection Agency and the California Attorney General' : x.us ? `${x.stName ? 'the ' + x.stName + ' Attorney General' : 'my state Attorney General'} and the Federal Trade Commission` : 'my national data protection authority';
      return `Subject: Follow-up: unanswered request to delete my personal information

To the privacy team at ${to},

On [date of your first request] I asked you to delete my personal information and remove any listing about me. I have not received a confirmation, and my information may still be published on your site.

Please complete the deletion and confirm in writing within 10 days. If I do not hear back, I will file a complaint with ${reg}.

Details to locate my records:

${idLines}${sign}`;
    }
    return `Subject: Request to delete my personal information

To the privacy team at ${to},

Please delete all personal information you hold about me, remove any profile or listing about me from your website and products, and stop selling or sharing my information.
${x.stName ? `\nI live in ${x.stName}. Where state privacy law gives me the right to access, delete or opt out, please treat this letter as exercising each of those rights.\n` : ''}
Please use the details below only to find and remove my records:

${idLines}

Please confirm in writing when this is done, and tell me if you need anything else to process it.${sign}`;
  }
  function viewLetters(sec) {
    const L = state.letter;
    if (!L.kind) L.kind = state.x.ca ? 'ccpa' : state.x.us ? 'us' : 'gdpr';
    const kinds = [['ccpa', 'California (CCPA / CPRA) deletion'], ['us', 'Deletion request, any US state'], ['gdpr', 'GDPR erasure (EU and UK)'], ['follow', 'Follow-up after no reply']];
    return `${viewHead(sec, [], 'Copy, paste, send')}
      <div class="letter">
        <div class="letter-controls">
          <div class="field"><label for="lt-to">Company</label><select id="lt-to"><option value="">Choose a company</option>${D.brokers.map((b) => `<option value="${b.id}"${L.to === b.id ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}<option value="__other"${L.to === '__other' ? ' selected' : ''}>Another company</option></select></div>
          <div class="field" id="lt-other-wrap"${L.to === '__other' ? '' : ' hidden'}><label for="lt-other">Company name</label><input id="lt-other" value="${esc(L.other)}" placeholder="Company name"></div>
          <div class="field"><label for="lt-kind">Letter</label><select id="lt-kind">${kinds.map(([v, l]) => `<option value="${v}"${L.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label for="lt-addr">Mailing address <span class="req">Optional</span></label><input id="lt-addr" value="${esc(L.addr)}" placeholder="Only if they need it to find you" autocomplete="street-address"></div>
        </div>
        <div class="letter-paper"><textarea id="lt-text" spellcheck="false" aria-label="Letter text">${esc(letterText())}</textarea></div>
        <div class="row-actions"><button class="btn primary" type="button" data-act="copy-letter">Copy letter</button>${EMBED ? '' : '<button class="btn" type="button" data-act="download-letter">Download .txt</button>'}</div>
        <p class="fine">Send it to the company's privacy email or web form, usually linked from its privacy policy. Keep a copy and note the date, then mark the site <em>Opt-out sent</em> so Unlisted can remind you to follow up.</p>
      </div>`;
  }

  // ---------------------------------------------------------------- render
  function compute() {
    state.x = derive(state.profile);
    state.checks = buildChecks(state.x);
  }
  function renderNav() {
    const nav = $('#index');
    nav.innerHTML = SECTIONS.map((s) => {
      const l = state.checks.filter((c) => c.sec === s.id);
      const t = tally(l);
      const pct = l.length ? Math.round((t.checked / l.length) * 100) : 0;
      const cur = state.view === s.id;
      const counted = s.id !== 'overview' && s.id !== 'letters';
      return `<a class="nav-item${cur ? ' is-current' : ''}" href="#${s.id}"${cur ? ' aria-current="page"' : ''}>
        <span class="nav-label">${esc(s.label)}</span>${t.found ? `<span class="nav-flag" title="${t.found} exposed">${t.found}</span>` : ''}
        ${counted ? `<span class="nav-count">${l.length}</span><span class="nav-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>` : ''}</a>`;
    }).join('');
  }
  function renderView() {
    const view = $('#view');
    const sec = SECTIONS.find((s) => s.id === state.view) || SECTIONS[0];
    view.innerHTML = sec.id === 'overview' ? viewOverview() : sec.id === 'letters' ? viewLetters(sec) : viewSection(sec);
    if (state.animate && !reduced()) {
      view.classList.remove('is-entering'); void view.offsetWidth; view.classList.add('is-entering');
      view.querySelectorAll('[data-count]').forEach(countUp);
    }
    state.animate = false;
    if (sec.id === 'photos') bindDrop();
  }
  function countUp(el) {
    const to = +el.dataset.count;
    if (!to) return;
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 700); el.textContent = num(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function renderIntake() {
    const intake = $('#intake');
    intake.dataset.mode = state.example || state.editing ? 'open' : 'strip';
    $('#cancelEdit').hidden = !(state.editing && !state.example);
    $('#exampleBanner').hidden = !state.example;
    const x = state.x;
    const bits = [[x.city, x.st].filter(Boolean).join(', '), x.emails.length && plural(x.emails.length, 'email'), x.handles.length && plural(x.handles.length, 'username'), x.phones.length && plural(x.phones.length, 'phone number')].filter(Boolean);
    $('#strip').innerHTML = `<div class="strip-id"><span class="strip-mark" aria-hidden="true"></span><div><p class="strip-name">${esc(state.profile.name)}</p><p class="strip-meta">${esc(bits.join(' · '))}</p></div></div>
      <button class="btn" type="button" data-act="edit">Edit details</button>`;
    updateLedger();
  }
  function renderAll() { compute(); renderIntake(); renderNav(); renderView(); }
  function refreshCounts() {
    renderNav();
    const sec = SECTIONS.find((s) => s.id === state.view);
    const stats = $('#viewStats');
    if (stats && sec) stats.innerHTML = statPills(tally(state.checks.filter((c) => c.sec === sec.id)));
  }

  // ---------------------------------------------------------------- intake form
  const F = { name: 'f-name', others: 'f-others', city: 'f-city', state: 'f-state', emails: 'f-emails', users: 'f-users', phones: 'f-phones' };
  function readForm() { const p = {}; for (const k in F) p[k] = document.getElementById(F[k]).value; return p; }
  function fillForm(p) { for (const k in F) document.getElementById(F[k]).value = p[k] || ''; updateLedger(); }
  function chipList(items) { return items.map(([t, cls]) => `<li class="${cls || ''}">${esc(t)}</li>`).join(''); }
  function updateLedger() {
    const p = readForm();
    const typed = splitName(p.name).first;
    const src = typed ? p : EXAMPLE;
    const x = derive(src);
    const checks = buildChecks(x);
    const d = countDetails(src);
    $('#ledgerIn').textContent = typed ? `Your ${plural(d, 'detail')}` : `Example: ${plural(d, 'detail')}`;
    $('#ledgerOut').textContent = num(checks.length);
    $('#ledgerRows').innerHTML = SECTIONS.filter((s) => s.id !== 'overview' && s.id !== 'letters').map((s) => {
      const n = checks.filter((c) => c.sec === s.id).length;
      return `<li class="${n ? '' : 'is-zero'}"><span>${esc(s.label)}</span><i aria-hidden="true"></i><b>${num(n)}</b></li>`;
    }).join('');
    // Inline previews of what each field turned into.
    const own = derive(p);
    $('#d-name').innerHTML = own.names.length > 1 ? chipList([['Also searches:', 'label']].concat(own.names.slice(1).map((n) => [n]))) : '';
    const bad = list(p.emails).filter((e) => !EMAIL_RE.test(e));
    const fromEmail = own.handles.filter((h) => h.from !== 'typed');
    $('#d-emails').innerHTML = chipList(own.emails.map((e) => [e]).concat(bad.map((e) => [`${e}: not an email`, 'is-bad']))
      .concat(fromEmail.length ? [['Usernames to check:', 'label']].concat(fromEmail.map((h) => ['@' + h.h])) : []));
    $('#d-users').innerHTML = chipList(own.handles.filter((h) => h.from === 'typed').map((h) => ['@' + h.h]));
    $('#d-phones').innerHTML = chipList(own.phones.map((d) => [prettyPhone(d)]));
  }
  function onBuild(e) {
    e.preventDefault();
    const p = readForm();
    const err = $('#formError');
    if (!splitName(p.name).first) { err.textContent = 'Enter your name to build the audit.'; err.hidden = false; $('#f-name').focus(); return; }
    err.hidden = true;
    if (state.example) { state.marks = {}; state.scans = {}; state.built = Date.now(); }
    state.profile = p;
    state.example = false;
    state.editing = false;
    save();
    state.animate = true;
    state.filter = 'all';
    state.handle = 'all';
    if (location.hash.slice(1) !== 'overview') { state.view = 'overview'; location.hash = 'overview'; }
    else state.view = 'overview';
    renderAll();
    $('#report').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    toast(`Built ${num(state.checks.length)} checks from ${plural(countDetails(p), 'detail')}.`);
  }

  // ---------------------------------------------------------------- routing
  function onRoute() {
    const v = location.hash.slice(1);
    if (!SECTION_IDS.has(v)) return;
    if (v !== state.view) { state.filter = 'all'; }
    state.view = v;
    renderNav();
    renderView();
    const focusId = state.pendingFocus;
    state.pendingFocus = null;
    const report = $('#report');
    if (focusId) {
      const el = document.getElementById('c-' + hash(focusId));
      if (el) { el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); return; }
    }
    const r = report.getBoundingClientRect();
    if (r.top < 0) report.scrollIntoView({ block: 'start' });
    $('#view').focus({ preventScroll: true });
  }
  function navigate(sec, focusId) {
    state.pendingFocus = focusId || null;
    if (location.hash.slice(1) !== sec) location.hash = sec;
    else onRoute();
  }

  // ---------------------------------------------------------------- network checks
  async function digestHex(alg, text) {
    if (!(window.crypto && crypto.subtle)) throw new Error('This browser blocks hashing on this page. Open Unlisted over https to use this check.');
    const buf = await crypto.subtle.digest(alg, new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function scanEmail(e) {
    state.busy[e] = true; state.scanErr[e] = null;
    rerenderView();
    try {
      const r = await fetch('https://api.xposedornot.com/v1/breach-analytics?email=' + enc(e));
      if (r.status === 429) throw new Error('The breach service is busy. Wait a minute, then scan again.');
      if (!r.ok && r.status !== 404) throw new Error(`The breach service returned an error (${r.status}). Try again later, or use Have I Been Pwned below.`);
      const j = r.status === 404 ? {} : await r.json();
      const raw = (j && j.ExposedBreaches && j.ExposedBreaches.breaches_details) || [];
      const breaches = raw.map((b) => ({
        n: String(b.breach || 'Unknown'), d: String(b.domain || ''), y: String(b.xposed_date || ''),
        data: String(b.xposed_data || '').split(';').map((s) => s.trim()).filter(Boolean),
        pw: String(b.password_risk || 'unknown').toLowerCase(),
      })).sort((a, b) => (parseInt(b.y, 10) || 0) - (parseInt(a.y, 10) || 0));
      let gravatar = null;
      try {
        const h = await digestHex('SHA-256', e.trim().toLowerCase());
        const g = await fetch(`https://gravatar.com/avatar/${h}?d=404&s=8`);
        gravatar = g.ok ? h : false;
      } catch (err) { gravatar = null; }
      state.scans[e] = { at: Date.now(), breaches, gravatar };
      save();
      toast(breaches.length ? `${plural(breaches.length, 'breach', 'breaches')} found for ${e}.` : `No known breaches for ${e}.`);
    } catch (err) {
      state.scanErr[e] = err instanceof TypeError ? 'Could not reach the breach service. Check your connection, or use Have I Been Pwned below.' : err.message;
    }
    state.busy[e] = false;
    compute();
    renderNav();
    rerenderView();
  }
  async function checkPassword(pw) {
    const h = (await digestHex('SHA-1', pw)).toUpperCase();
    const r = await fetch('https://api.pwnedpasswords.com/range/' + h.slice(0, 5), { headers: { 'Add-Padding': 'true' } });
    if (!r.ok) throw new Error(`The password service returned an error (${r.status}). Try again later.`);
    const suffix = h.slice(5);
    for (const line of (await r.text()).split('\n')) {
      const [s, c] = line.trim().split(':');
      if (s === suffix) return parseInt(c, 10) || 0;
    }
    return 0;
  }
  function rerenderView() {
    const y = window.scrollY;
    renderView();
    window.scrollTo(0, y);
  }

  // ---------------------------------------------------------------- photo metadata
  function readExif(buf) {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return { type: 'not-jpeg' };
    let off = 2;
    while (off + 4 <= v.byteLength) {
      if (v.getUint8(off) !== 0xff) break;
      const marker = v.getUint8(off + 1);
      if (marker === 0xda || marker === 0xd9) break;
      const len = v.getUint16(off + 2);
      if (marker === 0xe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966 && v.getUint16(off + 8) === 0) return parseTiff(v, off + 10);
      off += 2 + len;
    }
    return { type: 'none' };
  }
  function parseTiff(v, t) {
    if (t + 8 > v.byteLength) return { type: 'none' };
    const le = v.getUint16(t) === 0x4949;
    const u16 = (o) => v.getUint16(t + o, le);
    const u32 = (o) => v.getUint32(t + o, le);
    if (u16(2) !== 42) return { type: 'none' };
    const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const readIFD = (o) => {
      const res = {};
      if (!o || t + o + 2 > v.byteLength) return res;
      const n = u16(o);
      for (let i = 0; i < n; i++) {
        const e = o + 2 + i * 12;
        if (t + e + 12 > v.byteLength) break;
        const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
        const total = (SIZE[type] || 0) * count;
        if (!total || total > 1e6) continue;
        const vo = total > 4 ? u32(e + 8) : e + 8;
        if (t + vo + total > v.byteLength) continue;
        if (type === 2) { let s = ''; for (let k = 0; k < count; k++) { const c = v.getUint8(t + vo + k); if (!c) break; s += String.fromCharCode(c); } res[tag] = s.trim(); }
        else if (type === 3) res[tag] = u16(vo);
        else if (type === 4) res[tag] = u32(vo);
        else if (type === 5) res[tag] = Array.from({ length: count }, (_, k) => { const d = u32(vo + 8 * k + 4); return d ? u32(vo + 8 * k) / d : 0; });
      }
      return res;
    };
    const ifd0 = readIFD(u32(4));
    const exif = readIFD(ifd0[0x8769]);
    const gpsIfd = readIFD(ifd0[0x8825]);
    const dms = (a) => (Array.isArray(a) && a.length >= 3 ? a[0] + a[1] / 60 + a[2] / 3600 : NaN);
    let gps = null;
    const lat = dms(gpsIfd[2]), lon = dms(gpsIfd[4]);
    if (isFinite(lat) && isFinite(lon) && (lat || lon)) {
      gps = { lat: /S/i.test(gpsIfd[1] || '') ? -lat : lat, lon: /W/i.test(gpsIfd[3] || '') ? -lon : lon };
    }
    return { type: 'exif', gps, make: ifd0[0x010f] || '', model: ifd0[0x0110] || '', software: ifd0[0x0131] || '', taken: exif[0x9003] || ifd0[0x0132] || '' };
  }
  async function scanPhotos(files) {
    for (const file of Array.from(files).slice(0, 20)) {
      let info;
      try { info = readExif(await file.arrayBuffer()); } catch (e) { info = { type: 'error', message: 'Could not read this file.' }; }
      if (info.model && info.make && info.model.toLowerCase().startsWith(info.make.toLowerCase())) info.make = '';
      state.photos.unshift({ name: file.name, url: URL.createObjectURL(file), file, info });
    }
    rerenderView();
    const gps = state.photos.filter((p) => p.info.gps).length;
    toast(gps ? `${plural(gps, 'photo')} carry a location.` : 'No locations found in those photos.');
  }
  function cleanCopy(i) {
    const p = state.photos[i];
    if (!p) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob((blob) => { if (blob) download(p.name.replace(/\.[^.]+$/, '') + '-clean.jpg', blob); }, 'image/jpeg', 0.92);
    };
    img.src = p.url;
  }
  function bindDrop() {
    const drop = $('#drop');
    if (!drop) return;
    const input = $('#photoIn');
    input.addEventListener('change', () => { if (input.files.length) scanPhotos(input.files); });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, () => drop.classList.add('is-over')));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  }

  // ---------------------------------------------------------------- files, clipboard, toast
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function copyText(text, btn) {
    const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1400); } toast('Copied to clipboard.'); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) done(); else toast('Copying is blocked here. Select the text and copy it yourself.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  // ---------------------------------------------------------------- backup, print, reminders
  function backup() { return JSON.stringify({ app: 'unlisted', v: 1, exported: new Date().toISOString(), profile: state.profile, marks: state.marks, scans: state.scans, built: state.built }, null, 2); }
  function restore(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { toast("That file isn't a valid backup."); return; }
    if (!j || j.app !== 'unlisted' || !j.profile || typeof j.profile.name !== 'string') { toast("That file isn't an Unlisted backup."); return; }
    state.profile = Object.assign({}, EMPTY, j.profile);
    state.marks = j.marks && typeof j.marks === 'object' ? j.marks : {};
    state.scans = j.scans && typeof j.scans === 'object' ? j.scans : {};
    state.built = j.built || Date.now();
    state.example = false; state.editing = false;
    save();
    fillForm(state.profile);
    renderAll();
    toast('Backup restored.');
  }
  function printReport() {
    const t = tally(state.checks);
    const pick = (fn) => state.checks.filter(fn);
    const open = pick((c) => statusOf(c) === 'found' || statusOf(c) === 'requested' || (c.exposed && statusOf(c) === 'todo'));
    const done = pick((c) => RESOLVED.has(statusOf(c)));
    const table = (items) => items.length ? `<table><thead><tr><th>Item</th><th>Area</th><th>Status</th><th>Link</th></tr></thead><tbody>${items.map((c) => {
      const l = c.links.find((v) => v.primary) || c.links[0];
      return `<tr><td>${esc(c.title)}${c.handle ? ' (@' + esc(c.handle) + ')' : ''}</td><td>${esc(SECTIONS.find((s) => s.id === c.sec).label)}</td><td>${esc(c.exposed && statusOf(c) === 'todo' ? 'Exposed' : statusLabel(c, statusOf(c)))}</td><td>${l ? esc(l.href) : ''}</td></tr>`;
    }).join('')}</tbody></table>` : '<p>None.</p>';
    $('#print').innerHTML = `<h1>Unlisted exposure report</h1><p><strong>${esc(state.profile.name)}</strong> · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p>${num(t.checked)} of ${num(t.total)} checks done · ${num(open.length)} open · ${num(done.length)} resolved</p>
      <h2>Still exposed or in progress</h2>${table(open)}<h2>Removed, locked or done</h2>${table(done)}`;
    window.print();
  }
  function reminder() {
    const d = new Date(Date.now() + 90 * DAY);
    const p = (n) => String(n).padStart(2, '0');
    const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Unlisted//Self audit//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@unlisted`, `DTSTAMP:${stamp}`,
      `DTSTART:${day}T090000`, 'DURATION:PT30M', 'SUMMARY:Re-check your Unlisted privacy audit',
      'DESCRIPTION:People-search sites often relist removed records. Open Unlisted and re-check everything marked Removed or Not listed.',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    download('unlisted-recheck.ics', ics, 'text/calendar');
  }
  function loadExample() {
    const now = Date.now();
    state.profile = Object.assign({}, EXAMPLE);
    state.example = true;
    state.scans = {};
    state.built = 0;
    const m = (s, d) => ({ s, t: now - d * DAY });
    state.marks = {
      'broker:whitepages': m('found', 1), 'broker:spokeo': m('requested', 3), 'broker:beenverified': m('removed', 20),
      'broker:peopleconnect': m('found', 1), 'broker:fastpeoplesearch': m('clear', 2), 'broker:truepeoplesearch': m('found', 2),
      'freeze-equifax': m('done', 30), 'freeze-experian': m('done', 30), 'acct:instagram:jordanellis': m('found', 4),
      'acct:github:jordanellis': m('clear', 4), 'acct:reddit:jordanellis': m('locked', 6), 'q:name-loc': m('found', 2),
      'tag:ig:jordanellis': m('found', 5), 'tagset:ig': m('done', 5),
    };
  }

  // ---------------------------------------------------------------- theme
  function applyTheme(t) { if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; }
  function toggleTheme() {
    const r = document.documentElement;
    const cur = r.dataset.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    r.dataset.theme = next;
    store.set(THEME_KEY, next);
  }

  // ---------------------------------------------------------------- events
  function closeMenu() { $('#menuList').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }
  function bind() {
    const form = $('#intakeForm');
    form.addEventListener('submit', onBuild);
    // Update synchronously: a delayed update can shift the Build button between press and release.
    form.addEventListener('input', updateLedger);
    window.addEventListener('hashchange', onRoute);
    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#menuBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const open = $('#menuList').hidden;
      $('#menuList').hidden = !open;
      $('#menuBtn').setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeMenu();
      if (!$('#confirm').hidden) { $('#confirm').hidden = true; }
    });
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) file.text().then(restore);
      e.target.value = '';
    });

    $('#view').addEventListener('change', (e) => {
      const sel = e.target.closest('select.status');
      if (sel) {
        const id = sel.dataset.id;
        const prev = state.marks[id] ? state.marks[id].s : 'todo';
        setMark(id, sel.value);
        const r = sel.closest('.row');
        r.dataset.state = sel.value;
        const c = state.checks.find((v) => v.id === id);
        r.querySelector('.since').textContent = sel.value === 'todo' ? '' : `${statusLabel(c, sel.value)} today`;
        if (sel.value !== prev && !reduced()) { r.classList.remove('just'); void r.offsetWidth; r.classList.add('just'); }
        refreshCounts();
        return;
      }
      const lt = e.target.closest('#lt-to, #lt-kind');
      if (lt) {
        state.letter.to = $('#lt-to').value;
        state.letter.kind = $('#lt-kind').value;
        $('#lt-other-wrap').hidden = state.letter.to !== '__other';
        $('#lt-text').value = letterText();
      }
    });
    $('#view').addEventListener('input', (e) => {
      if (e.target.id === 'lt-other' || e.target.id === 'lt-addr') {
        state.letter.other = $('#lt-other').value;
        state.letter.addr = $('#lt-addr').value;
        $('#lt-text').value = letterText();
      }
    });
    $('#view').addEventListener('submit', (e) => {
      if (e.target.id !== 'pwForm') return;
      e.preventDefault();
      const input = $('#pw');
      const pw = input.value;
      if (!pw) { input.focus(); return; }
      $('#pwOut').innerHTML = '<p class="scan-status" role="status">Checking…</p>';
      checkPassword(pw).then((count) => { state.pwResult = { count }; }, (err) => {
        state.pwResult = { error: err instanceof TypeError ? 'Could not reach Pwned Passwords. Check your connection and try again.' : err.message };
      }).then(() => { input.value = ''; rerenderView(); });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu')) closeMenu();
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) { copyText(copyBtn.dataset.copy, copyBtn); return; }
      const f = e.target.closest('[data-filter]');
      if (f) { state.filter = f.dataset.filter; rerenderView(); return; }
      const hb = e.target.closest('[data-handle]');
      if (hb) { state.handle = hb.dataset.handle; rerenderView(); return; }
      const go = e.target.closest('[data-goto]');
      if (go) { navigate(go.dataset.goto, go.dataset.focus); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'scan') scanEmail(a.dataset.email);
      else if (act === 'toggle-all') { state.showAll[a.dataset.email] = !state.showAll[a.dataset.email]; rerenderView(); }
      else if (act === 'pw-show') { const i = $('#pw'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; a.textContent = show ? 'Hide' : 'Show'; a.setAttribute('aria-pressed', String(show)); }
      else if (act === 'clean') cleanCopy(+a.dataset.i);
      else if (act === 'copy-letter') copyText($('#lt-text').value, a);
      else if (act === 'download-letter') download('unlisted-letter.txt', $('#lt-text').value);
      else if (act === 'edit') { state.editing = true; fillForm(state.profile); renderIntake(); $('#intake').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); $('#f-name').focus({ preventScroll: true }); }
      else if (act === 'cancel-edit') { state.editing = false; renderIntake(); }
      else if (act === 'to-form') { e.preventDefault(); $('#intake').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); $('#f-name').focus({ preventScroll: true }); }
      else if (act === 'export') { closeMenu(); download(`unlisted-backup-${new Date().toISOString().slice(0, 10)}.json`, backup(), 'application/json'); }
      else if (act === 'copy-backup') { closeMenu(); copyText(backup()); }
      else if (act === 'import') { closeMenu(); $('#importFile').click(); }
      else if (act === 'print') { closeMenu(); printReport(); }
      else if (act === 'ics') { closeMenu(); reminder(); }
      else if (act === 'reset') { closeMenu(); $('#confirm').hidden = false; $('#confirm .btn').focus(); }
      else if (act === 'cancel-reset') $('#confirm').hidden = true;
      else if (act === 'do-reset') {
        $('#confirm').hidden = true;
        store.del(KEY);
        state.photos.forEach((p) => URL.revokeObjectURL(p.url));
        Object.assign(state, { photos: [], pwResult: null, busy: {}, scanErr: {}, showAll: {}, editing: false, view: 'overview', filter: 'all', handle: 'all' });
        loadExample();
        fillForm(EMPTY);
        if (location.hash.slice(1) !== 'overview') location.hash = 'overview';
        renderAll();
        window.scrollTo(0, 0);
        toast('Erased. Nothing about you is stored in this browser now.');
      }
    });
    $('.brand').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }));
  }

  // ---------------------------------------------------------------- boot
  function init() {
    if (EMBED) document.querySelectorAll('[data-full]').forEach((el) => el.remove());
    applyTheme(store.get(THEME_KEY));
    $('#f-state').innerHTML = '<option value="">Choose a state</option>' + D.states.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('') + '<option value="XX">Outside the US</option>';
    const saved = store.get(KEY);
    if (saved && saved.profile && splitName(saved.profile.name).first) {
      state.profile = Object.assign({}, EMPTY, saved.profile);
      state.marks = saved.marks || {};
      state.scans = saved.scans || {};
      state.built = saved.built || Date.now();
      state.example = false;
      fillForm(state.profile);
    } else {
      loadExample();
      fillForm(EMPTY);
    }
    const h = location.hash.slice(1);
    state.view = SECTION_IDS.has(h) ? h : 'overview';
    renderAll();
    bind();
  }
  init();
})();
