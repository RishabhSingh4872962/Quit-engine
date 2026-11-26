# Rooms: moderation and admin

Rooms live in the Realtime Database `quit-engine-app-default-rtdb` (asia-southeast1). Admin commands use
the Firebase CLI with your login (they bypass the security rules). Shortcut used below:

```sh
DB="--project quit-engine-app --instance quit-engine-app-default-rtdb"
```

## Reports

People can report a nickname or a custom room name from inside a room. Reports land in `/reports`:

```sh
npx firebase-tools database:get /reports $DB --pretty
```

Each report has `by` (reporter's id), `room` (room id), `uid` (reported person, for nicknames), `why`
(`name` | `nick` | `spam` | `other`) and `at` (time). Look at what was reported:

```sh
npx firebase-tools database:get /profiles/<uid> $DB --pretty     # a nickname
npx firebase-tools database:get /rooms/<roomId> $DB --pretty     # a public room
npx firebase-tools database:get /hidden/<roomId> $DB --pretty    # an invite-only room
```

## Actions

- **Block a person from rooms** (they can still delete their own data):
  `npx firebase-tools database:set /bans/<uid> --data true $DB`
- **Remove a nickname**: write `{"profiles/<uid>": null, "nicks/<nickname in lowercase>": null}` to a file,
  then `npx firebase-tools database:update / remove.json $DB`
- **Remove a room**: `{"rooms/<id>": null, "owned/<ownerUid>/<slot>": null}` (invite-only rooms:
  `hidden/<id>` instead of `rooms/<id>`, plus `"codes/<code>": null`), then `database:update /` as above.
- **Close a report**: `npx firebase-tools database:remove /reports/<reportId> $DB`

Check reports at least every few days, and quickly when the app grows. The room rules people agree to
are in `hosting/rules.html`.

## Official rooms

The study, silent and people rooms are in `scripts/rooms.json`. After editing it:

```sh
npx firebase-tools database:update /rooms scripts/rooms.json $DB
```

All shared timers count from midnight IST (1 Jan 2026), so 25/5 rooms start rounds at :00 and :30 and
50/10 rooms on the hour.

## Security rules

`database.rules.json`, tested by `scripts/test-db-rules.mjs` against the local emulator (needs Java 21+):

```sh
JAVA_HOME=/usr/lib/jvm/java-25-openjdk-amd64 PATH=/usr/lib/jvm/java-25-openjdk-amd64/bin:$PATH \
  npx -y firebase-tools@latest emulators:exec --only database --project quit-engine-app "node scripts/test-db-rules.mjs"
npx firebase-tools deploy --only database --project quit-engine-app
```

## Plan limits

On the free Spark plan the database allows **100 simultaneous connections** for the whole app. Phones only
connect while the app is open (they disconnect in the background), but before a public launch move to
the Blaze plan (free quotas still apply) to lift this to 200,000.
