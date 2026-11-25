import { useEffect, useRef, useState } from 'react';
import { Card, JumpNav, OnThisPage, PageHeader, PageShell, Pill, Section, cx } from '../ui';
import { externalLinks, sectionByKey } from '../../data/sections';
import { ToolCard, WhatsNew, sectionTones } from './ToolCards';
import { highlight } from '../bifrost/highlight.js';

const out = '↗︎';
const gh = 'https://github.com/Saorax';
const studioDownload = `${gh}/bifrost-app/releases/latest/download/BifrostStudio.exe`;

const toc = [
  { id: 'install', label: 'Install' },
  { id: 'files', label: 'Where files go' },
  { id: 'server', label: 'Host a server' },
  { id: 'service', label: 'Run as a service' },
  { id: 'updating', label: 'Updates and backups' },
  { id: 'settings', label: 'Server settings' },
  { id: 'discord', label: 'Discord sign-in' },
  { id: 'turn', label: 'Cloudflare TURN' },
  { id: 'tools', label: 'Mods and editors' },
  { id: 'repos', label: 'Repos and releases' },
];

const repos = [
  { key: 'bifrost-app', name: 'bifrost-app', href: `${gh}/bifrost-app`, releases: true, text: 'Bifrost Studio, the app that installs Bifrost or Official and can host a server.' },
  { key: 'bifrost', name: 'bifrost', href: `${gh}/bifrost`, releases: true, text: "Bifrost's own menus, online play, training and replay tools, and content mods." },
  { key: 'engine', name: 'bifrost, engine branch', href: `${gh}/bifrost/tree/engine`, text: 'The engine Bifrost runs on (HashLink + Heaps), the converter and the player kit the app downloads.', note: 'Releases are published from the bifrost repo.' },
  { key: 'bifrost-server', name: 'bifrost-server', href: `${gh}/bifrost-server`, text: 'The server: accounts, rooms, queues, the P2P relay, friends, clans, tournaments and leaderboards.', note: 'No releases of its own. Clone it with Git; each Bifrost release also has a server zip from the same build.' },
  { key: 'bh-client', name: 'bh-client', href: `${gh}/bh-client`, releases: true, text: 'Official: the modified client for the official servers.' },
];

const tasks = [
  { title: 'Add a mod someone shared', text: 'Drop the .bmod into the mods folder, or press Import .bmod on the Mods screen. Skins show up after a restart.', href: '/bifrost/mods#bmod', link: 'How to add a .bmod' },
  { title: 'Make a color scheme', text: 'Design it with Mods > COLOUR EDITOR in Bifrost or try it in the color creator, then add it to a mod.', href: '/bifrost/mods#catalogue', link: 'How color mods work' },
  { title: 'Change a move or a map', text: "Edit a move's numbers and hitboxes, or build a map, and download the result as a mod.", href: '/bifrost/move-editor', link: 'Open the Move Editor' },
];

const C = ({ children }) => <code className="rounded bg-slate-800 px-1 text-[0.92em] text-slate-100 [overflow-wrap:anywhere]">{children}</code>;
const A = ({ href, children }) => {
  const external = /^https?:/.test(href);
  return <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} className="font-bold text-blue-300 hover:underline">{children}{external && ` ${out}`}</a>;
};

function Code({ code, label, json = false }) {
  const [copied, setCopied] = useState('');
  const pre = useRef(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('Copied');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      setCopied('Selected');
    }
    window.setTimeout(() => setCopied(''), 1500);
  };
  return (
    <div className="min-w-0">
      {label && <div className="mb-1 text-xs font-bold text-slate-400 [overflow-wrap:anywhere]">{label}</div>}
      <div className="relative">
        <pre ref={pre} className="app-scrollbar overflow-x-auto rounded-xl bg-slate-950 py-2 pl-3 pr-16 text-[13px] leading-relaxed text-slate-200 ring-1 ring-slate-800">
          {json ? <code dangerouslySetInnerHTML={{ __html: highlight(code) }} /> : <code>{code}</code>}
        </pre>
        <button type="button" onClick={copy} className="absolute right-1.5 top-1.5 rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white">{copied || 'Copy'}</button>
      </div>
    </div>
  );
}

function Steps({ items, className = '' }) {
  return (
    <ol className={cx('grid gap-2', className)}>
      {items.map((step, index) => (
        <li key={step.title} className="flex min-w-0 gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-sm font-bold text-blue-200 ring-1 ring-blue-400/30">{index + 1}</span>
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="pt-0.5 font-bold text-white">{step.title}</h3>
            {step.body && <div className="max-w-prose space-y-1.5 text-sm text-slate-300">{step.body}</div>}
            {step.code}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Note({ tone = 'slate', title, children, className = '' }) {
  const tones = {
    slate: 'border-slate-700 bg-slate-950/60',
    amber: 'border-amber-400/30 bg-amber-500/10',
    emerald: 'border-emerald-400/30 bg-emerald-500/10',
  };
  return (
    <div className={cx('min-w-0 rounded-xl border p-2 text-sm text-slate-300', tones[tone], className)}>
      {title && <div className="mb-1 font-bold text-white">{title}</div>}
      <div className="max-w-prose space-y-1.5">{children}</div>
    </div>
  );
}

const installSteps = [
  {
    title: 'Download Bifrost Studio',
    body: <p>Get <C>BifrostStudio.exe</C> from the <A href={`${gh}/bifrost-app/releases/latest`}>latest bifrost-app release</A>. It's one file and runs without .NET installed.</p>,
  },
  {
    title: 'Run it',
    body: <p>It finds your Brawlhalla install, downloads the latest Bifrost release and installs it. The game is converted from your own copy on your PC: no game files are downloaded.</p>,
  },
  {
    title: 'Press Play in Steam',
    body: <p>Steam's game folder keeps a small <C>Brawlhalla.exe</C> launcher that starts Bifrost from its engine folder.</p>,
  },
  {
    title: 'First launch',
    body: (
      <>
        <p>Bifrost plays on <C>bifrost.saorax.com</C>. Sign in with Discord to keep levels, stats, friends and clans, or play as a guest.</p>
        <p>Options can import the official game's settings, key bindings and picks. Other servers go in Options &gt; SERVERS.</p>
      </>
    ),
  },
  {
    title: 'Updates',
    body: <p>When a new release is out, the app offers the update.</p>,
  },
];

const files = [
  ['%LOCALAPPDATA%\\Bifrost\\Engine', "The engine, its saves and Steam's own Brawlhalla.exe."],
  ['%LOCALAPPDATA%\\Bifrost\\Game', 'The copy of the game, when Bifrost is installed in its own folder.'],
  ['%LOCALAPPDATA%\\Bifrost\\Studio', "The app's settings."],
  ['%LOCALAPPDATA%\\Bifrost', 'Also the kit, downloads and the server the app hosts.'],
  ["Steam's Brawlhalla folder", "Only Bifrost's Brawlhalla.exe and, for now, the mods folder."],
];

const serverSteps = [
  {
    title: 'Install Python and Git',
    body: (
      <>
        <p>The version has to be 3.11 or newer.</p>
        <p>On Windows, install <A href="https://www.python.org/downloads/">Python</A> and <A href="https://git-scm.com/downloads">Git</A> from their sites and use <C>python</C> wherever these steps say <C>python3</C>.</p>
      </>
    ),
    code: <Code code={'sudo apt update\nsudo apt install python3 git\npython3 --version'} />,
  },
  {
    title: 'Download the server',
    body: <p>Run every command below from this folder.</p>,
    code: <Code code={'git clone https://github.com/Saorax/bifrost-server.git\ncd bifrost-server'} />,
  },
  {
    title: 'Make your settings file',
    body: <p>Open <C>config.local.json</C>, change <C>server_name</C> to your server's name and leave the rest for now. On Windows, copy the file in Explorer.</p>,
    code: <Code code="cp config.local.example.json config.local.json" />,
  },
  {
    title: 'Open the ports',
    body: (
      <>
        <p>7910 TCP (the game), 7910 UDP (the P2P relay) and 7911 TCP (mods, replays, tournaments and the sign-in page). With ufw:</p>
      </>
    ),
    code: (
      <>
        <Code code={'sudo ufw allow 7910/tcp\nsudo ufw allow 7910/udp\nsudo ufw allow 7911/tcp'} />
        <p className="max-w-prose text-sm text-slate-300">If your provider has its own firewall in its control panel (Hetzner and OVH do), open them there too. A domain on Cloudflare has to be DNS only (grey cloud): Cloudflare's proxy blocks these ports.</p>
      </>
    ),
  },
  {
    title: 'Start it',
    body: <p>The log should say <C>game connection on 0.0.0.0:7910</C>. From another network (your phone off Wi-Fi), open <C>http://&lt;your address&gt;:7911/info</C>: it should show your server's name.</p>,
    code: <Code code="python3 -m bh_server" />,
  },
  {
    title: 'Join it',
    body: <p>In Bifrost, add your address in Options &gt; SERVERS (an IP or a domain; add <C>:port</C> only if you changed 7910) and play a match. That address is what you give players.</p>,
  },
];

const serviceUnit = `[Unit]
Description=Bifrost server
After=network-online.target
Wants=network-online.target

[Service]
User=bifrost
WorkingDirectory=/opt/bifrost-server
ExecStart=/usr/bin/python3 -m bh_server
Restart=on-failure
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target`;

const settings = [
  ['server_name', 'The name players see.'],
  ['game_port, web_port, game_host, web_host', 'Where it listens: 7910 and 7911 on every address. Keep web_port one above game_port: the game looks for the tournament list there.'],
  ['public_url', "The sign-in page's address, as players' browsers reach it."],
  ['behind_proxy', 'true if a proxy answers public_url on the same port number as web_port.'],
  ['tls_cert, tls_key', 'A real certificate (full chain) and its key, to make the web port https. Reloaded when they change.'],
  ['tls', "true makes the web port https with the server's own certificate (browsers don't trust it)."],
  ['discord_client_id, discord_client_secret', 'Your Discord application, for sign-in.'],
  ['admin_discord_ids', 'Discord accounts allowed to use admin commands.'],
  ['mod_reviewer_discord_ids', 'Discord accounts that review shared mods.'],
  ['game_data', "The folder holding the game's Game/ and Init/ tables."],
  ['relay', 'inprocess (the built-in P2P relay) or native, with relay_native set to the relay program.'],
  ['turn', 'off (default) or cloudflare.'],
  ['turn_key_id, turn_api_token', "Your Cloudflare TURN key's ID and API token."],
  ['turn_ttl', 'How long each TURN login lasts, in seconds (default 7200, at most 172800).'],
  ['cups', 'true turns on Cups (double elimination brackets of 8).'],
  ['ask_region', "true opens the region picker at login for players who don't have one yet."],
  ['client_theme', "The menu theme every game gets: a ClientThemeName from the game's ClientThemeTypes table (Halloween, Anniversary, Shrek...) or its id, or auto (default), which shows the Default theme. The console's theme command changes it until a restart, and players can still pick their own in Options."],
];

const discordSteps = [
  { title: 'Make a Discord application', body: <p>In the <A href="https://discord.com/developers/applications">Discord Developer Portal</A>.</p> },
  { title: 'Add its ID and secret', body: <p>Put them in <C>config.local.json</C> as <C>discord_client_id</C> and <C>discord_client_secret</C>. Use your own app's ID: the one in <C>config.json</C> is the Bifrost project's app. Never put the secret in <C>config.json</C>.</p> },
  { title: 'Set public_url', body: <p>The address players' browsers use for your sign-in page. Pick one of the four ways below.</p> },
  { title: 'Add the redirect', body: <p>In the app's OAuth2 &gt; Redirects, add <C>&lt;public_url&gt;/callback</C>. The server prints the exact URL when it starts.</p> },
  { title: 'Make yourself admin', body: <p>Put your own Discord ID in <C>admin_discord_ids</C> to use the admin commands in game.</p> },
  { title: 'Restart the server', body: <p>The log shows the redirect it expects, or <C>DISCORD SIGN-IN IS OFF</C> and why.</p> },
];

const httpsOptions = [
  {
    title: 'Plain http',
    body: <p>Like <C>http://play.example.com:7911</C>. Fine for an IP address or a normal domain, but not for <C>.app</C>, <C>.dev</C>, <C>.page</C> and a few others, which browsers always open over https (<C>ERR_SSL_PROTOCOL_ERROR</C>).</p>,
  },
  {
    title: 'Certificate on the server',
    body: <p>Port 7911 speaks https. With Let's Encrypt: stop anything using port 80, open it, and run this (change the domain, folder and user). The hook copies the certificate into <C>data/</C> now and after every renewal; the server picks up renewed files within a minute. Keep port 80 open for renewals.</p>,
    code: (
      <>
        <Code code={'sudo certbot certonly --standalone -d play.example.com --deploy-hook \'install -o bifrost -m 600 "$RENEWED_LINEAGE"/fullchain.pem "$RENEWED_LINEAGE"/privkey.pem /opt/bifrost-server/data/\''} />
        <Code label="config.local.json" json code={'"tls_cert": "data/fullchain.pem",\n"tls_key": "data/privkey.pem",\n"public_url": "https://play.example.com:7911"'} />
      </>
    ),
  },
  {
    title: 'Reverse proxy on 443',
    body: <p>With <A href="https://caddyserver.com/">Caddy</A> this is the whole config. Set <C>public_url</C> to <C>https://play.example.com</C> with no port and open 80 and 443. Keep 7910 and 7911 open: the game still connects to them directly.</p>,
    code: <Code label="Caddyfile" code={'play.example.com {\n    reverse_proxy 127.0.0.1:7911\n}'} />,
  },
  {
    title: 'Cloudflare Tunnel',
    body: <p>If your domain is on Cloudflare and you'd rather not open ports: run <C>cloudflared</C> on the server with its own hostname, like <C>login.example.com</C>, pointing at <C>http://localhost:7911</C>, and set <C>public_url</C> to <C>https://login.example.com</C>. Players still use the DNS-only name as the server address.</p>,
  },
];

const releaseCacheKey = 'bifrost-latest-releases';

function useLatestReleases(names) {
  const [releases, setReleases] = useState({});
  const key = names.join('|');
  useEffect(() => {
    let cancelled = false;
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(releaseCacheKey) || 'null');
      if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
        setReleases(cached.data);
        return undefined;
      }
    } catch {
      setReleases({});
    }
    Promise.all(names.map((name) => fetch(`https://api.github.com/repos/Saorax/${name}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data?.tag_name ? [name, { name: data.name || data.tag_name, date: data.published_at, url: data.html_url }] : null))
      .catch(() => null)))
      .then((rows) => {
        if (cancelled) return;
        const data = Object.fromEntries(rows.filter(Boolean));
        setReleases(data);
        if (Object.keys(data).length) {
          try {
            window.sessionStorage.setItem(releaseCacheKey, JSON.stringify({ at: Date.now(), data }));
          } catch {
            setReleases(data);
          }
        }
      });
    return () => { cancelled = true; };
  }, [key]);
  return releases;
}

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

function RepoCard({ repo, release }) {
  const button = 'rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white';
  return (
    <Card as="li" className="flex h-full min-w-0 flex-col gap-1.5">
      <a href={repo.href} target="_blank" rel="noreferrer" className="font-bold text-white [overflow-wrap:anywhere] hover:text-blue-200 hover:underline">{repo.name}</a>
      <p className="text-sm text-slate-400">{repo.text}</p>
      <div className="text-xs text-slate-400">
        {repo.releases && release && (
          <a href={release.url} target="_blank" rel="noreferrer" className="block hover:text-white">
            <span className="block font-bold text-slate-200 [overflow-wrap:anywhere]">{release.name}</span>
            <span className="block">{formatDate(release.date)}</span>
          </a>
        )}
        {repo.note && <p>{repo.note}</p>}
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <a href={repo.href} target="_blank" rel="noreferrer" className={button}>{`GitHub ${out}`}</a>
        {repo.releases && <a href={`${repo.href}/releases`} target="_blank" rel="noreferrer" className={button}>{`Releases ${out}`}</a>}
      </div>
    </Card>
  );
}

export default function BifrostHub() {
  const bifrost = sectionByKey('bifrost');
  const releases = useLatestReleases(repos.filter((repo) => repo.releases).map((repo) => repo.key));
  const app = releases['bifrost-app'];
  return (
    <PageShell
      aside={(
        <>
          <OnThisPage items={toc} className="hidden xl:block" />
          <WhatsNew area="Bifrost" limit={4} />
        </>
      )}
    >
      <PageHeader
        title="Bifrost"
        actions={(
          <div className="flex flex-wrap gap-2">
            <a href={studioDownload} className="rounded-xl border border-violet-400 bg-violet-500/80 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500">Download Bifrost Studio</a>
            <a href={`${gh}/bifrost`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-200 hover:border-slate-500 hover:text-white">{`Bifrost on GitHub ${out}`}</a>
          </div>
        )}
      >
        <div className="max-w-prose space-y-2 text-base text-slate-200">
          <p>A modded Brawlhalla client. It runs the game on a new engine (HashLink + Heaps instead of Adobe AIR) and plays on its own servers: custom rooms, casual and ranked queues with rollback netcode, friends, clans and tournaments. It adds training and replay tools, and loads content mods. Everything is unlocked and nothing is sold.</p>
          <p className="text-sm text-slate-400">The Bifrost app converts your own copy of the game on your PC. The repos have no game code, art or files.</p>
          {app && <p className="text-xs text-slate-400">Latest: <a href={app.url} target="_blank" rel="noreferrer" className="font-bold text-slate-200 hover:text-white hover:underline">{app.name}</a>, {formatDate(app.date)}</p>}
        </div>
        <JumpNav label="On this page" items={toc} className="xl:hidden" />
      </PageHeader>

      <Section id="install" title="Install" headingAs="h2" tone="violet">
        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <Steps items={installSteps} className="md:grid-cols-2 min-[112.5rem]:grid-cols-3" />
          <div className="grid content-start gap-2 md:grid-cols-2 2xl:grid-cols-1">
            <Note title="You need">
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Windows (Linux and macOS builds are untested)</li>
                <li>Brawlhalla installed on the same PC</li>
                <li>Python 3.11 or newer, only to host a server from the app</li>
              </ul>
            </Note>
            <Note tone="amber" title="Official servers">
              <p>Bifrost never contacts the official online services. The app can also install Official, a modified client for the official servers: using it can get your account banned by Ubisoft, either when BMG sees it in screenshots, videos or streams, or if the game starts detecting it (there was no detection as of Oct 31, 2026).</p>
            </Note>
          </div>
        </div>
      </Section>

      <Section id="files" title="Where files go" headingAs="h2">
        <dl className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3 min-[137.5rem]:grid-cols-5">
          {files.map(([path, text]) => (
            <Card key={path} className="min-w-0">
              <dt className="font-mono text-sm font-bold text-slate-100 [overflow-wrap:anywhere]">{path}</dt>
              <dd className="mt-0.5 text-sm text-slate-400">{text}</dd>
            </Card>
          ))}
        </dl>
      </Section>

      <Section id="server" title="Host a server" headingAs="h2" tone="blue">
        <div className="grid gap-2 lg:grid-cols-2">
          <Note title="From the app">
            <p>The Server tab in Bifrost Studio runs a copy of the server on your own PC. It needs Python 3.11 or newer.</p>
          </Note>
          <Note title="On a VPS">
            <p>These steps are for Linux (Ubuntu or Debian). Windows works the same way; the differences are noted. The server is Python 3.11+ with only the standard library.</p>
          </Note>
        </div>
        <Steps items={serverSteps} className="lg:grid-cols-2 min-[112.5rem]:grid-cols-3" />
        <Note tone="emerald" title="The server works now">
          <p>Everyone plays as a guest until you set up <A href="#discord">Discord sign-in</A>. Also optional: <A href="#settings">game tables</A> for missions, achievements, the battle pass and timed events, and <A href="#service">running it as a service</A>.</p>
        </Note>
      </Section>

      <div className="grid gap-3 min-[112.5rem]:grid-cols-2">
        <Section id="service" title="Run as a service" headingAs="h2" className="min-w-0">
          <p className="max-w-prose text-sm text-slate-300">On Linux, systemd brings it back after a crash or reboot. Put this in <C>/etc/systemd/system/bifrost-server.service</C>, changing the user and folder:</p>
          <Code label="bifrost-server.service" code={serviceUnit} />
          <Code code="sudo systemctl enable --now bifrost-server" />
          <div className="max-w-prose space-y-1.5 text-sm text-slate-300">
            <p><C>KillSignal=SIGINT</C> lets it warn players before it stops. The log is in <C>data/server-log.txt</C>.</p>
            <p>A service has no admin console. Use <C>tmux</C> or <C>screen</C> if you want it. On Windows, leave it running in a console window.</p>
            <p>The console lists its commands when it starts (<C>say</C>, <C>who</C>, <C>kick</C>, <C>ban</C>, <C>mods</C>, <C>backup</C>...) and again for any command it doesn't know.</p>
          </div>
        </Section>

        <Section id="updating" title="Updates and backups" headingAs="h2" className="min-w-0">
          <p className="max-w-prose text-sm text-slate-300">Stop the server, pull, start it again. <C>config.local.json</C> and <C>data/</C> aren't touched.</p>
          <Code code={'sudo systemctl stop bifrost-server\ngit pull\nsudo systemctl start bifrost-server'} />
          <p className="max-w-prose text-sm text-slate-300">Without a service, stop it in its console, then <C>git pull</C> and <C>python3 -m bh_server</C>.</p>
          <p className="max-w-prose text-sm text-slate-300">Everything the server keeps is in <C>data/</C>: <C>accounts.sqlite</C>, the log, backups, replays, shared mods and bug reports. Back up that folder.</p>
        </Section>
      </div>

      <Section id="settings" title="Server settings" headingAs="h2">
        <p className="max-w-prose text-sm text-slate-300"><C>config.json</C> holds the shared defaults. Your own settings go in <C>config.local.json</C> (not in Git), which overrides it.</p>
        <dl className="grid gap-x-4 xl:grid-cols-2">
          {settings.map(([name, text]) => (
            <div key={name} className="grid gap-0.5 border-b border-slate-800 py-1.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-3">
              <dt className="font-mono text-sm font-bold text-slate-100 [overflow-wrap:anywhere]">{name}</dt>
              <dd className="text-sm text-slate-300">{text}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-2 lg:grid-cols-2">
          <Note title="Environment variables">
            <p>These override both files: <C>BH_DISCORD_CLIENT_SECRET</C>, <C>BH_PUBLIC_URL</C>, <C>BH_GAME_DATA</C>, <C>BH_RELAY_SECRET</C> for the native relay, and <C>BH_TURN_KEY_ID</C> and <C>BH_TURN_API_TOKEN</C> for TURN.</p>
          </Note>
          <Note title="Game tables">
            <p>Daily missions, achievements, the battle pass, timed events, tournament map pools, default skins and menu themes read the game's own XML tables. They're inside <C>Game.swz</C> and <C>Init.swz</C> in your Brawlhalla install and are never in the repo.</p>
            <p>Extract both (the repo has no extractor) and put the <C>Game/</C> and <C>Init/</C> folders in <C>data/game/</C>, or point <C>game_data</C> at the folder that holds them. Without them the server still runs and those features stay empty.</p>
          </Note>
        </div>
      </Section>

      <Section id="discord" title="Discord sign-in" headingAs="h2">
        <Note>
          <p>Optional. Guests can use custom rooms, the queues and matches, and each game keeps its own guest name and settings. Levels and stats, friends, clans, tournaments, uploading mods, the save kept on the server and a whitelist all need Discord. A signed-in account has one player, the same on any PC.</p>
        </Note>
        <Steps items={discordSteps} className="md:grid-cols-2 2xl:grid-cols-3" />
        <h3 className="pt-1 font-bold text-white">The sign-in page</h3>
        <p className="max-w-prose text-sm text-slate-300">Discord sends the player back to <C>&lt;public_url&gt;/callback</C>, and that page asks for the 4-digit code shown in the game. Port 7911 is plain http unless you give it a certificate, so pick one:</p>
        <ol className="grid gap-2 lg:grid-cols-2 min-[112.5rem]:grid-cols-4">
          {httpsOptions.map((option) => (
            <Card as="li" key={option.title} className="min-w-0 space-y-2">
              <h4 className="font-bold text-white">{option.title}</h4>
              <div className="max-w-prose text-sm text-slate-300">{option.body}</div>
              {option.code}
            </Card>
          ))}
        </ol>
        <Note tone="amber">
          <p>Don't use <C>https://</C> with port 7911 without <C>tls_cert</C> and <C>tls_key</C>: the browser fails with <C>ERR_SSL_PROTOCOL_ERROR</C>. The server catches this at start: the log says <C>DISCORD SIGN-IN IS OFF</C> and players who try to log in are told the server is set up wrong.</p>
        </Note>
      </Section>

      <Section id="turn" title="Cloudflare TURN" headingAs="h2">
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="max-w-prose space-y-1.5 text-sm text-slate-300">
            <p>Optional. Players who aren't friends play through a relay so they never see each other's IP. The built-in relay runs on your server, so two players far from it get a high ping.</p>
            <p>With <C>"turn": "cloudflare"</C>, each player relays through the <A href="https://developers.cloudflare.com/realtime/turn/">Cloudflare TURN</A> location nearest them, and players still only see Cloudflare's addresses. Players or networks that can't reach Cloudflare, and older Bifrost builds, keep using your server's relay.</p>
            <p>Cloudflare charges for the traffic it sends to players after a free amount each month, and it sees the IPs of the players it relays.</p>
          </div>
          <Steps
            items={[
              { title: 'Create a TURN key', body: <p>In the Cloudflare dashboard (Realtime TURN). Copy its key ID and API token.</p> },
              { title: 'Turn it on', body: <p>Put them in <C>config.local.json</C> (<C>turn_key_id</C>, <C>turn_api_token</C>) or in <C>BH_TURN_KEY_ID</C> and <C>BH_TURN_API_TOKEN</C>, set <C>"turn": "cloudflare"</C> and restart. The log says <C>turn: Cloudflare TURN on</C>.</p> },
            ]}
            className="content-start"
          />
        </div>
      </Section>

      <Section id="tools" title="Mods and editors" headingAs="h2" tone="violet">
        <div className="grid gap-2 md:grid-cols-3">
          {bifrost.tools.map((tool) => <ToolCard key={tool.href} tool={tool} tone={sectionTones.bifrost} size="large" />)}
        </div>
        <div className="grid gap-2 min-[112.5rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid gap-2 md:grid-cols-3">
          {tasks.map((task) => (
            <a key={task.title} href={task.href} className="group flex h-full flex-col rounded-xl border border-slate-700 bg-slate-950/60 p-2 transition hover:border-slate-500">
              <span className="font-bold text-white">{task.title}</span>
              <span className="mt-0.5 text-sm text-slate-400">{task.text}</span>
              <span className="mt-auto pt-2 text-xs font-bold text-blue-300 group-hover:underline">{task.link} →</span>
            </a>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2">
            <div className="flex flex-col items-start gap-1 font-bold text-white">Visual mods <Pill tone="emerald">Fine anywhere</Pill></div>
            <p className="mt-1 text-sm text-slate-300">Skins, colors, avatars, emotes, map art, music and sounds. Other players see your item only if they have the mod too.</p>
          </div>
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2">
            <div className="flex flex-col items-start gap-1 font-bold text-white">Gameplay mods <Pill tone="amber">Custom rooms only</Pill></div>
            <p className="mt-1 text-sm text-slate-300">Legends, stats, moves, game modes and maps. Blocked in casual and ranked; everyone in the room needs the same mods.</p>
          </div>
        </div>
        </div>
      </Section>

      <Section id="repos" title="Repos and releases" headingAs="h2">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 min-[112.5rem]:grid-cols-5">
          {repos.map((repo) => <RepoCard key={repo.key} repo={repo} release={releases[repo.key]} />)}
        </ul>
      </Section>
    </PageShell>
  );
}
