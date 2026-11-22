# Unlisted

A free self-audit of your own online exposure. Enter a few details about
yourself and Unlisted builds a personal checklist of every place they tend to
surface, with the search, opt-out or settings link for each one, and tracks
your progress as you remove them.

From a name, a city, one email, one username and one phone number it builds
roughly 340 checks across nine areas:

| Area | What it covers |
| --- | --- |
| People-search sites | 31 brokers (Whitepages, Spokeo, BeenVerified, the PeopleConnect family, FastPeopleSearch, Acxiom, LexisNexis and more) with a pre-filled search and the opt-out link for each. California residents also get the state's one-request DROP deletion. |
| Search engines | Ready-made Google, Bing and DuckDuckGo searches for your name, name variants (nicknames, middle initial, previous names), documents, obituaries, court notices, emails, leaks and usernames. |
| Accounts and usernames | Your usernames, plus ones derived from your email addresses, checked against 80 platforms, with delete-account links where they exist. |
| Tags and mentions | Posts you're tagged in on Instagram, Facebook, X, TikTok, Threads and Reddit, the settings that make you approve tags first, and apps that leak your location (Snap Map, Strava, Venmo and more). |
| Breaches and passwords | A live breach scan per email (XposedOrNot), a Gravatar check, and a k-anonymous Pwned Passwords check. |
| Phone number | Searches for every format of your number, caller-ID app removal, and carrier SIM-swap locks. |
| Home and maps | Property and voter-record privacy, Address Confidentiality Programs, Street View and Apple Maps blurring. |
| Photos and faces | A local scanner that finds GPS coordinates hidden in your photos and saves a clean copy, reverse image search, and face-search opt-outs. |
| Identity lockdown | Credit freezes at all six bureaus, prescreened-offer opt-out, IRS IP PIN, and other account claims. |

It also writes CCPA, GDPR and general US deletion letters and follow-ups filled
in with your details. The overview ranks what to do next, flags opt-outs to
chase after 14 days and listings to re-check after 90, and shows a map of
which details are confirmed exposed.

## Privacy model

- No server, no accounts, no analytics. Your details and progress live in
  `localStorage` in your browser. **Backup → Erase everything** wipes them.
- Unlisted has no database of people and never scrapes anything. Search and
  opt-out links open the third-party site directly in a new tab.
- The only outside calls happen when you click a button:
  - **Scan for breaches** sends that one email to `api.xposedornot.com` and
    its SHA-256 hash to `gravatar.com`.
  - **Check a password** sends only the first 5 characters of its SHA-1 hash
    to `api.pwnedpasswords.com`, with padding, and compares the results locally.
- Photos are read on your device and never uploaded.

It is built for auditing yourself, or a family member who asked for help.
Opt-out forms make the person listed confirm by email or phone.

## Run it

It is a static site with no build step:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly also works,
but some browsers disable storage and hashing on `file://` pages. To host it,
turn on GitHub Pages for this repository (Settings → Pages → deploy from the
branch root).

## Files

- `index.html`: page shell and intake form
- `styles.css`: design tokens (light and dark) and all styling
- `data.js`: the catalog of brokers, platforms, removal links and nicknames
- `app.js`: check generation, scoring, scanners, letters and rendering

Opt-out links were checked in November 2026. Brokers change their forms
often, so if a link breaks, update it in `data.js`. Not legal advice.
