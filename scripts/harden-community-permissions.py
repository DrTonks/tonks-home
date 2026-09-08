"""Constrain only this community deployment's files. Run as root on the server.

Preview is the default. --apply records former modes in a private audit directory.
Symlinks, unexpected owners and paths outside the fixed deployment roots abort
before changes. No content is deleted, copied from the database, or published.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import stat


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run as root; no permissions changed.')
    roots = [
        (Path('/var/www/shared/emojis'), 0o755, 0o644),
        (Path('/var/backups/tonks-community-20260908'), 0o700, 0o600),
        (Path('/var/backups/tonks-rich-20260908-120749'), 0o700, 0o600),
    ]
    planned = []
    for root, directory_mode, file_mode in roots:
        if not root.is_dir() or root.is_symlink() or root.resolve() != root:
            raise SystemExit(f'Unexpected root: {root}')
        for path in [root, *root.rglob('*')]:
            info = path.lstat()
            if path.is_symlink() or not (stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)):
                raise SystemExit(f'Unexpected file type: {path}')
            if not path.resolve().is_relative_to(root) or info.st_uid != 0:
                raise SystemExit(f'Unexpected path or owner: {path}')
            planned.append((path, stat.S_IMODE(info.st_mode), directory_mode if path.is_dir() else file_mode))
    # The current PM2 Sleepy process runs as root. SQLite creates WAL/journals
    # with its database file mode; also tighten any existing sidecars.
    database = Path('/var/sleepy/community.sqlite3')
    if not database.is_file():
        raise SystemExit('Community database missing')
    for path in [database, *[Path(str(database) + suffix) for suffix in ['-wal', '-shm', '-journal']]]:
        if not path.exists():
            continue
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or path.resolve() != path:
            raise SystemExit(f'Unexpected database path or owner: {path}')
        planned.append((path, stat.S_IMODE(info.st_mode), 0o600))
    changes = [(p, old, new) for p, old, new in planned if old != new]
    print(json.dumps({'checked': len(planned), 'changes': len(changes), 'apply': args.apply}))
    if not args.apply:
        return
    audit = Path('/var/backups') / ('tonks-permissions-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f'))
    audit.mkdir(mode=0o700)
    record = audit / 'modes.json'
    with record.open('x', encoding='utf8') as output:
        os.chmod(record, 0o600)
        json.dump([{'path': str(p), 'old': oct(old), 'new': oct(new)} for p, old, new in changes], output)
    for path, old, new in changes:
        os.chmod(path, new, follow_symlinks=False)
    assert all(stat.S_IMODE(p.stat().st_mode) == new for p, _, new in planned)
    print(json.dumps({'applied': len(changes), 'audit': str(audit)}))


if __name__ == '__main__':
    main()
