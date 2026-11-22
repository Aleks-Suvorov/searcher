/*
 * Unlisted: catalog data.
 *
 * Everything here is static reference data: where personal details tend to
 * surface, and how to get them removed. Nothing in this file (or anywhere in
 * Unlisted) is a record about a person. Opt-out links were checked in
 * November 2026; brokers change their forms often, so re-check before relying
 * on one.
 */
window.UNLISTED_DATA = (function () {
  'use strict';

  const enc = encodeURIComponent;
  const dash = (s) => s.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const low = (s) => dash(s).toLowerCase();

  // Detail types a source can expose. Order matters: it is the display order.
  const exposes = {
    address: 'Home address',
    history: 'Past addresses',
    phone: 'Phone',
    email: 'Email',
    age: 'Age or birth year',
    relatives: 'Relatives',
    associates: 'Associates',
    court: 'Court records',
    property: 'Property',
    job: 'Employer',
    social: 'Social profiles',
    photos: 'Photos',
  };

  /*
   * People-search sites and data brokers.
   * tier: 1 = biggest reach, 2 = smaller sites, 'source' = sells data to the
   * others, 'pro' = professional/B2B directories.
   * diff: removal effort, 1 easy to 3 hard. mins: typical minutes.
   * search(ctx): direct results URL when the site's URL scheme is stable;
   * otherwise Unlisted falls back to a Google site: search.
   */
  const brokers = [
    {
      id: 'whitepages', name: 'Whitepages', domain: 'whitepages.com', tier: 1,
      exposes: ['address', 'phone', 'age', 'relatives', 'history'], diff: 2, mins: 6,
      needs: ['Listing URL', 'Phone call'],
      optout: 'https://www.whitepages.com/suppression-requests',
      search: (c) => c.last && `https://www.whitepages.com/name/${dash(c.first)}-${dash(c.last)}${c.city && c.st ? `/${dash(c.city)}-${c.st}` : ''}`,
      note: 'Paste the URL of your listing, then confirm with the automated phone call they place.',
    },
    {
      id: 'spokeo', name: 'Spokeo', domain: 'spokeo.com', tier: 1,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'social', 'history'], diff: 1, mins: 4,
      needs: ['Listing URL', 'Email'],
      optout: 'https://www.spokeo.com/optout',
      search: (c) => c.last && `https://www.spokeo.com/${dash(c.first)}-${dash(c.last)}`,
      note: 'Paste each listing URL (you may have several) and click the link in the confirmation email.',
    },
    {
      id: 'beenverified', name: 'BeenVerified', domain: 'beenverified.com', tier: 1,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'court', 'social', 'history'], diff: 1, mins: 5,
      needs: ['Email'],
      optout: 'https://www.beenverified.com/app/optout/search',
      note: 'Search yourself on the opt-out page, pick your record, and confirm by email.',
    },
    {
      id: 'peopleconnect', name: 'PeopleConnect family', domain: 'intelius.com', tier: 1,
      covers: ['Intelius', 'Instant Checkmate', 'TruthFinder', 'US Search', 'ZabaSearch'],
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'court', 'history'], diff: 2, mins: 8,
      needs: ['Email', 'Date of birth'],
      optout: 'https://suppression.peopleconnect.us/login',
      note: 'One suppression request covers all five sites. Verify your email, then select every record that is you.',
    },
    {
      id: 'fastpeoplesearch', name: 'FastPeopleSearch', domain: 'fastpeoplesearch.com', tier: 1,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'associates', 'history'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.fastpeoplesearch.com/removal',
      search: (c) => c.last && `https://www.fastpeoplesearch.com/name/${low(c.first)}-${low(c.last)}${c.city && c.st ? `_${low(c.city)}-${c.st.toLowerCase()}` : ''}`,
      note: 'Find your record from the removal page, then click the link in the confirmation email.',
    },
    {
      id: 'truepeoplesearch', name: 'TruePeopleSearch', domain: 'truepeoplesearch.com', tier: 1,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'associates', 'history'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.truepeoplesearch.com/removal',
      search: (c) => c.last && `https://www.truepeoplesearch.com/results?name=${enc(c.first + ' ' + c.last)}${c.city && c.st ? `&citystatezip=${enc(c.city + ', ' + c.st)}` : ''}`,
      note: 'Search from the removal page, open your record and choose Remove This Record.',
    },
    {
      id: 'radaris', name: 'Radaris', domain: 'radaris.com', tier: 1,
      exposes: ['address', 'phone', 'age', 'relatives', 'job', 'property', 'history'], diff: 3, mins: 15,
      needs: ['Account', 'Phone or email'],
      optout: 'https://radaris.com/page/how-to-remove',
      search: (c) => c.last && `https://radaris.com/p/${dash(c.first)}/${dash(c.last)}/`,
      note: 'One of the slower removals. It can ask you to create an account before it hides a profile.',
    },
    {
      id: 'peoplefinders', name: 'PeopleFinders', domain: 'peoplefinders.com', tier: 1,
      exposes: ['address', 'phone', 'age', 'relatives', 'court', 'history'], diff: 1, mins: 5,
      needs: ['Email'],
      optout: 'https://www.peoplefinders.com/opt-out',
      note: 'Search for your record on the opt-out page, then confirm by email.',
    },
    {
      id: 'nuwber', name: 'Nuwber', domain: 'nuwber.com', tier: 2,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'history'], diff: 1, mins: 4,
      needs: ['Listing URL', 'Email'],
      optout: 'https://nuwber.com/removal/link',
      search: (c) => c.last && `https://nuwber.com/search?name=${enc(c.first + ' ' + c.last)}`,
      note: 'Paste your profile URL, then confirm from the email they send.',
    },
    {
      id: 'thatsthem', name: "That's Them", domain: 'thatsthem.com', tier: 2,
      exposes: ['address', 'phone', 'email', 'age'], diff: 1, mins: 4,
      needs: ['Details from your record'],
      optout: 'https://thatsthem.com/optout',
      search: (c) => c.last && `https://thatsthem.com/name/${dash(c.first)}-${dash(c.last)}`,
      note: 'Fill in the opt-out form with the same details your record shows.',
    },
    {
      id: 'usphonebook', name: 'USPhoneBook', domain: 'usphonebook.com', tier: 2,
      exposes: ['address', 'phone', 'relatives'], diff: 1, mins: 3,
      needs: ['Email'],
      optout: 'https://www.usphonebook.com/opt-out',
      note: 'Look yourself up on the opt-out page and confirm by email.',
    },
    {
      id: 'familytreenow', name: 'FamilyTreeNow', domain: 'familytreenow.com', tier: 2,
      exposes: ['address', 'age', 'relatives', 'history'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.familytreenow.com/optout',
      search: (c) => c.last && `https://www.familytreenow.com/search/genealogy/results?first=${enc(c.first)}&last=${enc(c.last)}`,
      note: 'Find your record from the opt-out page and choose Remove Record.',
    },
    {
      id: 'searchpeoplefree', name: 'SearchPeopleFree', domain: 'searchpeoplefree.com', tier: 2,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'history'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.searchpeoplefree.com/opt-out',
      note: 'Search from the opt-out page, select your record, then confirm by email.',
    },
    {
      id: 'cyberbackgroundchecks', name: 'CyberBackgroundChecks', domain: 'cyberbackgroundchecks.com', tier: 2,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'history'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.cyberbackgroundchecks.com/removal',
      note: 'Find your record from the removal page and confirm the removal email.',
    },
    {
      id: 'advancedbackgroundchecks', name: 'AdvancedBackgroundChecks', domain: 'advancedbackgroundchecks.com', tier: 2,
      exposes: ['address', 'phone', 'email', 'age', 'relatives', 'history'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.advancedbackgroundchecks.com/removal',
      note: 'Find your record from the removal page and confirm the removal email.',
    },
    {
      id: 'peoplesearchnow', name: 'PeopleSearchNow', domain: 'peoplesearchnow.com', tier: 2,
      exposes: ['address', 'phone', 'age', 'relatives'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.peoplesearchnow.com/opt-out',
      note: 'Search from the opt-out page and confirm by email.',
    },
    {
      id: 'smartbackgroundchecks', name: 'Smart Background Checks', domain: 'smartbackgroundchecks.com', tier: 2,
      exposes: ['address', 'phone', 'email', 'age', 'relatives'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.smartbackgroundchecks.com/remove',
      note: 'Find your record from the removal page and confirm by email.',
    },
    {
      id: 'usapeoplesearch', name: 'USA People Search', domain: 'usa-people-search.com', tier: 2,
      exposes: ['address', 'phone', 'age', 'relatives'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.usa-people-search.com/removal',
      note: 'Search from the removal page and confirm by email.',
    },
    {
      id: 'peekyou', name: 'PeekYou', domain: 'peekyou.com', tier: 2,
      exposes: ['social', 'photos', 'job', 'age'], diff: 2, mins: 6,
      needs: ['Profile URL', 'Email'],
      optout: 'https://www.peekyou.com/about/contact/optout/',
      search: (c) => c.last && `https://www.peekyou.com/${low(c.first).replace(/-/g, '_')}_${low(c.last).replace(/-/g, '_')}`,
      note: 'PeekYou links your social profiles together. Submit the profile URL from its opt-out form.',
    },
    {
      id: 'checkpeople', name: 'CheckPeople', domain: 'checkpeople.com', tier: 2,
      exposes: ['address', 'phone', 'age', 'relatives', 'court'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://checkpeople.com/opt-out',
      note: 'Search from the opt-out page and confirm by email.',
    },
    {
      id: 'infotracer', name: 'InfoTracer', domain: 'infotracer.com', tier: 2,
      exposes: ['address', 'phone', 'court', 'property'], diff: 2, mins: 6,
      needs: ['Email'],
      optout: 'https://infotracer.com/optout/',
      note: 'Fill in the opt-out form and confirm the email.',
    },
    {
      id: 'neighborreport', name: 'Neighbor.Report', domain: 'neighbor.report', tier: 2,
      exposes: ['address', 'phone', 'age'], diff: 1, mins: 3,
      needs: ['Listing URL'],
      optout: 'https://neighbor.report/remove',
      note: 'Paste the URL of your listing into the removal form.',
    },
    {
      id: 'locatefamily', name: 'LocateFamily', domain: 'locatefamily.com', tier: 2,
      exposes: ['address', 'phone'], diff: 1, mins: 3,
      needs: ['Listing URL', 'Email'],
      optout: 'https://www.locatefamily.com/removal.html',
      note: 'Paste the URL of your listing and confirm by email.',
    },
    {
      id: 'privateeye', name: 'Private Eye', domain: 'privateeye.com', tier: 2,
      exposes: ['address', 'phone', 'age', 'relatives'], diff: 2, mins: 5,
      needs: ['Details from your record'],
      optout: 'https://privateeye.com/removal',
      note: 'Fill in the removal form with the details shown on your record.',
    },
    {
      id: 'searchquarry', name: 'SearchQuarry', domain: 'searchquarry.com', tier: 2,
      exposes: ['address', 'phone', 'court'], diff: 2, mins: 5,
      needs: ['Email'],
      optout: 'https://www.searchquarry.com/privacy-choices/',
      note: 'Use the privacy choices page to request removal.',
    },
    {
      id: 'verecor', name: 'Verecor', domain: 'verecor.com', tier: 2,
      exposes: ['address', 'phone', 'age', 'relatives'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://www.verecor.com/ng/control/privacy',
      note: 'Search for your record from the privacy page and confirm by email.',
    },
    {
      id: '411locate', name: '411Locate', domain: '411locate.com', tier: 2,
      exposes: ['address', 'phone'], diff: 1, mins: 3,
      needs: ['Listing URL'],
      optout: 'https://www.411locate.com/opt-out',
      note: 'Paste your listing URL into the opt-out form.',
    },
    {
      id: 'acxiom', name: 'Acxiom', domain: 'acxiom.com', tier: 'source',
      exposes: ['address', 'phone', 'email', 'age'], diff: 1, mins: 5,
      needs: ['Name and address'],
      optout: 'https://isapps.acxiom.com/optout/optout.aspx',
      note: 'One of the largest marketing data brokers. It sells to other companies, so it has no public search. Opt out directly.',
    },
    {
      id: 'lexisnexis', name: 'LexisNexis', domain: 'lexisnexis.com', tier: 'source',
      exposes: ['address', 'phone', 'history', 'court', 'property'], diff: 2, mins: 8,
      needs: ['Name, address, date of birth'],
      optout: 'https://optout.lexisnexis.com/',
      note: 'Supplies records to background-check and people-search companies. Opting out here cuts off data at the source.',
    },
    {
      id: 'zoominfo', name: 'ZoomInfo', domain: 'zoominfo.com', tier: 'pro',
      exposes: ['email', 'phone', 'job'], diff: 1, mins: 4,
      needs: ['Work email'],
      optout: 'https://www.zoominfo.com/trust-center/your-privacy',
      note: 'A sales directory of work contact details. Request removal of your profile.',
    },
    {
      id: 'rocketreach', name: 'RocketReach', domain: 'rocketreach.co', tier: 'pro',
      exposes: ['email', 'phone', 'job', 'social'], diff: 1, mins: 4,
      needs: ['Email'],
      optout: 'https://rocketreach.co/remove-profile',
      note: 'A sales directory that guesses personal and work emails. Remove your profile.',
    },
  ];

  /*
   * Platforms checked for each handle. url(h) is the public profile address.
   * del: where to delete the account, when there is a stable page for it.
   */
  const platforms = [
    // Social
    { id: 'instagram', name: 'Instagram', cat: 'social', url: (h) => `https://www.instagram.com/${h}/`, del: 'https://accountscenter.instagram.com/personal_info' },
    { id: 'x', name: 'X (Twitter)', cat: 'social', url: (h) => `https://x.com/${h}`, del: 'https://x.com/settings/deactivate' },
    { id: 'tiktok', name: 'TikTok', cat: 'social', url: (h) => `https://www.tiktok.com/@${h}`, delNote: 'Delete in the app: Profile, Settings and privacy, Account, Deactivate or delete account.' },
    { id: 'facebook', name: 'Facebook', cat: 'social', url: (h) => `https://www.facebook.com/${h}`, del: 'https://accountscenter.facebook.com/personal_info' },
    { id: 'threads', name: 'Threads', cat: 'social', url: (h) => `https://www.threads.net/@${h}` },
    { id: 'reddit', name: 'Reddit', cat: 'social', url: (h) => `https://www.reddit.com/user/${h}/`, del: 'https://www.reddit.com/settings/account' },
    { id: 'snapchat', name: 'Snapchat', cat: 'social', url: (h) => `https://www.snapchat.com/add/${h}`, del: 'https://accounts.snapchat.com/accounts/delete_account' },
    { id: 'pinterest', name: 'Pinterest', cat: 'social', url: (h) => `https://www.pinterest.com/${h}/`, del: 'https://www.pinterest.com/settings/account-settings' },
    { id: 'tumblr', name: 'Tumblr', cat: 'social', url: (h) => `https://www.tumblr.com/${h}`, del: 'https://www.tumblr.com/settings/account' },
    { id: 'linkedin', name: 'LinkedIn', cat: 'social', url: (h) => `https://www.linkedin.com/in/${h}/`, del: 'https://www.linkedin.com/mypreferences/d/close-account' },
    { id: 'bluesky', name: 'Bluesky', cat: 'social', url: (h) => `https://bsky.app/profile/${h}.bsky.social` },
    { id: 'mastodon', name: 'Mastodon (mastodon.social)', cat: 'social', url: (h) => `https://mastodon.social/@${h}` },
    { id: 'telegram', name: 'Telegram', cat: 'social', url: (h) => `https://t.me/${h}` },
    { id: 'vsco', name: 'VSCO', cat: 'social', url: (h) => `https://vsco.co/${h}/gallery` },
    { id: 'quora', name: 'Quora', cat: 'social', url: (h) => `https://www.quora.com/profile/${h}` },
    { id: 'linktree', name: 'Linktree', cat: 'social', url: (h) => `https://linktr.ee/${h}` },
    { id: 'aboutme', name: 'About.me', cat: 'social', url: (h) => `https://about.me/${h}` },
    { id: 'gravatarprofile', name: 'Gravatar', cat: 'social', url: (h) => `https://gravatar.com/${h}` },

    // Video and streaming
    { id: 'youtube', name: 'YouTube', cat: 'video', url: (h) => `https://www.youtube.com/@${h}`, del: 'https://myaccount.google.com/delete-services-or-account' },
    { id: 'twitch', name: 'Twitch', cat: 'video', url: (h) => `https://www.twitch.tv/${h}`, del: 'https://www.twitch.tv/user/delete-account' },
    { id: 'kick', name: 'Kick', cat: 'video', url: (h) => `https://kick.com/${h}` },
    { id: 'vimeo', name: 'Vimeo', cat: 'video', url: (h) => `https://vimeo.com/${h}` },
    { id: 'rumble', name: 'Rumble', cat: 'video', url: (h) => `https://rumble.com/user/${h}` },
    { id: 'dailymotion', name: 'Dailymotion', cat: 'video', url: (h) => `https://www.dailymotion.com/${h}` },

    // Creative
    { id: 'behance', name: 'Behance', cat: 'creative', url: (h) => `https://www.behance.net/${h}` },
    { id: 'dribbble', name: 'Dribbble', cat: 'creative', url: (h) => `https://dribbble.com/${h}` },
    { id: 'deviantart', name: 'DeviantArt', cat: 'creative', url: (h) => `https://www.deviantart.com/${h}` },
    { id: 'artstation', name: 'ArtStation', cat: 'creative', url: (h) => `https://www.artstation.com/${h}` },
    { id: 'flickr', name: 'Flickr', cat: 'creative', url: (h) => `https://www.flickr.com/people/${h}/` },
    { id: 'unsplash', name: 'Unsplash', cat: 'creative', url: (h) => `https://unsplash.com/@${h}` },
    { id: '500px', name: '500px', cat: 'creative', url: (h) => `https://500px.com/p/${h}` },
    { id: 'sketchfab', name: 'Sketchfab', cat: 'creative', url: (h) => `https://sketchfab.com/${h}` },
    { id: 'imgur', name: 'Imgur', cat: 'creative', url: (h) => `https://imgur.com/user/${h}` },

    // Writing and publishing
    { id: 'medium', name: 'Medium', cat: 'writing', url: (h) => `https://medium.com/@${h}`, del: 'https://medium.com/me/settings/account' },
    { id: 'substack', name: 'Substack', cat: 'writing', url: (h) => `https://${h}.substack.com` },
    { id: 'wattpad', name: 'Wattpad', cat: 'writing', url: (h) => `https://www.wattpad.com/user/${h}` },
    { id: 'ao3', name: 'Archive of Our Own', cat: 'writing', url: (h) => `https://archiveofourown.org/users/${h}` },
    { id: 'wikipedia', name: 'Wikipedia', cat: 'writing', url: (h) => `https://en.wikipedia.org/wiki/User:${h}` },
    { id: 'fandom', name: 'Fandom', cat: 'writing', url: (h) => `https://community.fandom.com/wiki/User:${h}` },
    { id: 'letterboxd', name: 'Letterboxd', cat: 'writing', url: (h) => `https://letterboxd.com/${h}/` },
    { id: 'myanimelist', name: 'MyAnimeList', cat: 'writing', url: (h) => `https://myanimelist.net/profile/${h}` },
    { id: 'tripadvisor', name: 'Tripadvisor', cat: 'writing', url: (h) => `https://www.tripadvisor.com/Profile/${h}` },

    // Music and audio
    { id: 'soundcloud', name: 'SoundCloud', cat: 'music', url: (h) => `https://soundcloud.com/${h}` },
    { id: 'bandcamp', name: 'Bandcamp', cat: 'music', url: (h) => `https://${h}.bandcamp.com` },
    { id: 'mixcloud', name: 'Mixcloud', cat: 'music', url: (h) => `https://www.mixcloud.com/${h}/` },
    { id: 'lastfm', name: 'Last.fm', cat: 'music', url: (h) => `https://www.last.fm/user/${h}` },
    { id: 'genius', name: 'Genius', cat: 'music', url: (h) => `https://genius.com/${h}` },

    // Developer
    { id: 'github', name: 'GitHub', cat: 'dev', url: (h) => `https://github.com/${h}`, del: 'https://github.com/settings/admin' },
    { id: 'gitlab', name: 'GitLab', cat: 'dev', url: (h) => `https://gitlab.com/${h}` },
    { id: 'bitbucket', name: 'Bitbucket', cat: 'dev', url: (h) => `https://bitbucket.org/${h}/` },
    { id: 'devto', name: 'DEV Community', cat: 'dev', url: (h) => `https://dev.to/${h}` },
    { id: 'hackernews', name: 'Hacker News', cat: 'dev', url: (h) => `https://news.ycombinator.com/user?id=${h}` },
    { id: 'npm', name: 'npm', cat: 'dev', url: (h) => `https://www.npmjs.com/~${h}` },
    { id: 'pypi', name: 'PyPI', cat: 'dev', url: (h) => `https://pypi.org/user/${h}/` },
    { id: 'dockerhub', name: 'Docker Hub', cat: 'dev', url: (h) => `https://hub.docker.com/u/${h}` },
    { id: 'huggingface', name: 'Hugging Face', cat: 'dev', url: (h) => `https://huggingface.co/${h}` },
    { id: 'kaggle', name: 'Kaggle', cat: 'dev', url: (h) => `https://www.kaggle.com/${h}` },
    { id: 'replit', name: 'Replit', cat: 'dev', url: (h) => `https://replit.com/@${h}` },
    { id: 'codepen', name: 'CodePen', cat: 'dev', url: (h) => `https://codepen.io/${h}` },
    { id: 'leetcode', name: 'LeetCode', cat: 'dev', url: (h) => `https://leetcode.com/u/${h}/` },
    { id: 'keybase', name: 'Keybase', cat: 'dev', url: (h) => `https://keybase.io/${h}` },
    { id: 'producthunt', name: 'Product Hunt', cat: 'dev', url: (h) => `https://www.producthunt.com/@${h}` },
    { id: 'pastebin', name: 'Pastebin', cat: 'dev', url: (h) => `https://pastebin.com/u/${h}` },

    // Gaming
    { id: 'steam', name: 'Steam', cat: 'gaming', url: (h) => `https://steamcommunity.com/id/${h}` },
    { id: 'roblox', name: 'Roblox', cat: 'gaming', url: (h) => `https://www.roblox.com/user.aspx?username=${h}` },
    { id: 'chesscom', name: 'Chess.com', cat: 'gaming', url: (h) => `https://www.chess.com/member/${h}` },
    { id: 'lichess', name: 'Lichess', cat: 'gaming', url: (h) => `https://lichess.org/@/${h}` },
    { id: 'speedrun', name: 'Speedrun.com', cat: 'gaming', url: (h) => `https://www.speedrun.com/users/${h}` },
    { id: 'duolingo', name: 'Duolingo', cat: 'gaming', url: (h) => `https://www.duolingo.com/profile/${h}` },

    // Money and selling
    { id: 'venmo', name: 'Venmo', cat: 'money', url: (h) => `https://account.venmo.com/u/${h}` },
    { id: 'cashapp', name: 'Cash App', cat: 'money', url: (h) => `https://cash.app/$${h}` },
    { id: 'patreon', name: 'Patreon', cat: 'money', url: (h) => `https://www.patreon.com/${h}` },
    { id: 'kofi', name: 'Ko-fi', cat: 'money', url: (h) => `https://ko-fi.com/${h}` },
    { id: 'buymeacoffee', name: 'Buy Me a Coffee', cat: 'money', url: (h) => `https://www.buymeacoffee.com/${h}` },
    { id: 'etsy', name: 'Etsy', cat: 'money', url: (h) => `https://www.etsy.com/people/${h}` },
    { id: 'ebay', name: 'eBay', cat: 'money', url: (h) => `https://www.ebay.com/usr/${h}` },
    { id: 'poshmark', name: 'Poshmark', cat: 'money', url: (h) => `https://poshmark.com/closet/${h}` },
    { id: 'depop', name: 'Depop', cat: 'money', url: (h) => `https://www.depop.com/${h}/` },
    { id: 'fiverr', name: 'Fiverr', cat: 'money', url: (h) => `https://www.fiverr.com/${h}` },
    { id: 'calendly', name: 'Calendly', cat: 'money', url: (h) => `https://calendly.com/${h}` },
  ];

  const platformCats = {
    social: 'Social',
    video: 'Video and streaming',
    creative: 'Photos and art',
    writing: 'Writing, reviews and fandom',
    music: 'Music and audio',
    dev: 'Developer',
    gaming: 'Gaming',
    money: 'Payments and selling',
  };

  // Formal name -> common short forms. Used both ways.
  const nicknames = {
    abigail: ['Abby'], alexander: ['Alex', 'Xander'], alexandra: ['Alex', 'Sasha', 'Lexi'], aleksandr: ['Alex', 'Sasha'],
    aleksander: ['Alex'], alexei: ['Alex', 'Lyosha'], aleksei: ['Alex', 'Lyosha'], andrew: ['Andy', 'Drew'], anthony: ['Tony'],
    barbara: ['Barb'], benjamin: ['Ben'], catherine: ['Cathy', 'Kate'], charles: ['Charlie', 'Chuck'], christina: ['Tina', 'Chris'],
    christine: ['Chris'], christopher: ['Chris'], cynthia: ['Cindy'], daniel: ['Dan', 'Danny'], david: ['Dave'],
    deborah: ['Deb', 'Debbie'], dmitri: ['Dima'], dmitry: ['Dima'], donald: ['Don'], dorothy: ['Dot'], edward: ['Ed', 'Eddie', 'Ted'],
    elizabeth: ['Liz', 'Beth', 'Lizzie', 'Betsy'], eleanor: ['Ellie', 'Nora'], emily: ['Em'], frederick: ['Fred'],
    gabriel: ['Gabe'], gregory: ['Greg'], harold: ['Hal'], henry: ['Hank'], isabella: ['Bella', 'Izzy'], jacob: ['Jake'],
    jacqueline: ['Jackie'], james: ['Jim', 'Jimmy', 'Jamie'], jennifer: ['Jen', 'Jenny'], jessica: ['Jess'], john: ['Jack'],
    jonathan: ['Jon'], joseph: ['Joe'], joshua: ['Josh'], katherine: ['Kate', 'Katie', 'Kathy'], kathryn: ['Kate', 'Katie'],
    kenneth: ['Ken'], kimberly: ['Kim'], lawrence: ['Larry'], leonard: ['Leo', 'Len'], madeline: ['Maddie'],
    margaret: ['Maggie', 'Meg', 'Peggy'], matthew: ['Matt'], michael: ['Mike'], mikhail: ['Misha'], natalie: ['Nat'],
    nathaniel: ['Nate', 'Nathan'], nicholas: ['Nick'], olivia: ['Liv'], pamela: ['Pam'], patricia: ['Pat', 'Patty', 'Trish'],
    patrick: ['Pat'], peter: ['Pete'], raymond: ['Ray'], rebecca: ['Becky'], richard: ['Rick', 'Rich'], robert: ['Rob', 'Bob', 'Bobby'],
    ronald: ['Ron'], samantha: ['Sam'], samuel: ['Sam'], sergei: ['Serezha'], stephen: ['Steve'], steven: ['Steve'], susan: ['Sue'],
    theodore: ['Ted', 'Teddy', 'Theo'], thomas: ['Tom', 'Tommy'], timothy: ['Tim'], victoria: ['Vicky', 'Tori'],
    vladimir: ['Vlad', 'Volodya'], walter: ['Walt'], william: ['Will', 'Bill', 'Billy'], zachary: ['Zach'],
  };

  const states = [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
    ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'],
    ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
    ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'],
    ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
    ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
    ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
    ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
    ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
    ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ];

  // Fixed links used across the app.
  const links = {
    drop: 'https://consumer.drop.privacy.ca.gov',
    dropInfo: 'https://privacy.ca.gov/drop/',
    resultsAboutYou: 'https://myactivity.google.com/results-about-you',
    googleRemoval: 'https://support.google.com/websearch/troubleshooter/9685456',
    bingConcern: 'https://www.microsoft.com/en-us/concern/bing',
    googleAlerts: 'https://www.google.com/alerts',
    hibp: 'https://haveibeenpwned.com/',
    hibpPasswords: 'https://haveibeenpwned.com/Passwords',
    mozillaMonitor: 'https://monitor.mozilla.org/',
    xon: 'https://xposedornot.com/',
    gravatar: 'https://gravatar.com/',
    lens: 'https://lens.google.com/',
    tineye: 'https://tineye.com/',
    bingVisual: 'https://www.bing.com/visualsearch',
    pimeyes: 'https://pimeyes.com/en/opt-out',
    facecheck: 'https://facecheck.id/en/RemoveMyPhotos',
    stopncii: 'https://stopncii.org/',
    takeitdown: 'https://takeitdown.ncmec.org/',
    techsafety: 'https://www.techsafety.org/',
    identitytheft: 'https://www.identitytheft.gov/',
    truecaller: 'https://www.truecaller.com/unlisting',
    syncme: 'https://sync.me/unsubscribe/',
    donotcall: 'https://www.donotcall.gov/',
    optoutprescreen: 'https://www.optoutprescreen.com/',
    dmachoice: 'https://www.dmachoice.org/',
    informed: 'https://informeddelivery.usps.com/',
    relay: 'https://relay.firefox.com/',
    simplelogin: 'https://simplelogin.io/',
    ddgEmail: 'https://duckduckgo.com/email/',
    youtubePrivacy: 'https://www.youtube.com/account_privacy',
    amazonProfile: 'https://www.amazon.com/gp/profile',
    strava: 'https://www.strava.com/settings/privacy',
    fbActivity: 'https://www.facebook.com/me/allactivity',
    fbTagging: 'https://www.facebook.com/settings?tab=profile_and_tagging',
    xTagging: 'https://x.com/settings/tagging',
    liMentions: 'https://www.linkedin.com/mypreferences/d/mentioned-by-others',
  };

  // Credit and identity protections (United States).
  const identity = [
    { id: 'freeze-equifax', group: 'Freeze your credit', title: 'Freeze your credit at Equifax', w: 3, mins: 10,
      href: 'https://www.equifax.com/personal/credit-report-services/credit-freeze/',
      sub: 'Free, and it blocks new accounts opened in your name. Lift it for a day when you apply for credit.' },
    { id: 'freeze-experian', group: 'Freeze your credit', title: 'Freeze your credit at Experian', w: 3, mins: 10,
      href: 'https://www.experian.com/help/credit-freeze/',
      sub: 'Each bureau is separate. A freeze at one does nothing at the other two.' },
    { id: 'freeze-transunion', group: 'Freeze your credit', title: 'Freeze your credit at TransUnion', w: 3, mins: 10,
      href: 'https://www.transunion.com/credit-freeze',
      sub: 'Save the PIN or account login. You need it to lift the freeze later.' },
    { id: 'freeze-innovis', group: 'Freeze your credit', title: 'Freeze at Innovis, the fourth bureau', w: 1, mins: 8,
      href: 'https://www.innovis.com/personal/securityFreeze',
      sub: 'Smaller bureau that some lenders still check.' },
    { id: 'freeze-chex', group: 'Freeze your credit', title: 'Freeze your ChexSystems report', w: 1, mins: 8,
      href: 'https://www.chexsystems.com/security-freeze/place-freeze',
      sub: 'Banks use it when someone opens a checking account. A freeze stops fraudulent bank accounts.' },
    { id: 'freeze-nctue', group: 'Freeze your credit', title: 'Freeze your NCTUE report', w: 1, mins: 8,
      href: 'https://nctue.com/consumer/',
      sub: 'Used by phone, utility and cable companies to open new service.' },
    { id: 'prescreen', group: 'Stop junk offers', title: 'Opt out of prescreened credit offers', w: 2, mins: 4,
      href: 'https://www.optoutprescreen.com/',
      sub: 'Stops the bureaus from selling your file for mailed credit-card offers, which thieves can intercept. Online opt-out lasts five years.' },
    { id: 'dmachoice', group: 'Stop junk offers', title: 'Cut marketing mail with DMAchoice', w: 1, mins: 5,
      href: 'https://www.dmachoice.org/',
      sub: 'Removes you from many direct-mail lists.' },
    { id: 'ippin', group: 'Claim your government accounts', title: 'Get an IRS Identity Protection PIN', w: 2, mins: 15,
      href: 'https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin',
      sub: 'Stops someone else from filing a tax return with your Social Security number.' },
    { id: 'ssa', group: 'Claim your government accounts', title: 'Create your my Social Security account', w: 2, mins: 15,
      href: 'https://www.ssa.gov/myaccount/',
      sub: 'Claiming it first stops a scammer from creating it in your name.' },
    { id: 'informed', group: 'Claim your government accounts', title: 'Claim USPS Informed Delivery for your address', w: 1, mins: 10,
      href: 'https://informeddelivery.usps.com/',
      sub: 'Shows scans of mail headed to you, and keeps a stranger from signing up for your address.' },
  ];

  // Account hygiene that applies anywhere in the world.
  const hygiene = [
    { id: 'mfa-email', group: 'Lock your accounts', title: 'Turn on two-step verification for your main email', w: 3, mins: 5,
      sub: 'Your email resets every other password. Use an authenticator app or passkey, not SMS, where you can.' },
    { id: 'password-manager', group: 'Lock your accounts', title: 'Move to a password manager with unique passwords', w: 2, mins: 30,
      sub: 'Breaches leak passwords. A unique password per site keeps one leak from opening the rest.' },
    { id: 'aliases', group: 'Lock your accounts', title: 'Use email aliases for new sign-ups', w: 1, mins: 5,
      links: [['Firefox Relay', 'https://relay.firefox.com/'], ['SimpleLogin', 'https://simplelogin.io/'], ['DuckDuckGo Email', 'https://duckduckgo.com/email/']],
      sub: 'A different address per site means a leak cannot be matched to your other accounts.' },
  ];

  return { exposes, brokers, platforms, platformCats, nicknames, states, links, identity, hygiene };
})();
